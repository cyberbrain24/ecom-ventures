package customers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrCustomerNotFound   = errors.New("customer profile not found")
	ErrAddressNotFound    = errors.New("customer address not found")
	ErrEmailConflict      = errors.New("customer email already registered in this store")
	ErrPhoneConflict      = errors.New("customer phone number already registered in this store")
	ErrCustomerHasOrders  = errors.New("customer has active financial records. Hard deletion is forbidden to preserve audit integrity; use soft deactivation or blacklisting instead")
)

// Repository specifies transactional database interactions for the customer subsystem.
type Repository interface {
	CreateCustomer(ctx context.Context, db *sql.DB, c *storeModels.Customer) error
	GetCustomerByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Customer, error)
	GetCustomerByPhone(ctx context.Context, db *sql.DB, phone string) (*storeModels.Customer, error)
	GetCustomerByEmail(ctx context.Context, db *sql.DB, email string) (*storeModels.Customer, error)
	ListCustomers(ctx context.Context, db *sql.DB, filter *CustomerFilterParams) ([]CustomerSummary, int, error)
	UpdateCustomer(ctx context.Context, db *sql.DB, id string, req *UpdateCustomerRequest) error
	UpdateCRMProfile(ctx context.Context, db *sql.DB, id string, req *UpdateCRMProfileRequest) error
	ToggleBlacklist(ctx context.Context, db *sql.DB, id string, req *ToggleBlacklistRequest) error
	CountCustomerOrders(ctx context.Context, db *sql.DB, customerID string) (int, error)
	DeleteCustomer(ctx context.Context, db *sql.DB, id string) error

	// Address Book
	CreateAddress(ctx context.Context, db *sql.DB, addr *storeModels.CustomerAddress) error
	GetAddressByID(ctx context.Context, db *sql.DB, addressID string) (*storeModels.CustomerAddress, error)
	ListAddressesByCustomerID(ctx context.Context, db *sql.DB, customerID string) ([]storeModels.CustomerAddress, error)
	UpdateAddress(ctx context.Context, db *sql.DB, addressID string, req *AddressRequest) error
	DeleteAddress(ctx context.Context, db *sql.DB, addressID string) error
	ClearDefaultShipping(ctx context.Context, tx *sql.Tx, customerID string) error
	ClearDefaultBilling(ctx context.Context, tx *sql.Tx, customerID string) error

	// Metrics & Aggregations
	GetCustomerMetrics(ctx context.Context, db *sql.DB, customerID string) (*CustomerMetrics, error)
	ListRecentOrders(ctx context.Context, db *sql.DB, customerID string, limit int) ([]CustomerOrderSummary, error)
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

