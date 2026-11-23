package logistics

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/internal/store/orders"
	"ecom-ventures/backend/pkg/crypto"
)

// Service coordinates shipping consignments and carrier webhook processing.
type Service struct {
	repo          Repository
	ordersSvc     *orders.Service
	registry      *DriverRegistry
	encryptionKey []byte
}

// NewService instantiates the logistics domain service. encKey must be the 32-byte platform encryption key.
func NewService(repo Repository, ordersSvc *orders.Service, reg *DriverRegistry, encKey []byte) *Service {
	return &Service{
		repo:          repo,
		ordersSvc:     ordersSvc,
		registry:      reg,
		encryptionKey: encKey,
	}
}

// secretKey returns the 32-byte encryption key. A missing or wrong-sized key is an error so that
// carrier secrets are never read or stored without encryption.
func (s *Service) secretKey() ([]byte, error) {
	if len(s.encryptionKey) != 32 {
		return nil, fmt.Errorf("logistics: encryption key must be exactly 32 bytes, got %d", len(s.encryptionKey))
	}
	return s.encryptionKey, nil
}

// decryptCarrierSecrets replaces stored ciphertext in config with plaintext. A decryption failure is
// returned; the ciphertext is never used as a credential.
func (s *Service) decryptCarrierSecrets(config *CourierConfig) error {
	if config == nil {
		return nil
	}
	if config.SecretKey == "" && config.ApiKey == "" {
		return nil
	}
	key, err := s.secretKey()
	if err != nil {
		return err
	}
	if config.SecretKey != "" {
		dec, err := crypto.DecryptAESGCM(config.SecretKey, key)
		if err != nil {
			return fmt.Errorf("decrypting %s secret key: %w", config.Carrier, err)
		}
		config.SecretKey = dec
	}
	if config.ApiKey != "" {
		dec, err := crypto.DecryptAESGCM(config.ApiKey, key)
		if err != nil {
			return fmt.Errorf("decrypting %s api key: %w", config.Carrier, err)
		}
		config.ApiKey = dec
	}
	return nil
}

