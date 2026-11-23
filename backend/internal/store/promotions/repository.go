// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, discount rules, and cart promotion evaluations.
package promotions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/lib/pq"
)

var (
	// ErrCouponNotFound indicates the requested coupon ID or code does not exist.
	ErrCouponNotFound = errors.New("coupon not found")
	// ErrCodeConflict indicates a coupon with the specified code already exists for this store.
	ErrCodeConflict = errors.New("coupon code already exists in this store")

	promotionsSchemaMu    sync.Mutex
	promotionsSchemaReady sync.Map // *sql.DB -> struct{}
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

	// Recursive Category Resolution
	GetDescendantCategoryIDs(ctx context.Context, db *sql.DB, rootCategoryIDs []string) ([]string, error)

	// Usage tracking
	RecordCouponUsageTx(ctx context.Context, tx *sql.Tx, usage *CouponUsage) error
	IncrementCouponTimesUsedTx(ctx context.Context, tx *sql.Tx, couponID string) error
	GetCustomerUsageCount(ctx context.Context, db *sql.DB, couponID string, customerID *string, customerEmail, customerPhone string) (int, error)
	GetCustomerUsageCountTx(ctx context.Context, tx *sql.Tx, couponID string, customerID *string, customerEmail, customerPhone string) (int, error)

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
	if db == nil {
		return errors.New("nil database handle")
	}
	if _, ok := promotionsSchemaReady.Load(db); ok {
		return nil
	}

	promotionsSchemaMu.Lock()
	defer promotionsSchemaMu.Unlock()
	if _, ok := promotionsSchemaReady.Load(db); ok {
		return nil
	}

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
			applicable_category_ids UUID[] NOT NULL DEFAULT '{}',
			included_product_ids UUID[] NOT NULL DEFAULT '{}',
			excluded_product_ids UUID[] NOT NULL DEFAULT '{}',
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupons' AND column_name = 'applicable_category_ids') THEN
				ALTER TABLE coupons ADD COLUMN applicable_category_ids UUID[] NOT NULL DEFAULT '{}';
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupons' AND column_name = 'included_product_ids') THEN
				ALTER TABLE coupons ADD COLUMN included_product_ids UUID[] NOT NULL DEFAULT '{}';
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupons' AND column_name = 'excluded_product_ids') THEN
				ALTER TABLE coupons ADD COLUMN excluded_product_ids UUID[] NOT NULL DEFAULT '{}';
			END IF;
		END $$;

		CREATE TABLE IF NOT EXISTS coupon_usages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
			order_id VARCHAR(100),
			customer_id VARCHAR(100),
			customer_email VARCHAR(255) NOT NULL DEFAULT '',
			customer_phone VARCHAR(50) NOT NULL DEFAULT '',
			discount_amount NUMERIC(12, 2) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupon_usages' AND column_name = 'customer_phone') THEN
				ALTER TABLE coupon_usages ADD COLUMN customer_phone VARCHAR(50) NOT NULL DEFAULT '';
			END IF;
		END $$;

		CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
		CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
		CREATE INDEX IF NOT EXISTS idx_coupon_usages_phone ON coupon_usages(coupon_id, customer_phone);
		CREATE INDEX IF NOT EXISTS idx_coupon_usages_email ON coupon_usages(coupon_id, customer_email);
	`
	if _, err := db.ExecContext(ctx, query); err != nil {
		var exists bool
		_ = db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons')").Scan(&exists)
		if exists {
			promotionsSchemaReady.Store(db, struct{}{})
			return nil
		}
		return err
	}
	promotionsSchemaReady.Store(db, struct{}{})
	return nil
}

// GetDescendantCategoryIDs traverses the hierarchical categories recursively using CTE
// and returns the root categories plus all of their nested descendants.
func (r *SQLRepository) GetDescendantCategoryIDs(ctx context.Context, db *sql.DB, rootCategoryIDs []string) ([]string, error) {
	if len(rootCategoryIDs) == 0 {
		return []string{}, nil
	}

	query := `
		WITH RECURSIVE category_tree AS (
			SELECT id FROM categories WHERE id = ANY($1::UUID[])
			UNION ALL
			SELECT c.id FROM categories c
			JOIN category_tree ct ON c.parent_id = ct.id
		)
		SELECT DISTINCT id::TEXT FROM category_tree;
	`
	rows, err := db.QueryContext(ctx, query, pq.Array(rootCategoryIDs))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve descendant categories: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// CreateCoupon inserts a new promotional coupon with targeting arrays into the tenant database.
func (r *SQLRepository) CreateCoupon(ctx context.Context, db *sql.DB, c *Coupon) error {
	query := `
		INSERT INTO coupons (
			code, description, discount_type, discount_value, min_subtotal, max_discount_amount,
			max_uses, max_uses_per_customer, times_used, valid_from, valid_to, is_active,
			applicable_category_ids, included_product_ids, excluded_product_ids,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11,
			$12, $13, $14,
			NOW(), NOW()
		)
		RETURNING id, times_used, created_at, updated_at
	`
	if c.ApplicableCategoryIDs == nil {
		c.ApplicableCategoryIDs = []string{}
	}
	if c.IncludedProductIDs == nil {
		c.IncludedProductIDs = []string{}
	}
	if c.ExcludedProductIDs == nil {
		c.ExcludedProductIDs = []string{}
	}

	err := db.QueryRowContext(ctx, query,
		c.Code, c.Description, c.DiscountType, c.DiscountValue, c.MinSubtotal, c.MaxDiscountAmount,
		c.MaxUses, c.MaxUsesPerCustomer, c.ValidFrom, c.ValidTo, c.IsActive,
		pq.Array(c.ApplicableCategoryIDs), pq.Array(c.IncludedProductIDs), pq.Array(c.ExcludedProductIDs),
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
		       valid_from, valid_to, is_active,
		       COALESCE(applicable_category_ids, '{}'),
		       COALESCE(included_product_ids, '{}'),
		       COALESCE(excluded_product_ids, '{}'),
		       created_at, updated_at
		FROM coupons
		WHERE id = $1
	`
	c := &Coupon{}
	var maxDiscount sql.NullFloat64
	var appCats, incProds, excProds []string

	err := db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
		&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
		&c.ValidFrom, &c.ValidTo, &c.IsActive,
		pq.Array(&appCats), pq.Array(&incProds), pq.Array(&excProds),
		&c.CreatedAt, &c.UpdatedAt,
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
	c.ApplicableCategoryIDs = appCats
	c.IncludedProductIDs = incProds
	c.ExcludedProductIDs = excProds
	return c, nil
}

