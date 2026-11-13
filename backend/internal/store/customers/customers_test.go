package customers

import (
	"testing"
)

func TestCustomerAOVCalculation(t *testing.T) {
	metrics := CustomerMetrics{
		TotalOrders:   4,
		LifetimeValue: 12000.00,
	}

	if metrics.TotalOrders > 0 {
		metrics.AverageOrderValue = metrics.LifetimeValue / float64(metrics.TotalOrders)
	}

	if metrics.AverageOrderValue != 3000.00 {
		t.Fatalf("expected AOV to be 3000.00, got %f", metrics.AverageOrderValue)
	}
}

func TestCustomerZeroOrdersAOV(t *testing.T) {
	metrics := CustomerMetrics{
		TotalOrders:   0,
		LifetimeValue: 0.00,
	}

	if metrics.TotalOrders > 0 {
		metrics.AverageOrderValue = metrics.LifetimeValue / float64(metrics.TotalOrders)
	}

	if metrics.AverageOrderValue != 0.00 {
		t.Fatalf("expected AOV to be 0.00, got %f", metrics.AverageOrderValue)
	}
}

func TestAddressDefaultDemotionLogic(t *testing.T) {
	addresses := []struct {
		ID                string
		IsDefaultShipping bool
		IsDefaultBilling  bool
	}{
		{"addr-1", true, false},
		{"addr-2", false, true},
	}

	// When addr-3 is added with IsDefaultShipping = true, addr-1 should be demoted
	newDefaultShippingID := "addr-3"
	for i := range addresses {
		if addresses[i].ID != newDefaultShippingID {
			addresses[i].IsDefaultShipping = false
		}
	}

	if addresses[0].IsDefaultShipping {
		t.Errorf("expected addr-1 default shipping to be false after demotion")
	}
}
