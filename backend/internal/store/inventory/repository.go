package inventory

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrInsufficientStock     = errors.New("insufficient available stock for operation")
	ErrVariantStockNotFound  = errors.New("inventory record for variant not found")
	ErrInvalidStockOperation = errors.New("stock adjustment violates non-negative physical inventory constraint")
)

// Repository specifies transactional database interactions for the inventory subsystem.
type Repository interface {
	GetStockByVariantID(ctx context.Context, db *sql.DB, variantID string) (*storeModels.VariantStock, error)
	AdjustStockTx(ctx context.Context, tx *sql.Tx, variantID string, delta int, reason storeModels.StockMovementReason, refID *string, performedBy, notes string) (*storeModels.StockMovement, error)
	ReserveStockTx(ctx context.Context, tx *sql.Tx, variantID string, qty int, orderID, performedBy string) (*storeModels.StockMovement, error)
	FulfillStockTx(ctx context.Context, tx *sql.Tx, variantID string, qty int, orderID, performedBy string) (*storeModels.StockMovement, error)
	ReleaseStockTx(ctx context.Context, tx *sql.Tx, variantID string, qty int, orderID, performedBy string) (*storeModels.StockMovement, error)
	ListInventory(ctx context.Context, db *sql.DB, filter *InventoryFilterParams) ([]InventoryItemSummary, int, error)
	ListMovements(ctx context.Context, db *sql.DB, filter *StockMovementFilterParams) ([]storeModels.StockMovement, int, error)
	UpdateThreshold(ctx context.Context, db *sql.DB, variantID string, threshold int) error
	GetLowStockAlerts(ctx context.Context, db *sql.DB) ([]InventoryItemSummary, error)
}

// SQLRepository implements Repository using PostgreSQL row locks.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

func (r *SQLRepository) GetStockByVariantID(ctx context.Context, db *sql.DB, variantID string) (*storeModels.VariantStock, error) {
	query := `
		SELECT variant_id, quantity_available, quantity_reserved, low_stock_threshold, updated_at
		FROM variant_inventory
		WHERE variant_id = $1
	`
	stock := &storeModels.VariantStock{}
	err := db.QueryRowContext(ctx, query, variantID).Scan(
		&stock.VariantID,
		&stock.QuantityAvailable, // Physically on hand
		&stock.QuantityReserved,
		&stock.LowStockThreshold,
		&stock.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVariantStockNotFound
		}
		return nil, fmt.Errorf("failed to fetch stock: %w", err)
	}
	return stock, nil
}

func (r *SQLRepository) AdjustStockTx(ctx context.Context, tx *sql.Tx, variantID string, delta int, reason storeModels.StockMovementReason, refID *string, performedBy, notes string) (*storeModels.StockMovement, error) {
	// Pessimistic lock row to avoid concurrency races
	queryLock := `
		SELECT quantity_available, quantity_reserved
		FROM variant_inventory
		WHERE variant_id = $1
		FOR UPDATE
	`
	var currentQty, currentReserved int
	err := tx.QueryRowContext(ctx, queryLock, variantID).Scan(&currentQty, &currentReserved)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVariantStockNotFound
		}
		return nil, fmt.Errorf("failed to lock inventory row: %w", err)
	}

	newQty := currentQty + delta
	if newQty < 0 {
		return nil, ErrInvalidStockOperation
	}

	// Physical stock must never be less than current active reservations
	if newQty < currentReserved {
		return nil, fmt.Errorf("%w: adjustments would reduce physical stock (%d) below active reservations (%d)", ErrInsufficientStock, newQty, currentReserved)
	}

	// Update inventory table
	queryUpdate := `
		UPDATE variant_inventory
		SET quantity_available = $1, updated_at = NOW()
		WHERE variant_id = $2
	`
	if _, err := tx.ExecContext(ctx, queryUpdate, newQty, variantID); err != nil {
		return nil, fmt.Errorf("failed to update inventory quantity: %w", err)
	}

	// Append immutable double-entry movement ledger record
	movement := &storeModels.StockMovement{
		VariantID:      variantID,
		QuantityChange: delta,
		BalanceAfter:   newQty,
		Reason:         reason,
		ReferenceID:    refID,
		PerformedBy:    performedBy,
		Notes:          notes,
	}

	queryLedger := `
		INSERT INTO stock_movements (
			variant_id, quantity_change, balance_after, reason, reference_id, performed_by, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at
	`
	err = tx.QueryRowContext(ctx, queryLedger,
		movement.VariantID, movement.QuantityChange, movement.BalanceAfter,
		movement.Reason, movement.ReferenceID, movement.PerformedBy, movement.Notes,
	).Scan(&movement.ID, &movement.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to record stock movement: %w", err)
	}

	return movement, nil
}

