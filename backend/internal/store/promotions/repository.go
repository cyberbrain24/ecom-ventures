// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, discount rules, and cart promotion evaluations.
package promotions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrCouponNotFound indicates the requested coupon ID or code does not exist.
	ErrCouponNotFound = errors.New("coupon not found")
	// ErrCodeConflict indicates a coupon with the specified code already exists for this store.
	ErrCodeConflict = errors.New("coupon code already exists in this store")
)

// Repository specifies transactional database interactions for promotions and coupons.
type Repository interface {
	EnsureSchema(ctx context.Context, db *sql.DB) error
	CreateCoupon(ctx context.Context, db *sql.DB, c *Coupon) error
	GetCouponByID(ctx context.Context, db *sql.DB, id string) (*Coupon, error)
	GetCouponByCode(ctx context.Context, db *sql.DB, code string) (*Coupon, error)
	GetCouponByCodeForUpdate(ctx context.Context, tx *sql.Tx, code string) (*Coupon, error)
	ListCoupons(ctx context.Context, db *sql.DB, filter *CouponFilterParams) ([]Coupon, int, error)
	UpdateCoupon(ctx context.Context, db *sql.DB, id string, req *UpdateCouponRequest) error
	DeleteCoupon(ctx context.Context, db *sql.DB, id string) error

	// Usage tracking
	RecordCouponUsageTx(ctx context.Context, tx *sql.Tx, usage *CouponUsage) error
	IncrementCouponTimesUsedTx(ctx context.Context, tx *sql.Tx, couponID string) error
	GetCustomerUsageCount(ctx context.Context, db *sql.DB, couponID string, customerID *string, customerEmail string) (int, error)
	GetCustomerUsageCountTx(ctx context.Context, tx *sql.Tx, couponID string, customerID *string, customerEmail string) (int, error)

	// Multi-Item Bundle Tiers
	EnsureBundleSchema(ctx context.Context, db *sql.DB) error
	ListBundleTiers(ctx context.Context, db *sql.DB, activeOnly bool) ([]BundleTier, error)
	GetBundleTierByID(ctx context.Context, db *sql.DB, id string) (*BundleTier, error)
	CreateBundleTier(ctx context.Context, db *sql.DB, tier *BundleTier) error
	UpdateBundleTier(ctx context.Context, db *sql.DB, tier *BundleTier) error
	DeleteBundleTier(ctx context.Context, db *sql.DB, id string) error
	ToggleBundleTierStatus(ctx context.Context, db *sql.DB, id string, isActive bool) error
}

// SQLRepository implements Repository using PostgreSQL.
type SQLRepository struct{}

