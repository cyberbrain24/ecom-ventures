package orders

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"ecom-ventures/backend/internal/middleware"
	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/internal/store/inventory"
	storeModels "ecom-ventures/backend/internal/store/models"
	pkgAuth "ecom-ventures/backend/pkg/auth"
)

// Service coordinates order business logic, state machines, and inventory linkages.
type Service struct {
	repo          Repository
	inventoryRepo inventory.Repository
}

// NewService instantiates the order domain service.
func NewService(repo Repository, invRepo inventory.Repository) *Service {
	return &Service{
		repo:          repo,
		inventoryRepo: invRepo,
	}
}

// CreateOrder places a new order with atomic stock reservations and price audits.
func (s *Service) CreateOrder(ctx context.Context, req *CreateOrderRequest) (*OrderDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if len(req.Items) == 0 {
		return nil, errors.New("order must contain at least one item")
	}

	performedBy := extractActor(ctx, "STORE_ADMIN")

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin order transaction: %w", err)
	}
	defer tx.Rollback()

	// Calculate subtotal and build items
	var subtotal float64
	var orderItems []storeModels.OrderItem
	for _, it := range req.Items {
		if it.Quantity <= 0 {
			return nil, errors.New("item quantity must be greater than zero")
		}
		itemTotal := it.UnitPrice * float64(it.Quantity)
		subtotal += itemTotal

		// Retrieve variant details for snapshot
		queryVariant := `SELECT p.title, pv.title, pv.sku FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = $1`
		var prodTitle, varTitle, sku string
		if err := tx.QueryRowContext(ctx, queryVariant, it.VariantID).Scan(&prodTitle, &varTitle, &sku); err != nil {
			return nil, fmt.Errorf("failed to resolve variant %s: %w", it.VariantID, err)
		}

		orderItems = append(orderItems, storeModels.OrderItem{
			VariantID:    it.VariantID,
			ProductTitle: prodTitle,
			VariantTitle: varTitle,
			SKU:          sku,
			UnitPrice:    it.UnitPrice,
			Quantity:     it.Quantity,
			TotalPrice:   itemTotal,
		})
	}

	totalAmount := subtotal + req.ShippingFee - req.DiscountAmount
	if totalAmount < 0 {
		totalAmount = 0
	}

	paidAmount := req.PaidAmount
	dueAmount := totalAmount - paidAmount
	if dueAmount < 0 {
		dueAmount = 0
	}

	// Automated Risk Scoring Engine
	riskFlags := EvaluateRiskScores(ctx, stCtx.TenantDB, req.CustomerID, req.CustomerPhone, req.PaymentMethod, totalAmount)

	orderNumber := generateOrderNumber()

	isUrgent := totalAmount > 2500.0

	order := &storeModels.Order{
		OrderNumber:      orderNumber,
		CustomerID:       req.CustomerID,
		CustomerEmail:    strings.TrimSpace(req.CustomerEmail),
		CustomerPhone:    strings.TrimSpace(req.CustomerPhone),
		Status:           storeModels.OrderStatusPlaced,
		PaymentStatus:    storeModels.PaymentStatusPending,
		Currency:         stCtx.Store.Currency,
		Subtotal:         subtotal,
		ShippingFee:      req.ShippingFee,
		DiscountAmount:   req.DiscountAmount,
		TotalAmount:      totalAmount,
		PaidAmount:       paidAmount,
		DueAmount:        dueAmount,
		IsUrgent:         isUrgent,
		ShippingAddress:  req.ShippingAddress,
		BillingAddress:   req.BillingAddress,
		PaymentMethod:    req.PaymentMethod,
		Notes:            req.Notes,
		SpecialNote:      req.SpecialNote,
		ShippingDistrict: req.ShippingDistrict,
		ShippingThana:    req.ShippingThana,
		RiskScoreFlags:   riskFlags,
	}

	// 1. Insert order and order items
	if err := s.repo.CreateOrderTx(ctx, tx, order, orderItems); err != nil {
		return nil, err
	}

	// 2. Reserve inventory for all items in order
	for _, it := range orderItems {
		if _, err := s.inventoryRepo.ReserveStockTx(ctx, tx, it.VariantID, it.Quantity, order.ID, performedBy); err != nil {
			return nil, fmt.Errorf("failed to reserve inventory for item %s: %w", it.SKU, err)
		}
	}

	// 3. Record initial status history
	history := &storeModels.OrderStatusHistory{
		OrderID:     order.ID,
		OldStatus:   "",
		NewStatus:   storeModels.OrderStatusPlaced,
		PerformedBy: performedBy,
		Notes:       "Order created with reserved inventory (State: PLACED)",
	}
	if err := s.repo.RecordStatusHistoryTx(ctx, tx, history); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order creation: %w", err)
	}

	return s.repo.GetOrderByID(ctx, stCtx.TenantDB, order.ID)
}

