// Package main provides the entrypoint for the centralized Ecom Ventures API layer.
package main

import (
	"context"
	"database/sql"
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
	"ecom-ventures/backend/internal/store/orders"
	"ecom-ventures/backend/internal/store/payments"
	"ecom-ventures/backend/internal/store/promotions"
	"ecom-ventures/backend/internal/store/resolver"
	"ecom-ventures/backend/internal/store/reviews"
	"ecom-ventures/backend/internal/store/settings"
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
) http.Handler {
	r := chi.NewRouter()

	// Global Core Middleware Chain
	r.Use(middleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(middleware.StructuredLogger(logger))
	r.Use(chiMiddleware.Compress(5))
	r.Use(middleware.Recoverer(logger))
	r.Use(middleware.CORSConfig(cfg.Routing.MasterAdminDomain, cfg.Routing.StoreAdminDomain))
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
						r.Delete("/{id}", domainHandler.Delete)
					})
				}

				// Theme Registry & Management Engine
				if themeHandler != nil {
					r.Route("/themes", func(r chi.Router) {
						r.Get("/", themeHandler.List)
						r.Post("/", themeHandler.Register)
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
						adminR.Patch("/{id}/status", systemHandler.UpdateAdminStatus)
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
								r.Get("/", catalogHandler.ListCategories)
								r.Post("/", catalogHandler.CreateCategory)
								r.Put("/{id}", catalogHandler.UpdateCategory)
								r.Delete("/{id}", catalogHandler.DeleteCategory)
							})

							// Products
							r.Route("/products", func(r chi.Router) {
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
							r.Post("/attributes", variantsHandler.CreateAttribute)
							r.Post("/attributes/{attribute_id}/values", variantsHandler.AddAttributeValue)

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
						ordR.Get("/{order_id}", ordersHandler.GetOrder)
						ordR.Put("/{order_id}", ordersHandler.UpdateOrder)
						ordR.Delete("/{order_id}", ordersHandler.DeleteOrder)
						ordR.Patch("/{order_id}/status", ordersHandler.TransitionStatus)
						ordR.Post("/{order_id}/shipments", ordersHandler.CreateShipment)
						ordR.Post("/{order_id}/payments", ordersHandler.RecordPayment)
						ordR.Post("/{order_id}/call-notes", ordersHandler.AddCallNote)
						ordR.Get("/{order_id}/call-notes", ordersHandler.GetCallNotes)
					})
				}

				// Phase 18: Customers & Address Book
				if customersHandler != nil {
					r.Route("/customers", func(custR chi.Router) {
						custR.Get("/", customersHandler.ListCustomers)
						custR.Post("/", customersHandler.CreateCustomer)
						custR.Get("/{customer_id}", customersHandler.GetCustomer)
						custR.Put("/{customer_id}", customersHandler.UpdateCustomer)
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
					})
				}

				// Phase 26: Store Courier Logistics Dispatch & Settings
				if logisticsHandler != nil {
					r.Route("/logistics", func(logR chi.Router) {
						logR.Post("/dispatch/{order_id}", logisticsHandler.DispatchOrder)
					})

					r.Route("/settings/logistics", func(setR chi.Router) {
						setR.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN"))
						setR.Get("/", logisticsHandler.ListConfigs)
						setR.Put("/", logisticsHandler.SaveConfig)
					})
				}

				// Phase 27: Store Marketing & Tracking Telemetry Settings
				if marketingHandler != nil {
					r.Route("/settings/marketing", func(mktAdminR chi.Router) {
						mktAdminR.Use(middleware.RequireStoreRole("STORE_OWNER", "STORE_ADMIN"))
						mktAdminR.Get("/", marketingHandler.GetAdminConfig)
						mktAdminR.Put("/", marketingHandler.SaveAdminConfig)
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
					if th, err := themeHandler.GetService().GetStoreTheme(r.Context(), sc.Store.ID); err == nil {
						themeData = th
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

				response.JSON(w, http.StatusOK, map[string]interface{}{
					"store":            brand,
					"domain":           sc.Domain,
					"is_custom_domain": sc.IsCustom,
					"theme":            themeData,
					"seo":              seoSettings,
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
			}

			// Phase 25: Public Storefront Payment Gateway APIs
			if paymentHandler != nil {
				r.Route("/payments", func(payR chi.Router) {
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

	sAuthService := storeAuth.NewService(tokenManager)
	sAuthHandler := storeAuth.NewHandler(sAuthService)

	encryptionKeyBytes := []byte(cfg.Security.JWTSecret[:32])
	if len(cfg.DatabaseEncryptionKey) >= 32 {
		encryptionKeyBytes = []byte(cfg.DatabaseEncryptionKey[:32])
	}
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

	storeMgmtService := store_mgmt.NewService(platformDB.DB, dbProvisioner, storeResolver, tenantPool)
	storeMgmtHandler := store_mgmt.NewHandler(storeMgmtService)

	// Domains Engine
	dnsVerifier := domains.NewStandardDNSVerifier()
	cfClient := domains.NewCloudflareClient(os.Getenv("CLOUDFLARE_API_TOKEN"), os.Getenv("CLOUDFLARE_ZONE_ID"))
	domainService := domains.NewService(platformDB.DB, dnsVerifier, cfClient, storeResolver)
	domainHandler := domains.NewHandler(domainService)

	// Theme Management Engine
	themeService := themes.NewService(platformDB.DB, redisClient, storeResolver)
	themeHandler := themes.NewHandler(themeService)

	// Initialize Object Storage Service
	localStorageProvider, err := storage.NewLocalStorage("./uploads", "http://localhost:8080/uploads")
	if err != nil {
		logger.Error("FATAL: Failed to initialize local object storage", slog.String("error", err.Error()))
		os.Exit(1)
	}

	catalogRepo := catalog.NewRepository()
	catalogService := catalog.NewService(catalogRepo, localStorageProvider)
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
	customersService := customers.NewService(customersRepo, argonHasher)
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

	// Phase 24: Public Storefront Checkout Subsystem
	storefrontCheckoutRepo := storefrontCheckout.NewSQLRepository()
	storefrontCheckoutService := storefrontCheckout.NewService(storefrontCheckoutRepo, inventoryRepo, promotionsService, settingsRepo)
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

	systemService := platformSystem.NewService(platformDB.DB, redisClient, tenantPool)
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