// NewSQLRepository instantiates the promotions SQL repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// EnsureSchema idempotently creates the coupons and coupon_usages tables and indexes.
func (r *SQLRepository) EnsureSchema(ctx context.Context, db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS coupons (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			code VARCHAR(50) NOT NULL UNIQUE,
			description TEXT,
			discount_type VARCHAR(30) NOT NULL,
			discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
			min_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
			max_discount_amount NUMERIC(12, 2),
			max_uses INT NOT NULL DEFAULT 0,
			max_uses_per_customer INT NOT NULL DEFAULT 1,
			times_used INT NOT NULL DEFAULT 0,
			valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
			valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS coupon_usages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
			order_id VARCHAR(100),
			customer_id VARCHAR(100),
			customer_email VARCHAR(255) NOT NULL,
			discount_amount NUMERIC(12, 2) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
		CREATE INDEX IF NOT EXISTS idx_coupon_usages_customer ON coupon_usages(coupon_id, customer_email);
	`
	_, err := db.ExecContext(ctx, query)
	return err
}

// CreateCoupon inserts a new promotional coupon into the tenant database.
func (r *SQLRepository) CreateCoupon(ctx context.Context, db *sql.DB, c *Coupon) error {
	query := `
		INSERT INTO coupons (
			code, description, discount_type, discount_value, min_subtotal, max_discount_amount,
			max_uses, max_uses_per_customer, times_used, valid_from, valid_to, is_active, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, NOW(), NOW()
		)
		RETURNING id, times_used, created_at, updated_at
	`
	err := db.QueryRowContext(ctx, query,
		c.Code, c.Description, c.DiscountType, c.DiscountValue, c.MinSubtotal, c.MaxDiscountAmount,
		c.MaxUses, c.MaxUsesPerCustomer, c.ValidFrom, c.ValidTo, c.IsActive,
	).Scan(&c.ID, &c.TimesUsed, &c.CreatedAt, &c.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "coupons_code_key") || strings.Contains(err.Error(), "unique") {
			return ErrCodeConflict
		}
		return fmt.Errorf("failed to insert coupon: %w", err)
	}
	return nil
}

// GetCouponByID retrieves a single coupon record by ID.
func (r *SQLRepository) GetCouponByID(ctx context.Context, db *sql.DB, id string) (*Coupon, error) {
	query := `
		SELECT id, code, COALESCE(description, ''), discount_type, discount_value, min_subtotal,
		       max_discount_amount, max_uses, max_uses_per_customer, times_used,
		       valid_from, valid_to, is_active, created_at, updated_at
		FROM coupons
		WHERE id = $1
	`
	c := &Coupon{}
	var maxDiscount sql.NullFloat64
	err := db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
		&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
		&c.ValidFrom, &c.ValidTo, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCouponNotFound
		}
		return nil, fmt.Errorf("failed to query coupon: %w", err)
	}
	if maxDiscount.Valid {
		c.MaxDiscountAmount = &maxDiscount.Float64
	}
	return c, nil
}

// GetCouponByCode retrieves a single coupon by uppercase code.
func (r *SQLRepository) GetCouponByCode(ctx context.Context, db *sql.DB, code string) (*Coupon, error) {
	query := `
		SELECT id, code, COALESCE(description, ''), discount_type, discount_value, min_subtotal,
		       max_discount_amount, max_uses, max_uses_per_customer, times_used,
		       valid_from, valid_to, is_active, created_at, updated_at
		FROM coupons
		WHERE code = $1
	`
	c := &Coupon{}
	var maxDiscount sql.NullFloat64
	err := db.QueryRowContext(ctx, query, code).Scan(
		&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
		&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
		&c.ValidFrom, &c.ValidTo, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCouponNotFound
		}
		return nil, fmt.Errorf("failed to query coupon by code: %w", err)
	}
	if maxDiscount.Valid {
		c.MaxDiscountAmount = &maxDiscount.Float64
	}
	return c, nil
}

// GetCouponByCodeForUpdate retrieves a single coupon and locks the row with FOR UPDATE.
func (r *SQLRepository) GetCouponByCodeForUpdate(ctx context.Context, tx *sql.Tx, code string) (*Coupon, error) {
	query := `
		SELECT id, code, COALESCE(description, ''), discount_type, discount_value, min_subtotal,
		       max_discount_amount, max_uses, max_uses_per_customer, times_used,
		       valid_from, valid_to, is_active, created_at, updated_at
		FROM coupons
		WHERE code = $1
		FOR UPDATE
	`
	c := &Coupon{}
	var maxDiscount sql.NullFloat64
	err := tx.QueryRowContext(ctx, query, code).Scan(
		&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
		&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
		&c.ValidFrom, &c.ValidTo, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCouponNotFound
		}
		return nil, fmt.Errorf("failed to lock coupon row: %w", err)
	}
	if maxDiscount.Valid {
		c.MaxDiscountAmount = &maxDiscount.Float64
	}
	return c, nil
}

// ListCoupons returns filtered and paginated coupons.
func (r *SQLRepository) ListCoupons(ctx context.Context, db *sql.DB, filter *CouponFilterParams) ([]Coupon, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(code ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	if filter.IsActive != nil {
		where = append(where, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *filter.IsActive)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM coupons WHERE %s", whereClause)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count coupons: %w", err)
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
		SELECT id, code, COALESCE(description, ''), discount_type, discount_value, min_subtotal,
		       max_discount_amount, max_uses, max_uses_per_customer, times_used,
		       valid_from, valid_to, is_active, created_at, updated_at
		FROM coupons
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query coupons: %w", err)
	}
	defer rows.Close()

	list := make([]Coupon, 0)
	for rows.Next() {
		var c Coupon
		var maxDiscount sql.NullFloat64
		if err := rows.Scan(
			&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
			&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
			&c.ValidFrom, &c.ValidTo, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		if maxDiscount.Valid {
			c.MaxDiscountAmount = &maxDiscount.Float64
		}
		list = append(list, c)
	}

	return list, total, rows.Err()
}

// UpdateCoupon updates mutable properties of an existing coupon.
func (r *SQLRepository) UpdateCoupon(ctx context.Context, db *sql.DB, id string, req *UpdateCouponRequest) error {
	query := `
		UPDATE coupons
		SET description = $1, min_subtotal = $2, max_discount_amount = $3,
		    max_uses = $4, max_uses_per_customer = $5, valid_from = $6, valid_to = $7,
		    is_active = $8, updated_at = NOW()
		WHERE id = $9
	`
	res, err := db.ExecContext(ctx, query,
		req.Description, req.MinSubtotal, req.MaxDiscountAmount,
		req.MaxUses, req.MaxUsesPerCustomer, req.ValidFrom, req.ValidTo,
		req.IsActive, id,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrCouponNotFound
	}
	return nil
}

// DeleteCoupon deletes a coupon and cascades usage logs.
func (r *SQLRepository) DeleteCoupon(ctx context.Context, db *sql.DB, id string) error {
	query := `DELETE FROM coupons WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrCouponNotFound
	}
	return nil
}

