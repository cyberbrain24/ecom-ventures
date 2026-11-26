package reports

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

type statusSpec struct {
	Key           string
	Name          string
	Core          bool
	DefaultActive bool
}

var knownStatuses = []statusSpec{
	{Key: "placed", Name: "PLACED", Core: true, DefaultActive: true},
	{Key: "review", Name: "REVIEW", Core: true, DefaultActive: true},
	{Key: "pending", Name: "PENDING", Core: true, DefaultActive: true},
	{Key: "hold", Name: "HOLD", Core: true, DefaultActive: true},
	{Key: "approval_pending", Name: "APPROVAL PENDING", Core: true, DefaultActive: true},
	{Key: "confirmed", Name: "CONFIRMED", Core: false, DefaultActive: true},
	{Key: "processing", Name: "PROCESSING", Core: false, DefaultActive: true},
	{Key: "shipped", Name: "SHIPPED", Core: false, DefaultActive: true},
	{Key: "delayed", Name: "DELAYED", Core: false, DefaultActive: true},
	{Key: "delivered", Name: "DELIVERED", Core: true, DefaultActive: true},
	{Key: "partially_delivered", Name: "PARTIALLY DELIVERED", Core: false, DefaultActive: true},
	{Key: "returned", Name: "RETURNED", Core: true, DefaultActive: true},
	{Key: "cancelled", Name: "CANCELLED", Core: true, DefaultActive: false},
	{Key: "manually_cancelled", Name: "MANUALLY CANCELLED", Core: false, DefaultActive: false},
	{Key: "refunded", Name: "REFUNDED", Core: false, DefaultActive: false},
}

// Service coordinates executive sales report aggregation and exchange-rate updates.
type Service struct {
	repo Repository
}

// NewService constructs a reports Service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ResolveDateWindow computes UTC query bounds and YYYY-MM-DD labels in the store's local timezone.
func ResolveDateWindow(preset, dateFrom, dateTo, tzName string, now time.Time) (startUTC, endUTC time.Time, resolvedFrom, resolvedTo, resolvedPreset string, err error) {
	loc, loadErr := time.LoadLocation(strings.TrimSpace(tzName))
	if loadErr != nil || loc == nil {
		loc = time.FixedZone("Asia/Dhaka", 6*3600)
	}

	localNow := now.In(loc)
	todayStart := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc)

	p := strings.ToLower(strings.TrimSpace(preset))
	if p == "" {
		if strings.TrimSpace(dateFrom) != "" && strings.TrimSpace(dateTo) != "" {
			p = "custom"
		} else {
			p = "today"
		}
	}

	var startLocal, endLocal time.Time
	switch p {
	case "today":
		startLocal = todayStart
		endLocal = todayStart.AddDate(0, 0, 1)
	case "yesterday":
		startLocal = todayStart.AddDate(0, 0, -1)
		endLocal = todayStart
	case "last_7_days":
		startLocal = todayStart.AddDate(0, 0, -6)
		endLocal = todayStart.AddDate(0, 0, 1)
	case "last_30_days":
		startLocal = todayStart.AddDate(0, 0, -29)
		endLocal = todayStart.AddDate(0, 0, 1)
	case "this_month":
		startLocal = time.Date(localNow.Year(), localNow.Month(), 1, 0, 0, 0, 0, loc)
		endLocal = todayStart.AddDate(0, 0, 1)
	case "custom":
		fromTime, parseErr := time.ParseInLocation("2006-01-02", strings.TrimSpace(dateFrom), loc)
		if parseErr != nil {
			return time.Time{}, time.Time{}, "", "", "", errors.New("invalid date_from; expected YYYY-MM-DD")
		}
		toTime, parseErr := time.ParseInLocation("2006-01-02", strings.TrimSpace(dateTo), loc)
		if parseErr != nil {
			return time.Time{}, time.Time{}, "", "", "", errors.New("invalid date_to; expected YYYY-MM-DD")
		}
		if toTime.Before(fromTime) {
			return time.Time{}, time.Time{}, "", "", "", errors.New("date_to must be on or after date_from")
		}
		startLocal = fromTime
		endLocal = toTime.AddDate(0, 0, 1)
	default:
		return time.Time{}, time.Time{}, "", "", "", errors.New("unsupported preset; use today, yesterday, last_7_days, last_30_days, this_month, or custom")
	}

	return startLocal.UTC(), endLocal.UTC(), startLocal.Format("2006-01-02"), endLocal.AddDate(0, 0, -1).Format("2006-01-02"), p, nil
}