func (r *SQLRepository) CreateCustomer(ctx context.Context, db *sql.DB, c *storeModels.Customer) error {
	tier := c.MembershipTier
	if tier == "" {
		tier = storeModels.MembershipTierStandard
	}

	query := `
		INSERT INTO customers (
			email, password_hash, first_name, last_name, phone,
			membership_tier, date_of_birth, crm_notes, is_blacklisted, blacklist_reason,
			is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	err := db.QueryRowContext(ctx, query,
		c.Email, c.PasswordHash, c.FirstName, c.LastName, c.Phone,
		tier, c.DateOfBirth, c.CRMNotes, c.IsBlacklisted, c.BlacklistReason,
		c.IsActive,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "idx_customers_phone_unique") || (strings.Contains(err.Error(), "phone") && strings.Contains(err.Error(), "unique")) {
			return ErrPhoneConflict
		}
		if strings.Contains(err.Error(), "idx_customers_email_unique") || strings.Contains(err.Error(), "customers_email_key") {
			return ErrEmailConflict
		}
		return fmt.Errorf("failed to insert customer: %w", err)
	}
	return nil
}

func (r *SQLRepository) GetCustomerByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Customer, error) {
	query := `
		SELECT id, COALESCE(email, ''), password_hash, first_name, last_name, phone,
		       membership_tier, date_of_birth, crm_notes, is_blacklisted, blacklist_reason,
		       is_active, created_at, updated_at
		FROM customers
		WHERE id = $1
	`
	c := &storeModels.Customer{}
	var passwordHash, phone, dob sql.NullString

	err := db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Email, &passwordHash, &c.FirstName, &c.LastName, &phone,
		&c.MembershipTier, &dob, &c.CRMNotes, &c.IsBlacklisted, &c.BlacklistReason,
		&c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, fmt.Errorf("failed to query customer: %w", err)
	}
	if passwordHash.Valid {
		c.PasswordHash = passwordHash.String
	}
	if phone.Valid {
		c.Phone = &phone.String
	}
	if dob.Valid {
		c.DateOfBirth = &dob.String
	}
	return c, nil
}

func (r *SQLRepository) GetCustomerByPhone(ctx context.Context, db *sql.DB, phone string) (*storeModels.Customer, error) {
	query := `
		SELECT id, COALESCE(email, ''), password_hash, first_name, last_name, phone,
		       membership_tier, date_of_birth, crm_notes, is_blacklisted, blacklist_reason,
		       is_active, created_at, updated_at
		FROM customers
		WHERE phone = $1
	`
	c := &storeModels.Customer{}
	var passwordHash, phoneVal, dob sql.NullString

	err := db.QueryRowContext(ctx, query, phone).Scan(
		&c.ID, &c.Email, &passwordHash, &c.FirstName, &c.LastName, &phoneVal,
		&c.MembershipTier, &dob, &c.CRMNotes, &c.IsBlacklisted, &c.BlacklistReason,
		&c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, fmt.Errorf("failed to query customer by phone: %w", err)
	}
	if passwordHash.Valid {
		c.PasswordHash = passwordHash.String
	}
	if phoneVal.Valid {
		c.Phone = &phoneVal.String
	}
	if dob.Valid {
		c.DateOfBirth = &dob.String
	}
	return c, nil
}

func (r *SQLRepository) GetCustomerByEmail(ctx context.Context, db *sql.DB, email string) (*storeModels.Customer, error) {
	query := `
		SELECT id, COALESCE(email, ''), password_hash, first_name, last_name, phone,
		       membership_tier, date_of_birth, crm_notes, is_blacklisted, blacklist_reason,
		       is_active, created_at, updated_at
		FROM customers
		WHERE LOWER(email) = LOWER($1)
	`
	c := &storeModels.Customer{}
	var passwordHash, phone, dob sql.NullString

	err := db.QueryRowContext(ctx, query, email).Scan(
		&c.ID, &c.Email, &passwordHash, &c.FirstName, &c.LastName, &phone,
		&c.MembershipTier, &dob, &c.CRMNotes, &c.IsBlacklisted, &c.BlacklistReason,
		&c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, fmt.Errorf("failed to query customer: %w", err)
	}
	if passwordHash.Valid {
		c.PasswordHash = passwordHash.String
	}
	if phone.Valid {
		c.Phone = &phone.String
	}
	if dob.Valid {
		c.DateOfBirth = &dob.String
	}
	return c, nil
}

func (r *SQLRepository) ListCustomers(ctx context.Context, db *sql.DB, filter *CustomerFilterParams) ([]CustomerSummary, int, error) {
	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.Search != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(c.first_name ILIKE $%d OR c.last_name ILIKE $%d OR c.email ILIKE $%d OR c.phone ILIKE $%d)",
			argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, searchTerm)
		argIdx++
	}

	if filter.MembershipTier != "" && filter.MembershipTier != "ALL" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.membership_tier = $%d", argIdx))
		args = append(args, filter.MembershipTier)
		argIdx++
	}

	if filter.IsActive != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("c.is_active = $%d", argIdx))
		args = append(args, *filter.IsActive)
		argIdx++
	}

	if filter.IsBlacklisted != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("c.is_blacklisted = $%d", argIdx))
		args = append(args, *filter.IsBlacklisted)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`SELECT COUNT(1) FROM customers c WHERE %s`, whereSQL)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count customers: %w", err)
	}

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)

	query := fmt.Sprintf(`
		SELECT
			c.id, COALESCE(c.email, ''), c.first_name, c.last_name, c.phone,
			c.membership_tier, c.is_active, c.is_blacklisted, c.blacklist_reason,
			c.created_at, c.updated_at,
			COALESCE(ca.city, '') AS default_city,
			COALESCE(ca.district, ca.city, '') AS default_district,
			COALESCE(ca.thana, ca.state_province, '') AS default_thana,
			COUNT(o.id) FILTER (WHERE o.status != 'CANCELLED') AS total_orders,
			COUNT(o.id) FILTER (WHERE o.status = 'DELIVERED') AS delivered_orders,
			COUNT(o.id) FILTER (WHERE o.status = 'CANCELLED') AS cancelled_orders,
			COUNT(o.id) FILTER (WHERE o.status = 'REFUNDED') AS rto_orders,
			COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'CANCELLED' AND o.payment_status = 'PAID'), 0.00) AS lifetime_value,
			MAX(o.created_at) AS last_order_date
		FROM customers c
		LEFT JOIN customer_addresses ca ON ca.customer_id = c.id AND ca.is_default_shipping = TRUE
		LEFT JOIN orders o ON o.customer_id = c.id
		WHERE %s
		GROUP BY c.id, ca.city, ca.district, ca.thana, ca.state_province
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list customers: %w", err)
	}
	defer rows.Close()

	summaries := []CustomerSummary{}
	for rows.Next() {
		var s CustomerSummary
		var phone sql.NullString
		var lastOrder sql.NullTime
		var m CustomerMetrics

		err := rows.Scan(
			&s.ID, &s.Email, &s.FirstName, &s.LastName, &phone,
			&s.MembershipTier, &s.IsActive, &s.IsBlacklisted, &s.BlacklistReason,
			&s.CreatedAt, &s.UpdatedAt,
			&s.City, &s.District, &s.Thana,
			&m.TotalOrders, &m.DeliveredOrders, &m.CancelledOrders, &m.RtoOrders,
			&m.LifetimeValue, &lastOrder,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan customer summary: %w", err)
		}

		if phone.Valid {
			s.Phone = &phone.String
		}
		if lastOrder.Valid {
			m.LastOrderDate = &lastOrder.Time
		}
		if m.TotalOrders > 0 && m.LifetimeValue > 0 {
			m.AverageOrderValue = m.LifetimeValue / float64(m.TotalOrders)
		}
		// Calculate COD Delivery Reliability Score
		finishedParcels := m.DeliveredOrders + m.CancelledOrders + m.RtoOrders
		if finishedParcels > 0 {
			m.ReliabilityScore = (float64(m.DeliveredOrders) / float64(finishedParcels)) * 100.0
		} else if m.TotalOrders > 0 {
			m.ReliabilityScore = 100.0 // Active pending pipeline without failures yet
		}
		if m.TotalOrders > 0 {
			m.RtoRate = (float64(m.CancelledOrders+m.RtoOrders) / float64(m.TotalOrders)) * 100.0
		}

		s.Metrics = m
		summaries = append(summaries, s)
	}

	return summaries, total, nil
}

