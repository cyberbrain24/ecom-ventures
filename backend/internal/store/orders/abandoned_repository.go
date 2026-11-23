package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// HasRecentOrderPlaced checks if any order was placed with the given phone number within the specified minutes.
// This serves as the Anti-Collision Guard preventing customers who just purchased from being tagged as abandoned.
func (r *SQLRepository) HasRecentOrderPlaced(ctx context.Context, db *sql.DB, phone string, minutes int) (bool, error) {
	cleanPhone := strings.ReplaceAll(phone, " ", "")
	cleanPhone = strings.TrimPrefix(cleanPhone, "+88")
	cleanPhone = strings.TrimPrefix(cleanPhone, "88")

	var count int
	query := `
		SELECT COUNT(1) 
		FROM orders 
		WHERE REPLACE(REPLACE(customer_phone, ' ', ''), '+88', '') LIKE $1
		  AND created_at >= NOW() - ($2 || ' minutes')::INTERVAL;
	`
	err := db.QueryRowContext(ctx, query, "%"+cleanPhone, minutes).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("checking recent order collision: %w", err)
	}
	return count > 0, nil
}

// UpsertAbandonedCheckout silently captures or updates live customer checkout intent.
// Session-based upsert guarantees that cart modifications or address typings do not create duplicates.
func (r *SQLRepository) UpsertAbandonedCheckout(ctx context.Context, db *sql.DB, drop *storeModels.AbandonedCheckout) error {
	itemsJSON, err := json.Marshal(drop.CartItems)
	if err != nil {
		itemsJSON = []byte("[]")
	}

	// Check if session_token already exists
	var existingID string
	var existingStatus string
	findErr := db.QueryRowContext(ctx, "SELECT id, status FROM abandoned_checkouts WHERE session_token = $1 LIMIT 1;", drop.SessionToken).Scan(&existingID, &existingStatus)
	if findErr == nil && existingID != "" {
		if existingStatus == string(storeModels.AbandonedStatusConverted) {
			// Already converted, do not reopen
			return nil
		}
		_, err = db.ExecContext(ctx, `
			UPDATE abandoned_checkouts SET
				phone = $1,
				customer_name = $2,
				customer_email = $3,
				district = $4,
				thana = $5,
				address = $6,
				cart_items = $7,
				cart_total = $8,
				updated_at = NOW()
			WHERE id = $9;
		`, drop.Phone, drop.CustomerName, drop.CustomerEmail, drop.District, drop.Thana, drop.Address, string(itemsJSON), drop.CartTotal, existingID)
		drop.ID = existingID
		return err
	}

	err = db.QueryRowContext(ctx, `
		INSERT INTO abandoned_checkouts (
			session_token, phone, customer_name, customer_email,
			district, thana, address, cart_items, cart_total,
			status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW())
		RETURNING id, created_at, updated_at;
	`, drop.SessionToken, drop.Phone, drop.CustomerName, drop.CustomerEmail, drop.District, drop.Thana, drop.Address, string(itemsJSON), drop.CartTotal).Scan(
		&drop.ID, &drop.CreatedAt, &drop.UpdatedAt,
	)
	return err
}

// PurgeAbandonedCheckout deletes or marks converted any matching abandoned checkout upon successful order placement.
// This fulfills Pillar 3 (Auto-Purge Upon Self-Conversion: Zero Ghost Calls).
func (r *SQLRepository) PurgeAbandonedCheckout(ctx context.Context, db *sql.DB, sessionToken, phone string) error {
	cleanPhone := strings.ReplaceAll(phone, " ", "")
	cleanPhone = strings.TrimPrefix(cleanPhone, "+88")
	cleanPhone = strings.TrimPrefix(cleanPhone, "88")

	query := `
		DELETE FROM abandoned_checkouts
		WHERE (session_token = $1 OR REPLACE(REPLACE(phone, ' ', ''), '+88', '') LIKE $2)
		  AND status NOT IN ('converted');
	`
	_, err := db.ExecContext(ctx, query, sessionToken, "%"+cleanPhone)
	return err
}

