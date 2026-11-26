package reports

import (
	"math"
	"testing"
	"time"
)

func TestResolveDateWindowDhaka(t *testing.T) {
	// 2026-11-26 20:00:00 UTC is 2026-11-27 02:00:00 Asia/Dhaka (UTC+6)
	nowUTC := time.Date(2026, 11, 26, 20, 0, 0, 0, time.UTC)

	startUTC, endUTC, fromStr, toStr, preset, err := ResolveDateWindow("today", "", "", "Asia/Dhaka", nowUTC)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if preset != "today" || fromStr != "2026-11-27" || toStr != "2026-11-27" {
		t.Fatalf("unexpected resolved labels: preset=%s from=%s to=%s", preset, fromStr, toStr)
	}
	expectedStart := time.Date(2026, 11, 26, 18, 0, 0, 0, time.UTC)
	expectedEnd := time.Date(2026, 11, 27, 18, 0, 0, 0, time.UTC)
	if !startUTC.Equal(expectedStart) || !endUTC.Equal(expectedEnd) {
		t.Fatalf("expected [%v, %v), got [%v, %v)", expectedStart, expectedEnd, startUTC, endUTC)
	}
}

func TestResolveDateWindowCustomValidation(t *testing.T) {
	nowUTC := time.Date(2026, 11, 27, 12, 0, 0, 0, time.UTC)
	if _, _, _, _, _, err := ResolveDateWindow("custom", "2026-11-28", "2026-11-26", "Asia/Dhaka", nowUTC); err == nil {
		t.Fatal("expected error when date_to < date_from")
	}
}

func TestBuildSalesReportCalculations(t *testing.T) {
	meta := StoreMetaSettings{
		Currency: "BDT",
		Timezone: "Asia/Dhaka",
		USDRate:  132.00,
	}
	rows := []StatusAggregateRow{
		{StatusKey: "placed", Orders: 3, Products: 4, Value: 4337.00, Costing: 1455.00},
		{StatusKey: "cancelled", Orders: 2, Products: 2, Value: 2000.00, Costing: 700.00},
	}

	report := buildSalesReport("today", "2026-11-26", "2026-11-26", meta, rows, 9.09, 0)

	if report.Snapshot.OrdersQty != 3 {
		t.Fatalf("expected 3 active orders (excluding cancelled), got %d", report.Snapshot.OrdersQty)
	}
	if report.Snapshot.ProductQty != 4 {
		t.Fatalf("expected 4 products, got %d", report.Snapshot.ProductQty)
	}
	if report.Snapshot.TotalAmount != 4337.00 {
		t.Fatalf("expected 4337.00 revenue, got %.2f", report.Snapshot.TotalAmount)
	}
	if math.Abs(report.Snapshot.AOV-1445.67) > 0.01 {
		t.Fatalf("expected AOV ~1445.67, got %.2f", report.Snapshot.AOV)
	}
	if math.Abs(report.Snapshot.MetaAdsCosting-1199.88) > 0.01 {
		t.Fatalf("expected MetaAdsCosting 1199.88, got %.2f", report.Snapshot.MetaAdsCosting)
	}
	if math.Abs(report.Snapshot.TotalProfit-1682.12) > 0.01 {
		t.Fatalf("expected TotalProfit 1682.12, got %.2f", report.Snapshot.TotalProfit)
	}
	if report.StatusReport["placed"].Percentage != 100.0 {
		t.Fatalf("expected placed percentage 100.0, got %.1f", report.StatusReport["placed"].Percentage)
	}
	if report.StatusReport["cancelled"].DefaultActive {
		t.Fatal("expected cancelled DefaultActive to be false")
	}
}
