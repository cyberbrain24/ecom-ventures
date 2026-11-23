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
		Code:                  cleanCode,
		Description:           strings.TrimSpace(req.Description),
		DiscountType:          req.DiscountType,
		DiscountValue:         req.DiscountValue,
		MinSubtotal:           req.MinSubtotal,
		MaxDiscountAmount:     req.MaxDiscountAmount,
		MaxUses:               req.MaxUses,
		MaxUsesPerCustomer:    req.MaxUsesPerCustomer,
		ValidFrom:             req.ValidFrom,
		ValidTo:               req.ValidTo,
		IsActive:              req.IsActive,
		ApplicableCategoryIDs: req.ApplicableCategoryIDs,
		IncludedProductIDs:    req.IncludedProductIDs,
		ExcludedProductIDs:    req.ExcludedProductIDs,
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, fmt.Errorf("failed to verify promotions schema: %w", err)
	}

	if err := s.repo.CreateCoupon(ctx, stCtx.TenantDB, coupon); err != nil {
		return nil, err
	}

	return coupon, nil
}

// ValidateAndCalculateDiscount tests cart discount eligibility against targeting and limits without mutating usage state.
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
	customerPhone := strings.TrimSpace(req.CustomerPhone)
	usageCount, err := s.repo.GetCustomerUsageCount(ctx, stCtx.TenantDB, coupon.ID, req.CustomerID, customerEmail, customerPhone)
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

	// Resolve hierarchical category tree if coupon targets specific categories
	var resolvedCategoryMap = make(map[string]bool)
	if len(coupon.ApplicableCategoryIDs) > 0 {
		descendants, err := s.repo.GetDescendantCategoryIDs(ctx, stCtx.TenantDB, coupon.ApplicableCategoryIDs)
		if err != nil {
			return nil, err
		}
		for _, id := range descendants {
			resolvedCategoryMap[id] = true
		}
	}

	result, err := s.evaluator.EvaluateAndAllocate(coupon, req.Items, req.Subtotal, req.ShippingFee, resolvedCategoryMap)
	if err != nil {
		return &ValidateCouponResponse{
			IsValid: false,
			Code:    coupon.Code,
			Message: err.Error(),
		}, nil
	}

	finalSubtotal := req.Subtotal - result.TotalDiscount
	if finalSubtotal < 0 {
		finalSubtotal = 0
	}

	return &ValidateCouponResponse{
		IsValid:          true,
		Code:             coupon.Code,
		DiscountType:     coupon.DiscountType,
		DiscountAmount:   result.TotalDiscount,
		EligibleSubtotal: result.EligibleSubtotal,
		FinalSubtotal:    finalSubtotal,
		FinalShippingFee: result.FinalShippingFee,
		LineItemDetails:  result.LineItemDetails,
		Message:          "Coupon successfully applied",
	}, nil
}

// RedeemCouponTx atomically verifies eligibility and records redemption within an existing transaction.
func (s *Service) RedeemCouponTx(
	ctx context.Context,
	tx *sql.Tx,
	code string,
	orderID string,
	customerID *string,
	customerEmail,
	customerPhone string,
	subtotal,
	shippingFee float64,
	items []CartLineItem,
) (float64, error) {
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	coupon, err := s.repo.GetCouponByCodeForUpdate(ctx, tx, cleanCode)
	if err != nil {
		return 0, err
	}

	customerEmail = strings.ToLower(strings.TrimSpace(customerEmail))
	customerPhone = strings.TrimSpace(customerPhone)
	usageCount, err := s.repo.GetCustomerUsageCountTx(ctx, tx, coupon.ID, customerID, customerEmail, customerPhone)
	if err != nil {
		return 0, err
	}

	now := time.Now()
	if err := s.evaluator.EvaluateEligibility(coupon, subtotal, usageCount, now); err != nil {
		return 0, err
	}

	var resolvedCategoryMap = make(map[string]bool)
	if len(coupon.ApplicableCategoryIDs) > 0 {
		// Category resolution can use db connection or query within tx if needed
		stCtx, err := storeCtx.FromContext(ctx)
		if err == nil {
			descendants, err := s.repo.GetDescendantCategoryIDs(ctx, stCtx.TenantDB, coupon.ApplicableCategoryIDs)
			if err == nil {
				for _, id := range descendants {
					resolvedCategoryMap[id] = true
				}
			}
		}
	}

	evalResult, err := s.evaluator.EvaluateAndAllocate(coupon, items, subtotal, shippingFee, resolvedCategoryMap)
	if err != nil {
		return 0, err
	}

	discountAmount := evalResult.TotalDiscount

	usage := &CouponUsage{
		CouponID:       coupon.ID,
		OrderID:        orderID,
		CustomerID:     customerID,
		CustomerEmail:  customerEmail,
		CustomerPhone:  customerPhone,
		DiscountAmount: discountAmount,
	}

	if err := s.repo.RecordCouponUsageTx(ctx, tx, usage); err != nil {
		return 0, fmt.Errorf("failed to record coupon usage: %w", err)
	}

	if err := s.repo.IncrementCouponTimesUsedTx(ctx, tx, coupon.ID); err != nil {
		return 0, fmt.Errorf("failed to increment coupon redemption count: %w", err)
	}

	return discountAmount, nil
}

// GetCoupon retrieves a coupon by ID.
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

// ListCoupons retrieves a paginated collection of coupons.
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

// UpdateCoupon updates coupon metadata and targeting rules.
func (s *Service) UpdateCoupon(ctx context.Context, id string, req *UpdateCouponRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if req.ValidTo.Before(req.ValidFrom) {
		return errors.New("valid_to date cannot be earlier than valid_from date")
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}

	return s.repo.UpdateCoupon(ctx, stCtx.TenantDB, id, req)
}

// DeleteCoupon removes a coupon.
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

// ToggleCouponStatus toggles the is_active status of a coupon.
func (s *Service) ToggleCouponStatus(ctx context.Context, id string, isActive bool) error {
	c, err := s.GetCoupon(ctx, id)
	if err != nil {
		return err
	}

	req := &UpdateCouponRequest{
		Description:           c.Description,
		MinSubtotal:           c.MinSubtotal,
		MaxDiscountAmount:     c.MaxDiscountAmount,
		MaxUses:               c.MaxUses,
		MaxUsesPerCustomer:    c.MaxUsesPerCustomer,
		ValidFrom:             c.ValidFrom,
		ValidTo:               c.ValidTo,
		IsActive:              isActive,
		ApplicableCategoryIDs: c.ApplicableCategoryIDs,
		IncludedProductIDs:    c.IncludedProductIDs,
		ExcludedProductIDs:    c.ExcludedProductIDs,
	}

	return s.UpdateCoupon(ctx, id, req)
}