// DispatchOrder books consignment with courier, records shipment, and advances order status to SHIPPED.
func (s *Service) DispatchOrder(ctx context.Context, orderID string, req *DispatchOrderRequest) (*storeModels.OrderShipment, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	orderDetail, err := s.ordersSvc.GetOrder(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	driver, err := s.registry.GetDriver(req.Carrier)
	if err != nil {
		return nil, err
	}

	var config *CourierConfig
	if req.Carrier != CarrierManual {
		config, err = s.repo.GetCourierConfig(ctx, stCtx.TenantDB, req.Carrier)
		if err != nil {
			return nil, fmt.Errorf("loading %s courier configuration: %w", req.Carrier, err)
		}
		if !config.IsEnabled {
			return nil, ErrCarrierDisabled
		}
		if err := s.decryptCarrierSecrets(config); err != nil {
			return nil, err
		}
	}

	// 1. Book parcel consignment via external courier API
	consignment, err := driver.CreateConsignment(ctx, &orderDetail.Order, config, req)
	if err != nil {
		return nil, fmt.Errorf("failed to dispatch with courier %s: %w", req.Carrier, err)
	}

	// 2. Insert shipment record and transition order to SHIPPED (triggers inventory fulfillment)
	shipmentReq := &orders.CreateShipmentRequest{
		Carrier:        string(consignment.Carrier),
		TrackingNumber: consignment.TrackingNumber,
		TrackingURL:    consignment.TrackingURL,
		Notes:          fmt.Sprintf("Dispatched parcel via %s (Consignment ID: %s)", consignment.Carrier, consignment.ConsignmentID),
	}

	shipment, err := s.ordersSvc.CreateShipment(ctx, orderID, shipmentReq)
	if err != nil {
		return nil, fmt.Errorf("consignment booked but failed to record shipment (consignment %s, tracking %s): %w",
			consignment.ConsignmentID, consignment.TrackingNumber, err)
	}

	if err := s.ordersSvc.UpdateCourierConsignment(ctx, orderID, consignment.ConsignmentID, consignment.TrackingNumber); err != nil {
		return nil, fmt.Errorf("consignment booked and shipment recorded but linking consignment %s to the order failed: %w",
			consignment.ConsignmentID, err)
	}

	return shipment, nil
}

// TrackShipment queries real-time transit milestones from the assigned carrier.
func (s *Service) TrackShipment(ctx context.Context, trackingNumber string) (*TrackingTimeline, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	shipment, err := s.repo.GetShipmentByTrackingNumber(ctx, stCtx.TenantDB, trackingNumber)
	if err != nil {
		return nil, errors.New("shipment tracking record not found")
	}

	driver, err := s.registry.GetDriver(CarrierType(shipment.Carrier))
	if err != nil {
		return nil, err
	}

	var config *CourierConfig
	if shipment.Carrier != string(CarrierManual) {
		config, err = s.repo.GetCourierConfig(ctx, stCtx.TenantDB, CarrierType(shipment.Carrier))
		if err != nil {
			return nil, fmt.Errorf("loading %s courier configuration: %w", shipment.Carrier, err)
		}
		if err := s.decryptCarrierSecrets(config); err != nil {
			return nil, err
		}
	}

	return driver.TrackConsignment(ctx, trackingNumber, config)
}

// ProcessCourierWebhook processes automated milestone updates from shipping carriers.
// Carrier webhook authentication is not yet implemented (see the open decision on carrier webhook
// verification); configuration errors are returned rather than ignored.
func (s *Service) ProcessCourierWebhook(ctx context.Context, carrier CarrierType, rawBody []byte, headers map[string]string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	driver, err := s.registry.GetDriver(carrier)
	if err != nil {
		return err
	}

	config, err := s.repo.GetCourierConfig(ctx, stCtx.TenantDB, carrier)
	if err != nil {
		return fmt.Errorf("loading %s courier configuration for webhook: %w", carrier, err)
	}
	event, err := driver.HandleStatusWebhook(ctx, rawBody, headers, config)
	if err != nil {
		return err
	}

	// 1. Locate shipment record
	shipment, err := s.repo.GetShipmentByTrackingNumber(ctx, stCtx.TenantDB, event.TrackingNumber)
	if err != nil {
		return fmt.Errorf("shipment not found for tracking %s: %w", event.TrackingNumber, err)
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin carrier webhook transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 2. Update shipment milestone
	if err := s.repo.UpdateShipmentMilestoneTx(ctx, tx, shipment.ID, event.Milestone); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit carrier webhook transaction: %w", err)
	}

	// 3. Reconcile order state machine if delivered or returned
	var transition *orders.UpdateOrderStatusRequest
	switch event.Milestone {
	case storeModels.ShipmentDelivered:
		transition = &orders.UpdateOrderStatusRequest{
			Status: storeModels.OrderStatusDelivered,
			Notes:  "Automated carrier webhook: parcel confirmed delivered",
		}
	case storeModels.ShipmentReturned:
		transition = &orders.UpdateOrderStatusRequest{
			Status: storeModels.OrderStatusCancelled,
			Notes:  "Automated carrier webhook: parcel returned/cancelled by courier",
		}
	}
	if transition != nil {
		if _, err := s.ordersSvc.TransitionOrderStatus(ctx, shipment.OrderID, transition); err != nil {
			// The order is already past this state; the milestone update above is kept.
			if !errors.Is(err, orders.ErrInvalidOrderTransition) {
				return fmt.Errorf("reconciling order %s after carrier milestone %s: %w", shipment.OrderID, event.Milestone, err)
			}
			slog.Default().Warn("Carrier milestone did not change order state",
				slog.String("order_id", shipment.OrderID),
				slog.String("milestone", string(event.Milestone)),
				slog.String("reason", err.Error()),
			)
		}
	}

	return nil
}

// SaveCourierConfig persists store-level carrier keys with AES encryption.
// Encryption failure is returned; a carrier secret is never stored in plaintext.
func (s *Service) SaveCourierConfig(ctx context.Context, req *UpdateCourierConfigRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}

	encryptedKey := strings.TrimSpace(req.ApiKey)
	encryptedSecret := strings.TrimSpace(req.SecretKey)

	if encryptedKey != "" || encryptedSecret != "" {
		key, err := s.secretKey()
		if err != nil {
			return err
		}
		if encryptedKey != "" {
			enc, err := crypto.EncryptAESGCM(encryptedKey, key)
			if err != nil {
				return fmt.Errorf("encrypting carrier api key: %w", err)
			}
			encryptedKey = enc
		}
		if encryptedSecret != "" {
			enc, err := crypto.EncryptAESGCM(encryptedSecret, key)
			if err != nil {
				return fmt.Errorf("encrypting carrier secret key: %w", err)
			}
			encryptedSecret = enc
		}
	}

	c := &CourierConfig{
		Carrier:    req.Carrier,
		IsEnabled:  req.IsEnabled,
		IsTestMode: req.IsTestMode,
		ApiKey:     encryptedKey,
		SecretKey:  encryptedSecret,
		ClientID:   strings.TrimSpace(req.ClientID),
		WebhookKey: strings.TrimSpace(req.WebhookKey),
	}

	return s.repo.SaveCourierConfig(ctx, stCtx.TenantDB, c)
}

// ListCourierConfigs lists carrier integrations for the Store Admin.
func (s *Service) ListCourierConfigs(ctx context.Context) ([]CourierConfig, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	configs, err := s.repo.ListCourierConfigs(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}

	for i := range configs {
		if configs[i].ApiKey != "" {
			configs[i].ApiKey = "••••••••••••"
		}
		if configs[i].SecretKey != "" {
			configs[i].SecretKey = "••••••••••••"
		}
	}
	return configs, nil
}
