package payments

import (
	"context"
	"errors"
	"fmt"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrUnsupportedGateway = errors.New("unsupported payment gateway")
	ErrGatewayDisabled    = errors.New("requested payment gateway is disabled for this store")
	ErrInvalidSignature   = errors.New("invalid webhook signature or checksum verification failed")
	ErrPaymentFailed      = errors.New("payment settlement was rejected or cancelled by provider")
)

// PaymentGatewayDriver specifies standard capabilities required for external payment gateways.
type PaymentGatewayDriver interface {
	InitiatePayment(ctx context.Context, order *storeModels.Order, config *GatewayConfig, returnURL, cancelURL string) (*PaymentInitResponse, error)
	VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error)
	HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error)
}

// DriverRegistry instantiates provider drivers.
type DriverRegistry struct {
	drivers map[GatewayType]PaymentGatewayDriver
}

// NewDriverRegistry registers all supported payment gateway adapters.
func NewDriverRegistry() *DriverRegistry {
	return &DriverRegistry{
		drivers: map[GatewayType]PaymentGatewayDriver{
			GatewayBKash:      NewBKashDriver(),
			GatewaySSLCommerz: NewSSLCommerzDriver(),
			GatewayStripe:     NewStripeDriver(),
			GatewayCOD:        NewCODSettlementDriver(),
		},
	}
}

// GetDriver resolves the driver implementation for a gateway type.
func (r *DriverRegistry) GetDriver(gw GatewayType) (PaymentGatewayDriver, error) {
	driver, exists := r.drivers[gw]
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedGateway, gw)
	}
	return driver, nil
}

// CODSettlementDriver handles offline Cash on Delivery checkouts.
type CODSettlementDriver struct{}

// NewCODSettlementDriver instantiates the offline COD settlement driver.
func NewCODSettlementDriver() *CODSettlementDriver {
	return &CODSettlementDriver{}
}

// InitiatePayment returns an immediate settlement response without external redirects.
func (d *CODSettlementDriver) InitiatePayment(ctx context.Context, order *storeModels.Order, config *GatewayConfig, returnURL, cancelURL string) (*PaymentInitResponse, error) {
	return &PaymentInitResponse{
		Gateway:          GatewayCOD,
		TransactionID:    order.OrderNumber,
		RedirectURL:      returnURL,
		RequiresRedirect: false,
	}, nil
}

// VerifyPayment marks the COD order as pending offline cash collection.
func (d *CODSettlementDriver) VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error) {
	return &PaymentVerifyResponse{
		TransactionID: payload["transaction_id"],
		OrderID:       payload["order_id"],
		Status:        storeModels.PaymentStatusPending,
		RawPayload:    "COD_VERIFIED_OFFLINE",
	}, nil
}

// HandleWebhook rejects digital webhooks for offline COD orders.
func (d *CODSettlementDriver) HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error) {
	return nil, errors.New("COD does not receive digital webhooks")
}