func (r *SQLRepository) UpdateCustomer(ctx context.Context, db *sql.DB, id string, req *UpdateCustomerRequest) error {
	tier := req.MembershipTier
	if tier == "" {
		tier = storeModels.MembershipTierStandard
	}

	query := `
		UPDATE customers
		SET first_name = $1, last_name = $2, phone = $3,
		    membership_tier = $4, date_of_birth = $5, crm_notes = $6,
		    is_active = $7, updated_at = NOW()
		WHERE id = $8
	`
	res, err := db.ExecContext(ctx, query,
		req.FirstName, req.LastName, req.Phone,
		tier, req.DateOfBirth, req.CRMNotes,
		req.IsActive, id,
	)
	if err != nil {
		if strings.Contains(err.Error(), "idx_customers_phone_unique") || (strings.Contains(err.Error(), "phone") && strings.Contains(err.Error(), "unique")) {
			return ErrPhoneConflict
		}
		return fmt.Errorf("failed to update customer: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrCustomerNotFound
	}
	return nil
}

func (r *SQLRepository) UpdateCRMProfile(ctx context.Context, db *sql.DB, id string, req *UpdateCRMProfileRequest) error {
	tier := req.MembershipTier
	if tier == "" {
		tier = storeModels.MembershipTierStandard
	}

	query := `
		UPDATE customers
		SET membership_tier = $1, date_of_birth = $2, crm_notes = $3, updated_at = NOW()
		WHERE id = $4
	`
	res, err := db.ExecContext(ctx, query, tier, req.DateOfBirth, req.CRMNotes, id)
	if err != nil {
		return fmt.Errorf("failed to update customer CRM profile: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrCustomerNotFound
	}
	return nil
}

func (r *SQLRepository) ToggleBlacklist(ctx context.Context, db *sql.DB, id string, req *ToggleBlacklistRequest) error {
	query := `
		UPDATE customers
		SET is_blacklisted = $1, blacklist_reason = $2, updated_at = NOW()
		WHERE id = $3
	`
	res, err := db.ExecContext(ctx, query, req.IsBlacklisted, req.Reason, id)
	if err != nil {
		return fmt.Errorf("failed to toggle blacklist for customer %s: %w", id, err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrCustomerNotFound
	}
	return nil
}

func (r *SQLRepository) CountCustomerOrders(ctx context.Context, db *sql.DB, customerID string) (int, error) {
	var count int
	query := `SELECT COUNT(1) FROM orders WHERE customer_id = $1`
	err := db.QueryRowContext(ctx, query, customerID).Scan(&count)
	return count, err
}

func (r *SQLRepository) DeleteCustomer(ctx context.Context, db *sql.DB, id string) error {
	query := `DELETE FROM customers WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrCustomerNotFound
	}
	return nil
}

// ---------------- Address Book ----------------

func (r *SQLRepository) CreateAddress(ctx context.Context, db *sql.DB, addr *storeModels.CustomerAddress) error {
	district := addr.District
	if district == "" {
		district = addr.City
	}
	thana := addr.Thana
	if thana == "" && addr.StateProvince != nil {
		thana = *addr.StateProvince
	}

	query := `
		INSERT INTO customer_addresses (
			customer_id, label, recipient_name, phone, street_address,
			apartment_suite, city, district, thana, state_province, postal_code, country,
			is_default_shipping, is_default_billing, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	return db.QueryRowContext(ctx, query,
		addr.CustomerID, addr.Label, addr.RecipientName, addr.Phone, addr.StreetAddress,
		addr.ApartmentSuite, addr.City, district, thana, addr.StateProvince, addr.PostalCode, addr.Country,
		addr.IsDefaultShipping, addr.IsDefaultBilling,
	).Scan(&addr.ID, &addr.CreatedAt, &addr.UpdatedAt)
}

func (r *SQLRepository) GetAddressByID(ctx context.Context, db *sql.DB, addressID string) (*storeModels.CustomerAddress, error) {
	query := `
		SELECT id, customer_id, label, recipient_name, phone, street_address,
		       apartment_suite, city, COALESCE(district, city), COALESCE(thana, state_province, ''),
		       state_province, postal_code, country,
		       is_default_shipping, is_default_billing, created_at, updated_at
		FROM customer_addresses
		WHERE id = $1
	`
	addr := &storeModels.CustomerAddress{}
	var suite, state, postal sql.NullString

	err := db.QueryRowContext(ctx, query, addressID).Scan(
		&addr.ID, &addr.CustomerID, &addr.Label, &addr.RecipientName, &addr.Phone, &addr.StreetAddress,
		&suite, &addr.City, &addr.District, &addr.Thana, &state, &postal, &addr.Country,
		&addr.IsDefaultShipping, &addr.IsDefaultBilling, &addr.CreatedAt, &addr.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAddressNotFound
		}
		return nil, fmt.Errorf("failed to query customer address: %w", err)
	}
	if suite.Valid {
		addr.ApartmentSuite = &suite.String
	}
	if state.Valid {
		addr.StateProvince = &state.String
	}
	if postal.Valid {
		addr.PostalCode = &postal.String
	}
	return addr, nil
}

func (r *SQLRepository) ListAddressesByCustomerID(ctx context.Context, db *sql.DB, customerID string) ([]storeModels.CustomerAddress, error) {
	query := `
		SELECT id, customer_id, label, recipient_name, phone, street_address,
		       apartment_suite, city, COALESCE(district, city), COALESCE(thana, state_province, ''),
		       state_province, postal_code, country,
		       is_default_shipping, is_default_billing, created_at, updated_at
		FROM customer_addresses
		WHERE customer_id = $1
		ORDER BY is_default_shipping DESC, is_default_billing DESC, created_at DESC
	`
	rows, err := db.QueryContext(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to list customer addresses: %w", err)
	}
	defer rows.Close()

	addresses := []storeModels.CustomerAddress{}
	for rows.Next() {
		var addr storeModels.CustomerAddress
		var suite, state, postal sql.NullString

		err := rows.Scan(
			&addr.ID, &addr.CustomerID, &addr.Label, &addr.RecipientName, &addr.Phone, &addr.StreetAddress,
			&suite, &addr.City, &addr.District, &addr.Thana, &state, &postal, &addr.Country,
			&addr.IsDefaultShipping, &addr.IsDefaultBilling, &addr.CreatedAt, &addr.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan address: %w", err)
		}
		if suite.Valid {
			addr.ApartmentSuite = &suite.String
		}
		if state.Valid {
			addr.StateProvince = &state.String
		}
		if postal.Valid {
			addr.PostalCode = &postal.String
		}
		addresses = append(addresses, addr)
	}
	return addresses, nil
}

func (r *SQLRepository) UpdateAddress(ctx context.Context, db *sql.DB, addressID string, req *AddressRequest) error {
	district := req.District
	if district == "" {
		district = req.City
	}
	thana := req.Thana
	if thana == "" && req.StateProvince != nil {
		thana = *req.StateProvince
	}

	query := `
		UPDATE customer_addresses
		SET label = $1, recipient_name = $2, phone = $3, street_address = $4,
		    apartment_suite = $5, city = $6, district = $7, thana = $8,
		    state_province = $9, postal_code = $10, country = $11,
		    is_default_shipping = $12, is_default_billing = $13, updated_at = NOW()
		WHERE id = $14
	`
	res, err := db.ExecContext(ctx, query,
		req.Label, req.RecipientName, req.Phone, req.StreetAddress,
		req.ApartmentSuite, req.City, district, thana,
		req.StateProvince, req.PostalCode, req.Country,
		req.IsDefaultShipping, req.IsDefaultBilling, addressID,
	)
	if err != nil {
		return fmt.Errorf("failed to update address: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAddressNotFound
	}
	return nil
}

func (r *SQLRepository) DeleteAddress(ctx context.Context, db *sql.DB, addressID string) error {
	query := `DELETE FROM customer_addresses WHERE id = $1`
	res, err := db.ExecContext(ctx, query, addressID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAddressNotFound
	}
	return nil
}

func (r *SQLRepository) ClearDefaultShipping(ctx context.Context, tx *sql.Tx, customerID string) error {
	query := `UPDATE customer_addresses SET is_default_shipping = FALSE WHERE customer_id = $1`
	_, err := tx.ExecContext(ctx, query, customerID)
	return err
}

func (r *SQLRepository) ClearDefaultBilling(ctx context.Context, tx *sql.Tx, customerID string) error {
	query := `UPDATE customer_addresses SET is_default_billing = FALSE WHERE customer_id = $1`
	_, err := tx.ExecContext(ctx, query, customerID)
	return err
}

func (r *SQLRepository) GetCustomerMetrics(ctx context.Context, db *sql.DB, customerID string) (*CustomerMetrics, error) {
	query := `
		SELECT
			COUNT(id) FILTER (WHERE status != 'CANCELLED') AS total_orders,
			COUNT(id) FILTER (WHERE status = 'DELIVERED') AS delivered_orders,
			COUNT(id) FILTER (WHERE status = 'CANCELLED') AS cancelled_orders,
			COUNT(id) FILTER (WHERE status = 'REFUNDED') AS rto_orders,
			COALESCE(SUM(total_amount) FILTER (WHERE status != 'CANCELLED' AND payment_status = 'PAID'), 0.00) AS lifetime_value,
			MAX(created_at) AS last_order_date
		FROM orders
		WHERE customer_id = $1
	`
	m := &CustomerMetrics{}
	var lastOrder sql.NullTime

	err := db.QueryRowContext(ctx, query, customerID).Scan(
		&m.TotalOrders, &m.DeliveredOrders, &m.CancelledOrders, &m.RtoOrders,
		&m.LifetimeValue, &lastOrder,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate customer metrics: %w", err)
	}

	if m.TotalOrders > 0 && m.LifetimeValue > 0 {
		m.AverageOrderValue = m.LifetimeValue / float64(m.TotalOrders)
	}
	if lastOrder.Valid {
		m.LastOrderDate = &lastOrder.Time
	}

	finishedParcels := m.DeliveredOrders + m.CancelledOrders + m.RtoOrders
	if finishedParcels > 0 {
		m.ReliabilityScore = (float64(m.DeliveredOrders) / float64(finishedParcels)) * 100.0
	} else if m.TotalOrders > 0 {
		m.ReliabilityScore = 100.0
	}

	if m.TotalOrders > 0 {
		m.RtoRate = (float64(m.CancelledOrders+m.RtoOrders) / float64(m.TotalOrders)) * 100.0
	}

	return m, nil
}

func (r *SQLRepository) ListRecentOrders(ctx context.Context, db *sql.DB, customerID string, limit int) ([]CustomerOrderSummary, error) {
	query := `
		SELECT id, order_number, status, payment_status, total_amount, created_at
		FROM orders
		WHERE customer_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := db.QueryContext(ctx, query, customerID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent orders: %w", err)
	}
	defer rows.Close()

	orders := []CustomerOrderSummary{}
	for rows.Next() {
		var o CustomerOrderSummary
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.Status, &o.PaymentStatus, &o.TotalAmount, &o.CreatedAt); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	return orders, nil
}