// TransitionOrderStatus executes a state machine transition with inventory fulfillment or restock.
func (s *Service) TransitionOrderStatus(ctx context.Context, orderID string, req *UpdateOrderStatusRequest) (*OrderDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	performedBy := extractActor(ctx, "STORE_ADMIN")

	currentDetail, err := s.repo.GetOrderByID(ctx, stCtx.TenantDB, orderID)
	if err != nil {
		return nil, err
	}

	currentStatus := currentDetail.Order.Status
	targetStatus := req.Status

	// 1. Validate state jump against state machine
	if err := ValidateOrderTransition(currentStatus, targetStatus); err != nil {
		return nil, err
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transition transaction: %w", err)
	}
	defer tx.Rollback()

	// 2. Handle inventory mutations based on state transition
	if targetStatus == storeModels.OrderStatusShipped && currentStatus != storeModels.OrderStatusShipped {
		// Fulfill reserved stock
		for _, it := range currentDetail.Items {
			if _, err := s.inventoryRepo.FulfillStockTx(ctx, tx, it.VariantID, it.Quantity, orderID, performedBy); err != nil {
				return nil, fmt.Errorf("inventory fulfillment failed for item %s: %w", it.SKU, err)
			}
		}
	} else if targetStatus == storeModels.OrderStatusCancelled {
		// Release reservation if not yet fulfilled, or restock if already fulfilled
		if currentStatus == storeModels.OrderStatusPending || currentStatus == storeModels.OrderStatusConfirmed || currentStatus == storeModels.OrderStatusProcessing {
			for _, it := range currentDetail.Items {
				if _, err := s.inventoryRepo.ReleaseStockTx(ctx, tx, it.VariantID, it.Quantity, orderID, performedBy); err != nil {
					return nil, fmt.Errorf("inventory release failed for item %s: %w", it.SKU, err)
				}
			}
		} else if currentStatus == storeModels.OrderStatusShipped || currentStatus == storeModels.OrderStatusDelivered {
			for _, it := range currentDetail.Items {
				ref := orderID
				if _, err := s.inventoryRepo.AdjustStockTx(ctx, tx, it.VariantID, it.Quantity, storeModels.ReasonOrderCancellationRestock, &ref, performedBy, "Restocked on order cancellation"); err != nil {
					return nil, fmt.Errorf("restock failed for item %s: %w", it.SKU, err)
				}
			}
		}
	}

	// 3. Update order record status
	if err := s.repo.UpdateOrderStatusTx(ctx, tx, orderID, targetStatus); err != nil {
		return nil, err
	}

	// 4. Record history
	history := &storeModels.OrderStatusHistory{
		OrderID:     orderID,
		OldStatus:   currentStatus,
		NewStatus:   targetStatus,
		PerformedBy: performedBy,
		Notes:       req.Notes,
	}
	if err := s.repo.RecordStatusHistoryTx(ctx, tx, history); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order status transition: %w", err)
	}

	return s.repo.GetOrderByID(ctx, stCtx.TenantDB, orderID)
}

// CreateShipment registers shipping carrier dispatch and transitions order to SHIPPED.
func (s *Service) CreateShipment(ctx context.Context, orderID string, req *CreateShipmentRequest) (*storeModels.OrderShipment, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.Carrier == "" || req.TrackingNumber == "" {
		return nil, errors.New("carrier and tracking_number are required")
	}

	// Ensure order transitions to SHIPPED if not already
	transitionReq := &UpdateOrderStatusRequest{
		Status: storeModels.OrderStatusShipped,
		Notes:  fmt.Sprintf("Dispatched with carrier %s (Tracking: %s)", req.Carrier, req.TrackingNumber),
	}
	if _, err := s.TransitionOrderStatus(ctx, orderID, transitionReq); err != nil {
		// If already shipped, proceed without failing
		if !errors.Is(err, ErrInvalidOrderTransition) {
			return nil, err
		}
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin shipment transaction: %w", err)
	}
	defer tx.Rollback()

	shipment := &storeModels.OrderShipment{
		OrderID:        orderID,
		Carrier:        req.Carrier,
		TrackingNumber: req.TrackingNumber,
		TrackingURL:    req.TrackingURL,
		Status:         storeModels.ShipmentInTransit,
		Notes:          req.Notes,
	}

	if err := s.repo.CreateShipmentTx(ctx, tx, shipment); err != nil {
		return nil, fmt.Errorf("failed to record shipment: %w", err)
	}

	// Update order courier tracking code and consignment
	if err := s.repo.UpdateCourierConsignment(ctx, stCtx.TenantDB, orderID, req.TrackingNumber, req.TrackingNumber); err != nil {
		return nil, fmt.Errorf("failed to link tracking number to order: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit shipment: %w", err)
	}

	return shipment, nil
}

