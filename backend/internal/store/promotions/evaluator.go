// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, discount rules, and cart promotion evaluations.
package promotions

import (
	"errors"
	"fmt"
	"math"
	"time"
)

var (
	// ErrCouponInactive indicates the coupon is currently disabled.
	ErrCouponInactive = errors.New("coupon is currently inactive")
	// ErrCouponNotYetActive indicates the coupon's start date is in the future.
	ErrCouponNotYetActive = errors.New("coupon promotion has not started yet")
	// ErrCouponExpired indicates the coupon has passed its expiration date.
	ErrCouponExpired = errors.New("coupon has expired")
	// ErrCouponUsageLimitHit indicates the global redemption limit has been met.
	ErrCouponUsageLimitHit = errors.New("coupon usage limit has been reached")
	// ErrMinSubtotalNotMet indicates the cart subtotal is less than the required minimum spend.
	ErrMinSubtotalNotMet = errors.New("cart subtotal does not meet the minimum spend requirement")
	// ErrPerCustomerLimitHit indicates the customer has exhausted their individual redemption allowance.
	ErrPerCustomerLimitHit = errors.New("you have reached the maximum redemption limit for this coupon")
	// ErrInvalidDiscountValue indicates negative or non-compliant discount configurations.
	ErrInvalidDiscountValue = errors.New("invalid discount configuration value")
)

// Evaluator provides pure business calculations for discount rules and eligibility checks.
type Evaluator struct{}

// NewEvaluator instantiates the calculation engine.
func NewEvaluator() *Evaluator {
	return &Evaluator{}
}

// EvaluateEligibility checks temporal validity, minimum spend, global usage limits, and per-customer allowances.
func (e *Evaluator) EvaluateEligibility(c *Coupon, subtotal float64, customerUsageCount int, now time.Time) error {
	if !c.IsActive {
		return ErrCouponInactive
	}

	if now.Before(c.ValidFrom) {
		return ErrCouponNotYetActive
	}

	if now.After(c.ValidTo) {
		return ErrCouponExpired
	}

	if c.MaxUses > 0 && c.TimesUsed >= c.MaxUses {
		return ErrCouponUsageLimitHit
	}

	if c.MaxUsesPerCustomer > 0 && customerUsageCount >= c.MaxUsesPerCustomer {
		return ErrPerCustomerLimitHit
	}

	if subtotal < c.MinSubtotal {
		return fmt.Errorf("%w: minimum subtotal required is %.2f", ErrMinSubtotalNotMet, c.MinSubtotal)
	}

	return nil
}

// CalculateDiscount computes the exact monetary discount and adjusted shipping fee on the cart.
// It clamps discounts to prevent negative subtotals and enforces max discount caps for percentage types.
func (e *Evaluator) CalculateDiscount(c *Coupon, subtotal, shippingFee float64) (discountAmount float64, finalShippingFee float64) {
	finalShippingFee = shippingFee

	switch c.DiscountType {
	case DiscountTypePercentage:
		if c.DiscountValue <= 0 || c.DiscountValue > 100 {
			return 0, finalShippingFee
		}
		rawDiscount := (subtotal * c.DiscountValue) / 100.0
		// Apply cap if defined
		if c.MaxDiscountAmount != nil && *c.MaxDiscountAmount > 0 {
			discountAmount = math.Min(rawDiscount, *c.MaxDiscountAmount)
		} else {
			discountAmount = rawDiscount
		}
		// Discount cannot exceed subtotal
		discountAmount = math.Min(discountAmount, subtotal)

	case DiscountTypeFixedAmount:
		if c.DiscountValue <= 0 {
			return 0, finalShippingFee
		}
		discountAmount = math.Min(c.DiscountValue, subtotal)

	case DiscountTypeFreeShipping:
		discountAmount = shippingFee
		finalShippingFee = 0.00

	default:
		discountAmount = 0
	}

	// Round to two decimal places
	discountAmount = math.Round(discountAmount*100) / 100
	return discountAmount, finalShippingFee
}
