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
	ErrCustomerNotFound = errors.New("customer profile not found")
	ErrAddressNotFound  = errors.New("customer address not found")
	ErrEmailConflict    = errors.New("customer email already registered in this store")
)

// Repository specifies transactional database interactions for the customer subsystem.
type Repository interface {
	CreateCustomer(ctx context.Context, db *sql.DB, c *storeModels.Customer) error
	GetCustomerByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Customer, error)
	GetCustomerByEmail(ctx context.Context, db *sql.DB, email string) (*storeModels.Customer, error)
	ListCustomers(ctx context.Context, db *sql.DB, filter *CustomerFilterParams) ([]CustomerSummary, int, error)
	UpdateCustomer(ctx context.Context, db *sql.DB, id string, req *UpdateCustomerRequest) error
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
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

func (r *SQLRepository) CreateCustomer(ctx context.Context, db *sql.DB, c *storeModels.Customer) error {
	query := `
		INSERT INTO customers (
			email, password_hash, first_name, last_name, phone, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	err := db.QueryRowContext(ctx, query,
		c.Email, c.PasswordHash, c.FirstName, c.LastName, c.Phone, c.IsActive,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "customers_email_key") || strings.Contains(err.Error(), "unique") {
			return ErrEmailConflict
		}
		return fmt.Errorf("failed to insert customer: %w", err)
	}
	return nil
}

func (r *SQLRepository) GetCustomerByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Customer, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, phone, is_active, created_at, updated_at
		FROM customers
		WHERE id = $1
	`
	c := &storeModels.Customer{}
	var passwordHash, phone sql.NullString

	err := db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Email, &passwordHash, &c.FirstName, &c.LastName, &phone, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
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
	return c, nil
}

