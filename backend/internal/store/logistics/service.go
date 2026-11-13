package logistics

import (
	"context"
	"errors"
	"fmt"
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

// NewService instantiates the logistics domain service.
func NewService(repo Repository, ordersSvc *orders.Service, reg *DriverRegistry, encKey []byte) *Service {
	return &Service{
		repo:          repo,
		ordersSvc:     ordersSvc,
		registry:      reg,
		encryptionKey: encKey,
	}
}

func (s *Service) get32ByteKey() []byte {
	if len(s.encryptionKey) >= 32 {
		return s.encryptionKey[:32]
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
		if err != nil || !config.IsEnabled {
			return nil, ErrCarrierDisabled
		}
		// Decrypt sensitive keys
		key := s.get32ByteKey()
		if key != nil {
			if config.SecretKey != "" {
				if dec, err := crypto.DecryptAESGCM(config.SecretKey, key); err == nil {
					config.SecretKey = dec
				}
			}
			if config.ApiKey != "" {
				if dec, err := crypto.DecryptAESGCM(config.ApiKey, key); err == nil {
					config.ApiKey = dec
				}
			}
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
		return nil, fmt.Errorf("consignment booked but failed to record shipment: %w", err)
	}

	_ = s.ordersSvc.UpdateCourierConsignment(ctx, orderID, consignment.ConsignmentID, consignment.TrackingNumber)

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
		config, _ = s.repo.GetCourierConfig(ctx, stCtx.TenantDB, CarrierType(shipment.Carrier))
		key := s.get32ByteKey()
		if config != nil && config.ApiKey != "" && key != nil {
			if dec, err := crypto.DecryptAESGCM(config.ApiKey, key); err == nil {
				config.ApiKey = dec
			}
		}
	}

	return driver.TrackConsignment(ctx, trackingNumber, config)
}

// ProcessCourierWebhook processes automated milestone updates from shipping carriers.
func (s *Service) ProcessCourierWebhook(ctx context.Context, carrier CarrierType, rawBody []byte, headers map[string]string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	driver, err := s.registry.GetDriver(carrier)
	if err != nil {
		return err
	}

	config, _ := s.repo.GetCourierConfig(ctx, stCtx.TenantDB, carrier)
	event, err := driver.HandleStatusWebhook(ctx, rawBody, headers, config)
	if err != nil {
		return err
	}

	// 1. Locate shipment record
	shipment, err := s.repo.GetShipmentByTrackingNumber(ctx, stCtx.TenantDB, event.TrackingNumber)
	if err != nil {
		return fmt.Errorf("shipment not found for tracking: %s", event.TrackingNumber)
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 2. Update shipment milestone
	if err := s.repo.UpdateShipmentMilestoneTx(ctx, tx, shipment.ID, event.Milestone); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// 3. Reconcile order state machine if delivered or returned
	if event.Milestone == storeModels.ShipmentDelivered {
		_, _ = s.ordersSvc.TransitionOrderStatus(ctx, shipment.OrderID, &orders.UpdateOrderStatusRequest{
			Status: storeModels.OrderStatusDelivered,
			Notes:  "Automated carrier webhook: parcel confirmed delivered",
		})
	} else if event.Milestone == storeModels.ShipmentReturned {
		_, _ = s.ordersSvc.TransitionOrderStatus(ctx, shipment.OrderID, &orders.UpdateOrderStatusRequest{
			Status: storeModels.OrderStatusCancelled,
			Notes:  "Automated carrier webhook: parcel returned/cancelled by courier",
		})
	}

	return nil
}

// SaveCourierConfig persists store-level carrier keys with AES encryption.
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

	key := s.get32ByteKey()
	if key != nil {
		if encryptedKey != "" {
			if enc, err := crypto.EncryptAESGCM(encryptedKey, key); err == nil {
				encryptedKey = enc
			}
		}
		if encryptedSecret != "" {
			if enc, err := crypto.EncryptAESGCM(encryptedSecret, key); err == nil {
				encryptedSecret = enc
			}
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
