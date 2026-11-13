// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, multi-item bundle tiers, and cart promotion evaluations.
package promotions

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

// ListBundleTiers returns all bundle tiers for the active store tenant.
func (s *Service) ListBundleTiers(ctx context.Context, activeOnly bool) ([]BundleTier, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	return s.repo.ListBundleTiers(ctx, stCtx.TenantDB, activeOnly)
}

// GetBundleTier retrieves a specific bundle tier by ID.
func (s *Service) GetBundleTier(ctx context.Context, id string) (*BundleTier, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, errors.New("bundle tier id is required")
	}

	return s.repo.GetBundleTierByID(ctx, stCtx.TenantDB, cleanID)
}

// CreateBundleTier validates input parameters and stores a new combo tier.
func (s *Service) CreateBundleTier(ctx context.Context, req *CreateBundleTierRequest) (*BundleTier, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanName := strings.TrimSpace(req.Name)
	if cleanName == "" {
		return nil, errors.New("bundle tier name is required")
	}

	if req.RequiredItemsCount < 2 {
		return nil, errors.New("required items count must be at least 2")
	}

	if req.DiscountPercentage < 0 || req.DiscountPercentage > 100 {
		return nil, errors.New("discount percentage must be between 0 and 100")
	}

	cleanPerks := make([]string, 0, len(req.Perks))
	for _, p := range req.Perks {
		cp := strings.TrimSpace(p)
		if cp != "" {
			cleanPerks = append(cleanPerks, cp)
		}
	}

	tier := &BundleTier{
		Name:               cleanName,
		RequiredItemsCount: req.RequiredItemsCount,
		DiscountPercentage: math.Round(req.DiscountPercentage*100) / 100,
		BadgeText:          strings.TrimSpace(req.BadgeText),
		Subtitle:           strings.TrimSpace(req.Subtitle),
		Perks:              cleanPerks,
		HasFreeDelivery:    req.HasFreeDelivery,
		DisplayOrder:       req.DisplayOrder,
		IsActive:           req.IsActive,
	}

	if err := s.repo.CreateBundleTier(ctx, stCtx.TenantDB, tier); err != nil {
		return nil, err
	}

	return tier, nil
}

// UpdateBundleTier modifies an existing bundle tier.
func (s *Service) UpdateBundleTier(ctx context.Context, id string, req *UpdateBundleTierRequest) (*BundleTier, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, errors.New("bundle tier id is required")
	}

	cleanName := strings.TrimSpace(req.Name)
	if cleanName == "" {
		return nil, errors.New("bundle tier name is required")
	}

	if req.RequiredItemsCount < 2 {
		return nil, errors.New("required items count must be at least 2")
	}

	if req.DiscountPercentage < 0 || req.DiscountPercentage > 100 {
		return nil, errors.New("discount percentage must be between 0 and 100")
	}

	cleanPerks := make([]string, 0, len(req.Perks))
	for _, p := range req.Perks {
		cp := strings.TrimSpace(p)
		if cp != "" {
			cleanPerks = append(cleanPerks, cp)
		}
	}

	tier := &BundleTier{
		ID:                 cleanID,
		Name:               cleanName,
		RequiredItemsCount: req.RequiredItemsCount,
		DiscountPercentage: math.Round(req.DiscountPercentage*100) / 100,
		BadgeText:          strings.TrimSpace(req.BadgeText),
		Subtitle:           strings.TrimSpace(req.Subtitle),
		Perks:              cleanPerks,
		HasFreeDelivery:    req.HasFreeDelivery,
		DisplayOrder:       req.DisplayOrder,
		IsActive:           req.IsActive,
	}

	if err := s.repo.UpdateBundleTier(ctx, stCtx.TenantDB, tier); err != nil {
		return nil, err
	}

	return tier, nil
}

// DeleteBundleTier removes a bundle tier.
func (s *Service) DeleteBundleTier(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return errors.New("bundle tier id is required")
	}

	return s.repo.DeleteBundleTier(ctx, stCtx.TenantDB, cleanID)
}

// ToggleBundleTierStatus updates the active flag of a bundle tier.
func (s *Service) ToggleBundleTierStatus(ctx context.Context, id string, isActive bool) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return errors.New("bundle tier id is required")
	}

	return s.repo.ToggleBundleTierStatus(ctx, stCtx.TenantDB, cleanID, isActive)
}

// CalculateBundle performs slot validation and pro-rated mathematical line item pricing.
func (s *Service) CalculateBundle(ctx context.Context, tierID string, slots []BundleCalculationSlot) (*BundleCalculationResult, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	tier, err := s.repo.GetBundleTierByID(ctx, stCtx.TenantDB, tierID)
	if err != nil {
		return nil, err
	}

	if !tier.IsActive {
		return nil, errors.New("selected bundle tier is currently inactive")
	}

	if len(slots) != tier.RequiredItemsCount {
		return nil, fmt.Errorf("bundle requires exactly %d items, but received %d", tier.RequiredItemsCount, len(slots))
	}

	var originalTotal float64
	var discountAmount float64
	calcItems := make([]BundleCalculationItem, len(slots))

	discountFactor := tier.DiscountPercentage / 100.0

	for i, slot := range slots {
		if slot.UnitPrice < 0 {
			return nil, errors.New("invalid garment unit price")
		}

		itemSavings := math.Round(slot.UnitPrice*discountFactor*100) / 100
		itemDiscountedPrice := math.Max(0, math.Round((slot.UnitPrice-itemSavings)*100)/100)

		originalTotal += slot.UnitPrice
		discountAmount += itemSavings

		calcItems[i] = BundleCalculationItem{
			ProductID:       slot.ProductID,
			VariantID:       slot.VariantID,
			Title:           slot.Title,
			OriginalPrice:   slot.UnitPrice,
			DiscountedPrice: itemDiscountedPrice,
			Savings:         itemSavings,
		}
	}

	originalTotal = math.Round(originalTotal*100) / 100
	discountAmount = math.Round(discountAmount*100) / 100
	finalTotal := math.Max(0, math.Round((originalTotal-discountAmount)*100)/100)

	return &BundleCalculationResult{
		TierID:             tier.ID,
		TierName:           tier.Name,
		DiscountPercentage: tier.DiscountPercentage,
		OriginalTotal:      originalTotal,
		DiscountAmount:     discountAmount,
		FinalTotal:         finalTotal,
		HasFreeDelivery:    tier.HasFreeDelivery,
		Items:              calcItems,
	}, nil
}
