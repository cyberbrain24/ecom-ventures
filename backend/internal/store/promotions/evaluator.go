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
	// ErrNoEligibleItems indicates none of the cart items meet the coupon's category or product targeting rules.
	ErrNoEligibleItems = errors.New("no items in your cart are eligible for this coupon")
)

// Evaluator provides pure business calculations for discount rules, recursive category targeting,
// product exclusion gates, and proportional line-item distribution.
type Evaluator struct{}

// NewEvaluator instantiates the calculation engine.
func NewEvaluator() *Evaluator {
	return &Evaluator{}
}

// EvaluateEligibility checks campaign integrity, temporal validity, global redemption limit,
// per-customer limits, and minimum cart subtotal requirement.
func (e *Evaluator) EvaluateEligibility(c *Coupon, subtotal float64, customerUsageCount int, now time.Time) error {
	// Stage 1: Campaign Integrity Check
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

	// Stage 2: Customer Eligibility & Anti-Fraud Limit
	if c.MaxUsesPerCustomer > 0 && customerUsageCount >= c.MaxUsesPerCustomer {
		return ErrPerCustomerLimitHit
	}

	// Stage 3: Cart-Level Threshold Verification
	if subtotal < c.MinSubtotal {
		return fmt.Errorf("%w: minimum subtotal required is %.2f", ErrMinSubtotalNotMet, c.MinSubtotal)
	}

	return nil
}

// EvaluationResult holds the comprehensive result of discount evaluation.
type EvaluationResult struct {
	TotalDiscount    float64
	EligibleSubtotal float64
	FinalShippingFee float64
	LineItemDetails  []DiscountLineItemBreakdown
}