// RecordPayment logs a gateway settlement and updates order payment status.
func (s *Service) RecordPayment(ctx context.Context, orderID string, req *RecordPaymentRequest) (*storeModels.PaymentTransaction, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.Gateway == "" || req.Amount <= 0 {
		return nil, errors.New("gateway and a positive amount are required")
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin payment transaction: %w", err)
	}
	defer tx.Rollback()

	txn := &storeModels.PaymentTransaction{
		OrderID:       orderID,
		Gateway:       req.Gateway,
		TransactionID: req.TransactionID,
		Amount:        req.Amount,
		Status:        strings.ToUpper(req.Status),
		RawResponse:   req.RawResponse,
	}

	if err := s.repo.RecordPaymentTransactionTx(ctx, tx, txn); err != nil {
		return nil, fmt.Errorf("failed to record payment transaction: %w", err)
	}

	// Update order payment status if settled
	if txn.Status == "PAID" {
		if err := s.repo.UpdatePaymentStatusTx(ctx, tx, orderID, storeModels.PaymentStatusPaid); err != nil {
			return nil, err
		}
	} else if txn.Status == "REFUNDED" {
		if err := s.repo.UpdatePaymentStatusTx(ctx, tx, orderID, storeModels.PaymentStatusRefunded); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit payment: %w", err)
	}

	return txn, nil
}

// GetOrder fetches full details for an individual order.
func (s *Service) GetOrder(ctx context.Context, orderID string) (*OrderDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetOrderByID(ctx, stCtx.TenantDB, orderID)
}

// ListOrders returns a paginated list of filtered orders along with status breakdown counts.
func (s *Service) ListOrders(ctx context.Context, filter *OrderFilterParams) (*PaginatedOrdersResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	ordersList, total, err := s.repo.ListOrders(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}

	statusCounts, _ := s.repo.GetOrderStatusCounts(ctx, stCtx.TenantDB)

	return &PaginatedOrdersResponse{
		Orders:       ordersList,
		StatusCounts: statusCounts,
		Total:        total,
		Page:         filter.Page,
		Limit:        filter.Limit,
	}, nil
}

// AddCallNote logs an operational phone remark on an order.
func (s *Service) AddCallNote(ctx context.Context, orderID string, req *AddCallNoteRequest) (*storeModels.OrderCallNote, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Note) == "" {
		return nil, errors.New("note content cannot be empty")
	}

	staffName := req.StaffName
	if staffName == "" {
		staffName = extractActor(ctx, "Store Staff")
	}

	note := &storeModels.OrderCallNote{
		OrderID:   orderID,
		StaffName: staffName,
		Note:      strings.TrimSpace(req.Note),
	}

	if err := s.repo.AddCallNote(ctx, stCtx.TenantDB, note); err != nil {
		return nil, err
	}

	return note, nil
}

// GetCallNotes retrieves all timestamped remarks for an order.
func (s *Service) GetCallNotes(ctx context.Context, orderID string) ([]storeModels.OrderCallNote, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetCallNotes(ctx, stCtx.TenantDB, orderID)
}

// UpdateOrder modifies editable fields on an order adhering to Universal CRUD.
func (s *Service) UpdateOrder(ctx context.Context, orderID string, req *UpdateOrderRequest) (*OrderDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.UpdateOrder(ctx, stCtx.TenantDB, orderID, req); err != nil {
		return nil, err
	}

	return s.repo.GetOrderByID(ctx, stCtx.TenantDB, orderID)
}

// DeleteOrder purges or cancels an order record adhering to Universal CRUD.
func (s *Service) DeleteOrder(ctx context.Context, orderID string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	order, err := s.repo.GetOrderByID(ctx, stCtx.TenantDB, orderID)
	if err != nil {
		return err
	}

	// If order is shipped or delivered, do not allow hard deletion
	if order.Order.Status == storeModels.OrderStatusShipped || order.Order.Status == storeModels.OrderStatusDelivered {
		return errors.New("cannot delete order with active carrier shipment or finalized delivery; cancel order instead")
	}

	return s.repo.DeleteOrder(ctx, stCtx.TenantDB, orderID)
}

// UpdateCourierConsignment updates consignment ID and tracking code on the order.
func (s *Service) UpdateCourierConsignment(ctx context.Context, orderID string, consignmentID, trackingCode string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.UpdateCourierConsignment(ctx, stCtx.TenantDB, orderID, consignmentID, trackingCode)
}

// UpdateFulfillmentFlags updates warehouse dispatch flags (is_ready, is_print_ready).
func (s *Service) UpdateFulfillmentFlags(ctx context.Context, orderID string, req *UpdateFulfillmentFlagsRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.UpdateFulfillmentFlags(ctx, stCtx.TenantDB, orderID, req)
}

