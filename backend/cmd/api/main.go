// Package main provides the entrypoint for the centralized Ecom Ventures API layer.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"ecom-ventures/backend/internal/config"
	"ecom-ventures/backend/internal/middleware"
	platformAccounts "ecom-ventures/backend/internal/platform/accounts"
	platformAuth "ecom-ventures/backend/internal/platform/auth"
	"ecom-ventures/backend/internal/platform/database"
	"ecom-ventures/backend/internal/platform/domains"
	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/provisioner"
	platformStorage "ecom-ventures/backend/internal/platform/storage_mgmt"
	"ecom-ventures/backend/internal/platform/store_mgmt"
	platformSystem "ecom-ventures/backend/internal/platform/system"
	"ecom-ventures/backend/internal/platform/themes"
	"ecom-ventures/backend/internal/security"
	storeAccounts "ecom-ventures/backend/internal/store/accounts"
	storeAuth "ecom-ventures/backend/internal/store/auth"
	"ecom-ventures/backend/internal/store/blog"
	"ecom-ventures/backend/internal/store/catalog"
	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/internal/store/customers"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/internal/store/inventory"
	"ecom-ventures/backend/internal/store/logistics"
	"ecom-ventures/backend/internal/store/marketing"
	"ecom-ventures/backend/internal/store/music"
	"ecom-ventures/backend/internal/store/orders"
	"ecom-ventures/backend/internal/store/payments"
	"ecom-ventures/backend/internal/store/promotions"
	"ecom-ventures/backend/internal/store/resolver"
	"ecom-ventures/backend/internal/store/reviews"
	"ecom-ventures/backend/internal/store/settings"
	"ecom-ventures/backend/internal/store/shipping"
	"ecom-ventures/backend/internal/store/tasks"
	storefrontCart "ecom-ventures/backend/internal/storefront/cart"
	storefrontCatalog "ecom-ventures/backend/internal/storefront/catalog"
	storefrontCheckout "ecom-ventures/backend/internal/storefront/checkout"
	"ecom-ventures/backend/internal/worker"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/hasher"
	"ecom-ventures/backend/pkg/response"
	"ecom-ventures/backend/pkg/storage"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
)