// GetSalesReport aggregates order summary, P&L, and status breakdowns for the tenant.
func (s *Service) GetSalesReport(ctx context.Context, preset, dateFrom, dateTo string) (*SalesReportResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	meta, err := s.repo.GetStoreMetaSettings(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}

	startUTC, endUTC, resolvedFrom, resolvedTo, resolvedPreset, err := ResolveDateWindow(preset, dateFrom, dateTo, meta.Timezone, time.Now())
	if err != nil {
		return nil, err
	}

	rows, err := s.repo.AggregateOrdersByStatus(ctx, stCtx.TenantDB, startUTC, endUTC)
	if err != nil {
		return nil, err
	}

	metaAdsUSD, err := s.repo.GetMetaAdsSpendUSD(ctx, stCtx.TenantDB, startUTC, endUTC)
	if err != nil {
		return nil, err
	}

	fixedExpense, err := s.repo.GetFixedExpenses(ctx, stCtx.TenantDB, resolvedFrom, resolvedTo)
	if err != nil {
		return nil, err
	}

	return buildSalesReport(resolvedPreset, resolvedFrom, resolvedTo, meta, rows, metaAdsUSD, fixedExpense), nil
}

func buildSalesReport(
	preset, dateFrom, dateTo string,
	meta StoreMetaSettings,
	rows []StatusAggregateRow,
	metaAdsUSD, fixedExpense float64,
) *SalesReportResponse {
	byKey := make(map[string]StatusAggregateRow, len(rows))
	for _, r := range rows {
		byKey[strings.ToLower(strings.TrimSpace(r.StatusKey))] = r
	}

	statusMap := make(map[string]StatusBreakdown, len(knownStatuses))
	var activeOrders, activeProducts int
	var activeAmount, activeCosting float64

	for _, spec := range knownStatuses {
		agg, exists := byKey[spec.Key]
		if !spec.Core && (!exists || agg.Orders == 0) {
			continue
		}
		item := StatusBreakdown{
			Key:           spec.Key,
			Name:          spec.Name,
			Orders:        agg.Orders,
			Products:      agg.Products,
			Value:         round2(agg.Value),
			Costing:       round2(agg.Costing),
			DefaultActive: spec.DefaultActive,
		}
		statusMap[spec.Key] = item
		if spec.DefaultActive {
			activeOrders += agg.Orders
			activeProducts += agg.Products
			activeAmount += agg.Value
			activeCosting += agg.Costing
		}
	}

	for key, item := range statusMap {
		if activeOrders > 0 && item.DefaultActive {
			item.Percentage = round1((float64(item.Orders) / float64(activeOrders)) * 100.0)
			statusMap[key] = item
		}
	}

	var aov float64
	if activeOrders > 0 {
		aov = round2(activeAmount / float64(activeOrders))
	}

	metaAdsCosting := round2(metaAdsUSD * meta.USDRate)
	totalProfit := round2(activeAmount - activeCosting - metaAdsCosting - fixedExpense)

	return &SalesReportResponse{
		Preset:   preset,
		DateFrom: dateFrom,
		DateTo:   dateTo,
		Timezone: meta.Timezone,
		Currency: meta.Currency,
		Snapshot: SalesSnapshot{
			OrdersQty:      activeOrders,
			ProductQty:     activeProducts,
			TotalAmount:    round2(activeAmount),
			AOV:            aov,
			ProductCosting: round2(activeCosting),
			MetaAdsUSD:     round2(metaAdsUSD),
			USDRate:        round2(meta.USDRate),
			MetaAdsCosting: metaAdsCosting,
			FixedExpense:   round2(fixedExpense),
			TotalProfit:    totalProfit,
		},
		StatusReport: statusMap,
	}
}

// UpdateUSDRate validates and saves the tenant's USD exchange rate.
func (s *Service) UpdateUSDRate(ctx context.Context, rate float64) (float64, error) {
	if rate <= 0 || rate > 10000 {
		return 0, errors.New("usd_rate must be greater than 0 and less than 10000")
	}
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return 0, err
	}
	rounded := round2(rate)
	if err := s.repo.UpdateUSDRate(ctx, stCtx.TenantDB, rounded); err != nil {
		return 0, err
	}
	return rounded, nil
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