func (r *SQLRepository) GetCustomerByEmail(ctx context.Context, db *sql.DB, email string) (*storeModels.Customer, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, phone, is_active, created_at, updated_at
		FROM customers
		WHERE email = $1
	`
	c := &storeModels.Customer{}
	var passwordHash, phone sql.NullString

	err := db.QueryRowContext(ctx, query, email).Scan(
		&c.ID, &c.Email, &passwordHash, &c.FirstName, &c.LastName, &phone, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, fmt.Errorf("failed to query customer by email: %w", err)
	}
	if passwordHash.Valid {
		c.PasswordHash = passwordHash.String
	}
	if phone.Valid {
		c.Phone = &phone.String
	}
	return c, nil
}

func (r *SQLRepository) ListCustomers(ctx context.Context, db *sql.DB, filter *CustomerFilterParams) ([]CustomerSummary, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(email ILIKE $%d OR first_name ILIKE $%d OR last_name ILIKE $%d OR phone ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	if filter.IsActive != nil {
		where = append(where, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *filter.IsActive)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM customers WHERE %s", whereClause)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count customers: %w", err)
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
		SELECT
			c.id, c.email, c.first_name, c.last_name, c.phone, c.is_active, c.created_at, c.updated_at,
			COUNT(o.id) FILTER (WHERE o.status != 'CANCELLED') AS total_orders,
			COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'CANCELLED' AND o.payment_status = 'PAID'), 0.00) AS lifetime_value,
			MAX(o.created_at) AS last_order_date
		FROM customers c
		LEFT JOIN orders o ON o.customer_id = c.id
		WHERE %s
		GROUP BY c.id
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query customer directory: %w", err)
	}
	defer rows.Close()

	var list []CustomerSummary
	for rows.Next() {
		var s CustomerSummary
		var phone sql.NullString
		var lastOrder sql.NullTime
		if err := rows.Scan(
			&s.ID, &s.Email, &s.FirstName, &s.LastName, &phone, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
			&s.Metrics.TotalOrders, &s.Metrics.LifetimeValue, &lastOrder,
		); err != nil {
			return nil, 0, err
		}

		if phone.Valid {
			s.Phone = &phone.String
		}

		if s.Metrics.TotalOrders > 0 && s.Metrics.LifetimeValue > 0 {
			s.Metrics.AverageOrderValue = s.Metrics.LifetimeValue / float64(s.Metrics.TotalOrders)
		}
		if lastOrder.Valid {
			s.Metrics.LastOrderDate = &lastOrder.Time
		}

		list = append(list, s)
	}

	return list, total, rows.Err()
}

func (r *SQLRepository) UpdateCustomer(ctx context.Context, db *sql.DB, id string, req *UpdateCustomerRequest) error {
	query := `
		UPDATE customers
		SET first_name = $1, last_name = $2, phone = $3, is_active = $4, updated_at = NOW()
		WHERE id = $5
	`
	res, err := db.ExecContext(ctx, query, req.FirstName, req.LastName, req.Phone, req.IsActive, id)
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

func (r *SQLRepository) CreateAddress(ctx context.Context, db *sql.DB, addr *storeModels.CustomerAddress) error {
	query := `
		INSERT INTO customer_addresses (
			customer_id, label, recipient_name, phone, street_address, apartment_suite,
			city, state_province, postal_code, country, is_default_shipping, is_default_billing,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
		)
		RETURNING id, created_at, updated_at
	`
	return db.QueryRowContext(ctx, query,
		addr.CustomerID, addr.Label, addr.RecipientName, addr.Phone, addr.StreetAddress, addr.ApartmentSuite,
		addr.City, addr.StateProvince, addr.PostalCode, addr.Country, addr.IsDefaultShipping, addr.IsDefaultBilling,
	).Scan(&addr.ID, &addr.CreatedAt, &addr.UpdatedAt)
}

func (r *SQLRepository) GetAddressByID(ctx context.Context, db *sql.DB, addressID string) (*storeModels.CustomerAddress, error) {
	query := `
		SELECT id, customer_id, label, recipient_name, phone, street_address, apartment_suite,
		       city, state_province, postal_code, country, is_default_shipping, is_default_billing,
		       created_at, updated_at
		FROM customer_addresses
		WHERE id = $1
	`
	addr := &storeModels.CustomerAddress{}
	var apt, state, postal sql.NullString

	err := db.QueryRowContext(ctx, query, addressID).Scan(
		&addr.ID, &addr.CustomerID, &addr.Label, &addr.RecipientName, &addr.Phone, &addr.StreetAddress, &apt,
		&addr.City, &state, &postal, &addr.Country, &addr.IsDefaultShipping, &addr.IsDefaultBilling,
		&addr.CreatedAt, &addr.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAddressNotFound
		}
		return nil, fmt.Errorf("failed to query address: %w", err)
	}
	if apt.Valid {
		addr.ApartmentSuite = &apt.String
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
		SELECT id, customer_id, label, recipient_name, phone, street_address, apartment_suite,
		       city, state_province, postal_code, country, is_default_shipping, is_default_billing,
		       created_at, updated_at
		FROM customer_addresses
		WHERE customer_id = $1
		ORDER BY is_default_shipping DESC, is_default_billing DESC, created_at DESC
	`
	rows, err := db.QueryContext(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to list addresses: %w", err)
	}
	defer rows.Close()

	var list []storeModels.CustomerAddress
	for rows.Next() {
		var addr storeModels.CustomerAddress
		var apt, state, postal sql.NullString
		if err := rows.Scan(
			&addr.ID, &addr.CustomerID, &addr.Label, &addr.RecipientName, &addr.Phone, &addr.StreetAddress, &apt,
			&addr.City, &state, &postal, &addr.Country, &addr.IsDefaultShipping, &addr.IsDefaultBilling,
			&addr.CreatedAt, &addr.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if apt.Valid {
			addr.ApartmentSuite = &apt.String
		}
		if state.Valid {
			addr.StateProvince = &state.String
		}
		if postal.Valid {
			addr.PostalCode = &postal.String
		}
		list = append(list, addr)
	}
	return list, rows.Err()
}

func (r *SQLRepository) UpdateAddress(ctx context.Context, db *sql.DB, addressID string, req *AddressRequest) error {
	query := `
		UPDATE customer_addresses
		SET label = $1, recipient_name = $2, phone = $3, street_address = $4, apartment_suite = $5,
		    city = $6, state_province = $7, postal_code = $8, country = $9,
		    is_default_shipping = $10, is_default_billing = $11, updated_at = NOW()
		WHERE id = $12
	`
	res, err := db.ExecContext(ctx, query,
		req.Label, req.RecipientName, req.Phone, req.StreetAddress, req.ApartmentSuite,
		req.City, req.StateProvince, req.PostalCode, req.Country,
		req.IsDefaultShipping, req.IsDefaultBilling, addressID,
	)
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
			COALESCE(SUM(total_amount) FILTER (WHERE status != 'CANCELLED' AND payment_status = 'PAID'), 0.00) AS lifetime_value,
			MAX(created_at) AS last_order_date
		FROM orders
		WHERE customer_id = $1
	`
	m := &CustomerMetrics{}
	var lastOrder sql.NullTime

	err := db.QueryRowContext(ctx, query, customerID).Scan(
		&m.TotalOrders, &m.LifetimeValue, &lastOrder,
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

	return m, nil
}