func (r *SQLRepository) ReserveStockTx(ctx context.Context, tx *sql.Tx, variantID string, qty int, orderID, performedBy string) (*storeModels.StockMovement, error) {
	if qty <= 0 {
		return nil, errors.New("reservation quantity must be positive")
	}

	queryLock := `
		SELECT quantity_available, quantity_reserved
		FROM variant_inventory
		WHERE variant_id = $1
		FOR UPDATE
	`
	var currentQty, currentReserved int
	err := tx.QueryRowContext(ctx, queryLock, variantID).Scan(&currentQty, &currentReserved)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVariantStockNotFound
		}
		return nil, fmt.Errorf("failed to lock inventory row: %w", err)
	}

	available := currentQty - currentReserved
	if available < qty {
		return nil, fmt.Errorf("%w: requested %d, available %d", ErrInsufficientStock, qty, available)
	}

	newReserved := currentReserved + qty
	queryUpdate := `
		UPDATE variant_inventory
		SET quantity_reserved = $1, updated_at = NOW()
		WHERE variant_id = $2
	`
	if _, err := tx.ExecContext(ctx, queryUpdate, newReserved, variantID); err != nil {
		return nil, fmt.Errorf("failed to update reserved quantity: %w", err)
	}

	// Log reservation in ledger
	ref := orderID
	movement := &storeModels.StockMovement{
		VariantID:      variantID,
		QuantityChange: -qty, // Reservable stock reduced
		BalanceAfter:   currentQty - newReserved,
		Reason:         storeModels.ReasonOrderReservation,
		ReferenceID:    &ref,
		PerformedBy:    performedBy,
		Notes:          fmt.Sprintf("Reserved %d units for order %s", qty, orderID),
	}

	queryLedger := `
		INSERT INTO stock_movements (
			variant_id, quantity_change, balance_after, reason, reference_id, performed_by, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at
	`
	err = tx.QueryRowContext(ctx, queryLedger,
		movement.VariantID, movement.QuantityChange, movement.BalanceAfter,
		movement.Reason, movement.ReferenceID, movement.PerformedBy, movement.Notes,
	).Scan(&movement.ID, &movement.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to record reservation movement: %w", err)
	}

	return movement, nil
}

func (r *SQLRepository) FulfillStockTx(ctx context.Context, tx *sql.Tx, variantID string, qty int, orderID, performedBy string) (*storeModels.StockMovement, error) {
	if qty <= 0 {
		return nil, errors.New("fulfillment quantity must be positive")
	}

	queryLock := `
		SELECT quantity_available, quantity_reserved
		FROM variant_inventory
		WHERE variant_id = $1
		FOR UPDATE
	`
	var currentQty, currentReserved int
	err := tx.QueryRowContext(ctx, queryLock, variantID).Scan(&currentQty, &currentReserved)
	if err != nil {
		return nil, fmt.Errorf("failed to lock inventory row: %w", err)
	}

	if currentReserved < qty || currentQty < qty {
		return nil, fmt.Errorf("%w: cannot fulfill %d units with physical %d and reserved %d", ErrInsufficientStock, qty, currentQty, currentReserved)
	}

	newQty := currentQty - qty
	newReserved := currentReserved - qty

	queryUpdate := `
		UPDATE variant_inventory
		SET quantity_available = $1, quantity_reserved = $2, updated_at = NOW()
		WHERE variant_id = $3
	`
	if _, err := tx.ExecContext(ctx, queryUpdate, newQty, newReserved, variantID); err != nil {
		return nil, fmt.Errorf("failed to commit fulfillment deduction: %w", err)
	}

	ref := orderID
	movement := &storeModels.StockMovement{
		VariantID:      variantID,
		QuantityChange: -qty,
		BalanceAfter:   newQty,
		Reason:         storeModels.ReasonOrderFulfillment,
		ReferenceID:    &ref,
		PerformedBy:    performedBy,
		Notes:          fmt.Sprintf("Fulfilled %d units for order %s", qty, orderID),
	}

	queryLedger := `
		INSERT INTO stock_movements (
			variant_id, quantity_change, balance_after, reason, reference_id, performed_by, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at
	`
	err = tx.QueryRowContext(ctx, queryLedger,
		movement.VariantID, movement.QuantityChange, movement.BalanceAfter,
		movement.Reason, movement.ReferenceID, movement.PerformedBy, movement.Notes,
	).Scan(&movement.ID, &movement.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to record fulfillment movement: %w", err)
	}

	return movement, nil
}

