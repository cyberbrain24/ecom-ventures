package logistics

import (
	"context"
	"errors"
	"fmt"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrUnsupportedCarrier = errors.New("unsupported shipping carrier")
	ErrCarrierDisabled    = errors.New("requested shipping carrier is disabled for this store")
	ErrConsignmentFailed  = errors.New("carrier rejected consignment booking")
	// ErrTrackingNotImplemented is returned by drivers whose carrier tracking API is not integrated.
	ErrTrackingNotImplemented = errors.New("tracking not implemented for this carrier")
	// ErrCancellationNotImplemented is returned by drivers whose carrier cancellation is not integrated.
	ErrCancellationNotImplemented = errors.New("carrier cancellation is not implemented; cancel the consignment with the carrier directly")
)

// CourierDriver specifies capabilities required for external shipping logistics networks.
type CourierDriver interface {
	CreateConsignment(ctx context.Context, order *storeModels.Order, config *CourierConfig, req *DispatchOrderRequest) (*ConsignmentResponse, error)
	TrackConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) (*TrackingTimeline, error)
	CancelConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) error
	HandleStatusWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *CourierConfig) (*DeliveryMilestoneEvent, error)
}

// DriverRegistry instantiates and maintains logistics carrier adapters.
type DriverRegistry struct {
	drivers map[CarrierType]CourierDriver
}

// NewDriverRegistry registers all supported courier integrations.
func NewDriverRegistry() *DriverRegistry {
	return &DriverRegistry{
		drivers: map[CarrierType]CourierDriver{
			CarrierSteadfast: NewSteadfastDriver(),
			CarrierPathao:    NewPathaoDriver(),
			CarrierRedX:      NewRedXDriver(),
			CarrierManual:    NewManualCourierDriver(),
		},
	}
}

// GetDriver resolves the implementation driver for a carrier type.
func (r *DriverRegistry) GetDriver(carrier CarrierType) (CourierDriver, error) {
	driver, exists := r.drivers[carrier]
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedCarrier, carrier)
	}
	return driver, nil
}

// ManualCourierDriver handles in-house riders and store pickup deliveries.
type ManualCourierDriver struct{}

// NewManualCourierDriver instantiates the manual in-house delivery driver.
func NewManualCourierDriver() *ManualCourierDriver {
	return &ManualCourierDriver{}
}

// CreateConsignment allocates an internal dispatch tracking reference.
func (d *ManualCourierDriver) CreateConsignment(ctx context.Context, order *storeModels.Order, config *CourierConfig, req *DispatchOrderRequest) (*ConsignmentResponse, error) {
	trackingID := fmt.Sprintf("MANUAL-%s", order.OrderNumber)
	return &ConsignmentResponse{
		Carrier:        CarrierManual,
		ConsignmentID:  trackingID,
		TrackingNumber: trackingID,
		TrackingURL:    "",
		DeliveryFee:    0,
		RawPayload:     `{"status":"assigned_to_inhouse_rider"}`,
	}, nil
}

// TrackConsignment is not available for in-house delivery: there is no carrier record to query,
// and no milestone is invented.
func (d *ManualCourierDriver) TrackConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) (*TrackingTimeline, error) {
	return nil, fmt.Errorf("manual dispatch: %w", ErrTrackingNotImplemented)
}

// CancelConsignment is not available for in-house dispatch: no carrier is contacted, so the
// cancellation must be recorded by store staff rather than reported here.
func (d *ManualCourierDriver) CancelConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) error {
	return fmt.Errorf("manual dispatch: %w", ErrCancellationNotImplemented)
}

// HandleStatusWebhook returns an error as manual delivery does not receive external webhooks.
func (d *ManualCourierDriver) HandleStatusWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *CourierConfig) (*DeliveryMilestoneEvent, error) {
	return nil, errors.New("manual carrier does not receive external webhooks")
}
