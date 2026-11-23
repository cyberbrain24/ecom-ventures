package accounts

import (
	"context"
	"strings"
	"testing"
)

func TestServiceRequiresDatabase(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	tests := []struct {
		name string
		call func() error
	}{
		{
			name: "portfolio overview",
			call: func() error {
				_, err := service.GetPortfolioOverview(ctx)
				return err
			},
		},
		{
			name: "leaderboard",
			call: func() error {
				_, err := service.GetLeaderboard(ctx, "")
				return err
			},
		},
		{
			name: "billing records",
			call: func() error {
				_, err := service.ListBillingRecords(ctx, "")
				return err
			},
		},
		{
			name: "billing status",
			call: func() error {
				return service.UpdateBillingStatus(ctx, "invoice-id", "PAID")
			},
		},
		{
			name: "gateway allocations",
			call: func() error {
				_, err := service.GetGatewayAllocations(ctx)
				return err
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := test.call()
			if err == nil || !strings.Contains(err.Error(), "database is unavailable") {
				t.Fatalf("expected explicit database error, got %v", err)
			}
		})
	}
}
