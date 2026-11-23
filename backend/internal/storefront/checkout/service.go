// Package checkout provides domain logic and HTTP APIs for storefront
// checkout submission, atomic order creation, and public order tracking.
package checkout

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/internal/store/inventory"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/internal/store/promotions"
	"ecom-ventures/backend/internal/store/settings"
	"ecom-ventures/backend/internal/store/shipping"
)

// Service coordinates storefront checkout processing.
type Service struct {
	repo          Repository
	inventoryRepo inventory.Repository
	promotionsSvc *promotions.Service
	settingsRepo  settings.Repository
	shippingSvc   *shipping.Service
}

// NewService instantiates the checkout domain service.
func NewService(
	repo Repository,
	invRepo inventory.Repository,
	promSvc *promotions.Service,
	setRepo settings.Repository,
	shipSvc *shipping.Service,
) *Service {
	return &Service{
		repo:          repo,
		inventoryRepo: invRepo,
		promotionsSvc: promSvc,
		settingsRepo:  setRepo,
		shippingSvc:   shipSvc,
	}
}

// ProcessCheckout validates cart items, evaluates coupons, reserves inventory, and persists order atomically.
func (s *Service) ProcessCheckout(ctx context.Context, req *CheckoutRequest) (*CheckoutReceiptResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.CustomerEmail == "" || req.CustomerPhone == "" || req.ShippingAddress.RecipientName == "" {
		return nil, errors.New("customer contact and recipient information are required")
	}

	// 1. Fetch cart items and calculate subtotal
	items, subtotal, cartID, err := s.repo.GetCartItemsForCheckout(ctx, stCtx.TenantDB, req.SessionID)
	if err != nil {
		return nil, err
	}

	// 2. Resolve the shipping fee from the delivery zone that covers the address
	shippingFee, err := s.resolveShippingFee(ctx, req.ShippingAddress)
	if err != nil {
		return nil, err
	}

	// 3. Read store settings (order number prefix)
	settingsData, err := s.settingsRepo.GetSettings(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, fmt.Errorf("reading store settings: %w", err)
	}
	if settingsData == nil {
		return nil, errors.New("store settings are missing")
	}

	// 4. Begin atomic transaction
	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin checkout transaction: %w", err)
	}
	defer tx.Rollback()

	// 5. Concurrently lock and reserve inventory for all items
	orderPrefix := "ORD"
	if settingsData != nil && strings.TrimSpace(settingsData.OrderNumberPrefix) != "" {
		orderPrefix = strings.TrimSpace(settingsData.OrderNumberPrefix)
	}
	orderNumber := generateOrderNumber(orderPrefix)
	for _, it := range items {
		if _, err := s.inventoryRepo.ReserveStockTx(ctx, tx, it.VariantID, it.Quantity, orderNumber, "STOREFRONT_CHECKOUT"); err != nil {
			return nil, fmt.Errorf("stock reservation failed for SKU %s: %w", it.SKU, err)
		}
	}

	// 6. Evaluate and redeem coupon if supplied
	var discountAmount float64
	if req.CouponCode != nil && *req.CouponCode != "" {
		// Convert cart items to promotions.CartLineItem for targeting and line item allocation
		promItems := make([]promotions.CartLineItem, 0, len(items))
		for _, it := range items {
			promItems = append(promItems, promotions.CartLineItem{
				ProductID:  it.ProductID,
				VariantID:  it.VariantID,
				CategoryID: it.CategoryID,
				Title:      it.ProductTitle,
				Price:      it.UnitPrice,
				Quantity:   it.Quantity,
				Subtotal:   it.TotalPrice,
			})
		}

		discount, err := s.promotionsSvc.RedeemCouponTx(
			ctx,
			tx,
			*req.CouponCode,
			orderNumber,
			req.CustomerID,
			req.CustomerEmail,
			req.CustomerPhone,
			subtotal,
			shippingFee,
			promItems,
		)
		if err != nil {
			return nil, fmt.Errorf("coupon application failed: %w", err)
		}
		discountAmount = discount
	}

	totalAmount := subtotal + shippingFee - discountAmount
	if totalAmount < 0 {
		totalAmount = 0
	}

	paymentMethod := strings.ToUpper(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "COD"
	}

	// Verify the chosen payment gateway is active for this store.
	// If deactivated in Store Admin, reject the order placement.
	var isGatewayEnabled bool
	err = stCtx.TenantDB.QueryRowContext(ctx, "SELECT is_enabled FROM store_payment_gateways WHERE gateway = $1;", paymentMethod).Scan(&isGatewayEnabled)
	if err == nil && !isGatewayEnabled {
		return nil, fmt.Errorf("payment method %s is currently deactivated for this store", paymentMethod)
	}

	order := &storeModels.Order{
		OrderNumber:     orderNumber,
		CustomerID:      req.CustomerID,
		CustomerEmail:   strings.ToLower(strings.TrimSpace(req.CustomerEmail)),
		CustomerPhone:   strings.TrimSpace(req.CustomerPhone),
		Status:          storeModels.OrderStatusPending,
		PaymentStatus:   storeModels.PaymentStatusPending,
		Currency:        stCtx.Store.Currency,
		Subtotal:        subtotal,
		ShippingFee:     shippingFee,
		DiscountAmount:  discountAmount,
		TotalAmount:     totalAmount,
		ShippingAddress: req.ShippingAddress,
		BillingAddress:  req.BillingAddress,
		PaymentMethod:   paymentMethod,
		Notes:           req.Notes,
	}

	// 7. Insert order and order items
	if err := s.repo.CreateOrderTx(ctx, tx, order, items); err != nil {
		return nil, err
	}

	// 8. Clear the session shopping cart
	if err := s.repo.ClearCartSessionTx(ctx, tx, cartID); err != nil {
		return nil, fmt.Errorf("failed to clear shopping cart: %w", err)
	}

	// 9. Commit atomic transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order transaction: %w", err)
	}

	// 10. Auto-Purge from Abandoned Recovery Queue (Pillar 3: Zero Ghost Calls)
	_, _ = stCtx.TenantDB.ExecContext(ctx, `
		DELETE FROM abandoned_checkouts
		WHERE (session_token = $1 OR REPLACE(REPLACE(phone, ' ', ''), '+88', '') LIKE $2)
		  AND status NOT IN ('converted');
	`, req.SessionID, "%"+strings.TrimPrefix(strings.ReplaceAll(req.CustomerPhone, " ", ""), "+88"))

	return s.repo.GetOrderByNumber(ctx, stCtx.TenantDB, orderNumber)
}