// RecordCouponUsageTx records an immutable redemption event in coupon_usages within a transaction.
func (r *SQLRepository) RecordCouponUsageTx(ctx context.Context, tx *sql.Tx, usage *CouponUsage) error {
	query := `
		INSERT INTO coupon_usages (
			coupon_id, order_id, customer_id, customer_email, discount_amount, created_at
		) VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING id, created_at
	`
	return tx.QueryRowContext(ctx, query,
		usage.CouponID, usage.OrderID, usage.CustomerID, usage.CustomerEmail, usage.DiscountAmount,
	).Scan(&usage.ID, &usage.CreatedAt)
}

// IncrementCouponTimesUsedTx increments the global redemption counter for a coupon.
func (r *SQLRepository) IncrementCouponTimesUsedTx(ctx context.Context, tx *sql.Tx, couponID string) error {
	query := `UPDATE coupons SET times_used = times_used + 1, updated_at = NOW() WHERE id = $1`
	_, err := tx.ExecContext(ctx, query, couponID)
	return err
}

// GetCustomerUsageCount returns the count of previous coupon redemptions for a customer.
func (r *SQLRepository) GetCustomerUsageCount(ctx context.Context, db *sql.DB, couponID string, customerID *string, customerEmail string) (int, error) {
	var count int
	var err error
	if customerID != nil && strings.TrimSpace(*customerID) != "" {
		query := `
			SELECT COUNT(*)
			FROM coupon_usages
			WHERE coupon_id = $1 AND (customer_email = $2 OR customer_id = $3::UUID)
		`
		err = db.QueryRowContext(ctx, query, couponID, customerEmail, strings.TrimSpace(*customerID)).Scan(&count)
	} else {
		query := `
			SELECT COUNT(*)
			FROM coupon_usages
			WHERE coupon_id = $1 AND customer_email = $2
		`
		err = db.QueryRowContext(ctx, query, couponID, customerEmail).Scan(&count)
	}
	return count, err
}

// GetCustomerUsageCountTx returns the count of previous redemptions inside a transaction.
func (r *SQLRepository) GetCustomerUsageCountTx(ctx context.Context, tx *sql.Tx, couponID string, customerID *string, customerEmail string) (int, error) {
	var count int
	var err error
	if customerID != nil && strings.TrimSpace(*customerID) != "" {
		query := `
			SELECT COUNT(*)
			FROM coupon_usages
			WHERE coupon_id = $1 AND (customer_email = $2 OR customer_id = $3::UUID)
		`
		err = tx.QueryRowContext(ctx, query, couponID, customerEmail, strings.TrimSpace(*customerID)).Scan(&count)
	} else {
		query := `
			SELECT COUNT(*)
			FROM coupon_usages
			WHERE coupon_id = $1 AND customer_email = $2
		`
		err = tx.QueryRowContext(ctx, query, couponID, customerEmail).Scan(&count)
	}
	return count, err
}