// GetFulfillmentQueue retrieves actionable dispatch queue orders with two-tier priority.
func (s *Service) GetFulfillmentQueue(ctx context.Context, page, limit int, urgentOnly bool) (*FulfillmentQueueResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetFulfillmentQueue(ctx, stCtx.TenantDB, page, limit, urgentOnly)
}

// CaptureAbandonedCheckout handles silent background telemetry from the storefront checkout.
// It enforces the 15-minute anti-collision check and upserts the intent record.
func (s *Service) CaptureAbandonedCheckout(ctx context.Context, req *CaptureAbandonedCheckoutRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	if req.SessionToken == "" || req.Phone == "" {
		return errors.New("session_token and phone are required for abandoned capture")
	}

	// 1. Anti-Collision Guard: Check if an order was placed with this phone < 15 mins ago
	hasRecent, err := s.repo.HasRecentOrderPlaced(ctx, stCtx.TenantDB, req.Phone, 15)
	if err != nil {
		// Log warning and proceed with capture rather than failing customer telemetry
	} else if hasRecent {
		// Shopper already converted recently; skip recording to prevent duplicate contact
		return nil
	}

	drop := &storeModels.AbandonedCheckout{
		SessionToken:  req.SessionToken,
		Phone:         req.Phone,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		District:      req.District,
		Thana:         req.Thana,
		Address:       req.Address,
		CartTotal:     req.CartTotal,
	}

	// Convert cart items to json.RawMessage
	itemsJSON, _ := json.Marshal(req.CartItems)
	drop.CartItems = json.RawMessage(itemsJSON)

	return s.repo.UpsertAbandonedCheckout(ctx, stCtx.TenantDB, drop)
}

// ListAbandonedCheckouts returns paginated drops with operational pipeline metrics.
func (s *Service) ListAbandonedCheckouts(ctx context.Context, status string, page, limit int) (*PaginatedAbandonedResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListAbandonedCheckouts(ctx, stCtx.TenantDB, status, page, limit)
}

// UpdateAbandonedStatus records tele-sales call notes, scheduled callback timestamps, and status updates.
func (s *Service) UpdateAbandonedStatus(ctx context.Context, dropID string, req *UpdateAbandonedStatusRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	agentID := extractActor(ctx, "")
	var agentPtr *string
	if agentID != "" {
		agentPtr = &agentID
	}
	return s.repo.UpdateAbandonedStatus(ctx, stCtx.TenantDB, dropID, string(req.Status), req.CallNotes, req.ScheduledCallbackAt, agentPtr)
}

// ConvertAbandonedToOrder executes 1-click tele-sales order creation with regional courier pricing.
func (s *Service) ConvertAbandonedToOrder(ctx context.Context, dropID string, req *ConvertAbandonedToOrderRequest) (*storeModels.Order, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	agentID := extractActor(ctx, "")
	return s.repo.ConvertAbandonedToOrder(ctx, stCtx.TenantDB, dropID, req, agentID)
}

// GetOrderPulseDiagnostics aggregates Pillar 1 Hub Aging, Pillar 2 Cancellations, and Pillar 3 Catalog R&D matrix.
func (s *Service) GetOrderPulseDiagnostics(ctx context.Context) (*OrderPulseDiagnosticsResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetOrderPulseDiagnostics(ctx, stCtx.TenantDB)
}

// UpdateOrderPulseTags saves delay blocker or cancellation root cause tags inline.
func (s *Service) UpdateOrderPulseTags(ctx context.Context, orderID string, req *UpdateOrderPulseTagRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.UpdateOrderPulseTags(ctx, stCtx.TenantDB, orderID, req)
}

// ExecutePartialSplit segregates accepted and returned line items in an order.
func (s *Service) ExecutePartialSplit(ctx context.Context, orderID string, req *PartialSplitRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	performedBy := extractActor(ctx, "STORE_ADMIN")
	return s.repo.ExecutePartialSplit(ctx, stCtx.TenantDB, orderID, req, performedBy)
}

func extractActor(ctx context.Context, defaultActor string) string {
	if claims, ok := ctx.Value(middleware.AuthClaimsKey).(*pkgAuth.Claims); ok && claims != nil {
		if claims.Email != "" {
			return claims.Email
		}
		if claims.UserID != "" {
			return claims.UserID
		}
	}
	if staff, ok := ctx.Value("staff_email").(string); ok && staff != "" {
		return staff
	}
	return defaultActor
}

func generateOrderNumber() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	timestamp := time.Now().Format("060102")
	return fmt.Sprintf("ORD-%s-%s", timestamp, strings.ToUpper(hex.EncodeToString(b)))
}