// EvaluateAndAllocate executes Stage 4 (Targeting Resolution), Stage 5 (Line-Item Evaluation),
// Stage 6 (Value Calculation), and Stage 7 (Proportional Line-Item Allocation).
// resolvedCategoryMap contains all category IDs including descendant child categories that qualify.
func (e *Evaluator) EvaluateAndAllocate(
	c *Coupon,
	items []CartLineItem,
	cartSubtotal float64,
	shippingFee float64,
	resolvedCategoryMap map[string]bool,
) (*EvaluationResult, error) {
	result := &EvaluationResult{
		FinalShippingFee: shippingFee,
		LineItemDetails:  make([]DiscountLineItemBreakdown, 0, len(items)),
	}

	hasCategoryFilter := len(resolvedCategoryMap) > 0
	hasIncludeFilter := len(c.IncludedProductIDs) > 0
	hasExcludeFilter := len(c.ExcludedProductIDs) > 0

	includeMap := make(map[string]bool, len(c.IncludedProductIDs))
	for _, pid := range c.IncludedProductIDs {
		includeMap[pid] = true
	}

	excludeMap := make(map[string]bool, len(c.ExcludedProductIDs))
	for _, pid := range c.ExcludedProductIDs {
		excludeMap[pid] = true
	}

	// Fallback when no cart items are passed (legacy cart or direct validation)
	if len(items) == 0 {
		discount, finalShip := e.CalculateDiscountOnSubtotal(c, cartSubtotal, shippingFee)
		result.TotalDiscount = discount
		result.EligibleSubtotal = cartSubtotal
		result.FinalShippingFee = finalShip
		return result, nil
	}

	// Stages 4 & 5: Evaluate each line item against targeting rules
	var eligibleSubtotal float64
	type evaluatedItem struct {
		item       CartLineItem
		isEligible bool
		reason     string
	}
	evaluatedItems := make([]evaluatedItem, 0, len(items))

	for _, item := range items {
		itemSubtotal := item.Subtotal
		if itemSubtotal <= 0 && item.Price > 0 && item.Quantity > 0 {
			itemSubtotal = item.Price * float64(item.Quantity)
		}

		isEligible := true
		var reason string

		// Strict Blacklist Check (Precedence 1)
		if hasExcludeFilter && excludeMap[item.ProductID] {
			isEligible = false
			reason = "Product is explicitly excluded from this promotion"
		}

		// Product Whitelist Check (Precedence 2)
		if isEligible && hasIncludeFilter {
			if !includeMap[item.ProductID] {
				isEligible = false
				reason = "Product is not in the promotional whitelist"
			}
		}

		// Hierarchical Category Check (Precedence 3)
		if isEligible && hasCategoryFilter {
			if !resolvedCategoryMap[item.CategoryID] {
				isEligible = false
				reason = "Category does not qualify for this promotion"
			}
		}

		if isEligible {
			eligibleSubtotal += itemSubtotal
		}

		evaluatedItems = append(evaluatedItems, evaluatedItem{
			item:       item,
			isEligible: isEligible,
			reason:     reason,
		})
	}

	// If targeting rules exist and no items are eligible, fail validation
	if (hasCategoryFilter || hasIncludeFilter) && eligibleSubtotal <= 0 {
		return nil, ErrNoEligibleItems
	}

	if eligibleSubtotal <= 0 {
		eligibleSubtotal = cartSubtotal
	}

	result.EligibleSubtotal = math.Round(eligibleSubtotal*100) / 100

	// Stage 6: Calculate Base Discount on Eligible Subtotal
	var totalDiscount float64
	switch c.DiscountType {
	case DiscountTypePercentage:
		if c.DiscountValue <= 0 || c.DiscountValue > 100 {
			totalDiscount = 0
		} else {
			rawDiscount := (eligibleSubtotal * c.DiscountValue) / 100.0
			if c.MaxDiscountAmount != nil && *c.MaxDiscountAmount > 0 {
				totalDiscount = math.Min(rawDiscount, *c.MaxDiscountAmount)
			} else {
				totalDiscount = rawDiscount
			}
			totalDiscount = math.Min(totalDiscount, eligibleSubtotal)
		}

	case DiscountTypeFixedAmount:
		if c.DiscountValue <= 0 {
			totalDiscount = 0
		} else {
			// Clamped by min(discount_value, eligible_subtotal)
			totalDiscount = math.Min(c.DiscountValue, eligibleSubtotal)
		}

	case DiscountTypeFreeShipping:
		totalDiscount = shippingFee
		result.FinalShippingFee = 0.00

	default:
		totalDiscount = 0
	}

	totalDiscount = math.Round(totalDiscount*100) / 100
	result.TotalDiscount = totalDiscount

	// Stage 7: Proportional Line-Item Allocation
	// Line Discount = Item Subtotal * (Total Discount / Eligible Subtotal)
	var allocatedSoFar float64
	var lastEligibleIdx = -1

	for idx, ev := range evaluatedItems {
		itemSubtotal := ev.item.Subtotal
		if itemSubtotal <= 0 && ev.item.Price > 0 && ev.item.Quantity > 0 {
			itemSubtotal = ev.item.Price * float64(ev.item.Quantity)
		}

		breakdown := DiscountLineItemBreakdown{
			ProductID:        ev.item.ProductID,
			VariantID:        ev.item.VariantID,
			OriginalSubtotal: math.Round(itemSubtotal*100) / 100,
			IsEligible:       ev.isEligible,
			IneligibilityMsg: ev.reason,
		}

		if ev.isEligible && totalDiscount > 0 && c.DiscountType != DiscountTypeFreeShipping {
			lastEligibleIdx = idx
			lineRatio := itemSubtotal / eligibleSubtotal
			lineDiscount := math.Floor(totalDiscount*lineRatio*100) / 100
			breakdown.DiscountAmount = lineDiscount
			breakdown.FinalSubtotal = math.Round((itemSubtotal-lineDiscount)*100) / 100
			allocatedSoFar += lineDiscount
		} else {
			breakdown.DiscountAmount = 0
			breakdown.FinalSubtotal = breakdown.OriginalSubtotal
		}

		result.LineItemDetails = append(result.LineItemDetails, breakdown)
	}

	// Distribute residual penny differences caused by integer rounding to the last eligible item
	if lastEligibleIdx >= 0 && c.DiscountType != DiscountTypeFreeShipping {
		residual := math.Round((totalDiscount-allocatedSoFar)*100) / 100
		if residual > 0 {
			result.LineItemDetails[lastEligibleIdx].DiscountAmount = math.Round((result.LineItemDetails[lastEligibleIdx].DiscountAmount+residual)*100) / 100
			result.LineItemDetails[lastEligibleIdx].FinalSubtotal = math.Round((result.LineItemDetails[lastEligibleIdx].OriginalSubtotal-result.LineItemDetails[lastEligibleIdx].DiscountAmount)*100) / 100
		}
	}

	return result, nil
}

// CalculateDiscount is an alias for CalculateDiscountOnSubtotal to maintain backwards-compatibility.
func (e *Evaluator) CalculateDiscount(c *Coupon, subtotal, shippingFee float64) (discountAmount float64, finalShippingFee float64) {
	return e.CalculateDiscountOnSubtotal(c, subtotal, shippingFee)
}

// CalculateDiscountOnSubtotal provides cart-level discount calculation when item array is not available.
func (e *Evaluator) CalculateDiscountOnSubtotal(c *Coupon, subtotal, shippingFee float64) (discountAmount float64, finalShippingFee float64) {
	finalShippingFee = shippingFee

	switch c.DiscountType {
	case DiscountTypePercentage:
		if c.DiscountValue <= 0 || c.DiscountValue > 100 {
			return 0, finalShippingFee
		}
		rawDiscount := (subtotal * c.DiscountValue) / 100.0
		if c.MaxDiscountAmount != nil && *c.MaxDiscountAmount > 0 {
			discountAmount = math.Min(rawDiscount, *c.MaxDiscountAmount)
		} else {
			discountAmount = rawDiscount
		}
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

	discountAmount = math.Round(discountAmount*100) / 100
	return discountAmount, finalShippingFee
}