// ListAbandonedCheckouts retrieves paginated drops with summary counts for tele-sales recovery.
func (r *SQLRepository) ListAbandonedCheckouts(ctx context.Context, db *sql.DB, status string, page, limit int) (*PaginatedAbandonedResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Pipeline counts
	var summary AbandonedCheckoutsSummary
	summaryQuery := `
		SELECT 
			COUNT(1),
			COUNT(1) FILTER (WHERE status = 'pending'),
			COUNT(1) FILTER (WHERE status = 'called_busy'),
			COUNT(1) FILTER (WHERE status = 'called_followup'),
			COUNT(1) FILTER (WHERE status = 'declined'),
			COUNT(1) FILTER (WHERE status = 'converted')
		FROM abandoned_checkouts;
	`
	_ = db.QueryRowContext(ctx, summaryQuery).Scan(
		&summary.TotalCount,
		&summary.PendingCount,
		&summary.CalledBusyCount,
		&summary.CalledFollowupCount,
		&summary.DeclinedCount,
		&summary.ConvertedCount,
	)

	baseQuery := `
		SELECT 
			id, session_token, phone, customer_name, customer_email,
			district, thana, address, cart_items, cart_total,
			status, call_notes, scheduled_callback_at, agent_id,
			converted_order_id, created_at, updated_at
		FROM abandoned_checkouts
	`
	countQuery := `SELECT COUNT(1) FROM abandoned_checkouts`

	var conditions []string
	var args []interface{}
	idx := 1

	if status != "" && strings.ToUpper(status) != "ALL" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, strings.ToLower(status))
		idx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	err := db.QueryRowContext(ctx, countQuery+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("counting abandoned checkouts: %w", err)
	}

	query := fmt.Sprintf("%s%s ORDER BY updated_at DESC LIMIT $%d OFFSET $%d;", baseQuery, whereClause, idx, idx+1)
	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying abandoned checkouts: %w", err)
	}
	defer rows.Close()

	items := make([]storeModels.AbandonedCheckout, 0)
	for rows.Next() {
		var item storeModels.AbandonedCheckout
		var itemsRaw []byte
		var agentID sql.NullString
		var convertedID sql.NullString
		var callbackAt sql.NullTime

		if err := rows.Scan(
			&item.ID, &item.SessionToken, &item.Phone, &item.CustomerName, &item.CustomerEmail,
			&item.District, &item.Thana, &item.Address, &itemsRaw, &item.CartTotal,
			&item.Status, &item.CallNotes, &callbackAt, &agentID,
			&convertedID, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning abandoned checkout: %w", err)
		}

		item.CartItems = json.RawMessage(itemsRaw)
		if agentID.Valid {
			item.AgentID = &agentID.String
		}
		if convertedID.Valid {
			item.ConvertedOrderID = &convertedID.String
		}
		if callbackAt.Valid {
			item.ScheduledCallbackAt = &callbackAt.Time
		}
		items = append(items, item)
	}

	return &PaginatedAbandonedResponse{
		Items:   items,
		Summary: summary,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}, nil
}

// UpdateAbandonedStatus updates tele-sales outreach status and agent notes.
func (r *SQLRepository) UpdateAbandonedStatus(ctx context.Context, db *sql.DB, id, status, callNotes string, callbackAt *time.Time, agentID *string) error {
	query := `
		UPDATE abandoned_checkouts SET
			status = $1,
			call_notes = $2,
			scheduled_callback_at = $3,
			agent_id = $4,
			updated_at = NOW()
		WHERE id = $5;
	`
	res, err := db.ExecContext(ctx, query, status, callNotes, callbackAt, agentID, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("abandoned checkout not found")
	}
	return nil
}

