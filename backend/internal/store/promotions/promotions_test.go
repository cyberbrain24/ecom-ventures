package promotions

import (
	"testing"
	"time"
)

func TestPercentageDiscountWithCap(t *testing.T) {
	evaluator := NewEvaluator()
	maxCap := 500.00
	coupon := &Coupon{
		DiscountType:      DiscountTypePercentage,
		DiscountValue:     20.00, // 20%
		MaxDiscountAmount: &maxCap,
	}

	// 20% of 2000 is 400 (under 500 cap)
	discount, _ := evaluator.CalculateDiscount(coupon, 2000.00, 60.00)
	if discount != 400.00 {
		t.Errorf("expected discount 400.00, got %.2f", discount)
	}

	// 20% of 5000 is 1000 (capped at 500)
	discountCapped, _ := evaluator.CalculateDiscount(coupon, 5000.00, 60.00)
	if discountCapped != 500.00 {
		t.Errorf("expected discount capped at 500.00, got %.2f", discountCapped)
	}
}

func TestFixedAmountDiscount(t *testing.T) {
	evaluator := NewEvaluator()
	coupon := &Coupon{
		DiscountType:  DiscountTypeFixedAmount,
		DiscountValue: 250.00,
	}

	discount, _ := evaluator.CalculateDiscount(coupon, 1000.00, 50.00)
	if discount != 250.00 {
		t.Errorf("expected fixed discount 250.00, got %.2f", discount)
	}

	// Fixed discount cannot exceed cart subtotal
	discountExcess, _ := evaluator.CalculateDiscount(coupon, 150.00, 50.00)
	if discountExcess != 150.00 {
		t.Errorf("expected discount clamped to subtotal 150.00, got %.2f", discountExcess)
	}
}

func TestFreeShippingDiscount(t *testing.T) {
	evaluator := NewEvaluator()
	coupon := &Coupon{
		DiscountType: DiscountTypeFreeShipping,
	}

	discount, finalShipping := evaluator.CalculateDiscount(coupon, 1200.00, 100.00)
	if discount != 100.00 {
		t.Errorf("expected discount 100.00 for free shipping, got %.2f", discount)
	}
	if finalShipping != 0.00 {
		t.Errorf("expected final shipping fee 0.00, got %.2f", finalShipping)
	}
}

func TestEligibilityValidation(t *testing.T) {
	evaluator := NewEvaluator()
	now := time.Now()

	coupon := &Coupon{
		IsActive:           true,
		MinSubtotal:        1500.00,
		MaxUses:            10,
		TimesUsed:          5,
		MaxUsesPerCustomer: 1,
		ValidFrom:          now.Add(-24 * time.Hour),
		ValidTo:            now.Add(24 * time.Hour),
	}

	// Valid cart
	if err := evaluator.EvaluateEligibility(coupon, 2000.00, 0, now); err != nil {
		t.Errorf("expected cart to be eligible, got: %v", err)
	}

	// Subtotal below minimum
	if err := evaluator.EvaluateEligibility(coupon, 1000.00, 0, now); err == nil {
		t.Errorf("expected error for subtotal below minimum threshold")
	}

	// Per-customer usage exhausted
	if err := evaluator.EvaluateEligibility(coupon, 2000.00, 1, now); err == nil {
		t.Errorf("expected error when per-customer limit is reached")
	}

	// Global usage limit exhausted
	coupon.TimesUsed = 10
	if err := evaluator.EvaluateEligibility(coupon, 2000.00, 0, now); err == nil {
		t.Errorf("expected error when global usage limit is reached")
	}

	// Inactive coupon
	coupon.IsActive = false
	coupon.TimesUsed = 5
	if err := evaluator.EvaluateEligibility(coupon, 2000.00, 0, now); err == nil {
		t.Errorf("expected error for inactive coupon")
	}

	// Expired coupon
	coupon.IsActive = true
	coupon.ValidTo = now.Add(-1 * time.Hour)
	if err := evaluator.EvaluateEligibility(coupon, 2000.00, 0, now); err == nil {
		t.Errorf("expected error for expired coupon")
	}

	// Future coupon not yet active
	coupon.ValidTo = now.Add(24 * time.Hour)
	coupon.ValidFrom = now.Add(1 * time.Hour)
	if err := evaluator.EvaluateEligibility(coupon, 2000.00, 0, now); err == nil {
		t.Errorf("expected error for future coupon")
	}
}

