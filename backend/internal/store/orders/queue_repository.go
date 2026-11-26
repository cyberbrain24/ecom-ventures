package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var fulfillmentSchemaSynced sync.Map

func ensureFulfillmentIssueColumn(ctx context.Context, db *sql.DB) {
	if db == nil {
		return
	}
	key := fmt.Sprintf("%p", db)
	if _, ok := fulfillmentSchemaSynced.Load(key); ok {
		return
	}
	_, _ = db.ExecContext(ctx, `
		ALTER TABLE orders
			ADD COLUMN IF NOT EXISTS issue_status VARCHAR(32) NOT NULL DEFAULT 'NONE';
	`)
	fulfillmentSchemaSynced.Store(key, true)
}

// UpdateFulfillmentFlags updates ready, print, urgent, and issue_status flags on an order.
func (r *SQLRepository) UpdateFulfillmentFlags(ctx context.Context, db *sql.DB, orderID string, req *UpdateFulfillmentFlagsRequest) error {
	ensureFulfillmentIssueColumn(ctx, db)
	sets := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.IsReady != nil {
		sets = append(sets, fmt.Sprintf("is_ready = $%d", argIdx))
		args = append(args, *req.IsReady)
		argIdx++
	}
	if req.IsPrintReady != nil {
		sets = append(sets, fmt.Sprintf("is_print_ready = $%d", argIdx))
		args = append(args, *req.IsPrintReady)
		argIdx++
	}
	if req.IsUrgent != nil {
		sets = append(sets, fmt.Sprintf("is_urgent = $%d", argIdx))
		args = append(args, *req.IsUrgent)
		argIdx++
	}
	if req.IssueStatus != nil {
		normalized := strings.ToUpper(strings.TrimSpace(*req.IssueStatus))
		if normalized == "" {
			normalized = "NONE"
		}
		sets = append(sets, fmt.Sprintf("issue_status = $%d", argIdx))
		args = append(args, normalized)
		argIdx++
	}

	if len(sets) == 0 {
		return nil
	}

	sets = append(sets, "updated_at = NOW()")
	query := fmt.Sprintf("UPDATE orders SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)
	args = append(args, orderID)

	res, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update fulfillment flags: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrOrderNotFound
	}
	return nil
}

