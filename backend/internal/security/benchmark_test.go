package security

import (
	"strings"
	"testing"
)

// BenchmarkSlugSanitization evaluates throughput and allocations of URI slug formatting.
func BenchmarkSlugSanitization(b *testing.B) {
	rawTitle := "Luxury Handcrafted Leather Belt - Autumn 2026 Collection"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = strings.ToLower(strings.ReplaceAll(rawTitle, " ", "-"))
	}
}

// BenchmarkCartSubtotalMath measures subtotal calculation loop performance across cart line items.
func BenchmarkCartSubtotalMath(b *testing.B) {
	items := []struct {
		Price float64
		Qty   int
	}{
		{1250.00, 2},
		{450.50, 1},
		{99.99, 3},
		{3200.00, 1},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var subtotal float64
		for _, it := range items {
			subtotal += it.Price * float64(it.Qty)
		}
		if subtotal <= 0 {
			b.Fatal("subtotal calculation error")
		}
	}
}
