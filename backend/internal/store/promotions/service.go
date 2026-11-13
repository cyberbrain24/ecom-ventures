// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, discount rules, and cart promotion evaluations.
package promotions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

// Service coordinates promotion domain operations and database transactions.
type Service struct {
	repo      Repository
	evaluator *Evaluator
}

// NewService instantiates the promotion domain service.
func NewService(repo Repository) *Service {
	return &Service{
		repo:      repo,
		evaluator: NewEvaluator(),
	}
}

// CreateCoupon registers a new promotion code with validation checks inside the active tenant database.
func (s *Service) CreateCoupon(ctx context.Context, req *CreateCouponRequest) (*Coupon, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.Code))
	if cleanCode == "" {
		return nil, errors.New("coupon code is required")
	}

	if req.DiscountValue <= 0 {
		return nil, errors.New("discount value must be positive")
	}

	if req.DiscountType == DiscountTypePercentage && req.DiscountValue > 100 {
		return nil, errors.New("percentage discount cannot exceed 100%")
	}

	if req.ValidTo.Before(req.ValidFrom) {
		return nil, errors.New("valid_to date cannot be earlier than valid_from date")
	}

	coupon := &Coupon{
		Code:               cleanCode,
		Description:        strings.TrimSpace(req.Description),
		DiscountType:       req.DiscountType,
		DiscountValue:      req.DiscountValue,
		MinSubtotal:        req.MinSubtotal,
		MaxDiscountAmount:  req.MaxDiscountAmount,
		MaxUses:            req.MaxUses,
		MaxUsesPerCustomer: req.MaxUsesPerCustomer,
		ValidFrom:          req.ValidFrom,
		ValidTo:            req.ValidTo,
		IsActive:           req.IsActive,
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, fmt.Errorf("failed to verify promotions schema: %w", err)
	}

	if err := s.repo.CreateCoupon(ctx, stCtx.TenantDB, coupon); err != nil {
		return nil, err
	}

	return coupon, nil
}

// ValidateAndCalculateDiscount tests cart discount eligibility without mutating usage state.
func (s *Service) ValidateAndCalculateDiscount(ctx context.Context, req *ValidateCouponRequest) (*ValidateCouponResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.Code))
	if cleanCode == "" {
		return nil, errors.New("coupon code is required")
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	coupon, err := s.repo.GetCouponByCode(ctx, stCtx.TenantDB, cleanCode)
	if err != nil {
		if errors.Is(err, ErrCouponNotFound) {
			return &ValidateCouponResponse{
				IsValid: false,
				Code:    cleanCode,
				Message: "Invalid or nonexistent coupon code",
			}, nil
		}
		return nil, err
	}

	customerEmail := strings.ToLower(strings.TrimSpace(req.CustomerEmail))
	usageCount, err := s.repo.GetCustomerUsageCount(ctx, stCtx.TenantDB, coupon.ID, req.CustomerID, customerEmail)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if err := s.evaluator.EvaluateEligibility(coupon, req.Subtotal, usageCount, now); err != nil {
		return &ValidateCouponResponse{
			IsValid: false,
			Code:    coupon.Code,
			Message: err.Error(),
		}, nil
	}

	discountAmount, finalShipping := s.evaluator.CalculateDiscount(coupon, req.Subtotal, req.ShippingFee)
	finalSubtotal := req.Subtotal - discountAmount
	if finalSubtotal < 0 {
		finalSubtotal = 0
	}

	return &ValidateCouponResponse{
		IsValid:          true,
		Code:             coupon.Code,
		DiscountType:     coupon.DiscountType,
		DiscountAmount:   discountAmount,
		FinalSubtotal:    finalSubtotal,
		FinalShippingFee: finalShipping,
		Message:          "Coupon successfully applied",
	}, nil
}

// RedeemCouponTx atomically verifies eligibility and records redemption within an existing transaction.
func (s *Service) RedeemCouponTx(ctx context.Context, tx *sql.Tx, code string, orderID string, customerID *string, customerEmail string, subtotal, shippingFee float64) (float64, error) {
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	coupon, err := s.repo.GetCouponByCodeForUpdate(ctx, tx, cleanCode)
	if err != nil {
		return 0, err
	}

	customerEmail = strings.ToLower(strings.TrimSpace(customerEmail))
	usageCount, err := s.repo.GetCustomerUsageCountTx(ctx, tx, coupon.ID, customerID, customerEmail)
	if err != nil {
		return 0, err
	}

	now := time.Now()
	if err := s.evaluator.EvaluateEligibility(coupon, subtotal, usageCount, now); err != nil {
		return 0, err
	}

	discountAmount, _ := s.evaluator.CalculateDiscount(coupon, subtotal, shippingFee)

	usage := &CouponUsage{
		CouponID:       coupon.ID,
		OrderID:        orderID,
		CustomerID:     customerID,
		CustomerEmail:  customerEmail,
		DiscountAmount: discountAmount,
	}

	if err := s.repo.RecordCouponUsageTx(ctx, tx, usage); err != nil {
		return 0, fmt.Errorf("failed to record coupon usage: %w", err)
	}

	if err := s.repo.IncrementCouponTimesUsedTx(ctx, tx, coupon.ID); err != nil {
		return 0, fmt.Errorf("failed to increment coupon redemption counter: %w", err)
	}

	return discountAmount, nil
}

// ListCoupons returns a paginated list of store coupons.
func (s *Service) ListCoupons(ctx context.Context, filter *CouponFilterParams) (*PaginatedCouponsResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	coupons, total, err := s.repo.ListCoupons(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}

	return &PaginatedCouponsResponse{
		Coupons: coupons,
		Total:   total,
		Page:    filter.Page,
		Limit:   filter.Limit,
	}, nil
}

// GetCoupon retrieves a single coupon by ID.
func (s *Service) GetCoupon(ctx context.Context, id string) (*Coupon, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	return s.repo.GetCouponByID(ctx, stCtx.TenantDB, id)
}

// UpdateCoupon updates coupon parameters.
func (s *Service) UpdateCoupon(ctx context.Context, id string, req *UpdateCouponRequest) (*Coupon, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.ValidTo.Before(req.ValidFrom) {
		return nil, errors.New("valid_to date cannot be earlier than valid_from date")
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	if err := s.repo.UpdateCoupon(ctx, stCtx.TenantDB, id, req); err != nil {
		return nil, err
	}

	return s.repo.GetCouponByID(ctx, stCtx.TenantDB, id)
}

// DeleteCoupon removes a coupon from the store.
func (s *Service) DeleteCoupon(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}

	return s.repo.DeleteCoupon(ctx, stCtx.TenantDB, id)
}