// GetCouponByCode retrieves a single coupon by uppercase code.
func (r *SQLRepository) GetCouponByCode(ctx context.Context, db *sql.DB, code string) (*Coupon, error) {
	query := `
		SELECT id, code, COALESCE(description, ''), discount_type, discount_value, min_subtotal,
		       max_discount_amount, max_uses, max_uses_per_customer, times_used,
		       valid_from, valid_to, is_active,
		       COALESCE(applicable_category_ids, '{}'),
		       COALESCE(included_product_ids, '{}'),
		       COALESCE(excluded_product_ids, '{}'),
		       created_at, updated_at
		FROM coupons
		WHERE code = $1
	`
	c := &Coupon{}
	var maxDiscount sql.NullFloat64
	var appCats, incProds, excProds []string

	err := db.QueryRowContext(ctx, query, code).Scan(
		&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
		&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
		&c.ValidFrom, &c.ValidTo, &c.IsActive,
		pq.Array(&appCats), pq.Array(&incProds), pq.Array(&excProds),
		&c.CreatedAt, &c.UpdatedAt,
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
	c.ApplicableCategoryIDs = appCats
	c.IncludedProductIDs = incProds
	c.ExcludedProductIDs = excProds
	return c, nil
}

// GetCouponByCodeForUpdate retrieves a single coupon and locks the row with FOR UPDATE.
func (r *SQLRepository) GetCouponByCodeForUpdate(ctx context.Context, tx *sql.Tx, code string) (*Coupon, error) {
	query := `
		SELECT id, code, COALESCE(description, ''), discount_type, discount_value, min_subtotal,
		       max_discount_amount, max_uses, max_uses_per_customer, times_used,
		       valid_from, valid_to, is_active,
		       COALESCE(applicable_category_ids, '{}'),
		       COALESCE(included_product_ids, '{}'),
		       COALESCE(excluded_product_ids, '{}'),
		       created_at, updated_at
		FROM coupons
		WHERE code = $1
		FOR UPDATE
	`
	c := &Coupon{}
	var maxDiscount sql.NullFloat64
	var appCats, incProds, excProds []string

	err := tx.QueryRowContext(ctx, query, code).Scan(
		&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
		&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
		&c.ValidFrom, &c.ValidTo, &c.IsActive,
		pq.Array(&appCats), pq.Array(&incProds), pq.Array(&excProds),
		&c.CreatedAt, &c.UpdatedAt,
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
	c.ApplicableCategoryIDs = appCats
	c.IncludedProductIDs = incProds
	c.ExcludedProductIDs = excProds
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
		       valid_from, valid_to, is_active,
		       COALESCE(applicable_category_ids, '{}'),
		       COALESCE(included_product_ids, '{}'),
		       COALESCE(excluded_product_ids, '{}'),
		       created_at, updated_at
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
		var appCats, incProds, excProds []string

		if err := rows.Scan(
			&c.ID, &c.Code, &c.Description, &c.DiscountType, &c.DiscountValue, &c.MinSubtotal,
			&maxDiscount, &c.MaxUses, &c.MaxUsesPerCustomer, &c.TimesUsed,
			&c.ValidFrom, &c.ValidTo, &c.IsActive,
			pq.Array(&appCats), pq.Array(&incProds), pq.Array(&excProds),
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		if maxDiscount.Valid {
			c.MaxDiscountAmount = &maxDiscount.Float64
		}
		c.ApplicableCategoryIDs = appCats
		c.IncludedProductIDs = incProds
		c.ExcludedProductIDs = excProds
		list = append(list, c)
	}

	return list, total, rows.Err()
}

// UpdateCoupon updates mutable properties and targeting arrays of an existing coupon.
func (r *SQLRepository) UpdateCoupon(ctx context.Context, db *sql.DB, id string, req *UpdateCouponRequest) error {
	query := `
		UPDATE coupons
		SET description = $1, min_subtotal = $2, max_discount_amount = $3,
		    max_uses = $4, max_uses_per_customer = $5, valid_from = $6, valid_to = $7,
		    is_active = $8,
		    applicable_category_ids = $9,
		    included_product_ids = $10,
		    excluded_product_ids = $11,
		    updated_at = NOW()
		WHERE id = $12
	`
	if req.ApplicableCategoryIDs == nil {
		req.ApplicableCategoryIDs = []string{}
	}
	if req.IncludedProductIDs == nil {
		req.IncludedProductIDs = []string{}
	}
	if req.ExcludedProductIDs == nil {
		req.ExcludedProductIDs = []string{}
	}

	res, err := db.ExecContext(ctx, query,
		req.Description, req.MinSubtotal, req.MaxDiscountAmount,
		req.MaxUses, req.MaxUsesPerCustomer, req.ValidFrom, req.ValidTo,
		req.IsActive,
		pq.Array(req.ApplicableCategoryIDs), pq.Array(req.IncludedProductIDs), pq.Array(req.ExcludedProductIDs),
		id,
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
			coupon_id, order_id, customer_id, customer_email, customer_phone, discount_amount, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING id, created_at
	`
	return tx.QueryRowContext(ctx, query,
		usage.CouponID, usage.OrderID, usage.CustomerID, usage.CustomerEmail, usage.CustomerPhone, usage.DiscountAmount,
	).Scan(&usage.ID, &usage.CreatedAt)
}

// IncrementCouponTimesUsedTx increments the global redemption counter for a coupon.
func (r *SQLRepository) IncrementCouponTimesUsedTx(ctx context.Context, tx *sql.Tx, couponID string) error {
	query := `UPDATE coupons SET times_used = times_used + 1, updated_at = NOW() WHERE id = $1`
	_, err := tx.ExecContext(ctx, query, couponID)
	return err
}

// GetCustomerUsageCount returns the count of previous coupon redemptions for a customer.
// It prioritizes phone-first rate limiting, while checking email and customer ID if provided.
func (r *SQLRepository) GetCustomerUsageCount(ctx context.Context, db *sql.DB, couponID string, customerID *string, customerEmail, customerPhone string) (int, error) {
	conditions := []string{"coupon_id = $1"}
	args := []interface{}{couponID}
	argIdx := 2

	orClauses := []string{}
	cleanPhone := strings.TrimSpace(customerPhone)
	if cleanPhone != "" {
		orClauses = append(orClauses, fmt.Sprintf("customer_phone = $%d", argIdx))
		args = append(args, cleanPhone)
		argIdx++
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(customerEmail))
	if cleanEmail != "" {
		orClauses = append(orClauses, fmt.Sprintf("LOWER(customer_email) = $%d", argIdx))
		args = append(args, cleanEmail)
		argIdx++
	}

	if customerID != nil && strings.TrimSpace(*customerID) != "" {
		orClauses = append(orClauses, fmt.Sprintf("customer_id = $%d", argIdx))
		args = append(args, strings.TrimSpace(*customerID))
		argIdx++
	}

	if len(orClauses) == 0 {
		return 0, nil
	}

	conditions = append(conditions, "("+strings.Join(orClauses, " OR ")+")")
	query := fmt.Sprintf("SELECT COUNT(*) FROM coupon_usages WHERE %s", strings.Join(conditions, " AND "))

	var count int
	err := db.QueryRowContext(ctx, query, args...).Scan(&count)
	return count, err
}

// GetCustomerUsageCountTx returns the count of previous redemptions inside a transaction.
func (r *SQLRepository) GetCustomerUsageCountTx(ctx context.Context, tx *sql.Tx, couponID string, customerID *string, customerEmail, customerPhone string) (int, error) {
	conditions := []string{"coupon_id = $1"}
	args := []interface{}{couponID}
	argIdx := 2

	orClauses := []string{}
	cleanPhone := strings.TrimSpace(customerPhone)
	if cleanPhone != "" {
		orClauses = append(orClauses, fmt.Sprintf("customer_phone = $%d", argIdx))
		args = append(args, cleanPhone)
		argIdx++
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(customerEmail))
	if cleanEmail != "" {
		orClauses = append(orClauses, fmt.Sprintf("LOWER(customer_email) = $%d", argIdx))
		args = append(args, cleanEmail)
		argIdx++
	}

	if customerID != nil && strings.TrimSpace(*customerID) != "" {
		orClauses = append(orClauses, fmt.Sprintf("customer_id = $%d", argIdx))
		args = append(args, strings.TrimSpace(*customerID))
		argIdx++
	}

	if len(orClauses) == 0 {
		return 0, nil
	}

	conditions = append(conditions, "("+strings.Join(orClauses, " OR ")+")")
	query := fmt.Sprintf("SELECT COUNT(*) FROM coupon_usages WHERE %s", strings.Join(conditions, " AND "))

	var count int
	err := tx.QueryRowContext(ctx, query, args...).Scan(&count)
	return count, err
}
