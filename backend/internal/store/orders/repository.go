package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrOrderNotFound = errors.New("order not found")
)

// Repository defines database operations for the store orders subsystem.
type Repository interface {
	CreateOrderTx(ctx context.Context, tx *sql.Tx, order *storeModels.Order, items []storeModels.OrderItem) error
	GetOrderByID(ctx context.Context, db *sql.DB, id string) (*OrderDetailResponse, error)
	ListOrders(ctx context.Context, db *sql.DB, filter *OrderFilterParams) ([]storeModels.Order, int, error)
	GetOrderStatusCounts(ctx context.Context, db *sql.DB) (map[string]int, error)
	GetOrderPulseDiagnostics(ctx context.Context, db *sql.DB) (*OrderPulseDiagnosticsResponse, error)
	UpdateOrderPulseTags(ctx context.Context, db *sql.DB, orderID string, req *UpdateOrderPulseTagRequest) error
	ExecutePartialSplit(ctx context.Context, db *sql.DB, orderID string, req *PartialSplitRequest, performedBy string) error
	UpdateOrderStatusTx(ctx context.Context, tx *sql.Tx, orderID string, newStatus storeModels.OrderStatus) error
	UpdatePaymentStatusTx(ctx context.Context, tx *sql.Tx, orderID string, newStatus storeModels.PaymentStatus) error
	RecordStatusHistoryTx(ctx context.Context, tx *sql.Tx, history *storeModels.OrderStatusHistory) error
	CreateShipmentTx(ctx context.Context, tx *sql.Tx, shipment *storeModels.OrderShipment) error
	RecordPaymentTransactionTx(ctx context.Context, tx *sql.Tx, txn *storeModels.PaymentTransaction) error
	GetOrderItems(ctx context.Context, db *sql.DB, orderID string) ([]storeModels.OrderItem, error)
	AddCallNote(ctx context.Context, db *sql.DB, note *storeModels.OrderCallNote) error
	GetCallNotes(ctx context.Context, db *sql.DB, orderID string) ([]storeModels.OrderCallNote, error)
	UpdateOrder(ctx context.Context, db *sql.DB, orderID string, req *UpdateOrderRequest) error
	DeleteOrder(ctx context.Context, db *sql.DB, orderID string) error
	UpdateCourierConsignment(ctx context.Context, db *sql.DB, orderID string, consignmentID, trackingCode string) error
	UpdateFulfillmentFlags(ctx context.Context, db *sql.DB, orderID string, req *UpdateFulfillmentFlagsRequest) error
	GetFulfillmentQueue(ctx context.Context, db *sql.DB, page, limit int, urgentOnly bool) (*FulfillmentQueueResponse, error)
	HasRecentOrderPlaced(ctx context.Context, db *sql.DB, phone string, minutes int) (bool, error)
	UpsertAbandonedCheckout(ctx context.Context, db *sql.DB, drop *storeModels.AbandonedCheckout) error
	PurgeAbandonedCheckout(ctx context.Context, db *sql.DB, sessionToken, phone string) error
	ListAbandonedCheckouts(ctx context.Context, db *sql.DB, status string, page, limit int) (*PaginatedAbandonedResponse, error)
	UpdateAbandonedStatus(ctx context.Context, db *sql.DB, id, status, callNotes string, callbackAt *time.Time, agentID *string) error
	ConvertAbandonedToOrder(ctx context.Context, db *sql.DB, dropID string, req *ConvertAbandonedToOrderRequest, agentID string) (*storeModels.Order, error)
}

// SQLRepository implements Repository for tenant PostgreSQL databases.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

