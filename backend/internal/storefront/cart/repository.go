package cart

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var (
	ErrCartNotFound      = errors.New("cart not found")
	ErrCartItemNotFound  = errors.New("cart item not found")
	ErrVariantInactive   = errors.New("variant is no longer active")
	ErrInsufficientStock = errors.New("requested quantity exceeds available stock")
)

// Repository specifies database interactions for the storefront cart.
type Repository interface {
	GetOrCreateCart(ctx context.Context, db *sql.DB, sessionID, currency string) (*CartDTO, error)
	GetCartBySession(ctx context.Context, db *sql.DB, sessionID string) (*CartDTO, error)
	AddItem(ctx context.Context, db *sql.DB, cartID, variantID string, quantity int) error
	UpdateItemQuantity(ctx context.Context, db *sql.DB, cartID, itemID string, quantity int) error
	RemoveItem(ctx context.Context, db *sql.DB, cartID, itemID string) error
	ClearCart(ctx context.Context, db *sql.DB, cartID string) error
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

func (r *SQLRepository) GetOrCreateCart(ctx context.Context, db *sql.DB, sessionID, currency string) (*CartDTO, error) {
	if currency == "" {
		currency = "BDT"
	}
	queryInsert := `
		INSERT INTO carts (session_token, currency, expires_at, created_at, updated_at)
		VALUES ($1, $2, NOW() + INTERVAL '30 days', NOW(), NOW())
		ON CONFLICT (session_token) DO UPDATE SET updated_at = NOW(), expires_at = NOW() + INTERVAL '30 days'
		RETURNING id;
	`
	var cartID string
	err := db.QueryRowContext(ctx, queryInsert, sessionID, currency).Scan(&cartID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve or create cart: %w", err)
	}

	return r.GetCartBySession(ctx, db, sessionID)
}

func (r *SQLRepository) GetCartBySession(ctx context.Context, db *sql.DB, sessionID string) (*CartDTO, error) {
	queryCart := `SELECT id, session_token, currency, updated_at FROM carts WHERE session_token = $1;`
	cart := &CartDTO{}
	err := db.QueryRowContext(ctx, queryCart, sessionID).Scan(&cart.ID, &cart.SessionID, &cart.Currency, &cart.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCartNotFound
		}
		return nil, err
	}

	queryItems := `
		SELECT
			ci.id, ci.variant_id, pv.product_id, p.title, pv.title, pv.sku,
			COALESCE(p.featured_image_url, ''), ci.unit_price, ci.quantity,
			COALESCE(vi.quantity_available - vi.quantity_reserved, 0) AS available_quantity
		FROM cart_items ci
		JOIN product_variants pv ON pv.id = ci.variant_id
		JOIN products p ON p.id = pv.product_id
		LEFT JOIN variant_inventory vi ON vi.variant_id = pv.id
		WHERE ci.cart_id = $1
		ORDER BY ci.created_at ASC;
	`
	rows, err := db.QueryContext(ctx, queryItems, cart.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to query cart items: %w", err)
	}
	defer rows.Close()

	cart.Items = []CartItemDTO{}
	for rows.Next() {
		var it CartItemDTO
		if err := rows.Scan(
			&it.ID, &it.VariantID, &it.ProductID, &it.ProductTitle, &it.VariantTitle,
			&it.SKU, &it.ImageURL, &it.UnitPrice, &it.Quantity, &it.AvailableQuantity,
		); err == nil {
			it.TotalPrice = it.UnitPrice * float64(it.Quantity)
			cart.Items = append(cart.Items, it)
			cart.Subtotal += it.TotalPrice
			cart.ItemCount += it.Quantity
		}
	}

	return cart, nil
}

func (r *SQLRepository) AddItem(ctx context.Context, db *sql.DB, cartID, variantID string, quantity int) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Verify variant exists, is active, and inspect live stock
	queryVariant := `
		SELECT pv.price, pv.is_active, COALESCE(vi.quantity_available - vi.quantity_reserved, 0)
		FROM product_variants pv
		LEFT JOIN variant_inventory vi ON vi.variant_id = pv.id
		WHERE pv.id = $1
		FOR SHARE;
	`
	var price float64
	var isActive bool
	var availableQty int
	err = tx.QueryRowContext(ctx, queryVariant, variantID).Scan(&price, &isActive, &availableQty)
	if err != nil {
		return ErrCartItemNotFound
	}
	if !isActive {
		return ErrVariantInactive
	}

	// 2. Check if item already in cart to calculate cumulative quantity
	queryExisting := `SELECT quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2;`
	var existingQty int
	err = tx.QueryRowContext(ctx, queryExisting, cartID, variantID).Scan(&existingQty)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	totalDesiredQty := existingQty + quantity
	if totalDesiredQty > availableQty {
		return fmt.Errorf("%w: requested %d, available %d", ErrInsufficientStock, totalDesiredQty, availableQty)
	}

	queryUpsert := `
		INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (cart_id, variant_id) DO UPDATE SET
			quantity = cart_items.quantity + EXCLUDED.quantity,
			updated_at = NOW();
	`
	if _, err := tx.ExecContext(ctx, queryUpsert, cartID, variantID, quantity, price); err != nil {
		return fmt.Errorf("failed to upsert cart item: %w", err)
	}

	_, _ = tx.ExecContext(ctx, `UPDATE carts SET updated_at = NOW() WHERE id = $1;`, cartID)
	return tx.Commit()
}

func (r *SQLRepository) UpdateItemQuantity(ctx context.Context, db *sql.DB, cartID, itemID string, quantity int) error {
	if quantity <= 0 {
		return r.RemoveItem(ctx, db, cartID, itemID)
	}

	// Verify inventory bounds
	queryStock := `
		SELECT COALESCE(vi.quantity_available - vi.quantity_reserved, 0)
		FROM cart_items ci
		JOIN product_variants pv ON pv.id = ci.variant_id
		LEFT JOIN variant_inventory vi ON vi.variant_id = pv.id
		WHERE ci.id = $1 AND ci.cart_id = $2;
	`
	var availableQty int
	err := db.QueryRowContext(ctx, queryStock, itemID, cartID).Scan(&availableQty)
	if err != nil {
		return ErrCartItemNotFound
	}

	if quantity > availableQty {
		return fmt.Errorf("%w: requested %d, available %d", ErrInsufficientStock, quantity, availableQty)
	}

	query := `UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 AND cart_id = $3;`
	res, err := db.ExecContext(ctx, query, quantity, itemID, cartID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrCartItemNotFound
	}

	_, _ = db.ExecContext(ctx, `UPDATE carts SET updated_at = NOW() WHERE id = $1;`, cartID)
	return nil
}

func (r *SQLRepository) RemoveItem(ctx context.Context, db *sql.DB, cartID, itemID string) error {
	query := `DELETE FROM cart_items WHERE id = $1 AND cart_id = $2;`
	res, err := db.ExecContext(ctx, query, itemID, cartID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrCartItemNotFound
	}
	_, _ = db.ExecContext(ctx, `UPDATE carts SET updated_at = NOW() WHERE id = $1;`, cartID)
	return nil
}

func (r *SQLRepository) ClearCart(ctx context.Context, db *sql.DB, cartID string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM cart_items WHERE cart_id = $1;`, cartID)
	return err
}
