// Package orders provides risk scoring and fraud hazard detection algorithms
// to safeguard stores against invalid numbers, high-value COD loss, and chronic cancellations.
package orders

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	// bdPhoneRegex matches valid 11-digit Bangladesh mobile numbers: 013 to 019
	bdPhoneRegex = regexp.MustCompile(`^01[3-9]\d{8}$`)
	// nonDigitsRegex strips characters other than 0-9
	nonDigitsRegex = regexp.MustCompile(`\D`)
)

// SanitizeBDPhone strips country codes (+88 / 88), spaces, dashes, and returns normalized 11-digit phone string.
func SanitizeBDPhone(rawPhone string) string {
	cleaned := nonDigitsRegex.ReplaceAllString(rawPhone, "")
	if strings.HasPrefix(cleaned, "8801") && len(cleaned) == 13 {
		cleaned = cleaned[2:]
	} else if strings.HasPrefix(cleaned, "880") && len(cleaned) == 13 {
		cleaned = cleaned[2:]
	}
	return cleaned
}

// IsValidBDPhone tests whether the sanitized phone matches ^01[3-9]\d{8}$
func IsValidBDPhone(phone string) bool {
	return bdPhoneRegex.MatchString(phone)
}

// EvaluateRiskScores executes all 4 automated risk checks against an order payload.
func EvaluateRiskScores(
	ctx context.Context,
	db *sql.DB,
	customerID *string,
	customerPhone string,
	paymentMethod string,
	totalAmount float64,
) []storeModels.RiskFlag {
	flags := make([]storeModels.RiskFlag, 0)
	sanitizedPhone := SanitizeBDPhone(customerPhone)

	// 1. Phone Number Sanitizer & Regex Validation
	if !IsValidBDPhone(sanitizedPhone) {
		flags = append(flags, storeModels.RiskFlag{
			Code:        "invalid_phone",
			Severity:    "WARNING",
			Label:       "Invalid Phone Format",
			Description: fmt.Sprintf("Phone '%s' does not conform to 11-digit BD mobile format (013-019)", customerPhone),
		})
	}

	// 2. Profile Mismatch Check (if order is linked to a customer account)
	if customerID != nil && *customerID != "" && db != nil {
		var profilePhone sql.NullString
		err := db.QueryRowContext(ctx, "SELECT phone FROM customers WHERE id = $1", *customerID).Scan(&profilePhone)
		if err == nil && profilePhone.Valid && profilePhone.String != "" {
			cleanProfile := SanitizeBDPhone(profilePhone.String)
			if cleanProfile != "" && cleanProfile != sanitizedPhone {
				flags = append(flags, storeModels.RiskFlag{
					Code:        "profile_mismatch",
					Severity:    "WARNING",
					Label:       "Profile Phone Mismatch",
					Description: fmt.Sprintf("Checkout phone differs from CRM profile on file (%s)", profilePhone.String),
				})
			}
		}
	}

	// 3. High-Value COD Threshold Check (>= ৳5,000 threshold for unpaid cash delivery)
	isCOD := strings.EqualFold(strings.TrimSpace(paymentMethod), "COD") || strings.TrimSpace(paymentMethod) == ""
	if isCOD && totalAmount > 5000.00 {
		flags = append(flags, storeModels.RiskFlag{
			Code:        "high_value_cod",
			Severity:    "WARNING",
			Label:       "High-Value COD",
			Description: fmt.Sprintf("Cash on Delivery amount (৳%.2f) exceeds safety threshold of ৳5,000.00", totalAmount),
		})
	}

	// 4. Repeat Cancellation Lookups (query past orders for phone)
	if sanitizedPhone != "" && db != nil {
		var cancelCount int
		// Check both raw phone and sanitized variation
		query := `
			SELECT COUNT(*) 
			FROM orders 
			WHERE (customer_phone = $1 OR customer_phone = $2)
			  AND status = 'CANCELLED'
		`
		err := db.QueryRowContext(ctx, query, sanitizedPhone, customerPhone).Scan(&cancelCount)
		if err == nil && cancelCount >= 2 {
			flags = append(flags, storeModels.RiskFlag{
				Code:        "repeat_offender",
				Severity:    "DANGER",
				Label:       "Repeat Offender",
				Description: fmt.Sprintf("Customer telephone has %d past cancelled orders on record", cancelCount),
			})
		}
	}

	return flags
}
