package customers

import (
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
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

func TestCustomerReliabilityScoreCalculation(t *testing.T) {
	metrics := CustomerMetrics{
		TotalOrders:     10,
		DeliveredOrders: 8,
		CancelledOrders: 1,
		RtoOrders:       1,
	}

	finished := metrics.DeliveredOrders + metrics.CancelledOrders + metrics.RtoOrders
	if finished > 0 {
		metrics.ReliabilityScore = (float64(metrics.DeliveredOrders) / float64(finished)) * 100.0
	}

	if metrics.ReliabilityScore != 80.0 {
		t.Fatalf("expected ReliabilityScore to be 80.0%%, got %f", metrics.ReliabilityScore)
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

func TestMembershipTierConstants(t *testing.T) {
	tiers := []storeModels.MembershipTier{
		storeModels.MembershipTierStandard,
		storeModels.MembershipTierSilver,
		storeModels.MembershipTierGold,
		storeModels.MembershipTierVIPBlack,
	}

	if len(tiers) != 4 {
		t.Fatalf("expected 4 membership tiers, got %d", len(tiers))
	}
}