func (r *SQLRepository) CreateOrderTx(ctx context.Context, tx *sql.Tx, o *storeModels.Order, items []storeModels.OrderItem) error {
	shippingJSON, err := json.Marshal(o.ShippingAddress)
	if err != nil {
		return fmt.Errorf("failed to serialize shipping address: %w", err)
	}

	var billingJSON []byte
	if o.BillingAddress != nil {
		billingJSON, err = json.Marshal(o.BillingAddress)
		if err != nil {
			return fmt.Errorf("failed to serialize billing address: %w", err)
		}
	}

	if o.DueAmount == 0 && o.TotalAmount > 0 && o.PaidAmount == 0 {
		o.DueAmount = o.TotalAmount
	} else if o.DueAmount == 0 && o.TotalAmount > o.PaidAmount {
		o.DueAmount = o.TotalAmount - o.PaidAmount
	}

	riskJSON, err := json.Marshal(o.RiskScoreFlags)
	if err != nil {
		riskJSON = []byte("[]")
	}

	queryOrder := `
		INSERT INTO orders (
			order_number, customer_id, customer_email, customer_phone,
			status, payment_status, currency, subtotal, shipping_fee, discount_amount, total_amount,
			paid_amount, due_amount, is_urgent, is_ready, is_print_ready, courier_risk_level, courier_delivery_ratio,
			risk_score_flags, special_note, shipping_district, shipping_thana,
			shipping_address, billing_address, payment_method, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW()
		)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRowContext(ctx, queryOrder,
		o.OrderNumber, o.CustomerID, o.CustomerEmail, o.CustomerPhone,
		o.Status, o.PaymentStatus, o.Currency, o.Subtotal, o.ShippingFee, o.DiscountAmount, o.TotalAmount,
		o.PaidAmount, o.DueAmount, o.IsUrgent, o.IsReady, o.IsPrintReady, o.CourierRiskLevel, o.CourierDeliveryRatio,
		string(riskJSON), o.SpecialNote, o.ShippingDistrict, o.ShippingThana,
		string(shippingJSON), string(billingJSON), o.PaymentMethod, o.Notes,
	).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert order: %w", err)
	}

	queryItem := `
		INSERT INTO order_items (
			order_id, variant_id, product_title, variant_title, sku, unit_price, unit_cost, quantity, total_price, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			COALESCE($7, (SELECT COALESCE(pv.cost_price, p.cost_price, 0) FROM product_variants pv LEFT JOIN products p ON p.id = pv.product_id WHERE pv.id = $2)),
			$8, $9, NOW()
		)
		RETURNING id, created_at
	`
	for i := range items {
		it := &items[i]
		it.OrderID = o.ID
		err := tx.QueryRowContext(ctx, queryItem,
			it.OrderID, it.VariantID, it.ProductTitle, it.VariantTitle, it.SKU,
			it.UnitPrice, it.UnitCost, it.Quantity, it.TotalPrice,
		).Scan(&it.ID, &it.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed to insert order item %s: %w", it.SKU, err)
		}
	}

	return nil
}

func (r *SQLRepository) GetOrderByID(ctx context.Context, db *sql.DB, id string) (*OrderDetailResponse, error) {
	queryOrder := `
		SELECT id, order_number, customer_id, customer_email, customer_phone,
		       status, payment_status, currency, subtotal, shipping_fee, discount_amount, total_amount,
		       paid_amount, due_amount, is_urgent, is_ready, is_print_ready,
		       COALESCE(courier_risk_level, 'LOW'), COALESCE(courier_delivery_ratio, 0.00),
		       risk_score_flags, courier_consignment_id, courier_tracking_code,
		       courier_status_sync_at, special_note, shipping_district, shipping_thana,
		       shipping_address, billing_address, payment_method, notes, created_at, updated_at
		FROM orders
		WHERE id = $1
	`
	var o storeModels.Order
	var customerID sql.NullString
	var customerEmail, customerPhone sql.NullString
	var shippingStr string
	var billingStr sql.NullString
	var paymentMethod, notes sql.NullString
	var riskFlagsStr sql.NullString
	var courierConsignmentID, courierTrackingCode, specialNote, shippingDistrict, shippingThana sql.NullString
	var courierStatusSyncAt *time.Time

	err := db.QueryRowContext(ctx, queryOrder, id).Scan(
		&o.ID, &o.OrderNumber, &customerID, &customerEmail, &customerPhone,
		&o.Status, &o.PaymentStatus, &o.Currency, &o.Subtotal, &o.ShippingFee, &o.DiscountAmount, &o.TotalAmount,
		&o.PaidAmount, &o.DueAmount, &o.IsUrgent, &o.IsReady, &o.IsPrintReady,
		&o.CourierRiskLevel, &o.CourierDeliveryRatio,
		&riskFlagsStr, &courierConsignmentID, &courierTrackingCode,
		&courierStatusSyncAt, &specialNote, &shippingDistrict, &shippingThana,
		&shippingStr, &billingStr, &paymentMethod, &notes, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to query order: %w", err)
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
	if billingStr.Valid && billingStr.String != "" {
		var b storeModels.CustomerAddress
		if err := json.Unmarshal([]byte(billingStr.String), &b); err == nil {
			o.BillingAddress = &b
		}
	}

	// Fetch items
	items, err := r.GetOrderItems(ctx, db, id)
	if err != nil {
		return nil, err
	}
	o.Items = items

	// Fetch call notes
	callNotes, err := r.GetCallNotes(ctx, db, id)
	if err == nil {
		o.CallNotes = callNotes
	}

	// Fetch shipments
	queryShipments := `
		SELECT id, order_id, carrier, tracking_number, tracking_url, status, notes, shipped_at, delivered_at, created_at, updated_at
		FROM order_shipments
		WHERE order_id = $1
		ORDER BY created_at DESC
	`
	sRows, err := db.QueryContext(ctx, queryShipments, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query shipments: %w", err)
	}
	defer sRows.Close()

	var shipments []storeModels.OrderShipment
	for sRows.Next() {
		var s storeModels.OrderShipment
		var trackingNumber, trackingURL, sNotes sql.NullString
		if err := sRows.Scan(
			&s.ID, &s.OrderID, &s.Carrier, &trackingNumber, &trackingURL,
			&s.Status, &sNotes, &s.ShippedAt, &s.DeliveredAt, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if trackingNumber.Valid {
			s.TrackingNumber = trackingNumber.String
		}
		if trackingURL.Valid {
			s.TrackingURL = trackingURL.String
		}
		if sNotes.Valid {
			s.Notes = sNotes.String
		}
		shipments = append(shipments, s)
	}
	o.Shipments = shipments

	// Fetch payments
	queryPayments := `
		SELECT id, order_id, gateway, transaction_id, amount, status, raw_response, created_at
		FROM payment_transactions
		WHERE order_id = $1
		ORDER BY created_at DESC
	`
	pRows, err := db.QueryContext(ctx, queryPayments, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query payment transactions: %w", err)
	}
	defer pRows.Close()

	var payments []storeModels.PaymentTransaction
	for pRows.Next() {
		var p storeModels.PaymentTransaction
		var rawResp sql.NullString
		if err := pRows.Scan(
			&p.ID, &p.OrderID, &p.Gateway, &p.TransactionID, &p.Amount, &p.Status, &rawResp, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		if rawResp.Valid {
			p.RawResponse = rawResp.String
		}
		payments = append(payments, p)
	}
	o.Transactions = payments

	// Fetch history
	queryHistory := `
		SELECT id, order_id, old_status, new_status, performed_by, notes, created_at
		FROM order_status_history
		WHERE order_id = $1
		ORDER BY created_at ASC
	`
	hRows, err := db.QueryContext(ctx, queryHistory, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query status history: %w", err)
	}
	defer hRows.Close()

	var history []storeModels.OrderStatusHistory
	for hRows.Next() {
		var h storeModels.OrderStatusHistory
		var oldSt, notesStr sql.NullString
		if err := hRows.Scan(
			&h.ID, &h.OrderID, &oldSt, &h.NewStatus, &h.PerformedBy, &notesStr, &h.CreatedAt,
		); err != nil {
			return nil, err
		}
		if oldSt.Valid {
			h.OldStatus = storeModels.OrderStatus(oldSt.String)
		}
		if notesStr.Valid {
			h.Notes = notesStr.String
		}
		history = append(history, h)
	}
	o.StatusHistory = history

	return &OrderDetailResponse{
		Order:     o,
		Items:     items,
		Shipments: shipments,
		Payments:  payments,
		History:   history,
	}, nil
}

func (r *SQLRepository) GetOrderItems(ctx context.Context, db *sql.DB, orderID string) ([]storeModels.OrderItem, error) {
	queryItems := `
		SELECT oi.id, oi.order_id, oi.variant_id, oi.product_title, oi.variant_title, oi.sku, oi.unit_price, oi.quantity, oi.total_price,
		       COALESCE(
		           (SELECT pi.url FROM product_images pi JOIN variant_images vi ON vi.image_id = pi.id WHERE vi.variant_id = oi.variant_id LIMIT 1),
		           p.featured_image_url
		       ) AS image_url,
		       COALESCE(oi.item_status, 'DELIVERED'), oi.return_reason,
		       oi.created_at
		FROM order_items oi
		LEFT JOIN product_variants pv ON pv.id = oi.variant_id
		LEFT JOIN products p ON p.id = pv.product_id OR p.id = oi.product_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at ASC
	`
	rows, err := db.QueryContext(ctx, queryItems, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to query order items: %w", err)
	}
	defer rows.Close()

	var items []storeModels.OrderItem
	for rows.Next() {
		var it storeModels.OrderItem
		var prodTitle, varTitle, sku, imgURL, itemStatus, returnReason sql.NullString
		if err := rows.Scan(
			&it.ID, &it.OrderID, &it.VariantID, &prodTitle, &varTitle,
			&sku, &it.UnitPrice, &it.Quantity, &it.TotalPrice, &imgURL,
			&itemStatus, &returnReason,
			&it.CreatedAt,
		); err != nil {
			return nil, err
		}
		if prodTitle.Valid {
			it.ProductTitle = prodTitle.String
		}
		if varTitle.Valid {
			it.VariantTitle = varTitle.String
		}
		if sku.Valid {
			it.SKU = sku.String
		}
		if imgURL.Valid && imgURL.String != "" {
			it.ImageURL = &imgURL.String
		}
		if itemStatus.Valid {
			it.ItemStatus = itemStatus.String
		}
		if returnReason.Valid {
			it.ReturnReason = &returnReason.String
		}
		items = append(items, it)
	}
	return items, nil
}

func (r *SQLRepository) ListOrders(ctx context.Context, db *sql.DB, filter *OrderFilterParams) ([]storeModels.Order, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(order_number ILIKE $%d OR customer_email ILIKE $%d OR customer_phone ILIKE $%d OR courier_consignment_id ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	if filter.Status != nil && *filter.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *filter.Status)
		argIdx++
	}

	if filter.PaymentStatus != nil && *filter.PaymentStatus != "" {
		where = append(where, fmt.Sprintf("payment_status = $%d", argIdx))
		args = append(args, *filter.PaymentStatus)
		argIdx++
	}

	if filter.StartDate != nil {
		where = append(where, fmt.Sprintf("created_at >= $%d", argIdx))
		args = append(args, *filter.StartDate)
		argIdx++
	}

	if filter.EndDate != nil {
		where = append(where, fmt.Sprintf("created_at <= $%d", argIdx))
		args = append(args, *filter.EndDate)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM orders WHERE %s", whereClause)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := (filter.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT id, order_number, customer_id, customer_email, customer_phone,
		       status, payment_status, currency, subtotal, shipping_fee, discount_amount, total_amount,
		       paid_amount, due_amount, is_urgent, is_ready, is_print_ready,
		       COALESCE(courier_risk_level, 'LOW'), COALESCE(courier_delivery_ratio, 0.00),
		       risk_score_flags, courier_consignment_id, courier_tracking_code,
		       courier_status_sync_at, special_note, shipping_district, shipping_thana,
		       shipping_address, payment_method, notes,
		       delay_blocker_reason, cancellation_root_cause, return_root_cause, is_partial_split, parent_order_id,
		       created_at, updated_at
		FROM orders
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	var ordersList []storeModels.Order
	for rows.Next() {
		var o storeModels.Order
		var customerID, customerEmail, customerPhone sql.NullString
		var shippingStr string
		var paymentMethod, notes sql.NullString
		var riskFlagsStr sql.NullString
		var courierConsignmentID, courierTrackingCode, specialNote, shippingDistrict, shippingThana sql.NullString
		var delayBlockerReason, cancellationRootCause, returnRootCause, parentOrderID sql.NullString
		var courierStatusSyncAt *time.Time

		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &customerID, &customerEmail, &customerPhone,
			&o.Status, &o.PaymentStatus, &o.Currency, &o.Subtotal, &o.ShippingFee, &o.DiscountAmount, &o.TotalAmount,
			&o.PaidAmount, &o.DueAmount, &o.IsUrgent, &o.IsReady, &o.IsPrintReady,
			&o.CourierRiskLevel, &o.CourierDeliveryRatio,
			&riskFlagsStr, &courierConsignmentID, &courierTrackingCode,
			&courierStatusSyncAt, &specialNote, &shippingDistrict, &shippingThana,
			&shippingStr, &paymentMethod, &notes,
			&delayBlockerReason, &cancellationRootCause, &returnRootCause, &o.IsPartialSplit, &parentOrderID,
			&o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, 0, err
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
		if delayBlockerReason.Valid {
			o.DelayBlockerReason = &delayBlockerReason.String
		}
		if cancellationRootCause.Valid {
			o.CancellationRootCause = &cancellationRootCause.String
		}
		if returnRootCause.Valid {
			o.ReturnRootCause = &returnRootCause.String
		}
		if parentOrderID.Valid {
			o.ParentOrderID = &parentOrderID.String
		}
		o.CourierStatusSyncAt = courierStatusSyncAt

		if riskFlagsStr.Valid && riskFlagsStr.String != "" {
			_ = json.Unmarshal([]byte(riskFlagsStr.String), &o.RiskScoreFlags)
		}
		if o.RiskScoreFlags == nil {
			o.RiskScoreFlags = make([]storeModels.RiskFlag, 0)
		}

		_ = json.Unmarshal([]byte(shippingStr), &o.ShippingAddress)

		// Populate items & call notes for the order
		if items, err := r.GetOrderItems(ctx, db, o.ID); err == nil {
			o.Items = items
		}
		if notes, err := r.GetCallNotes(ctx, db, o.ID); err == nil {
			o.CallNotes = notes
		}

		ordersList = append(ordersList, o)
	}

	return ordersList, total, rows.Err()
}

func (r *SQLRepository) GetOrderStatusCounts(ctx context.Context, db *sql.DB) (map[string]int, error) {
	counts := map[string]int{
		"ALL":                 0,
		"PLACED":              0,
		"REVIEW":              0,
		"PENDING":             0,
		"DELAYED":             0,
		"HOLD":                0,
		"APPROVAL_PENDING":    0,
		"CONFIRMED":           0,
		"PROCESSING":          0,
		"SHIPPED":             0,
		"DELIVERED":           0,
		"PARTIALLY_DELIVERED": 0,
		"RETURNED":            0,
		"CANCELLED":           0,
		"MANUALLY_CANCELLED":  0,
	}

	query := `SELECT status, COUNT(*) FROM orders GROUP BY status`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return counts, err
	}
	defer rows.Close()

	total := 0
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err == nil {
			counts[status] = count
			total += count
		}
	}
	counts["ALL"] = total
	return counts, nil
}

func (r *SQLRepository) UpdateOrderStatusTx(ctx context.Context, tx *sql.Tx, orderID string, newStatus storeModels.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
	res, err := tx.ExecContext(ctx, query, newStatus, orderID)
	if err != nil {
		return err
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

func (r *SQLRepository) UpdatePaymentStatusTx(ctx context.Context, tx *sql.Tx, orderID string, newStatus storeModels.PaymentStatus) error {
	query := `UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2`
	res, err := tx.ExecContext(ctx, query, newStatus, orderID)
	if err != nil {
		return err
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

func (r *SQLRepository) RecordStatusHistoryTx(ctx context.Context, tx *sql.Tx, h *storeModels.OrderStatusHistory) error {
	query := `
		INSERT INTO order_status_history (order_id, old_status, new_status, performed_by, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING id, created_at
	`
	var oldStatusStr *string
	if h.OldStatus != "" {
		s := string(h.OldStatus)
		oldStatusStr = &s
	}
	return tx.QueryRowContext(ctx, query, h.OrderID, oldStatusStr, h.NewStatus, h.PerformedBy, h.Notes).
		Scan(&h.ID, &h.CreatedAt)
}

func (r *SQLRepository) CreateShipmentTx(ctx context.Context, tx *sql.Tx, s *storeModels.OrderShipment) error {
	query := `
		INSERT INTO order_shipments (order_id, carrier, tracking_number, tracking_url, status, notes, shipped_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	return tx.QueryRowContext(ctx, query,
		s.OrderID, s.Carrier, s.TrackingNumber, s.TrackingURL, s.Status, s.Notes,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *SQLRepository) RecordPaymentTransactionTx(ctx context.Context, tx *sql.Tx, p *storeModels.PaymentTransaction) error {
	query := `
		INSERT INTO payment_transactions (order_id, gateway, transaction_id, amount, status, raw_response, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING id, created_at
	`
	return tx.QueryRowContext(ctx, query,
		p.OrderID, p.Gateway, p.TransactionID, p.Amount, p.Status, p.RawResponse,
	).Scan(&p.ID, &p.CreatedAt)
}

func (r *SQLRepository) AddCallNote(ctx context.Context, db *sql.DB, note *storeModels.OrderCallNote) error {
	query := `
		INSERT INTO order_call_notes (order_id, staff_name, note, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, created_at
	`
	return db.QueryRowContext(ctx, query, note.OrderID, note.StaffName, note.Note).Scan(&note.ID, &note.CreatedAt)
}

func (r *SQLRepository) GetCallNotes(ctx context.Context, db *sql.DB, orderID string) ([]storeModels.OrderCallNote, error) {
	query := `
		SELECT id, order_id, staff_name, note, created_at
		FROM order_call_notes
		WHERE order_id = $1
		ORDER BY created_at DESC
	`
	rows, err := db.QueryContext(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to query call notes: %w", err)
	}
	defer rows.Close()

	notes := make([]storeModels.OrderCallNote, 0)
	for rows.Next() {
		var n storeModels.OrderCallNote
		if err := rows.Scan(&n.ID, &n.OrderID, &n.StaffName, &n.Note, &n.CreatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, nil
}

func (r *SQLRepository) UpdateOrder(ctx context.Context, db *sql.DB, orderID string, req *UpdateOrderRequest) error {
	var currentTotal float64
	var currentPaid float64
	err := db.QueryRowContext(ctx, "SELECT total_amount, paid_amount FROM orders WHERE id = $1", orderID).Scan(&currentTotal, &currentPaid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrOrderNotFound
		}
		return err
	}

	paid := currentPaid
	if req.PaidAmount != nil {
		paid = *req.PaidAmount
	}
	due := currentTotal - paid
	if due < 0 {
		due = 0
	}

	var shippingJSON []byte
	if req.ShippingAddress != nil {
		shippingJSON, _ = json.Marshal(req.ShippingAddress)
	}

	query := `
		UPDATE orders
		SET customer_name = COALESCE(NULLIF($1, ''), customer_name),
		    customer_email = COALESCE(NULLIF($2, ''), customer_email),
		    customer_phone = COALESCE(NULLIF($3, ''), customer_phone),
		    shipping_district = COALESCE(NULLIF($4, ''), shipping_district),
		    shipping_thana = COALESCE(NULLIF($5, ''), shipping_thana),
		    special_note = $6,
		    notes = COALESCE(NULLIF($7, ''), notes),
		    paid_amount = $8,
		    due_amount = $9,
		    shipping_address = CASE WHEN $10::text IS NOT NULL AND $10::text != '' THEN $10::jsonb ELSE shipping_address END,
		    updated_at = NOW()
		WHERE id = $11
	`
	res, err := db.ExecContext(ctx, query,
		req.CustomerName, req.CustomerEmail, req.CustomerPhone,
		req.ShippingDistrict, req.ShippingThana, req.SpecialNote,
		req.Notes, paid, due, string(shippingJSON), orderID,
	)
	if err != nil {
		return fmt.Errorf("failed to update order: %w", err)
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

func (r *SQLRepository) DeleteOrder(ctx context.Context, db *sql.DB, orderID string) error {
	query := `DELETE FROM orders WHERE id = $1`
	res, err := db.ExecContext(ctx, query, orderID)
	if err != nil {
		return fmt.Errorf("failed to delete order: %w", err)
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

// UpdateOrderPulseTags updates delay_blocker_reason, cancellation_root_cause, or return_root_cause.
func (r *SQLRepository) UpdateOrderPulseTags(ctx context.Context, db *sql.DB, orderID string, req *UpdateOrderPulseTagRequest) error {
	sets := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.DelayBlockerReason != nil {
		sets = append(sets, fmt.Sprintf("delay_blocker_reason = $%d", argIdx))
		args = append(args, *req.DelayBlockerReason)
		argIdx++
	}
	if req.CancellationRootCause != nil {
		sets = append(sets, fmt.Sprintf("cancellation_root_cause = $%d", argIdx))
		args = append(args, *req.CancellationRootCause)
		argIdx++
	}
	if req.ReturnRootCause != nil {
		sets = append(sets, fmt.Sprintf("return_root_cause = $%d", argIdx))
		args = append(args, *req.ReturnRootCause)
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
		return fmt.Errorf("failed to update orderpulse tags: %w", err)
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

// GetOrderPulseDiagnostics aggregates Pillar 1 (Hub Aging), Pillar 2 (Cancellations), and Pillar 3 (Catalog R&D Matrix).
func (r *SQLRepository) GetOrderPulseDiagnostics(ctx context.Context, db *sql.DB) (*OrderPulseDiagnosticsResponse, error) {
	resp := &OrderPulseDiagnosticsResponse{
		AgingSummary: OrderPulseAgingSummary{
			BlockerCounts: make(map[string]int),
		},
		CancellationSummary: OrderPulseCancellationSummary{
			PreDispatchCauses:  make(map[string]int),
			PostDispatchCauses: make(map[string]int),
		},
		CatalogRDMatrix: make([]CatalogRDMatrixItem, 0),
	}

	// 1. Pillar 1: Hub Aging for unshipped orders ('PLACED', 'REVIEW', 'PENDING', 'DELAYED', 'HOLD')
	agingQuery := `
		SELECT 
			EXTRACT(EPOCH FROM (NOW() - created_at))/3600.0 AS aging_hours,
			COALESCE(delay_blocker_reason, 'Untagged Blocker') AS blocker
		FROM orders
		WHERE status IN ('PLACED', 'REVIEW', 'PENDING', 'DELAYED', 'HOLD')
	`
	rows, err := db.QueryContext(ctx, agingQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var hours float64
			var blocker string
			if err := rows.Scan(&hours, &blocker); err == nil {
				if hours >= 24 {
					resp.AgingSummary.TotalDelayedCount++
					resp.AgingSummary.BlockerCounts[blocker]++

					if hours >= 24 && hours < 48 {
						resp.AgingSummary.Aging24to48hCount++
					} else if hours >= 48 && hours < 72 {
						resp.AgingSummary.Aging48to72hCount++
					} else if hours >= 72 {
						resp.AgingSummary.CriticalOver72h++
					}
				}
			}
		}
	}

	// 2. Pillar 2: Pre-Dispatch (MANUALLY_CANCELLED) vs Post-Dispatch (CANCELLED, RETURNED)
	cancelsQuery := `
		SELECT status, COALESCE(cancellation_root_cause, COALESCE(return_root_cause, 'Untagged')) AS cause
		FROM orders
		WHERE status IN ('CANCELLED', 'MANUALLY_CANCELLED', 'RETURNED')
	`
	cRows, err := db.QueryContext(ctx, cancelsQuery)
	if err == nil {
		defer cRows.Close()
		totalPre := 0
		totalPost := 0
		for cRows.Next() {
			var st, cause string
			if err := cRows.Scan(&st, &cause); err == nil {
				if st == "MANUALLY_CANCELLED" {
					totalPre++
					resp.CancellationSummary.PreDispatchCauses[cause]++
				} else {
					totalPost++
					resp.CancellationSummary.PostDispatchCauses[cause]++
				}
			}
		}
		resp.CancellationSummary.PreDispatchCount = totalPre
		resp.CancellationSummary.PostDispatchCount = totalPost

		// Compute top pre reason
		maxCount := 0
		for cause, cnt := range resp.CancellationSummary.PreDispatchCauses {
			if cnt > maxCount && cause != "Untagged" {
				maxCount = cnt
				resp.CancellationSummary.TopPreReason = cause
			}
		}

		// Compute friction rate against all orders
		var totalOrders int
		_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM orders`).Scan(&totalOrders)
		if totalOrders > 0 {
			resp.CancellationSummary.FrictionRate = float64(totalPre) / float64(totalOrders) * 100.0
		}
	}

	// 3. Partial Deliveries Summary
	_ = db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(paid_amount), 0.0)
		FROM orders
		WHERE is_partial_split = TRUE OR status = 'PARTIALLY_DELIVERED'
	`).Scan(&resp.PartialCount, &resp.PartialRecoveredBDT)

	resp.TopPartialReason = "Sizing Mismatch"

	// 4. Pillar 3: Catalog R&D Matrix (Top returned SKUs and root causes)
	rdQuery := `
		SELECT 
			oi.variant_id,
			oi.sku,
			oi.product_title,
			oi.variant_title,
			COALESCE(
				(SELECT pi.url FROM product_images pi JOIN variant_images vi ON vi.image_id = pi.id WHERE vi.variant_id = oi.variant_id LIMIT 1),
				p.featured_image_url
			) AS image_url,
			COUNT(oi.id) AS ret_qty,
			COALESCE(oi.return_reason, COALESCE(o.return_root_cause, 'Sizing Mismatch')) AS reason
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		LEFT JOIN product_variants pv ON pv.id = oi.variant_id
		LEFT JOIN products p ON p.id = pv.product_id OR p.id = oi.product_id
		WHERE oi.item_status = 'RETURNED' OR o.status IN ('RETURNED', 'PARTIALLY_DELIVERED')
		GROUP BY oi.variant_id, oi.sku, oi.product_title, oi.variant_title, image_url, reason
		ORDER BY ret_qty DESC
		LIMIT 20
	`
	rdRows, err := db.QueryContext(ctx, rdQuery)
	if err == nil {
		defer rdRows.Close()
		skuMap := make(map[string]*CatalogRDMatrixItem)
		for rdRows.Next() {
			var varID, sku, prodTitle, varTitle, reason string
			var imgURL sql.NullString
			var qty int
			if err := rdRows.Scan(&varID, &sku, &prodTitle, &varTitle, &imgURL, &qty, &reason); err == nil {
				item, exists := skuMap[sku]
				if !exists {
					var imgPtr *string
					if imgURL.Valid && imgURL.String != "" {
						imgPtr = &imgURL.String
					}
					item = &CatalogRDMatrixItem{
						VariantID:        varID,
						SKU:              sku,
						ProductTitle:     prodTitle,
						VariantTitle:     varTitle,
						ImageURL:         imgPtr,
						ReturnedQuantity: 0,
						PrimaryRootCause: reason,
						ReasonBreakdown:  make(map[string]int),
					}
					skuMap[sku] = item
				}
				item.ReturnedQuantity += qty
				item.ReasonBreakdown[reason] += qty
			}
		}

		for _, item := range skuMap {
			maxR := 0
			for rName, rCnt := range item.ReasonBreakdown {
				if rCnt > maxR {
					maxR = rCnt
					item.PrimaryRootCause = rName
				}
			}
			resp.CatalogRDMatrix = append(resp.CatalogRDMatrix, *item)
		}
	}

	return resp, nil
}

// ExecutePartialSplit handles 1-click partial delivery order segregation.
func (r *SQLRepository) ExecutePartialSplit(ctx context.Context, db *sql.DB, orderID string, req *PartialSplitRequest, performedBy string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Mark original order as is_partial_split = true and status = 'PARTIALLY_DELIVERED'
	_, err = tx.ExecContext(ctx, `
		UPDATE orders 
		SET is_partial_split = TRUE,
		    status = 'PARTIALLY_DELIVERED',
		    updated_at = NOW()
		WHERE id = $1
	`, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order partial split flag: %w", err)
	}

	// 2. Update individual order items status and return reason
	for _, it := range req.Items {
		itemStatus := "DELIVERED"
		if it.Action == "RETURN" {
			itemStatus = "RETURNED"
		}
		_, err = tx.ExecContext(ctx, `
			UPDATE order_items
			SET item_status = $1,
			    return_reason = $2
			WHERE id = $3 AND order_id = $4
		`, itemStatus, it.ReturnReason, it.ItemID, orderID)
		if err != nil {
			return fmt.Errorf("failed to update order item status: %w", err)
		}
	}

	// 3. Record status history
	_, _ = tx.ExecContext(ctx, `
		INSERT INTO order_status_history (order_id, old_status, new_status, performed_by, notes, created_at)
		VALUES ($1, 'SHIPPED', 'PARTIALLY_DELIVERED', $2, $3, NOW())
	`, orderID, performedBy, "Partial Split executed via OrderPulse Analytics: "+req.Notes)

	return tx.Commit()
}

func (r *SQLRepository) UpdateCourierConsignment(ctx context.Context, db *sql.DB, orderID string, consignmentID, trackingCode string) error {
	query := `
		UPDATE orders
		SET courier_consignment_id = $1,
		    courier_tracking_code = $2,
		    courier_status_sync_at = NOW(),
		    status = 'SHIPPED',
		    updated_at = NOW()
		WHERE id = $3
	`
	res, err := db.ExecContext(ctx, query, consignmentID, trackingCode, orderID)
	if err != nil {
		return fmt.Errorf("failed to update courier consignment: %w", err)
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