// ConvertAbandonedToOrder executes Pillar 5: 1-Click Order Genesis Engine.
func (r *SQLRepository) ConvertAbandonedToOrder(ctx context.Context, db *sql.DB, dropID string, req *ConvertAbandonedToOrderRequest, agentID string) (*storeModels.Order, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("starting transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Fetch the Abandoned Checkout
	var drop storeModels.AbandonedCheckout
	var itemsRaw []byte
	err = tx.QueryRowContext(ctx, `
		SELECT id, phone, customer_name, customer_email, district, thana, address, cart_items, cart_total, status
		FROM abandoned_checkouts WHERE id = $1 FOR UPDATE;
	`, dropID).Scan(
		&drop.ID, &drop.Phone, &drop.CustomerName, &drop.CustomerEmail,
		&drop.District, &drop.Thana, &drop.Address, &itemsRaw, &drop.CartTotal, &drop.Status,
	)
	if err != nil {
		return nil, fmt.Errorf("loading abandoned checkout: %w", err)
	}
	if drop.Status == storeModels.AbandonedStatusConverted {
		return nil, fmt.Errorf("checkout has already been converted into an order")
	}

	// Apply any overrides from agent
	if req.CustomerName != nil && *req.CustomerName != "" {
		drop.CustomerName = *req.CustomerName
	}
	if req.Phone != nil && *req.Phone != "" {
		drop.Phone = *req.Phone
	}
	if req.CustomerEmail != nil && *req.CustomerEmail != "" {
		drop.CustomerEmail = *req.CustomerEmail
	}
	if req.District != nil && *req.District != "" {
		drop.District = *req.District
	}
	if req.Thana != nil && *req.Thana != "" {
		drop.Thana = *req.Thana
	}
	if req.Address != nil && *req.Address != "" {
		drop.Address = *req.Address
	}

	if drop.Phone == "" {
		return nil, fmt.Errorf("valid phone number is required to convert order")
	}
	if drop.CustomerName == "" {
		drop.CustomerName = "Valued Customer"
	}

	// 2. Compute Regional Courier Rate: ৳70 inside Dhaka / ৳120 outside Dhaka
	shippingFee := 120.00
	if strings.Contains(strings.ToLower(drop.District), "dhaka") {
		shippingFee = 70.00
	}

	// 3. Resolve Customer & CRM Profile
	var customerID string
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM customers WHERE phone = $1 LIMIT 1;
	`, drop.Phone).Scan(&customerID)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("resolving customer: %w", err)
	}
	if customerID == "" {
		// Create guest customer
		var newCID string
		err = tx.QueryRowContext(ctx, `
			INSERT INTO customers (name, email, phone, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
			RETURNING id;
		`, drop.CustomerName, drop.CustomerEmail, drop.Phone).Scan(&newCID)
		if err == nil {
			customerID = newCID
		}
	}

	// 4. Generate Order Number
	orderNumber := fmt.Sprintf("ORD-%s-%d", time.Now().Format("060102"), time.Now().UnixNano()%10000)

	// Subtotal & Total
	subtotal := drop.CartTotal
	totalAmount := subtotal + shippingFee
	isUrgent := totalAmount > 2500.00

	paymentMethod := "COD"
	if req.PaymentMethod != "" {
		paymentMethod = req.PaymentMethod
	}

	thana := drop.Thana
	shippingAddress := storeModels.CustomerAddress{
		RecipientName: drop.CustomerName,
		Phone:         drop.Phone,
		StreetAddress: drop.Address,
		City:          drop.District,
		StateProvince: &thana,
		Country:       "BD",
	}
	shippingJSON, _ := json.Marshal(shippingAddress)

	// 5. Insert Order
	var newOrderID string
	var createdAt, updatedAt time.Time
	orderQuery := `
		INSERT INTO orders (
			order_number, customer_id, customer_email, customer_phone,
			status, payment_status, currency, subtotal, shipping_fee, discount_amount, total_amount,
			shipping_address, billing_address, payment_method, notes, is_urgent,
			created_at, updated_at
		) VALUES (
			$1, NULLIF($2, '')::UUID, $3, $4,
			'PENDING', 'PENDING', 'BDT', $5, $6, 0.00, $7,
			$8, $8, $9, $10, $11,
			NOW(), NOW()
		)
		RETURNING id, created_at, updated_at;
	`
	orderNotes := fmt.Sprintf("Recovered via 1-Click Tele-Sales Outreach. %s", req.Notes)
	err = tx.QueryRowContext(ctx, orderQuery,
		orderNumber, customerID, drop.CustomerEmail, drop.Phone,
		subtotal, shippingFee, totalAmount,
		string(shippingJSON), paymentMethod, orderNotes, isUrgent,
	).Scan(&newOrderID, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating order record: %w", err)
	}

	// 6. Insert Order Items from Cart Snapshot
	var cartItems []struct {
		VariantID    string  `json:"variant_id"`
		ProductTitle string  `json:"product_title"`
		VariantTitle string  `json:"variant_title"`
		SKU          string  `json:"sku"`
		UnitPrice    float64 `json:"unit_price"`
		Quantity     int     `json:"quantity"`
	}
	_ = json.Unmarshal(itemsRaw, &cartItems)

	for _, item := range cartItems {
		itemTotal := item.UnitPrice * float64(item.Quantity)
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO order_items (
				order_id, variant_id, title, product_title, variant_title, sku, unit_price, quantity, total_price, created_at
			) VALUES ($1, NULLIF($2, '')::UUID, $3, $3, $4, $5, $6, $7, $8, NOW());
		`, newOrderID, item.VariantID, item.ProductTitle, item.VariantTitle, item.SKU, item.UnitPrice, item.Quantity, itemTotal)
	}

	// 7. Order Status History
	_, _ = tx.ExecContext(ctx, `
		INSERT INTO order_status_history (
			order_id, old_status, new_status, performed_by, notes, reason, created_at
		) VALUES ($1, '', 'PENDING', 'TELE_SALES_RECOVERY', '1-Click Recovery conversion from abandoned checkout', 'TELE_SALES_CONVERT', NOW());
	`, newOrderID)

	// 8. Update Abandoned Checkout status='converted' and link converted_order_id
	_, err = tx.ExecContext(ctx, `
		UPDATE abandoned_checkouts SET
			status = 'converted',
			converted_order_id = $1,
			agent_id = NULLIF($2, '')::UUID,
			call_notes = call_notes || ' | Converted to Order #' || $3,
			updated_at = NOW()
		WHERE id = $4;
	`, newOrderID, agentID, orderNumber, dropID)
	if err != nil {
		return nil, fmt.Errorf("updating abandoned status: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing order conversion: %w", err)
	}

	createdOrder := &storeModels.Order{
		ID:              newOrderID,
		OrderNumber:     orderNumber,
		CustomerEmail:   drop.CustomerEmail,
		CustomerPhone:   drop.Phone,
		Status:          storeModels.OrderStatusPending,
		PaymentStatus:   storeModels.PaymentStatusPending,
		Currency:        "BDT",
		Subtotal:        subtotal,
		ShippingFee:     shippingFee,
		TotalAmount:     totalAmount,
		IsUrgent:        isUrgent,
		ShippingAddress: shippingAddress,
		PaymentMethod:   paymentMethod,
		Notes:           orderNotes,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}

	return createdOrder, nil
}
