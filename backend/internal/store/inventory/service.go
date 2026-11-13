package inventory

import (
	"context"
	"errors"
	"fmt"

	"ecom-ventures/backend/internal/middleware"
	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	pkgAuth "ecom-ventures/backend/pkg/auth"
)

// Service defines inventory operations coordinating business logic and database transactions.
type Service struct {
	repo Repository
}

// NewService instantiates the inventory service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func extractActor(ctx context.Context, defaultActor string) string {
	if claims, ok := ctx.Value(middleware.AuthClaimsKey).(*pkgAuth.Claims); ok && claims != nil && claims.Email != "" {
		return claims.Email
	}
	if staff, ok := ctx.Value("staff_email").(string); ok && staff != "" {
		return staff
	}
	return defaultActor
}

// AdjustStock adjusts an SKU's physical inventory with atomic ledger tracking.
func (s *Service) AdjustStock(ctx context.Context, req *AdjustStockRequest) (*storeModels.StockMovement, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.VariantID == "" {
		return nil, errors.New("variant_id is required")
	}

	performedBy := extractActor(ctx, "STORE_ADMIN")

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	movement, err := s.repo.AdjustStockTx(ctx, tx, req.VariantID, req.QuantityChange, req.Reason, req.ReferenceID, performedBy, req.Notes)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit adjustment transaction: %w", err)
	}

	return movement, nil
}

// BatchAdjustStock executes multi-item inventory alterations atomically.
func (s *Service) BatchAdjustStock(ctx context.Context, req *BatchStockAdjustmentRequest) ([]storeModels.StockMovement, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if len(req.Adjustments) == 0 {
		return nil, errors.New("no adjustments provided")
	}

	performedBy := extractActor(ctx, "STORE_ADMIN")

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var movements []storeModels.StockMovement
	for _, adj := range req.Adjustments {
		m, err := s.repo.AdjustStockTx(ctx, tx, adj.VariantID, adj.QuantityChange, adj.Reason, adj.ReferenceID, performedBy, adj.Notes)
		if err != nil {
			return nil, fmt.Errorf("failed adjusting variant %s: %w", adj.VariantID, err)
		}
		movements = append(movements, *m)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit batch adjustment transaction: %w", err)
	}

	return movements, nil
}

// ReserveStock reserves available units for an active cart checkout or pending order.
func (s *Service) ReserveStock(ctx context.Context, req *ReserveStockRequest) (*storeModels.StockMovement, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	performedBy := extractActor(ctx, "CHECKOUT_ENGINE")

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	movement, err := s.repo.ReserveStockTx(ctx, tx, req.VariantID, req.Quantity, req.OrderID, performedBy)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit reservation: %w", err)
	}

	return movement, nil
}

// FulfillStock decrements both physical and reserved counts upon order fulfillment.
func (s *Service) FulfillStock(ctx context.Context, req *FulfillStockRequest) (*storeModels.StockMovement, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	performedBy := extractActor(ctx, "FULFILLMENT_ENGINE")

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	movement, err := s.repo.FulfillStockTx(ctx, tx, req.VariantID, req.Quantity, req.OrderID, performedBy)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit fulfillment: %w", err)
	}

	return movement, nil
}

// ReleaseStock frees reserved quantity when an order is cancelled or checkout expires.
func (s *Service) ReleaseStock(ctx context.Context, req *ReleaseStockRequest) (*storeModels.StockMovement, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	performedBy := extractActor(ctx, "CHECKOUT_TIMEOUT")

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	movement, err := s.repo.ReleaseStockTx(ctx, tx, req.VariantID, req.Quantity, req.OrderID, performedBy)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit release: %w", err)
	}

	return movement, nil
}

// ListInventory returns filtered stock summaries for the active store tenant.
func (s *Service) ListInventory(ctx context.Context, filter *InventoryFilterParams) (*PaginatedInventoryResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	items, total, err := s.repo.ListInventory(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}

	return &PaginatedInventoryResponse{
		Items: items,
		Total: total,
		Page:  filter.Page,
		Limit: filter.Limit,
	}, nil
}

// ListMovements returns paginated audit records from the stock movement ledger.
func (s *Service) ListMovements(ctx context.Context, filter *StockMovementFilterParams) (*PaginatedMovementsResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	movements, total, err := s.repo.ListMovements(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}

	return &PaginatedMovementsResponse{
		Movements: movements,
		Total:     total,
		Page:      filter.Page,
		Limit:     filter.Limit,
	}, nil
}

// UpdateThreshold sets low stock warning boundaries.
func (s *Service) UpdateThreshold(ctx context.Context, variantID string, threshold int) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.UpdateThreshold(ctx, stCtx.TenantDB, variantID, threshold)
}

// GetLowStockAlerts returns all SKUs that have breached low stock thresholds.
func (s *Service) GetLowStockAlerts(ctx context.Context) ([]InventoryItemSummary, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetLowStockAlerts(ctx, stCtx.TenantDB)
}