// resolveShippingFee returns the fee of the delivery zone covering the shipping address.
// It wraps shipping.ErrZoneNotFound when no zone matches, and never falls back to a default fee.
func (s *Service) resolveShippingFee(ctx context.Context, addr storeModels.CustomerAddress) (float64, error) {
	zone, err := s.shippingSvc.FindZone(ctx, shippingDistrict(addr), addr.City)
	if err != nil {
		return 0, fmt.Errorf("resolving shipping fee for city %q: %w", addr.City, err)
	}
	return zone.ShippingFee, nil
}

// shippingDistrict returns the value matched against a zone's district.
// Customer addresses carry no district field, so the state_province is used.
func shippingDistrict(addr storeModels.CustomerAddress) string {
	if addr.StateProvince == nil {
		return ""
	}
	return strings.TrimSpace(*addr.StateProvince)
}

// LookupOrder returns public order details after verifying phone or email.
func (s *Service) LookupOrder(ctx context.Context, orderNumber, contactVerify string) (*CheckoutReceiptResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	receipt, err := s.repo.GetOrderByNumber(ctx, stCtx.TenantDB, orderNumber)
	if err != nil {
		return nil, err
	}

	contactClean := strings.ToLower(strings.TrimSpace(contactVerify))
	if !strings.EqualFold(receipt.CustomerEmail, contactClean) && !strings.Contains(receipt.CustomerPhone, contactClean) {
		return nil, ErrOrderNotFound // Do not leak existence if verification fails
	}

	return receipt, nil
}

func generateOrderNumber(prefix string) string {
	cleanPrefix := strings.TrimSpace(prefix)
	if cleanPrefix == "" {
		cleanPrefix = "ORD"
	}
	cleanPrefix = strings.TrimSuffix(cleanPrefix, "-")
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	timestamp := time.Now().Format("060102")
	return fmt.Sprintf("%s-%s-%s", cleanPrefix, timestamp, strings.ToUpper(hex.EncodeToString(b)))
}
