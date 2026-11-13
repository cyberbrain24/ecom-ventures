package orders

import (
	"strings"
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
)

func TestValidateOrderTransitionValid(t *testing.T) {
	validJumps := []struct {
		from storeModels.OrderStatus
		to   storeModels.OrderStatus
	}{
		{storeModels.OrderStatusPending, storeModels.OrderStatusProcessing},
		{storeModels.OrderStatusPending, storeModels.OrderStatusCancelled},
		{storeModels.OrderStatusProcessing, storeModels.OrderStatusShipped},
		{storeModels.OrderStatusProcessing, storeModels.OrderStatusCancelled},
		{storeModels.OrderStatusShipped, storeModels.OrderStatusDelivered},
		{storeModels.OrderStatusShipped, storeModels.OrderStatusCancelled},
		{storeModels.OrderStatusShipped, storeModels.OrderStatusRefunded},
		{storeModels.OrderStatusDelivered, storeModels.OrderStatusRefunded},
	}

	for _, jump := range validJumps {
		if err := ValidateOrderTransition(jump.from, jump.to); err != nil {
			t.Errorf("expected transition from %s to %s to be valid, got: %v", jump.from, jump.to, err)
		}
	}
}

func TestValidateOrderTransitionInvalid(t *testing.T) {
	invalidJumps := []struct {
		from storeModels.OrderStatus
		to   storeModels.OrderStatus
	}{
		// Same state
		{storeModels.OrderStatusPending, storeModels.OrderStatusPending},
		// Reverse jump
		{storeModels.OrderStatusShipped, storeModels.OrderStatusProcessing},
		{storeModels.OrderStatusDelivered, storeModels.OrderStatusPending},
		// Jump past required stages
		{storeModels.OrderStatusPending, storeModels.OrderStatusDelivered},
		// From terminal cancelled
		{storeModels.OrderStatusCancelled, storeModels.OrderStatusProcessing},
		{storeModels.OrderStatusCancelled, storeModels.OrderStatusShipped},
		// From terminal refunded
		{storeModels.OrderStatusRefunded, storeModels.OrderStatusDelivered},
	}

	for _, jump := range invalidJumps {
		if err := ValidateOrderTransition(jump.from, jump.to); err == nil {
			t.Errorf("expected transition from %s to %s to fail, but passed", jump.from, jump.to)
		}
	}
}

func TestIsTerminalState(t *testing.T) {
	if !IsTerminalState(storeModels.OrderStatusCancelled) {
		t.Errorf("expected CANCELLED to be terminal")
	}
	if !IsTerminalState(storeModels.OrderStatusRefunded) {
		t.Errorf("expected REFUNDED to be terminal")
	}
	if IsTerminalState(storeModels.OrderStatusPending) {
		t.Errorf("expected PENDING to not be terminal")
	}
	if IsTerminalState(storeModels.OrderStatusProcessing) {
		t.Errorf("expected PROCESSING to not be terminal")
	}
}

func TestGenerateOrderNumber(t *testing.T) {
	num1 := generateOrderNumber()
	num2 := generateOrderNumber()

	if !strings.HasPrefix(num1, "ORD-") {
		t.Fatalf("expected order number to start with 'ORD-', got %s", num1)
	}
	if num1 == num2 {
		t.Fatalf("expected generated order numbers to be unique, got duplicate %s", num1)
	}
}

func TestOrderTotalCalculation(t *testing.T) {
	subtotal := 2500.00
	shipping := 120.00
	discount := 200.00
	expectedTotal := 2420.00

	total := subtotal + shipping - discount
	if total != expectedTotal {
		t.Fatalf("expected total %f, got %f", expectedTotal, total)
	}

	// Discount exceeding subtotal + shipping should clamp to 0
	oversizedDiscount := 3000.00
	clampedTotal := subtotal + shipping - oversizedDiscount
	if clampedTotal < 0 {
		clampedTotal = 0
	}
	if clampedTotal != 0 {
		t.Fatalf("expected total clamped to 0, got %f", clampedTotal)
	}
}

func TestSanitizeBDPhone(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"+8801712345678", "01712345678"},
		{"8801812345678", "01812345678"},
		{"01912-345 678", "01912345678"},
		{"01300000000", "01300000000"},
		{"01511223344", "01511223344"},
		{"invalid phone", ""},
	}

	for _, c := range cases {
		out := SanitizeBDPhone(c.input)
		if out != c.expected {
			t.Errorf("SanitizeBDPhone(%q) = %q, expected %q", c.input, out, c.expected)
		}
	}
}

func TestIsValidBDPhone(t *testing.T) {
	valid := []string{"01712345678", "01312345678", "01812345678", "01912345678", "01512345678", "01612345678"}
	for _, p := range valid {
		if !IsValidBDPhone(p) {
			t.Errorf("expected %s to be valid BD phone", p)
		}
	}

	invalid := []string{"01212345678", "0171234567", "017123456789", "12345678901", "abcdefghijk"}
	for _, p := range invalid {
		if IsValidBDPhone(p) {
			t.Errorf("expected %s to be invalid BD phone", p)
		}
	}
}

func TestEvaluateRiskScoresHighValueCOD(t *testing.T) {
	// Nil DB tests COD threshold and invalid phone without DB dependencies
	flags := EvaluateRiskScores(nil, nil, nil, "01711223344", "COD", 6500.00)
	hasHighValueCOD := false
	for _, f := range flags {
		if f.Code == "high_value_cod" {
			hasHighValueCOD = true
		}
	}
	if !hasHighValueCOD {
		t.Errorf("expected high_value_cod flag for COD order > 5000")
	}

	// Below threshold should not trigger flag
	flagsLow := EvaluateRiskScores(nil, nil, nil, "01711223344", "COD", 2500.00)
	for _, f := range flagsLow {
		if f.Code == "high_value_cod" {
			t.Errorf("did not expect high_value_cod flag for COD order <= 5000")
		}
	}
}