func buildRouter(
	cfg *config.Config,
	logger *slog.Logger,
	res *resolver.StoreResolver,
	tm *pkgAuth.TokenManager,
	pAuthHandler *platformAuth.Handler,
	sAuthHandler *storeAuth.Handler,
	storeMgmtHandler *store_mgmt.Handler,
	domainHandler *domains.Handler,
	themeHandler *themes.Handler,
	catalogHandler *catalog.Handler,
	variantsHandler *catalog.VariantsHandler,
	inventoryHandler *inventory.Handler,
	ordersHandler *orders.Handler,
	customersHandler *customers.Handler,
	promotionsHandler *promotions.Handler,
	settingsHandler *settings.Handler,
	storefrontCatalogHandler *storefrontCatalog.Handler,
	storefrontCartHandler *storefrontCart.Handler,
	storefrontCheckoutHandler *storefrontCheckout.Handler,
	paymentHandler *payments.Handler,
	logisticsHandler *logistics.Handler,
	marketingHandler *marketing.Handler,
	securityHandler *security.Handler,
	systemHandler *platformSystem.Handler,
	pAccountsHandler *platformAccounts.Handler,
	sAccountsHandler *storeAccounts.Handler,
	rateLimiter *middleware.RateLimiter,
	reviewsHandler *reviews.Handler,
	blogHandler *blog.Handler,
	shippingHandler *shipping.Handler,
	extraHandlers ...interface{},
) http.Handler {
	var musicHandler *music.Handler
	var tasksHandler *tasks.Handler
	var platformSessions middleware.PlatformSessionChecker
	var storageHandler *platformStorage.Handler

	for _, h := range extraHandlers {
		if h == nil {
			continue
		}
		switch v := h.(type) {
		case *music.Handler:
			musicHandler = v
		case *tasks.Handler:
			tasksHandler = v
		case middleware.PlatformSessionChecker:
			platformSessions = v
		case *platformStorage.Handler:
			storageHandler = v
		}
	}
	r := chi.NewRouter()

	// Global Core Middleware Chain
	r.Use(middleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(middleware.StructuredLogger(logger))
	r.Use(chiMiddleware.Compress(5))
	r.Use(middleware.Recoverer(logger))
	r.Use(middleware.CORSConfig(cfg.Routing.MasterAdminDomain, cfg.Routing.StoreAdminDomain, cfg.IsDevelopment()))
	r.Use(chiMiddleware.Timeout(60 * time.Second))

	// Static file serving for local asset storage uploads
	uploadsDir := "./uploads"
	_ = os.MkdirAll(uploadsDir, 0755)
	fileServer := http.FileServer(http.Dir(uploadsDir))
	r.Handle("/uploads/*", http.StripPrefix("/uploads", fileServer))

	// Base System Health Probes
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		response.JSON(w, http.StatusOK, map[string]interface{}{
			"status":      "healthy",
			"environment": cfg.AppEnv,
			"service":     "ecom-ventures-backend",
			"version":     "1.0.0",
			"timestamp":   time.Now().UTC(),
		})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			response.JSON(w, http.StatusOK, map[string]interface{}{
				"status":      "healthy",
				"api_version": "v1",
			})
		})

		// 1. Platform Master Admin API Group
		r.Route("/platform", func(r chi.Router) {
			// Public Platform Auth Routes
			r.Route("/auth", func(r chi.Router) {
				if pAuthHandler != nil {
					r.Post("/login", pAuthHandler.Login)
					r.Post("/refresh", pAuthHandler.Refresh)
					if tm != nil {
						r.With(middleware.Authenticate(tm)).Post("/logout", pAuthHandler.Logout)
					}
				}
			})

			// Protected Platform Routes
			r.Group(func(r chi.Router) {
				if tm != nil {
					r.Use(middleware.Authenticate(tm))
					if platformSessions != nil {
						r.Use(middleware.RequireActivePlatformSession(platformSessions))
					}
				}
				r.Use(middleware.RequirePlatformRole(models.RoleSuperAdmin, models.RolePlatformStaff))

				r.Get("/me", func(w http.ResponseWriter, r *http.Request) {
					claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
					if !ok || claims == nil {
						response.Unauthorized(w, r, "invalid session claims")
						return
					}
					response.JSON(w, http.StatusOK, claims)
				})

				// Store Creator & Management Engine
				if storeMgmtHandler != nil || themeHandler != nil {
					r.Route("/stores", func(r chi.Router) {
						if storeMgmtHandler != nil {
							r.Get("/", storeMgmtHandler.List)
							r.Post("/", storeMgmtHandler.Create)
							r.Get("/{id}", storeMgmtHandler.GetByID)
							r.Patch("/{id}", storeMgmtHandler.Update)
							r.Patch("/{id}/status", storeMgmtHandler.UpdateStatus)
							r.Delete("/{id}", storeMgmtHandler.Delete)
							r.Get("/{id}/provisioning-logs", storeMgmtHandler.GetLogs)
						}
						if themeHandler != nil {
							r.Put("/{id}/theme", themeHandler.Assign)
						}
					})
				}

				// Domain Network & Verification Management
				if domainHandler != nil {
					r.Route("/domains", func(r chi.Router) {
						r.Get("/", domainHandler.ListAll)
						r.Post("/", domainHandler.AddDomain)
						r.Post("/{id}/verify", domainHandler.Verify)
						r.Patch("/{id}/primary", domainHandler.SetPrimary)
						r.Patch("/{id}", domainHandler.Update)
						r.Delete("/{id}", domainHandler.Delete)
					})
				}

				// Theme Registry & Management Engine
				if themeHandler != nil {
					r.Route("/themes", func(r chi.Router) {
						r.Get("/", themeHandler.List)
						r.Post("/", themeHandler.Register)
						r.Patch("/{id}", themeHandler.Update)
					})
				}

				// Phase 29: Security Audits & Compliance
				if securityHandler != nil {
					r.Route("/security", func(secR chi.Router) {
						secR.Use(middleware.RequirePlatformRole(models.RoleSuperAdmin))
						secR.Get("/audit", securityHandler.GetSecurityAuditReport)
					})
				}

				// Platform Staff, Audit Logs & Cluster Overview
				if systemHandler != nil {
					r.Route("/admins", func(adminR chi.Router) {
						adminR.Get("/", systemHandler.ListAdmins)
						adminR.Post("/", systemHandler.CreateAdmin)
						adminR.With(middleware.RequirePlatformRole(models.RoleSuperAdmin)).Patch("/{id}", systemHandler.UpdateAdmin)
						adminR.With(middleware.RequirePlatformRole(models.RoleSuperAdmin)).Delete("/{id}", systemHandler.DeleteAdmin)
					})
					r.Get("/audit-logs", systemHandler.ListAuditLogs)
					r.Get("/system/overview", systemHandler.GetClusterOverview)
				}

				// Platform Accounts & Brand Billing Subsystem
				if pAccountsHandler != nil {
					r.Route("/accounts", func(accR chi.Router) {
						accR.Get("/overview", pAccountsHandler.GetOverview)
						accR.Get("/leaderboard", pAccountsHandler.GetLeaderboard)
						accR.Get("/billing", pAccountsHandler.ListBilling)
						accR.Patch("/billing/{id}/status", pAccountsHandler.UpdateBillingStatus)
						accR.Get("/gateways", pAccountsHandler.GetGateways)
					})
				}

				// Platform Cloudflare R2 & Object Storage Subsystem
				if storageHandler != nil {
					r.Route("/storage", func(stR chi.Router) {
						stR.Get("/settings", storageHandler.GetSettings)
						stR.Put("/settings", storageHandler.UpdateSettings)
						stR.Post("/test", storageHandler.TestConnection)
						stR.Post("/reset", storageHandler.ResetToLocal)
						stR.Post("/upload-test", storageHandler.UploadTestAsset)
					})
					r.Post("/media/upload", storageHandler.UploadPlatformMedia)
				}
			})
		})

		// 2. Shared Store Admin API Group
		r.Route("/store/{store_slug}", func(r chi.Router) {
			if res != nil {
				r.Use(middleware.StoreAdminTenantResolver(res))
				r.Use(middleware.RequireTenantContext)
			}

			// Store Staff Public Auth Routes
			r.Route("/auth", func(r chi.Router) {
				if sAuthHandler != nil {
					r.Post("/login", sAuthHandler.Login)
					if tm != nil {
						r.With(
							middleware.Authenticate(tm),
							middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN", "STORE_STAFF"),
						).Get("/me", sAuthHandler.Me)
					}
				}
			})

			// Store Staff Protected Operations
			r.Group(func(r chi.Router) {
				if tm != nil {
					r.Use(middleware.Authenticate(tm))
				}
				r.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN", "STORE_STAFF"))

				r.Get("/dashboard/overview", func(w http.ResponseWriter, r *http.Request) {
					sc := storeCtx.MustGetStoreContext(r.Context())
					claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
					if !ok || claims == nil {
						response.Unauthorized(w, r, "invalid session claims")
						return
					}
					response.JSON(w, http.StatusOK, map[string]interface{}{
						"store_id":   sc.Store.ID,
						"store_name": sc.Store.Name,
						"staff_user": claims.Email,
						"role":       claims.Role,
					})
				})

				// Store Catalog & Variants Management Subsystem
				if catalogHandler != nil || variantsHandler != nil {
					r.Route("/catalog", func(r chi.Router) {
						if catalogHandler != nil {
							// Categories
							r.Route("/categories", func(r chi.Router) {
								r.Put("/reorder", catalogHandler.ReorderCategories)
								r.Get("/", catalogHandler.ListCategories)
								r.Post("/", catalogHandler.CreateCategory)
								r.Put("/{id}", catalogHandler.UpdateCategory)
								r.Delete("/{id}", catalogHandler.DeleteCategory)
							})

							// Brands
							r.Route("/brands", func(r chi.Router) {
								r.Put("/reorder", catalogHandler.ReorderBrands)
								r.Get("/", catalogHandler.ListBrands)
								r.Post("/", catalogHandler.CreateBrand)
								r.Put("/{id}", catalogHandler.UpdateBrand)
								r.Delete("/{id}", catalogHandler.DeleteBrand)
							})

							// Care instructions
							r.Route("/care-instructions", func(r chi.Router) {
								r.Put("/reorder", catalogHandler.ReorderCareInstructions)
								r.Get("/", catalogHandler.ListCareInstructions)
								r.Post("/", catalogHandler.CreateCareInstruction)
								r.Put("/{id}", catalogHandler.UpdateCareInstruction)
								r.Delete("/{id}", catalogHandler.DeleteCareInstruction)
							})

							// Size guide templates
							r.Route("/size-guides", func(r chi.Router) {
								r.Get("/", catalogHandler.ListSizeGuideTemplates)
								r.Post("/", catalogHandler.CreateSizeGuideTemplate)
								r.Put("/{id}", catalogHandler.UpdateSizeGuideTemplate)
								r.Delete("/{id}", catalogHandler.DeleteSizeGuideTemplate)
							})

							// Products
							r.Route("/products", func(r chi.Router) {
								r.Put("/reorder", catalogHandler.ReorderProducts)
								r.Put("/featured/reorder", catalogHandler.ReorderFeaturedProducts)
								r.Patch("/{id}/featured", catalogHandler.SetProductFeatured)
								r.Patch("/{id}/links", catalogHandler.SetProductLinks)
								r.Get("/", catalogHandler.ListProducts)
								r.Post("/", catalogHandler.CreateProduct)
								r.Get("/{id}", catalogHandler.GetProduct)
								r.Put("/{id}", catalogHandler.UpdateProduct)
								r.Delete("/{id}", catalogHandler.DeleteProduct)

								// Product Media Gallery
								r.Post("/{id}/media", catalogHandler.UploadMedia)
								r.Patch("/{id}/media/{image_id}/primary", catalogHandler.SetPrimaryImage)
								r.Delete("/{id}/media/{image_id}", catalogHandler.DeleteImage)
							})
						}

						if variantsHandler != nil {
							// Attributes & Values
							r.Get("/attributes", variantsHandler.ListAttributes)
							r.Put("/attributes/reorder", variantsHandler.ReorderAttributes)
							r.Post("/attributes", variantsHandler.CreateAttribute)
							r.Put("/attributes/{id}", variantsHandler.UpdateAttribute)
							r.Delete("/attributes/{id}", variantsHandler.DeleteAttribute)
							r.Post("/attributes/{attribute_id}/values", variantsHandler.AddAttributeValue)
							r.Delete("/attributes/values/{value_id}", variantsHandler.DeleteAttributeValue)

							// Variants & Matrix
							r.Get("/products/{product_id}/variants", variantsHandler.ListVariants)
							r.Post("/products/{product_id}/variants", variantsHandler.CreateVariant)
							r.Post("/products/{product_id}/variants/preview", variantsHandler.PreviewMatrix)
							r.Post("/products/{product_id}/variants/generate", variantsHandler.GenerateMatrix)

							r.Put("/variants/{variant_id}", variantsHandler.UpdateVariant)
							r.Delete("/variants/{variant_id}", variantsHandler.DeleteVariant)
							r.Patch("/variants/batch", variantsHandler.BatchUpdateVariants)
							r.Post("/variants/{variant_id}/images", variantsHandler.BindVariantImages)
						}
					})
				}

				// Phase 16: Inventory & Stock Movement Ledger
				if inventoryHandler != nil {
					r.Route("/inventory", func(r chi.Router) {
						r.Get("/", inventoryHandler.ListInventory)
						r.Post("/adjust", inventoryHandler.AdjustStock)
						r.Post("/adjust/batch", inventoryHandler.BatchAdjustStock)
						r.Get("/movements", inventoryHandler.ListMovements)
						r.Patch("/{variant_id}/threshold", inventoryHandler.UpdateThreshold)
						r.Get("/alerts/low-stock", inventoryHandler.GetLowStockAlerts)
					})
				}

				// Phase 17: Orders & Fulfillment Pipeline
				if ordersHandler != nil {
					r.Route("/orders", func(ordR chi.Router) {
						ordR.Get("/", ordersHandler.ListOrders)
						ordR.Post("/", ordersHandler.CreateOrder)
						ordR.Get("/fulfillment-queue", ordersHandler.GetFulfillmentQueue)
						ordR.Get("/abandoned", ordersHandler.ListAbandoned)
						ordR.Patch("/abandoned/{id}/status", ordersHandler.UpdateAbandonedStatus)
						ordR.Post("/abandoned/{id}/convert", ordersHandler.ConvertAbandonedToOrder)
						ordR.Get("/{order_id}", ordersHandler.GetOrder)
						ordR.Put("/{order_id}", ordersHandler.UpdateOrder)
						ordR.Delete("/{order_id}", ordersHandler.DeleteOrder)
						ordR.Patch("/{order_id}/status", ordersHandler.TransitionStatus)
						ordR.Patch("/{order_id}/fulfillment-flags", ordersHandler.UpdateFulfillmentFlags)
						ordR.Post("/{order_id}/shipments", ordersHandler.CreateShipment)
						ordR.Post("/{order_id}/payments", ordersHandler.RecordPayment)
						ordR.Post("/{order_id}/call-notes", ordersHandler.AddCallNote)
						ordR.Get("/{order_id}/call-notes", ordersHandler.GetCallNotes)
						// Phase 27: OrderPulse Analytics & Diagnostics
						ordR.Get("/orderpulse/diagnostics", ordersHandler.GetOrderPulseDiagnostics)
						ordR.Patch("/{order_id}/orderpulse-tags", ordersHandler.UpdateOrderPulseTags)
						ordR.Post("/{order_id}/partial-split", ordersHandler.PartialSplit)
					})
				}

				// Phase 18: Customers & Address Book
				if customersHandler != nil {
					r.Route("/customers", func(custR chi.Router) {
						custR.Get("/", customersHandler.ListCustomers)
						custR.Post("/", customersHandler.CreateCustomer)
						custR.Get("/{customer_id}", customersHandler.GetCustomer)
						custR.Put("/{customer_id}", customersHandler.UpdateCustomer)
						custR.Patch("/{customer_id}/crm", customersHandler.UpdateCRMProfile)
						custR.Post("/{customer_id}/blacklist", customersHandler.ToggleBlacklist)
						custR.Post("/{customer_id}/impersonate", customersHandler.ImpersonateCustomer)
						custR.Delete("/{customer_id}", customersHandler.DeleteCustomer)

						custR.Post("/{customer_id}/addresses", customersHandler.AddAddress)
						custR.Put("/{customer_id}/addresses/{address_id}", customersHandler.UpdateAddress)
						custR.Delete("/{customer_id}/addresses/{address_id}", customersHandler.DeleteAddress)
					})
				}

				// Phase 19: Promotions & Coupons
				if promotionsHandler != nil {
					r.Route("/promotions", func(promR chi.Router) {
						promR.Get("/coupons", promotionsHandler.ListCoupons)
						promR.Post("/coupons", promotionsHandler.CreateCoupon)
						promR.Get("/coupons/{coupon_id}", promotionsHandler.GetCoupon)
						promR.Put("/coupons/{coupon_id}", promotionsHandler.UpdateCoupon)
						promR.Patch("/coupons/{coupon_id}/status", promotionsHandler.ToggleCouponStatus)
						promR.Delete("/coupons/{coupon_id}", promotionsHandler.DeleteCoupon)
						promR.Post("/validate", promotionsHandler.ValidateCoupon)

						// Multi-Item Bundle Tiers ("Buy More & Save")
						promR.Get("/bundle-tiers", promotionsHandler.ListBundleTiers)
						promR.Post("/bundle-tiers", promotionsHandler.CreateBundleTier)
						promR.Get("/bundle-tiers/{tier_id}", promotionsHandler.GetBundleTier)
						promR.Put("/bundle-tiers/{tier_id}", promotionsHandler.UpdateBundleTier)
						promR.Delete("/bundle-tiers/{tier_id}", promotionsHandler.DeleteBundleTier)
						promR.Patch("/bundle-tiers/{tier_id}/status", promotionsHandler.ToggleBundleTierStatus)
						promR.Post("/bundle-tiers/calculate", promotionsHandler.CalculateBundle)
					})
				}

				// Phase 20: Store Settings & Staff
				if settingsHandler != nil {
					r.Route("/settings", func(setR chi.Router) {
						setR.Get("/", settingsHandler.GetSettings)
						setR.With(middleware.RequireStoreRole("STORE_OWNER")).Put("/", settingsHandler.UpdateSettings)
					})

					r.Route("/staff", func(stfR chi.Router) {
						stfR.Get("/", settingsHandler.ListStaff)
						stfR.Post("/change-password", settingsHandler.ChangePassword)

						// Owner-only staff mutations
						stfR.Group(func(ownerR chi.Router) {
							ownerR.Use(middleware.RequireStoreRole("STORE_OWNER"))
							ownerR.Post("/", settingsHandler.CreateStaff)
							ownerR.Put("/{staff_id}", settingsHandler.UpdateStaff)
							ownerR.Delete("/{staff_id}", settingsHandler.DeleteStaff)
						})
					})
				}

				// Phase 25: Store Payment Gateway Settings
				if paymentHandler != nil {
					r.Route("/settings/payments", func(paySetR chi.Router) {
						paySetR.Use(middleware.RequireStoreRole("STORE_OWNER"))
						paySetR.Get("/", paymentHandler.ListConfigs)
						paySetR.Put("/", paymentHandler.SaveConfig)
						paySetR.Post("/{gateway}/default", paymentHandler.SetDefault)
						paySetR.Patch("/{gateway}/toggle", paymentHandler.ToggleActive)
					})
				}

				// Phase 26: Store Courier Logistics Dispatch & Settings
				if logisticsHandler != nil {
					r.Route("/logistics", func(logR chi.Router) {
						logR.Post("/dispatch/{order_id}", logisticsHandler.DispatchOrder)
						logR.Get("/shipments", func(w http.ResponseWriter, r *http.Request) {
							stCtx, err := storeCtx.FromContext(r.Context())
							if err != nil {
								response.InternalServerError(w, r)
								return
							}
							rows, err := stCtx.TenantDB.QueryContext(r.Context(), `
								SELECT 
									s.id,
									o.order_number,
									s.carrier,
									COALESCE(s.tracking_number, ''),
									COALESCE(c.first_name || ' ' || c.last_name, o.customer_email, 'Guest Customer'),
									COALESCE(o.shipping_district, ''),
									s.status,
									s.shipped_at,
									s.estimated_delivery
								FROM order_shipments s
								JOIN orders o ON o.id = s.order_id
								LEFT JOIN customers c ON c.id = o.customer_id
								ORDER BY s.created_at DESC
								LIMIT 100
							`)
							if err != nil {
								response.InternalServerError(w, r)
								return
							}
							defer rows.Close()

							type ShipmentDTO struct {
								ID                string  `json:"id"`
								OrderNumber       string  `json:"orderNumber"`
								Carrier           string  `json:"carrier"`
								TrackingNumber    string  `json:"trackingNumber"`
								RecipientName     string  `json:"recipientName"`
								RecipientCity     string  `json:"recipientCity"`
								Status            string  `json:"status"`
								ShippedAt         *string `json:"shippedAt,omitempty"`
								EstimatedDelivery *string `json:"estimatedDelivery,omitempty"`
							}

							var list []ShipmentDTO
							for rows.Next() {
								var item ShipmentDTO
								var shippedAt, estDelivery *time.Time
								if err := rows.Scan(
									&item.ID,
									&item.OrderNumber,
									&item.Carrier,
									&item.TrackingNumber,
									&item.RecipientName,
									&item.RecipientCity,
									&item.Status,
									&shippedAt,
									&estDelivery,
								); err == nil {
									if shippedAt != nil {
										s := shippedAt.Format(time.RFC3339)
										item.ShippedAt = &s
									}
									if estDelivery != nil {
										e := estDelivery.Format(time.RFC3339)
										item.EstimatedDelivery = &e
									}
									list = append(list, item)
								}
							}
							if list == nil {
								list = []ShipmentDTO{}
							}
							response.JSON(w, http.StatusOK, list)
						})
					})

					r.Route("/settings/logistics", func(setR chi.Router) {
						setR.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN"))
						setR.Get("/", logisticsHandler.ListConfigs)
						setR.Put("/", logisticsHandler.SaveConfig)
					})
				}

				// Delivery zones & Hierarchical Locations: staff can read; only owners and admins can change them
				if shippingHandler != nil {
					r.Route("/shipping/zones", func(shipR chi.Router) {
						shipR.Get("/", shippingHandler.ListZones)
						shipR.Group(func(writeR chi.Router) {
							writeR.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN"))
							writeR.Post("/", shippingHandler.CreateZone)
							writeR.Put("/{id}", shippingHandler.UpdateZone)
							writeR.Delete("/{id}", shippingHandler.DeleteZone)
						})
					})

					r.Route("/shipping/locations", func(locR chi.Router) {
						locR.Get("/districts", shippingHandler.ListDistricts)
						locR.Get("/thanas", shippingHandler.ListThanas)

						locR.Group(func(writeR chi.Router) {
							writeR.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN"))
							writeR.Post("/districts", shippingHandler.CreateDistrict)
							writeR.Put("/districts/{id}", shippingHandler.UpdateDistrict)
							writeR.Delete("/districts/{id}", shippingHandler.DeleteDistrict)

							writeR.Post("/thanas", shippingHandler.CreateThana)
							writeR.Put("/thanas/{id}", shippingHandler.UpdateThana)
							writeR.Delete("/thanas/{id}", shippingHandler.DeleteThana)
						})
					})
				}

				// Phase 27: Store Marketing & Tracking Telemetry Settings
				if marketingHandler != nil {
					r.Route("/settings/marketing", func(mktAdminR chi.Router) {
						mktAdminR.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN"))
						mktAdminR.Get("/", marketingHandler.GetAdminConfig)
						mktAdminR.Put("/", marketingHandler.SaveAdminConfig)
					})
					r.Route("/marketing", func(mktR chi.Router) {
						mktR.Get("/meta-attribution", marketingHandler.GetMetaAttribution)
						mktR.Get("/meta-accounts", marketingHandler.ListMetaAdAccounts)
						mktR.Post("/meta-accounts", marketingHandler.SaveMetaAdAccount)
						mktR.Delete("/meta-accounts/{id}", marketingHandler.DeleteMetaAdAccount)
						mktR.Post("/meta-accounts/{id}/sync", marketingHandler.SyncMetaAdAccount)
						mktR.Post("/meta-explorer/test", marketingHandler.TestGraphAPIExplorer)
					})
				}

				// Store Accounts, Expenses, Reconciliation & P&L Subsystem
				if sAccountsHandler != nil {
					r.Route("/accounts", func(accR chi.Router) {
						accR.Get("/overview", sAccountsHandler.GetOverview)
						accR.Get("/transactions", sAccountsHandler.ListTransactions)
						accR.Get("/expenses", sAccountsHandler.ListExpenses)
						accR.Post("/expenses", sAccountsHandler.CreateExpense)
						accR.Delete("/expenses/{id}", sAccountsHandler.DeleteExpense)
						accR.Get("/payouts", sAccountsHandler.ListPayouts)
						accR.Get("/reconciliation", sAccountsHandler.GetReconciliation)
						accR.Get("/profit-loss", sAccountsHandler.GetProfitLoss)
						accR.Get("/export", sAccountsHandler.ExportLedger)
					})
				}

				// Phase 31: Product Reviews & Reputation Moderation Engine
				if reviewsHandler != nil {
					r.Route("/reviews", func(revR chi.Router) {
						revR.Get("/", reviewsHandler.ListReviews)
						revR.Post("/", reviewsHandler.CreateStaffReview)
						revR.Get("/{id}", reviewsHandler.GetReview)
						revR.Put("/{id}", reviewsHandler.UpdateReview)
						revR.Patch("/{id}/status", reviewsHandler.QuickModerate)
						revR.Delete("/{id}", reviewsHandler.DeleteReview)
					})
				}

				// Storefront Theme Appearance for Store Admin
				if themeHandler != nil && themeHandler.GetService() != nil {
					r.Get("/theme/current", func(w http.ResponseWriter, r *http.Request) {
						sc := storeCtx.MustGetStoreContext(r.Context())
						th, err := themeHandler.GetService().GetStoreTheme(r.Context(), sc.Store.ID)
						if err != nil || th == nil {
							response.JSON(w, http.StatusOK, map[string]interface{}{
								"theme_id":          "",
								"theme_name":        "Default Theme",
								"theme_slug":        "fashion",
								"primary_color":     "#0f172a",
								"secondary_color":   "#3b82f6",
								"heading_font":      "Inter",
								"body_font":         "Inter",
								"border_radius":     "sm",
								"header_layout":     "standard",
								"show_announcement": false,
								"announcement_text": "",
								"colors": map[string]interface{}{
									"primary":    "#0f172a",
									"secondary":  "#3b82f6",
									"accent":     "#f59e0b",
									"background": "#ffffff",
									"surface":    "#f8fafc",
									"text":       "#0f172a",
									"muted":      "#64748b",
								},
								"fonts": map[string]interface{}{
									"heading":         "Inter",
									"body":            "Inter",
									"heading_weight":  "700",
									"letter_spacing":  "normal",
									"text_transform":  "none",
									"font_size_scale": "standard",
								},
							})
							return
						}
						themeCfg := mergeThemeConfig(th.Theme.Config, th.CustomConfig)
						primaryColor := "#0f172a"
						secondaryColor := "#3b82f6"
						accentColor := "#f59e0b"
						backgroundColor := "#ffffff"
						surfaceColor := "#f8fafc"
						textColor := "#0f172a"
						mutedColor := "#64748b"
						headingFont := "Inter"
						bodyFont := "Inter"
						headingWeight := "700"
						letterSpacing := "normal"
						textTransform := "none"
						fontSizeScale := "standard"
						radius := "sm"
						density := "compact"
						showAnnouncement := false
						announcementText := ""

						if colors, ok := themeCfg["colors"].(map[string]interface{}); ok {
							if p, ok := colors["primary"].(string); ok && p != "" {
								primaryColor = p
							}
							if s, ok := colors["secondary"].(string); ok && s != "" {
								secondaryColor = s
							}
							if a, ok := colors["accent"].(string); ok && a != "" {
								accentColor = a
							}
							if b, ok := colors["background"].(string); ok && b != "" {
								backgroundColor = b
							}
							if sf, ok := colors["surface"].(string); ok && sf != "" {
								surfaceColor = sf
							}
							if t, ok := colors["text"].(string); ok && t != "" {
								textColor = t
							}
							if m, ok := colors["muted"].(string); ok && m != "" {
								mutedColor = m
							}
						}
						if fonts, ok := themeCfg["fonts"].(map[string]interface{}); ok {
							if h, ok := fonts["heading"].(string); ok && h != "" {
								headingFont = h
							}
							if b, ok := fonts["body"].(string); ok && b != "" {
								bodyFont = b
							}
							if hw, ok := fonts["heading_weight"].(string); ok && hw != "" {
								headingWeight = hw
							}
							if ls, ok := fonts["letter_spacing"].(string); ok && ls != "" {
								letterSpacing = ls
							}
							if tt, ok := fonts["text_transform"].(string); ok && tt != "" {
								textTransform = tt
							}
							if fss, ok := fonts["font_size_scale"].(string); ok && fss != "" {
								fontSizeScale = fss
							}
						}
						if r, ok := themeCfg["radius"].(string); ok && r != "" {
							radius = r
						}
						if d, ok := themeCfg["density"].(string); ok && d != "" {
							density = d
						}
						if sa, ok := themeCfg["show_announcement_bar"].(bool); ok {
							showAnnouncement = sa
						}
						if at, ok := themeCfg["announcement_text"].(string); ok {
							announcementText = at
						}

						colorsMap := map[string]interface{}{
							"primary":    primaryColor,
							"secondary":  secondaryColor,
							"accent":     accentColor,
							"background": backgroundColor,
							"surface":    surfaceColor,
							"text":       textColor,
							"muted":      mutedColor,
						}
						fontsMap := map[string]interface{}{
							"heading":         headingFont,
							"body":            bodyFont,
							"heading_weight":  headingWeight,
							"letter_spacing":  letterSpacing,
							"text_transform":  textTransform,
							"font_size_scale": fontSizeScale,
						}

						response.JSON(w, http.StatusOK, map[string]interface{}{
							"theme_id":          th.ThemeID,
							"theme_name":        th.ThemeName,
							"theme_slug":        th.ThemeSlug,
							"primary_color":     primaryColor,
							"secondary_color":   secondaryColor,
							"heading_font":      headingFont,
							"body_font":         bodyFont,
							"border_radius":     radius,
							"density":           density,
							"header_layout":     "standard",
							"show_announcement": showAnnouncement,
							"announcement_text": announcementText,
							"colors":            colorsMap,
							"fonts":             fontsMap,
						})
					})

					r.Put("/theme/current", func(w http.ResponseWriter, r *http.Request) {
						sc := storeCtx.MustGetStoreContext(r.Context())
						var payload map[string]interface{}
						if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
							response.BadRequest(w, r, "Invalid theme customization payload")
							return
						}
						rawBytes, err := json.Marshal(payload)
						if err != nil {
							response.BadRequest(w, r, "Malformed JSON")
							return
						}
						if err := themeHandler.GetService().UpdateStoreThemeCustomConfig(r.Context(), sc.Store.ID, rawBytes); err != nil {
							response.Problem(w, r, http.StatusInternalServerError, "THEME_UPDATE_FAILED", "Theme Update Failed", err.Error())
							return
						}
						// Also sync primary_color, secondary_color, font_heading, font_body to store_settings in tenant DB
						var primary, secondary, heading, body string
						if colors, ok := payload["colors"].(map[string]interface{}); ok {
							if p, ok := colors["primary"].(string); ok {
								primary = p
							}
							if s, ok := colors["secondary"].(string); ok {
								secondary = s
							}
						}
						if fonts, ok := payload["fonts"].(map[string]interface{}); ok {
							if h, ok := fonts["heading"].(string); ok {
								heading = h
							}
							if b, ok := fonts["body"].(string); ok {
								body = b
							}
						}
						_, _ = sc.TenantDB.ExecContext(r.Context(), `
							UPDATE store_settings SET 
								primary_color = COALESCE(NULLIF($1, ''), primary_color),
								secondary_color = COALESCE(NULLIF($2, ''), secondary_color),
								font_heading = COALESCE(NULLIF($3, ''), font_heading),
								font_body = COALESCE(NULLIF($4, ''), font_body),
								updated_at = CURRENT_TIMESTAMP
							WHERE id = (SELECT id FROM store_settings LIMIT 1);
						`, primary, secondary, heading, body)

						response.JSON(w, http.StatusOK, map[string]interface{}{
							"success": true,
							"message": "Store theme appearance tokens updated successfully",
						})
					})
				}

				// Ambient Music System: Track Library and Master Switch
				if musicHandler != nil {
					r.Route("/music", func(musicR chi.Router) {
						musicR.Get("/config", musicHandler.GetAdminConfig)
						musicR.Put("/config", musicHandler.UpdateAdminConfig)
						musicR.Get("/tracks", musicHandler.ListAdminTracks)
						musicR.Post("/tracks", musicHandler.CreateAdminTrack)
						musicR.Put("/tracks/{id}", musicHandler.UpdateAdminTrack)
						musicR.Delete("/tracks/{id}", musicHandler.DeleteAdminTrack)
						musicR.Post("/tracks/reorder", musicHandler.ReorderAdminTracks)
						musicR.Post("/upload", musicHandler.UploadTrackAudio)
					})
				}

				// Task Management Workstation Subsystem
				if tasksHandler != nil {
					r.Route("/tasks", func(taskR chi.Router) {
						taskR.Get("/categories", tasksHandler.ListCategories)
						taskR.Post("/categories", tasksHandler.CreateCategory)
						taskR.Get("/", tasksHandler.ListTasks)
						taskR.Post("/", tasksHandler.CreateTask)
						taskR.Get("/{id}", tasksHandler.GetTask)
						taskR.Put("/{id}", tasksHandler.UpdateTask)
						taskR.Put("/{id}/complete", tasksHandler.CompleteTask)
						taskR.Delete("/{id}", tasksHandler.DeleteTask)
					})
				}

				// Blog & 100% SEO Editorial Management Subsystem
				if blogHandler != nil {
					r.Route("/blog", func(bAdminR chi.Router) {
						// Posts CRUD
						bAdminR.Get("/posts", blogHandler.ListPosts)
						bAdminR.Post("/posts", blogHandler.CreatePost)
						bAdminR.Get("/posts/{id}", blogHandler.GetPost)
						bAdminR.Put("/posts/{id}", blogHandler.UpdatePost)
						bAdminR.Patch("/posts/{id}/status", blogHandler.QuickUpdateStatus)
						bAdminR.Delete("/posts/{id}", blogHandler.DeletePost)
						bAdminR.Post("/analyze-seo", blogHandler.AnalyzeSEO)

						// Categories CRUD
						bAdminR.Get("/categories", blogHandler.ListCategories)
						bAdminR.Post("/categories", blogHandler.CreateCategory)
						bAdminR.Get("/categories/{id}", blogHandler.GetCategory)
						bAdminR.Put("/categories/{id}", blogHandler.UpdateCategory)
						bAdminR.Delete("/categories/{id}", blogHandler.DeleteCategory)
					})
				}

				// Tenant Media Upload Endpoint (Partitioned into stores/{store_slug}/{module})
				if storageHandler != nil {
					r.Post("/media/upload", storageHandler.UploadStoreMedia)
				}
			})
		})

		// 3. Shared Storefront API Group
		r.Route("/storefront", func(r chi.Router) {
			if rateLimiter != nil {
				r.Use(rateLimiter.Limit(middleware.TierStorefrontPublic))
			}
			r.Use(middleware.StorefrontTenantResolver(res))
			r.Use(middleware.RequireTenantContext)

			r.Get("/config", func(w http.ResponseWriter, r *http.Request) {
				sc := storeCtx.MustGetStoreContext(r.Context())
				var themeData interface{}
				if themeHandler != nil && themeHandler.GetService() != nil {
					if th, err := themeHandler.GetService().GetStoreTheme(r.Context(), sc.Store.ID); err == nil && th != nil {
						// Map to the shape the storefront expects: {id, name, slug, version, config}.
						themeCfg := mergeThemeConfig(th.Theme.Config, th.CustomConfig)
						themeData = map[string]interface{}{
							"id":      th.ThemeID,
							"name":    th.ThemeName,
							"slug":    th.ThemeSlug,
							"version": th.Version,
							"config":  themeCfg,
						}
					}
				}

				brand := map[string]interface{}{
					"id":            sc.Store.ID,
					"name":          sc.Store.Name,
					"slug":          sc.Store.Slug,
					"currency":      sc.Store.Currency,
					"timezone":      sc.Store.Timezone,
					"status":        sc.Store.Status,
					"contact_email": sc.Store.ContactEmail,
					"contact_phone": sc.Store.ContactPhone,
					"logo_url":      sc.Store.LogoURL,
				}

				// Query Tenant-specific SEO & Favicon settings from sc.TenantDB
				seoSettings := map[string]interface{}{
					"meta_title_template":      "%s | " + sc.Store.Name,
					"default_meta_title":       sc.Store.Name + " | Official Online Store",
					"default_meta_description": "Shop the latest authentic collections at " + sc.Store.Name + ". Fast delivery and verified quality.",
					"default_keywords":         "ecommerce, online shopping, " + strings.ToLower(sc.Store.Name),
					"favicon_url":              sc.Store.LogoURL,
					"apple_touch_icon_url":     sc.Store.LogoURL,
					"default_og_image_url":     "",
					"twitter_handle":           "@" + strings.ToLower(sc.Store.Slug),
					"google_site_verification": "",
					"bing_site_verification":   "",
					"pinterest_verification":   "",
					"robots_txt_custom":        "",
					"sitemap_enabled":          true,
				}
				if sc.TenantDB != nil {
					var metaTpl, defTitle, defDesc, defKw, fav, appleFav, ogImg, twHandle, gVer, bVer, pVer, rCustom sql.NullString
					var sEnabled sql.NullBool
					q := `SELECT meta_title_template, default_meta_title, default_meta_description, default_keywords,
					             favicon_url, apple_touch_icon_url, default_og_image_url, twitter_handle,
					             google_site_verification, bing_site_verification, pinterest_verification,
					             robots_txt_custom, sitemap_enabled
					      FROM store_settings LIMIT 1;`
					if err := sc.TenantDB.QueryRowContext(r.Context(), q).Scan(
						&metaTpl, &defTitle, &defDesc, &defKw, &fav, &appleFav, &ogImg, &twHandle,
						&gVer, &bVer, &pVer, &rCustom, &sEnabled,
					); err == nil {
						if metaTpl.Valid && metaTpl.String != "" {
							seoSettings["meta_title_template"] = metaTpl.String
						}
						if defTitle.Valid && defTitle.String != "" {
							seoSettings["default_meta_title"] = defTitle.String
						}
						if defDesc.Valid && defDesc.String != "" {
							seoSettings["default_meta_description"] = defDesc.String
						}
						if defKw.Valid && defKw.String != "" {
							seoSettings["default_keywords"] = defKw.String
						}
						if fav.Valid && fav.String != "" {
							seoSettings["favicon_url"] = fav.String
						}
						if appleFav.Valid && appleFav.String != "" {
							seoSettings["apple_touch_icon_url"] = appleFav.String
						}
						if ogImg.Valid && ogImg.String != "" {
							seoSettings["default_og_image_url"] = ogImg.String
						}
						if twHandle.Valid && twHandle.String != "" {
							seoSettings["twitter_handle"] = twHandle.String
						}
						if gVer.Valid && gVer.String != "" {
							seoSettings["google_site_verification"] = gVer.String
						}
						if bVer.Valid && bVer.String != "" {
							seoSettings["bing_site_verification"] = bVer.String
						}
						if pVer.Valid && pVer.String != "" {
							seoSettings["pinterest_verification"] = pVer.String
						}
						if rCustom.Valid && rCustom.String != "" {
							seoSettings["robots_txt_custom"] = rCustom.String
						}
						if sEnabled.Valid {
							seoSettings["sitemap_enabled"] = sEnabled.Bool
						}
					}
				}

				var publicGateways interface{} = []interface{}{}
				if paymentHandler != nil && paymentHandler.GetService() != nil {
					if pgList, err := paymentHandler.GetService().ListPublicGateways(r.Context()); err == nil {
						publicGateways = pgList
					}
				}

				response.JSON(w, http.StatusOK, map[string]interface{}{
					"store":            brand,
					"domain":           sc.Domain,
					"is_custom_domain": sc.IsCustom,
					"theme":            themeData,
					"seo":              seoSettings,
					"payment_gateways": publicGateways,
					"brand_name":       sc.Store.Name,
					"slug":             sc.Store.Slug,
					"currency":         sc.Store.Currency,
					"logo_url":         sc.Store.LogoURL,
					"is_custom":        sc.IsCustom,
				})
			})

			// Public Storefront SEO & Webmaster Directives
			r.Route("/seo", func(seoR chi.Router) {
				seoR.Get("/settings", func(w http.ResponseWriter, r *http.Request) {
					sc := storeCtx.MustGetStoreContext(r.Context())
					seoSettings := map[string]interface{}{
						"meta_title_template":      "%s | " + sc.Store.Name,
						"default_meta_title":       sc.Store.Name + " | Official Online Store",
						"default_meta_description": "Shop authentic collections at " + sc.Store.Name + ". High quality & swift delivery.",
						"default_keywords":         "ecommerce, online store, " + strings.ToLower(sc.Store.Name),
						"favicon_url":              sc.Store.LogoURL,
						"apple_touch_icon_url":     sc.Store.LogoURL,
						"default_og_image_url":     "",
						"twitter_handle":           "@" + strings.ToLower(sc.Store.Slug),
						"google_site_verification": "",
						"bing_site_verification":   "",
						"pinterest_verification":   "",
						"robots_txt_custom":        "",
						"sitemap_enabled":          true,
					}
					if sc.TenantDB != nil {
						var metaTpl, defTitle, defDesc, defKw, fav, appleFav, ogImg, twHandle, gVer, bVer, pVer, rCustom sql.NullString
						var sEnabled sql.NullBool
						q := `SELECT meta_title_template, default_meta_title, default_meta_description, default_keywords,
						             favicon_url, apple_touch_icon_url, default_og_image_url, twitter_handle,
						             google_site_verification, bing_site_verification, pinterest_verification,
						             robots_txt_custom, sitemap_enabled
						      FROM store_settings LIMIT 1;`
						if err := sc.TenantDB.QueryRowContext(r.Context(), q).Scan(
							&metaTpl, &defTitle, &defDesc, &defKw, &fav, &appleFav, &ogImg, &twHandle,
							&gVer, &bVer, &pVer, &rCustom, &sEnabled,
						); err == nil {
							if metaTpl.Valid && metaTpl.String != "" {
								seoSettings["meta_title_template"] = metaTpl.String
							}
							if defTitle.Valid && defTitle.String != "" {
								seoSettings["default_meta_title"] = defTitle.String
							}
							if defDesc.Valid && defDesc.String != "" {
								seoSettings["default_meta_description"] = defDesc.String
							}
							if defKw.Valid && defKw.String != "" {
								seoSettings["default_keywords"] = defKw.String
							}
							if fav.Valid && fav.String != "" {
								seoSettings["favicon_url"] = fav.String
							}
							if appleFav.Valid && appleFav.String != "" {
								seoSettings["apple_touch_icon_url"] = appleFav.String
							}
							if ogImg.Valid && ogImg.String != "" {
								seoSettings["default_og_image_url"] = ogImg.String
							}
							if twHandle.Valid && twHandle.String != "" {
								seoSettings["twitter_handle"] = twHandle.String
							}
							if gVer.Valid && gVer.String != "" {
								seoSettings["google_site_verification"] = gVer.String
							}
							if bVer.Valid && bVer.String != "" {
								seoSettings["bing_site_verification"] = bVer.String
							}
							if pVer.Valid && pVer.String != "" {
								seoSettings["pinterest_verification"] = pVer.String
							}
							if rCustom.Valid && rCustom.String != "" {
								seoSettings["robots_txt_custom"] = rCustom.String
							}
							if sEnabled.Valid {
								seoSettings["sitemap_enabled"] = sEnabled.Bool
							}
						}
					}
					response.JSON(w, http.StatusOK, seoSettings)
				})

				seoR.Get("/sitemap.xml", func(w http.ResponseWriter, r *http.Request) {
					sc := storeCtx.MustGetStoreContext(r.Context())
					host := r.Host
					if h := r.Header.Get("X-Forwarded-Host"); h != "" {
						host = h
					}
					baseURL := "https://" + host

					var xmlBuilder strings.Builder
					xmlBuilder.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
					xmlBuilder.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` + "\n")

					nowStr := time.Now().UTC().Format(time.RFC3339)
					corePages := []struct {
						loc      string
						priority string
						freq     string
					}{
						{loc: baseURL, priority: "1.0", freq: "daily"},
						{loc: baseURL + "/catalog", priority: "0.9", freq: "daily"},
						{loc: baseURL + "/blog", priority: "0.8", freq: "weekly"},
						{loc: baseURL + "/about", priority: "0.5", freq: "monthly"},
						{loc: baseURL + "/shipping-policy", priority: "0.4", freq: "monthly"},
						{loc: baseURL + "/returns", priority: "0.4", freq: "monthly"},
					}
					for _, cp := range corePages {
						xmlBuilder.WriteString(fmt.Sprintf("  <url><loc>%s</loc><lastmod>%s</lastmod><changefreq>%s</changefreq><priority>%s</priority></url>\n",
							cp.loc, nowStr, cp.freq, cp.priority))
					}

					if sc.TenantDB != nil {
						// Categories
						catRows, err := sc.TenantDB.QueryContext(r.Context(), "SELECT slug, updated_at FROM categories WHERE is_active = TRUE ORDER BY display_order ASC;")
						if err == nil {
							for catRows.Next() {
								var cSlug string
								var uAt time.Time
								if err := catRows.Scan(&cSlug, &uAt); err == nil {
									xmlBuilder.WriteString(fmt.Sprintf("  <url><loc>%s/catalog?category=%s</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n",
										baseURL, cSlug, uAt.UTC().Format(time.RFC3339)))
								}
							}
							catRows.Close()
						}

						// Products
						prodRows, err := sc.TenantDB.QueryContext(r.Context(), "SELECT slug, title, COALESCE(featured_image_url, ''), updated_at FROM products WHERE status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 5000;")
						if err == nil {
							for prodRows.Next() {
								var pSlug, pTitle, pImg string
								var uAt time.Time
								if err := prodRows.Scan(&pSlug, &pTitle, &pImg, &uAt); err == nil {
									if pImg != "" {
										xmlBuilder.WriteString(fmt.Sprintf("  <url><loc>%s/product/%s</loc><lastmod>%s</lastmod><changefreq>daily</changefreq><priority>0.9</priority><image:image><image:loc>%s</image:loc><image:title>%s</image:title></image:image></url>\n",
											baseURL, pSlug, uAt.UTC().Format(time.RFC3339), pImg, strings.ReplaceAll(pTitle, "&", "&amp;")))
									} else {
										xmlBuilder.WriteString(fmt.Sprintf("  <url><loc>%s/product/%s</loc><lastmod>%s</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>\n",
											baseURL, pSlug, uAt.UTC().Format(time.RFC3339)))
									}
								}
							}
							prodRows.Close()
						}

						// Blog posts
						blogRows, err := sc.TenantDB.QueryContext(r.Context(), "SELECT slug, updated_at FROM blog_posts WHERE status = 'PUBLISHED' ORDER BY published_at DESC LIMIT 1000;")
						if err == nil {
							for blogRows.Next() {
								var bSlug string
								var uAt time.Time
								if err := blogRows.Scan(&bSlug, &uAt); err == nil {
									xmlBuilder.WriteString(fmt.Sprintf("  <url><loc>%s/blog/%s</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n",
										baseURL, bSlug, uAt.UTC().Format(time.RFC3339)))
								}
							}
							blogRows.Close()
						}
					}

					xmlBuilder.WriteString("</urlset>")
					w.Header().Set("Content-Type", "application/xml; charset=utf-8")
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte(xmlBuilder.String()))
				})

				seoR.Get("/robots.txt", func(w http.ResponseWriter, r *http.Request) {
					sc := storeCtx.MustGetStoreContext(r.Context())
					host := r.Host
					if h := r.Header.Get("X-Forwarded-Host"); h != "" {
						host = h
					}
					baseURL := "https://" + host

					var customRobots sql.NullString
					if sc.TenantDB != nil {
						_ = sc.TenantDB.QueryRowContext(r.Context(), "SELECT robots_txt_custom FROM store_settings LIMIT 1;").Scan(&customRobots)
					}

					if customRobots.Valid && strings.TrimSpace(customRobots.String) != "" {
						w.Header().Set("Content-Type", "text/plain; charset=utf-8")
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write([]byte(customRobots.String))
						return
					}

					defaultRobots := fmt.Sprintf(`User-agent: *
Disallow: /checkout
Disallow: /checkout/*
Disallow: /cart
Disallow: /orders/lookup
Disallow: /api/
Allow: /

Sitemap: %s/sitemap.xml
`, baseURL)

					w.Header().Set("Content-Type", "text/plain; charset=utf-8")
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte(defaultRobots))
				})
			})

			// Dynamic Storefront Theme & Config Delivery Endpoint
			if themeHandler != nil {
				r.Get("/theme", themeHandler.GetStorefrontTheme)
			}

			// Phase 22 & 23: Public Storefront Catalog APIs
			if storefrontCatalogHandler != nil {
				r.Route("/catalog", func(catR chi.Router) {
					catR.Get("/categories", storefrontCatalogHandler.ListCategories)
					catR.Get("/products", storefrontCatalogHandler.SearchProducts)
					catR.Get("/products/{slug}", storefrontCatalogHandler.GetProductBySlug)
				})
			}

			// Phase 23: Public Storefront Cart APIs
			if storefrontCartHandler != nil {
				r.Route("/cart", func(cartR chi.Router) {
					cartR.Get("/", storefrontCartHandler.GetCart)
					cartR.Post("/items", storefrontCartHandler.AddItem)
					cartR.Put("/items/{item_id}", storefrontCartHandler.UpdateItem)
					cartR.Delete("/items/{item_id}", storefrontCartHandler.RemoveItem)
				})
			}

			// Phase 24: Public Storefront Checkout APIs
			if storefrontCheckoutHandler != nil {
				r.Post("/checkout", storefrontCheckoutHandler.ProcessCheckout)
				r.Get("/orders/{order_number}", storefrontCheckoutHandler.LookupOrder)
				if ordersHandler != nil {
					r.Post("/orders/abandoned/capture", ordersHandler.CaptureAbandoned)
				}
			}

			// Public delivery zones used to show and check shipping availability
			if shippingHandler != nil {
				r.Get("/shipping/zones", shippingHandler.ListPublicZones)
			}

			// Phase 25: Public Storefront Payment Gateway APIs
			if paymentHandler != nil {
				r.Route("/payments", func(payR chi.Router) {
					payR.Get("/methods", paymentHandler.ListPublicGateways)
					payR.Get("/gateways", paymentHandler.ListPublicGateways)
					payR.Post("/initiate", paymentHandler.Initiate)
					payR.HandleFunc("/{gateway}/callback", paymentHandler.Callback)
					payR.Post("/{gateway}/webhook", paymentHandler.Webhook)
				})
			}

			// Phase 26: Public Storefront Logistics Tracking & Carrier Webhooks
			if logisticsHandler != nil {
				r.Route("/logistics", func(logR chi.Router) {
					logR.Get("/track/{tracking_number}", logisticsHandler.TrackShipment)
					logR.Post("/{carrier}/webhook", logisticsHandler.CarrierWebhook)
				})
			}

			// Phase 27: Public Storefront Marketing Config
			if marketingHandler != nil {
				r.Route("/marketing", func(mktR chi.Router) {
					mktR.Get("/config", marketingHandler.GetStorefrontConfig)
				})
			}

			// Phase 31: Public Storefront Product Reviews & Social Proof
			if reviewsHandler != nil {
				r.Route("/reviews", func(revR chi.Router) {
					revR.Get("/products/{product_slug}", reviewsHandler.GetProductReviewsStorefront)
					revR.Post("/products/{product_slug}", reviewsHandler.SubmitCustomerReview)
				})
			}

			// Public Ambient Music System APIs
			if musicHandler != nil {
				r.Route("/music", func(musR chi.Router) {
					musR.Get("/config", musicHandler.GetStorefrontConfig)
					musR.Get("/tracks", musicHandler.ListStorefrontTracks)
				})
			}

			// Public Storefront Multi-Item Bundle Tiers & Promotion Validation
			if promotionsHandler != nil {
				r.Route("/promotions", func(promR chi.Router) {
					promR.Post("/validate", promotionsHandler.ValidateCoupon)
					promR.Get("/bundle-tiers", promotionsHandler.ListStorefrontBundleTiers)
					promR.Post("/bundle-tiers/calculate", promotionsHandler.CalculateBundle)
				})
				r.Get("/bundle-tiers", promotionsHandler.ListStorefrontBundleTiers)
			}

			// Public Storefront 100% SEO Blog & Editorial APIs
			if blogHandler != nil {
				r.Route("/blog", func(bPubR chi.Router) {
					bPubR.Get("/posts", blogHandler.StorefrontListPosts)
					bPubR.Get("/posts/{slug}", blogHandler.StorefrontGetPostBySlug)
					bPubR.Get("/categories", blogHandler.StorefrontListCategories)
					bPubR.Get("/sitemap", blogHandler.StorefrontSitemapFeed)
				})
			}

			// Public Storefront Media Upload (e.g. customer review photos)
			if storageHandler != nil {
				r.Post("/media/upload", storageHandler.UploadStoreMedia)
			}
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		response.NotFound(w, r, fmt.Sprintf("The requested route %s was not found.", r.URL.Path))
	})

	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		response.Problem(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method Not Allowed", fmt.Sprintf("HTTP method %s is not permitted on this resource.", r.Method))
	})

	return r
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("FATAL: Failed to load system configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	platformDB, err := database.NewPlatformConnection(&cfg.PlatformDB)
	if err != nil {
		logger.Error("FATAL: Failed to initialize Platform DB connection pool", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer platformDB.Close()

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	defer redisClient.Close()

	// Initialize Phase 28 Redis Streams Queue Producer
	queueProducer := worker.NewRedisQueueProducer(redisClient)
	_ = queueProducer // Expose queueProducer for asynchronous background job enqueuing

	tenantPool := storeDB.NewTenantPoolManager(
		cfg.StoreDBTemplate.MaxOpenConns,
		cfg.StoreDBTemplate.MaxIdleConns,
		cfg.StoreDBTemplate.ConnMaxLifetime,
	)
	defer tenantPool.CloseAll()

	tokenManager, err := pkgAuth.NewTokenManager(cfg.Security.JWTSecret, cfg.Security.JWTExpirationHours, cfg.Security.RefreshTokenExpirationDays)
	if err != nil {
		logger.Error("FATAL: Failed to initialize token manager", slog.String("error", err.Error()))
		os.Exit(1)
	}
	sessionManager := platformAuth.NewSessionManager(redisClient)

	pAuthService := platformAuth.NewService(platformDB.DB, tokenManager, sessionManager)
	pAuthHandler := platformAuth.NewHandler(pAuthService)

	sAuthService := storeAuth.NewService(tokenManager, platformDB.DB)
	sAuthHandler := storeAuth.NewHandler(sAuthService)

	// The encryption key is independent of JWT_SECRET and is validated to 32 bytes by config.Load.
	encryptionKeyBytes := []byte(cfg.DatabaseEncryptionKey)
	storeResolver, err := resolver.NewStoreResolver(platformDB.DB, redisClient, tenantPool, encryptionKeyBytes)
	if err != nil {
		logger.Error("FATAL: Failed to initialize StoreResolver", slog.String("error", err.Error()))
		os.Exit(1)
	}

	clusterAdminDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=disable",
		cfg.PlatformDB.Host, cfg.PlatformDB.Port, cfg.PlatformDB.User, cfg.PlatformDB.Password)
	clusterAdminDB, err := sql.Open("postgres", clusterAdminDSN)
	if err != nil {
		logger.Error("FATAL: Failed to connect to PostgreSQL cluster admin DB", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer clusterAdminDB.Close()

	storeMigrationsPath := "../infra/migrations/store"
	if _, err := os.Stat(storeMigrationsPath); os.IsNotExist(err) {
		storeMigrationsPath = "infra/migrations/store"
	}

	dbProvisioner, err := provisioner.NewProvisioner(platformDB.DB, clusterAdminDB, storeMigrationsPath, encryptionKeyBytes)
	if err != nil {
		logger.Error("FATAL: Failed to initialize Provisioner", slog.String("error", err.Error()))
		os.Exit(1)
	}

	storeMgmtService := store_mgmt.NewService(platformDB.DB, dbProvisioner, storeResolver, tenantPool, cfg.IsDevelopment())
	storeMgmtHandler := store_mgmt.NewHandler(storeMgmtService)

	// Domains Engine
	dnsVerifier := domains.NewStandardDNSVerifier()
	cfClient := domains.NewCloudflareClient(os.Getenv("CLOUDFLARE_API_TOKEN"), os.Getenv("CLOUDFLARE_ZONE_ID"))
	domainService := domains.NewService(platformDB.DB, dnsVerifier, cfClient, storeResolver, cfg.IsDevelopment())
	domainHandler := domains.NewHandler(domainService)

	// Theme Management Engine
	themeService := themes.NewService(platformDB.DB, redisClient, storeResolver)
	themeHandler := themes.NewHandler(themeService)

	// Initialize Object Storage Service (Dynamic Provider supporting Local Disk & Cloudflare R2)
	localStorageProvider, err := storage.NewLocalStorage("./uploads", "http://localhost:8080/uploads")
	if err != nil {
		logger.Error("FATAL: Failed to initialize local object storage", slog.String("error", err.Error()))
		os.Exit(1)
	}
	dynamicStorageProvider := storage.NewDynamicStorageProvider(localStorageProvider, "local")

	storageRepo := platformStorage.NewRepository(platformDB.DB)
	storageService := platformStorage.NewService(storageRepo, dynamicStorageProvider, []byte(cfg.DatabaseEncryptionKey), "./uploads", "http://localhost:8080/uploads")
	if err := storageService.InitializeFromDB(context.Background()); err != nil {
		logger.Warn("Notice: Platform storage settings initialization", slog.String("info", err.Error()))
	}
	storageHandler := platformStorage.NewHandler(storageService)

	catalogRepo := catalog.NewRepository()
	catalogService := catalog.NewService(catalogRepo, dynamicStorageProvider)
	catalogHandler := catalog.NewHandler(catalogService)

	// Phase 15: Variants & Matrix Subsystem
	variantsRepo := catalog.NewSQLVariantsRepository()
	variantsService := catalog.NewVariantsService(variantsRepo, catalogRepo)
	variantsHandler := catalog.NewVariantsHandler(variantsService)

	// Phase 16: Real-Time Inventory Subsystem
	inventoryRepo := inventory.NewSQLRepository()
	inventoryService := inventory.NewService(inventoryRepo)
	inventoryHandler := inventory.NewHandler(inventoryService)

	// Phase 17: Order State Machine & Fulfillment Subsystem
	ordersRepo := orders.NewSQLRepository()
	ordersService := orders.NewService(ordersRepo, inventoryRepo)
	ordersHandler := orders.NewHandler(ordersService)

	// Phase 18: Customer Directory & LTV Analytics Subsystem
	argonHasher := hasher.NewArgon2idHasher()
	customersRepo := customers.NewSQLRepository()
	customersService := customers.NewService(customersRepo, argonHasher, tokenManager)
	customersHandler := customers.NewHandler(customersService)

	// Phase 19: Promotions & Coupon Architecture
	promotionsRepo := promotions.NewSQLRepository()
	promotionsService := promotions.NewService(promotionsRepo)
	promotionsHandler := promotions.NewHandler(promotionsService)

	// Phase 20: Store Settings & Staff RBAC Subsystem
	settingsRepo := settings.NewSQLRepository()
	settingsService := settings.NewService(settingsRepo, argonHasher)
	settingsHandler := settings.NewHandler(settingsService)

	// Phase 22: Public Storefront Catalog Subsystem
	storefrontCatalogRepo := storefrontCatalog.NewSQLRepository()
	storefrontCatalogService := storefrontCatalog.NewService(storefrontCatalogRepo)
	storefrontCatalogHandler := storefrontCatalog.NewHandler(storefrontCatalogService)

	// Phase 23: Public Storefront Cart Subsystem
	storefrontCartRepo := storefrontCart.NewSQLRepository()
	storefrontCartService := storefrontCart.NewService(storefrontCartRepo)
	storefrontCartHandler := storefrontCart.NewHandler(storefrontCartService)

	// Delivery Zones Subsystem: shipping fees come from zones, never from a store-wide default
	shippingRepo := shipping.NewSQLRepository()
	shippingService := shipping.NewService(shippingRepo)
	shippingHandler := shipping.NewHandler(shippingService)

	// Phase 24: Public Storefront Checkout Subsystem
	storefrontCheckoutRepo := storefrontCheckout.NewSQLRepository()
	storefrontCheckoutService := storefrontCheckout.NewService(storefrontCheckoutRepo, inventoryRepo, promotionsService, settingsRepo, shippingService)
	storefrontCheckoutHandler := storefrontCheckout.NewHandler(storefrontCheckoutService)

	// Phase 25: Payment Gateway Subsystem
	paymentRepo := payments.NewSQLRepository()
	paymentRegistry := payments.NewDriverRegistry()
	paymentService := payments.NewService(paymentRepo, paymentRegistry, []byte(cfg.DatabaseEncryptionKey))
	paymentHandler := payments.NewHandler(paymentService)

	// Phase 26: Courier Logistics Subsystem
	logisticsRepo := logistics.NewSQLRepository()
	logisticsRegistry := logistics.NewDriverRegistry()
	logisticsService := logistics.NewService(logisticsRepo, ordersService, logisticsRegistry, []byte(cfg.DatabaseEncryptionKey))
	logisticsHandler := logistics.NewHandler(logisticsService)

	// Phase 27: Marketing & Telemetry Subsystem
	marketingRepo := marketing.NewSQLRepository()
	capiDispatcher := marketing.NewMetaCAPIDispatcher()
	marketingService := marketing.NewService(marketingRepo, capiDispatcher, []byte(cfg.DatabaseEncryptionKey))
	marketingHandler := marketing.NewHandler(marketingService)

	// Phase 29: Security Auditing & Rate Limiting
	rateLimiter := middleware.NewRateLimiter(redisClient)
	securityRunner := security.NewAuditRunner(platformDB.DB, tenantPool)
	securityHandler := security.NewHandler(securityRunner)

	systemService := platformSystem.NewService(platformDB.DB, redisClient, tenantPool, sessionManager)
	systemHandler := platformSystem.NewHandler(systemService)

	pAccountsService := platformAccounts.NewService(platformDB.DB)
	pAccountsHandler := platformAccounts.NewHandler(pAccountsService)

	sAccountsService := storeAccounts.NewService()
	sAccountsHandler := storeAccounts.NewHandler(sAccountsService)

	// Phase 31: Product Reviews & Reputation Moderation Engine
	reviewsRepo := reviews.NewRepository()
	reviewsService := reviews.NewService(reviewsRepo, redisClient)
	reviewsHandler := reviews.NewHandler(reviewsService)

	// Blog & 100% SEO Editorial Management Subsystem
	blogRepo := blog.NewRepository()
	blogService := blog.NewService(blogRepo)
	blogHandler := blog.NewHandler(blogService)

	// Ambient Music System Subsystem
	musicRepo := music.NewRepository()
	musicService := music.NewService(musicRepo, dynamicStorageProvider)
	musicHandler := music.NewHandler(musicService)

	// Task Management Workstation Subsystem
	tasksRepo := tasks.NewRepository()
	tasksService := tasks.NewService(tasksRepo)
	tasksHandler := tasks.NewHandler(tasksService)

	router := buildRouter(
		cfg, logger, storeResolver, tokenManager,
		pAuthHandler, sAuthHandler, storeMgmtHandler,
		domainHandler, themeHandler, catalogHandler, variantsHandler, inventoryHandler, ordersHandler, customersHandler, promotionsHandler, settingsHandler,
		storefrontCatalogHandler,
		storefrontCartHandler,
		storefrontCheckoutHandler,
		paymentHandler,
		logisticsHandler,
		marketingHandler,
		securityHandler,
		systemHandler,
		pAccountsHandler,
		sAccountsHandler,
		rateLimiter,
		reviewsHandler,
		blogHandler,
		shippingHandler,
		musicHandler,
		tasksHandler,
		sessionManager,
		storageHandler,
	)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info("Starting Ecom Ventures Modular Monolith API Kernel",
			slog.String("addr", server.Addr),
			slog.String("mode", cfg.AppEnv),
		)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("FATAL: HTTP server error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	sig := <-shutdownSignal
	logger.Info("OS signal received. Initiating graceful shutdown...", slog.String("signal", sig.String()))

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("FATAL: Forced shutdown error", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Info("Ecom Ventures API Kernel gracefully terminated.")
}

// mergeThemeConfig combines a theme's design configuration with a store's custom overrides.
// The theme's config_schema is the base design; each top-level key in the overrides replaces the
// base value, and when both values are objects (for example "colors") their keys are merged one
// level deep so an override can change one colour without losing the rest. Invalid or empty JSON
// is treated as an empty object, which the storefront then resolves to the neutral design.
// Inputs: the raw theme config and the raw store overrides. Output: the merged map for the API.
func mergeThemeConfig(base, overrides json.RawMessage) map[string]interface{} {
	merged := map[string]interface{}{}
	if len(base) > 0 {
		var b map[string]interface{}
		if err := json.Unmarshal(base, &b); err == nil {
			merged = b
		}
	}
	if len(overrides) == 0 {
		return merged
	}
	var o map[string]interface{}
	if err := json.Unmarshal(overrides, &o); err != nil {
		return merged
	}
	for key, value := range o {
		baseMap, baseIsMap := merged[key].(map[string]interface{})
		overMap, overIsMap := value.(map[string]interface{})
		if baseIsMap && overIsMap {
			for k, v := range overMap {
				baseMap[k] = v
			}
			continue
		}
		merged[key] = value
	}
	return merged
}
