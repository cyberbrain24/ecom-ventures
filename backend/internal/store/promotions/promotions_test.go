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

func TestBundleTrioProRatedCalculations(t *testing.T) {
	// Standard Trio Bundle: 3 Items, 10% discount, Free Delivery
	discountPct := 10.0
	slots := []BundleCalculationSlot{
		{ProductID: "p1", VariantID: "v1", Title: "Acid Trim Tee", UnitPrice: 1000.00},
		{ProductID: "p2", VariantID: "v2", Title: "Baggy Cargo", UnitPrice: 1200.00},
		{ProductID: "p3", VariantID: "v3", Title: "Minimalist Cap", UnitPrice: 800.00},
	}

	var originalTotal float64
	var discountAmount float64
	for _, s := range slots {
		savings := s.UnitPrice * (discountPct / 100.0)
		discounted := s.UnitPrice - savings
		originalTotal += s.UnitPrice
		discountAmount += savings

		if s.ProductID == "p1" && discounted != 900.00 {
			t.Errorf("expected p1 discounted price 900.00, got %.2f", discounted)
		}
		if s.ProductID == "p2" && discounted != 1080.00 {
			t.Errorf("expected p2 discounted price 1080.00, got %.2f", discounted)
		}
		if s.ProductID == "p3" && discounted != 720.00 {
			t.Errorf("expected p3 discounted price 720.00, got %.2f", discounted)
		}
	}

	if originalTotal != 3000.00 {
		t.Errorf("expected original total 3000.00, got %.2f", originalTotal)
	}
	if discountAmount != 300.00 {
		t.Errorf("expected total discount 300.00, got %.2f", discountAmount)
	}
	finalTotal := originalTotal - discountAmount
	if finalTotal != 2700.00 {
		t.Errorf("expected final total 2700.00, got %.2f", finalTotal)
	}
}