func (r *SQLRepository) ReleaseStockTx(ctx context.Context, tx *sql.Tx, variantID string, qty int, orderID, performedBy string) (*storeModels.StockMovement, error) {
	if qty <= 0 {
		return nil, errors.New("release quantity must be positive")
	}

	queryLock := `
		SELECT quantity_available, quantity_reserved
		FROM variant_inventory
		WHERE variant_id = $1
		FOR UPDATE
	`
	var currentQty, currentReserved int
	err := tx.QueryRowContext(ctx, queryLock, variantID).Scan(&currentQty, &currentReserved)
	if err != nil {
		return nil, fmt.Errorf("failed to lock inventory row: %w", err)
	}

	newReserved := currentReserved - qty
	if newReserved < 0 {
		newReserved = 0
	}

	queryUpdate := `
		UPDATE variant_inventory
		SET quantity_reserved = $1, updated_at = NOW()
		WHERE variant_id = $2
	`
	if _, err := tx.ExecContext(ctx, queryUpdate, newReserved, variantID); err != nil {
		return nil, fmt.Errorf("failed to update released reserved quantity: %w", err)
	}

	ref := orderID
	movement := &storeModels.StockMovement{
		VariantID:      variantID,
		QuantityChange: qty, // Reservable stock restored
		BalanceAfter:   currentQty - newReserved,
		Reason:         storeModels.ReasonOrderCancellationRestock,
		ReferenceID:    &ref,
		PerformedBy:    performedBy,
		Notes:          fmt.Sprintf("Released %d reserved units for order %s", qty, orderID),
	}

	queryLedger := `
		INSERT INTO stock_movements (
			variant_id, quantity_change, balance_after, reason, reference_id, performed_by, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at
	`
	err = tx.QueryRowContext(ctx, queryLedger,
		movement.VariantID, movement.QuantityChange, movement.BalanceAfter,
		movement.Reason, movement.ReferenceID, movement.PerformedBy, movement.Notes,
	).Scan(&movement.ID, &movement.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to record stock release movement: %w", err)
	}

	return movement, nil
}

func (r *SQLRepository) ListInventory(ctx context.Context, db *sql.DB, filter *InventoryFilterParams) ([]InventoryItemSummary, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(pv.sku ILIKE $%d OR p.title ILIKE $%d OR pv.title ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	if filter.IsLowStock != nil && *filter.IsLowStock {
		where = append(where, "(vi.quantity_available - vi.quantity_reserved) <= vi.low_stock_threshold")
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM variant_inventory vi
		JOIN product_variants pv ON pv.id = vi.variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE %s
	`, whereClause)

	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory: %w", err)
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
			vi.variant_id,
			pv.product_id,
			pv.sku,
			p.title AS product_title,
			pv.title AS variant_title,
			vi.quantity_available AS quantity_on_hand,
			vi.quantity_reserved,
			(vi.quantity_available - vi.quantity_reserved) AS available_quantity,
			vi.low_stock_threshold,
			((vi.quantity_available - vi.quantity_reserved) <= vi.low_stock_threshold) AS is_low_stock,
			vi.updated_at
		FROM variant_inventory vi
		JOIN product_variants pv ON pv.id = vi.variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE %s
		ORDER BY is_low_stock DESC, vi.updated_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query inventory items: %w", err)
	}
	defer rows.Close()

	var list []InventoryItemSummary
	for rows.Next() {
		var item InventoryItemSummary
		if err := rows.Scan(
			&item.VariantID,
			&item.ProductID,
			&item.SKU,
			&item.ProductTitle,
			&item.VariantTitle,
			&item.QuantityOnHand,
			&item.QuantityReserved,
			&item.QuantityAvailable,
			&item.LowStockThreshold,
			&item.IsLowStock,
			&item.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		list = append(list, item)
	}

	return list, total, rows.Err()
}

func (r *SQLRepository) ListMovements(ctx context.Context, db *sql.DB, filter *StockMovementFilterParams) ([]storeModels.StockMovement, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.VariantID != nil && *filter.VariantID != "" {
		where = append(where, fmt.Sprintf("variant_id = $%d", argIdx))
		args = append(args, *filter.VariantID)
		argIdx++
	}

	if filter.Reason != nil && *filter.Reason != "" {
		where = append(where, fmt.Sprintf("reason = $%d", argIdx))
		args = append(args, *filter.Reason)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM stock_movements WHERE %s", whereClause)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count stock movements: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := (filter.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT id, variant_id, quantity_change, balance_after, reason, reference_id, performed_by, notes, created_at
		FROM stock_movements
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query stock movements: %w", err)
	}
	defer rows.Close()

	var list []storeModels.StockMovement
	for rows.Next() {
		var sm storeModels.StockMovement
		if err := rows.Scan(
			&sm.ID, &sm.VariantID, &sm.QuantityChange, &sm.BalanceAfter,
			&sm.Reason, &sm.ReferenceID, &sm.PerformedBy, &sm.Notes, &sm.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		list = append(list, sm)
	}

	return list, total, rows.Err()
}

func (r *SQLRepository) UpdateThreshold(ctx context.Context, db *sql.DB, variantID string, threshold int) error {
	if threshold < 0 {
		return errors.New("threshold must be non-negative")
	}
	query := `
		UPDATE variant_inventory
		SET low_stock_threshold = $1, updated_at = NOW()
		WHERE variant_id = $2
	`
	res, err := db.ExecContext(ctx, query, threshold, variantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrVariantStockNotFound
	}
	return nil
}

func (r *SQLRepository) GetLowStockAlerts(ctx context.Context, db *sql.DB) ([]InventoryItemSummary, error) {
	isLowStock := true
	filter := &InventoryFilterParams{
		IsLowStock: &isLowStock,
		Page:       1,
		Limit:      100,
	}
	items, _, err := r.ListInventory(ctx, db, filter)
	return items, err
}