// GetFulfillmentQueue retrieves actionable orders sorted by urgent-first and FIFO aging.
func (r *SQLRepository) GetFulfillmentQueue(ctx context.Context, db *sql.DB, page, limit int, urgentOnly bool, statusFilter, search string) (*FulfillmentQueueResponse, error) {
	ensureFulfillmentIssueColumn(ctx, db)
	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	where := []string{}
	args := []interface{}{}
	argIdx := 1

	cleanStatus := strings.ToUpper(strings.TrimSpace(statusFilter))
	switch cleanStatus {
	case "REVIEW", "PENDING", "CONFIRMED", "PROCESSING":
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, cleanStatus)
		argIdx++
	default:
		where = append(where, "status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'REVIEW')")
	}

	if urgentOnly {
		where = append(where, "is_urgent = TRUE")
	}

	if cleanSearch := strings.TrimSpace(search); cleanSearch != "" {
		like := "%" + cleanSearch + "%"
		where = append(where, fmt.Sprintf("(order_number ILIKE $%d OR COALESCE(customer_phone, '') ILIKE $%d OR COALESCE(courier_tracking_code, '') ILIKE $%d OR COALESCE(shipping_address::text, '') ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, like)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	var summary FulfillmentQueueSummary
	summaryQuery := `
		SELECT
			COUNT(*) as total_queue,
			COUNT(*) FILTER (WHERE is_urgent = TRUE) as urgent_count,
			COUNT(*) FILTER (WHERE is_ready = TRUE) as ready_count,
			COUNT(*) FILTER (WHERE is_print_ready = FALSE) as print_pending_count,
			COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '24 hours') as delayed_count
		FROM orders
		WHERE status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'REVIEW');
	`
	_ = db.QueryRowContext(ctx, summaryQuery).Scan(
		&summary.TotalQueueCount,
		&summary.UrgentCount,
		&summary.ReadyToShipCount,
		&summary.PrintPendingCount,
		&summary.DelayedAlertCount,
	)

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM orders WHERE %s", whereClause)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count fulfillment queue: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT id, order_number, customer_id, customer_email, customer_phone,
		       status, payment_status, currency, subtotal, shipping_fee, discount_amount, total_amount,
		       paid_amount, due_amount, is_urgent, is_ready, is_print_ready, COALESCE(issue_status, 'NONE'),
		       COALESCE(courier_risk_level, 'LOW'), COALESCE(courier_delivery_ratio, 0.00),
		       risk_score_flags, courier_consignment_id, courier_tracking_code,
		       courier_status_sync_at, special_note, shipping_district, shipping_thana,
		       shipping_address, payment_method, notes, created_at, updated_at
		FROM orders
		WHERE %s
		ORDER BY is_urgent DESC, created_at ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query fulfillment queue: %w", err)
	}
	defer rows.Close()

	now := time.Now()
	var items []FulfillmentQueueItem
	for rows.Next() {
		var o storeModels.Order
		var customerID, customerEmail, customerPhone sql.NullString
		var shippingStr string
		var paymentMethod, notes sql.NullString
		var riskFlagsStr sql.NullString
		var courierConsignmentID, courierTrackingCode, specialNote, shippingDistrict, shippingThana sql.NullString
		var courierStatusSyncAt *time.Time

		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &customerID, &customerEmail, &customerPhone,
			&o.Status, &o.PaymentStatus, &o.Currency, &o.Subtotal, &o.ShippingFee, &o.DiscountAmount, &o.TotalAmount,
			&o.PaidAmount, &o.DueAmount, &o.IsUrgent, &o.IsReady, &o.IsPrintReady, &o.IssueStatus,
			&o.CourierRiskLevel, &o.CourierDeliveryRatio,
			&riskFlagsStr, &courierConsignmentID, &courierTrackingCode,
			&courierStatusSyncAt, &specialNote, &shippingDistrict, &shippingThana,
			&shippingStr, &paymentMethod, &notes, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if customerID.Valid {
			o.CustomerID = &customerID.String
		}
		if customerEmail.Valid {
			o.CustomerEmail = customerEmail.String
		}
		if customerPhone.Valid {
			o.CustomerPhone = customerPhone.String
		}
		if paymentMethod.Valid {
			o.PaymentMethod = paymentMethod.String
		}
		if notes.Valid {
			o.Notes = notes.String
		}
		if specialNote.Valid {
			o.SpecialNote = &specialNote.String
		}
		if shippingDistrict.Valid {
			o.ShippingDistrict = shippingDistrict.String
		}
		if shippingThana.Valid {
			o.ShippingThana = shippingThana.String
		}
		if courierConsignmentID.Valid {
			o.CourierConsignmentID = &courierConsignmentID.String
		}
		if courierTrackingCode.Valid {
			o.CourierTrackingCode = &courierTrackingCode.String
		}
		o.CourierStatusSyncAt = courierStatusSyncAt

		if riskFlagsStr.Valid && riskFlagsStr.String != "" {
			_ = json.Unmarshal([]byte(riskFlagsStr.String), &o.RiskScoreFlags)
		}
		if o.RiskScoreFlags == nil {
			o.RiskScoreFlags = make([]storeModels.RiskFlag, 0)
		}

		_ = json.Unmarshal([]byte(shippingStr), &o.ShippingAddress)

		if oItems, err := r.GetOrderItems(ctx, db, o.ID); err == nil {
			o.Items = oItems
		}
		if cNotes, err := r.GetCallNotes(ctx, db, o.ID); err == nil {
			o.CallNotes = cNotes
		}

		diff := now.Sub(o.CreatedAt)
		hours := diff.Hours()
		agingTier := "NORMAL"
		isDelayed := false

		if hours >= 72 {
			agingTier = "CRITICAL"
			isDelayed = true
		} else if hours >= 48 {
			agingTier = "HIGH_DELAY"
			isDelayed = true
		} else if hours >= 24 {
			agingTier = "WARNING"
			isDelayed = true
		}

		items = append(items, FulfillmentQueueItem{
			Order:             o,
			AgingHours:        hours,
			AgingTier:         agingTier,
			IsDelayedHubAlert: isDelayed,
		})
	}

	return &FulfillmentQueueResponse{
		Items:   items,
		Summary: summary,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}, nil
}