func TestInvalidDiscountValues(t *testing.T) {
	evaluator := NewEvaluator()

	// Percentage > 100
	c1 := &Coupon{DiscountType: DiscountTypePercentage, DiscountValue: 120.00}
	d1, s1 := evaluator.CalculateDiscount(c1, 1000.00, 50.00)
	if d1 != 0 || s1 != 50.00 {
		t.Errorf("expected invalid percentage to return 0 discount, got %.2f", d1)
	}

	// Percentage <= 0
	c2 := &Coupon{DiscountType: DiscountTypePercentage, DiscountValue: -5.00}
	d2, _ := evaluator.CalculateDiscount(c2, 1000.00, 50.00)
	if d2 != 0 {
		t.Errorf("expected negative percentage to return 0 discount, got %.2f", d2)
	}

	// Fixed amount <= 0
	c3 := &Coupon{DiscountType: DiscountTypeFixedAmount, DiscountValue: -50.00}
	d3, _ := evaluator.CalculateDiscount(c3, 1000.00, 50.00)
	if d3 != 0 {
		t.Errorf("expected negative fixed amount to return 0 discount, got %.2f", d3)
	}
}

// TestTargetingAndProportionalAllocation tests Stages 4, 5, 6, and 7
func TestTargetingAndProportionalAllocation(t *testing.T) {
	evaluator := NewEvaluator()

	// Scenario: 15% coupon applicable to Category A (and subcategories)
	// Product P2 is blacklisted explicitly even though it's in Category A
	coupon := &Coupon{
		DiscountType:          DiscountTypePercentage,
		DiscountValue:         15.0, // 15%
		ApplicableCategoryIDs: []string{"cat-a"},
		ExcludedProductIDs:    []string{"prod-2"},
	}

	resolvedCategories := map[string]bool{
		"cat-a":     true,
		"cat-a-sub": true, // descendant category
	}

	items := []CartLineItem{
		{ProductID: "prod-1", CategoryID: "cat-a-sub", Subtotal: 1000.00}, // Eligible
		{ProductID: "prod-2", CategoryID: "cat-a", Subtotal: 1000.00},     // Ineligible (Excluded)
		{ProductID: "prod-3", CategoryID: "cat-b", Subtotal: 1000.00},     // Ineligible (Wrong category)
	}

	res, err := evaluator.EvaluateAndAllocate(coupon, items, 3000.00, 60.00, resolvedCategories)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Only prod-1 qualifies: eligible subtotal = 1000.00
	if res.EligibleSubtotal != 1000.00 {
		t.Errorf("expected eligible subtotal 1000.00, got %.2f", res.EligibleSubtotal)
	}

	// 15% of 1000.00 = 150.00
	if res.TotalDiscount != 150.00 {
		t.Errorf("expected total discount 150.00, got %.2f", res.TotalDiscount)
	}

	// Check line items
	if len(res.LineItemDetails) != 3 {
		t.Fatalf("expected 3 line item details, got %d", len(res.LineItemDetails))
	}

	// prod-1
	p1 := res.LineItemDetails[0]
	if !p1.IsEligible || p1.DiscountAmount != 150.00 || p1.FinalSubtotal != 850.00 {
		t.Errorf("prod-1 breakdown mismatch: %+v", p1)
	}

	// prod-2 (blacklisted)
	p2 := res.LineItemDetails[1]
	if p2.IsEligible || p2.DiscountAmount != 0 || p2.FinalSubtotal != 1000.00 {
		t.Errorf("prod-2 breakdown mismatch: %+v", p2)
	}

	// prod-3 (other category)
	p3 := res.LineItemDetails[2]
	if p3.IsEligible || p3.DiscountAmount != 0 || p3.FinalSubtotal != 1000.00 {
		t.Errorf("prod-3 breakdown mismatch: %+v", p3)
	}
}
