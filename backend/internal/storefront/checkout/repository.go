package checkout

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	// ErrEmptyCart indicates that no items exist in the referenced cart session.
	ErrEmptyCart = errors.New("cart is empty")
	// ErrOrderNotFound indicates the requested order could not be located.
	ErrOrderNotFound = errors.New("order not found")
)

// Repository specifies transactional database interactions for storefront checkout.
type Repository interface {
	GetCartItemsForCheckout(ctx context.Context, db *sql.DB, sessionID string) ([]CheckoutReceiptItem, float64, string, error)
	CreateOrderTx(ctx context.Context, tx *sql.Tx, o *storeModels.Order, items []CheckoutReceiptItem) error
	ClearCartSessionTx(ctx context.Context, tx *sql.Tx, cartID string) error
	GetOrderByNumber(ctx context.Context, db *sql.DB, orderNumber string) (*CheckoutReceiptResponse, error)
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// GetCartItemsForCheckout fetches cart items, computes subtotal, and returns the tenant cart ID.
func (r *SQLRepository) GetCartItemsForCheckout(ctx context.Context, db *sql.DB, sessionID string) ([]CheckoutReceiptItem, float64, string, error) {
	queryCart := `SELECT id FROM carts WHERE session_token = $1;`
	var cartID string
	err := db.QueryRowContext(ctx, queryCart, sessionID).Scan(&cartID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, 0, "", ErrEmptyCart
		}
		return nil, 0, "", err
	}

	queryItems := `
		SELECT
			p.id::TEXT, COALESCE(p.category_id::TEXT, ''), ci.variant_id, p.title, pv.title, pv.sku, ci.unit_price, ci.quantity
		FROM cart_items ci
		JOIN product_variants pv ON pv.id = ci.variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE ci.cart_id = $1
		ORDER BY ci.created_at ASC;
	`
	rows, err := db.QueryContext(ctx, queryItems, cartID)
	if err != nil {
		return nil, 0, "", fmt.Errorf("failed to query cart items: %w", err)
	}
	defer rows.Close()

	var items []CheckoutReceiptItem
	var subtotal float64

	for rows.Next() {
		var it CheckoutReceiptItem
		if err := rows.Scan(&it.ProductID, &it.CategoryID, &it.VariantID, &it.ProductTitle, &it.VariantTitle, &it.SKU, &it.UnitPrice, &it.Quantity); err != nil {
			return nil, 0, "", err
		}
		it.TotalPrice = it.UnitPrice * float64(it.Quantity)
		subtotal += it.TotalPrice
		items = append(items, it)
	}

	if len(items) == 0 {
		return nil, 0, "", ErrEmptyCart
	}

	return items, subtotal, cartID, nil
}

// CreateOrderTx atomically inserts the order, order items, and initial status history.
func (r *SQLRepository) CreateOrderTx(ctx context.Context, tx *sql.Tx, o *storeModels.Order, items []CheckoutReceiptItem) error {
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
	} else {
		billingJSON = shippingJSON
	}

	queryOrder := `
		INSERT INTO orders (
			order_number, customer_id, customer_email, customer_phone,
			status, payment_status, currency, subtotal, shipping_fee, discount_amount, total_amount,
			shipping_address, billing_address, payment_method, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
		)
		RETURNING id, created_at, updated_at;
	`
	err = tx.QueryRowContext(ctx, queryOrder,
		o.OrderNumber, o.CustomerID, o.CustomerEmail, o.CustomerPhone,
		o.Status, o.PaymentStatus, o.Currency, o.Subtotal, o.ShippingFee, o.DiscountAmount, o.TotalAmount,
		string(shippingJSON), string(billingJSON), o.PaymentMethod, o.Notes,
	).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert order: %w", err)
	}

	queryItem := `
		INSERT INTO order_items (
			order_id, variant_id, title, product_title, variant_title, sku, unit_price, quantity, total_price, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
	`
	for _, it := range items {
		if _, err := tx.ExecContext(ctx, queryItem,
			o.ID, it.VariantID, it.ProductTitle, it.ProductTitle, it.VariantTitle, it.SKU,
			it.UnitPrice, it.Quantity, it.TotalPrice,
		); err != nil {
			return fmt.Errorf("failed to insert order item %s: %w", it.SKU, err)
		}
	}

	// Record initial status history
	queryHistory := `
		INSERT INTO order_status_history (order_id, previous_status, old_status, new_status, performed_by, changed_by, notes, reason, created_at)
		VALUES ($1, '', '', $2, 'STOREFRONT_CHECKOUT', 'STOREFRONT_CHECKOUT', 'Order placed via storefront', 'Order placed via storefront', NOW());
	`
	if _, err := tx.ExecContext(ctx, queryHistory, o.ID, o.Status); err != nil {
		return fmt.Errorf("failed to record status history: %w", err)
	}

	return nil
}

// ClearCartSessionTx empties all cart items for the checked-out cart session.
func (r *SQLRepository) ClearCartSessionTx(ctx context.Context, tx *sql.Tx, cartID string) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM cart_items WHERE cart_id = $1;`, cartID)
	return err
}

// GetOrderByNumber returns public receipt details for a placed order.
func (r *SQLRepository) GetOrderByNumber(ctx context.Context, db *sql.DB, orderNumber string) (*CheckoutReceiptResponse, error) {
	queryOrder := `
		SELECT id, order_number, customer_email, customer_phone, status, payment_status,
		       COALESCE(payment_method, 'COD'), currency, subtotal, shipping_fee, discount_amount, total_amount,
		       shipping_address, created_at
		FROM orders
		WHERE order_number = $1;
	`
	resp := &CheckoutReceiptResponse{}
	var shippingStr string

	err := db.QueryRowContext(ctx, queryOrder, orderNumber).Scan(
		&resp.ID, &resp.OrderNumber, &resp.CustomerEmail, &resp.CustomerPhone,
		&resp.Status, &resp.PaymentStatus, &resp.PaymentMethod, &resp.Currency,
		&resp.Subtotal, &resp.ShippingFee, &resp.DiscountAmount, &resp.TotalAmount,
		&shippingStr, &resp.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}

	_ = json.Unmarshal([]byte(shippingStr), &resp.ShippingAddress)

	queryItems := `
		SELECT variant_id, COALESCE(product_title, title), COALESCE(variant_title, ''), COALESCE(sku, ''), unit_price, quantity, total_price
		FROM order_items
		WHERE order_id = $1
		ORDER BY created_at ASC;
	`
	rows, err := db.QueryContext(ctx, queryItems, resp.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resp.Items = []CheckoutReceiptItem{}
	for rows.Next() {
		var it CheckoutReceiptItem
		if err := rows.Scan(&it.VariantID, &it.ProductTitle, &it.VariantTitle, &it.SKU, &it.UnitPrice, &it.Quantity, &it.TotalPrice); err == nil {
			resp.Items = append(resp.Items, it)
		}
	}

	return resp, nil
}
