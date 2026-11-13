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
)

// Service coordinates storefront checkout processing.
type Service struct {
	repo          Repository
	inventoryRepo inventory.Repository
	promotionsSvc *promotions.Service
	settingsRepo  settings.Repository
}

// NewService instantiates the checkout domain service.
func NewService(
	repo Repository,
	invRepo inventory.Repository,
	promSvc *promotions.Service,
	setRepo settings.Repository,
) *Service {
	return &Service{
		repo:          repo,
		inventoryRepo: invRepo,
		promotionsSvc: promSvc,
		settingsRepo:  setRepo,
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

	// 2. Fetch default store shipping fee settings
	settingsData, err := s.settingsRepo.GetSettings(ctx, stCtx.TenantDB)
	shippingFee := 60.00
	if err == nil && settingsData != nil {
		shippingFee = settingsData.DefaultShippingFee
	}

	// 3. Begin atomic transaction
	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin checkout transaction: %w", err)
	}
	defer tx.Rollback()

	// 4. Concurrently lock and reserve inventory for all items
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

	// 5. Evaluate and redeem coupon if supplied
	var discountAmount float64
	if req.CouponCode != nil && *req.CouponCode != "" {
		discount, err := s.promotionsSvc.RedeemCouponTx(ctx, tx, *req.CouponCode, orderNumber, req.CustomerID, req.CustomerEmail, subtotal, shippingFee)
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

	// 6. Insert order and order items
	if err := s.repo.CreateOrderTx(ctx, tx, order, items); err != nil {
		return nil, err
	}

	// 7. Clear the session shopping cart
	if err := s.repo.ClearCartSessionTx(ctx, tx, cartID); err != nil {
		return nil, fmt.Errorf("failed to clear shopping cart: %w", err)
	}

	// 8. Commit atomic transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order transaction: %w", err)
	}

	return s.repo.GetOrderByNumber(ctx, stCtx.TenantDB, orderNumber)
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
