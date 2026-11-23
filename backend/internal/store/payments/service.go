package payments

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/crypto"
)

// ErrSettlementMismatch is returned when a provider-verified settlement does not match the order's
// reference, total or currency. Such a settlement is never recorded.
var ErrSettlementMismatch = errors.New("payment settlement does not match the order reference, total or currency")

// amountTolerance is the largest difference, in the order currency, accepted between a verified
// settlement amount and the order total. It absorbs floating point representation only.
const amountTolerance = 0.005

// Service coordinates payment processing across external providers.
type Service struct {
	repo          Repository
	registry      *DriverRegistry
	encryptionKey []byte
}

// NewService instantiates the payment service. encKey must be the 32-byte platform encryption key.
func NewService(repo Repository, reg *DriverRegistry, encKey []byte) *Service {
	return &Service{
		repo:          repo,
		registry:      reg,
		encryptionKey: encKey,
	}
}

// secretKey returns the 32-byte encryption key. A missing or wrong-sized key is an error so that
// secrets are never stored or read without encryption.
func (s *Service) secretKey() ([]byte, error) {
	if len(s.encryptionKey) != 32 {
		return nil, fmt.Errorf("payments: encryption key must be exactly 32 bytes, got %d", len(s.encryptionKey))
	}
	return s.encryptionKey, nil
}

// decryptClientSecret replaces the stored ciphertext in config with the plaintext secret.
// A decryption failure is returned; the ciphertext is never used as a credential.
func (s *Service) decryptClientSecret(config *GatewayConfig) error {
	if config == nil || config.ClientSecret == "" {
		return nil
	}
	key, err := s.secretKey()
	if err != nil {
		return err
	}
	plain, err := crypto.DecryptAESGCM(config.ClientSecret, key)
	if err != nil {
		return fmt.Errorf("decrypting %s client secret: %w", config.Gateway, err)
	}
	config.ClientSecret = plain
	return nil
}

// verifySettlementMatchesOrder checks a provider-verified settlement against the stored order.
// The order reference, the amount and the currency must all match before any state changes.
func verifySettlementMatchesOrder(order *storeModels.Order, orderNumber string, amount float64, currency string) error {
	if order == nil {
		return fmt.Errorf("%w: order not loaded", ErrSettlementMismatch)
	}
	if orderNumber == "" || orderNumber != order.OrderNumber {
		return fmt.Errorf("%w: order reference %q does not match %q", ErrSettlementMismatch, orderNumber, order.OrderNumber)
	}
	if math.Abs(amount-order.TotalAmount) > amountTolerance {
		return fmt.Errorf("%w: settled amount %.2f does not match order total %.2f", ErrSettlementMismatch, amount, order.TotalAmount)
	}
	if !strings.EqualFold(strings.TrimSpace(currency), strings.TrimSpace(order.Currency)) {
		return fmt.Errorf("%w: settled currency %q does not match order currency %q", ErrSettlementMismatch, currency, order.Currency)
	}
	return nil
}

// InitiatePayment starts an online payment flow and returns the redirect URL.
func (s *Service) InitiatePayment(ctx context.Context, req *InitiatePaymentRequest) (*PaymentInitResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	order, err := s.repo.GetOrderByNumber(ctx, stCtx.TenantDB, req.OrderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	if order.PaymentStatus == storeModels.PaymentStatusPaid {
		return nil, errors.New("order is already paid")
	}

	// Resolve provider driver
	driver, err := s.registry.GetDriver(req.Gateway)
	if err != nil {
		return nil, err
	}

	// Fetch store credentials (COD bypasses credentials check)
	var config *GatewayConfig
	if req.Gateway != GatewayCOD {
		config, err = s.repo.GetGatewayConfig(ctx, stCtx.TenantDB, req.Gateway)
		if err != nil {
			return nil, fmt.Errorf("loading %s gateway configuration: %w", req.Gateway, err)
		}
		if !config.IsEnabled {
			return nil, ErrGatewayDisabled
		}
		if err := s.decryptClientSecret(config); err != nil {
			return nil, err
		}
	}

	return driver.InitiatePayment(ctx, order, config, req.ReturnURL, req.CancelURL)
}

// ProcessCallback verifies return URL callbacks from client redirects.
// A PAID result is recorded only when the provider-verified amount and currency match the order.
func (s *Service) ProcessCallback(ctx context.Context, gateway GatewayType, payload map[string]string) (*PaymentVerifyResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	driver, err := s.registry.GetDriver(gateway)
	if err != nil {
		return nil, err
	}

	config, err := s.repo.GetGatewayConfig(ctx, stCtx.TenantDB, gateway)
	if err != nil {
		return nil, err
	}

	if err := s.decryptClientSecret(config); err != nil {
		return nil, err
	}

	verifyResult, err := driver.VerifyPayment(ctx, payload, config)
	if err != nil {
		return nil, err
	}

	// Reconcile order settlement atomically
	if verifyResult.Status == storeModels.PaymentStatusPaid {
		if err := s.settleOrderPayment(ctx, stCtx.TenantDB, gateway, verifyResult); err != nil {
			return nil, err
		}
	}

	return verifyResult, nil
}

// ProcessWebhook handles asynchronous webhook events with idempotency locking.
// The driver is responsible for provider verification; this method additionally requires the
// settled amount, currency and order reference to match the order before recording payment.
// Any error rolls back the transaction, including the idempotency key, so the event can be retried.
func (s *Service) ProcessWebhook(ctx context.Context, gateway GatewayType, rawBody []byte, headers map[string]string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	driver, err := s.registry.GetDriver(gateway)
	if err != nil {
		return err
	}

	config, err := s.repo.GetGatewayConfig(ctx, stCtx.TenantDB, gateway)
	if err != nil {
		return err
	}

	if err := s.decryptClientSecret(config); err != nil {
		return err
	}

	event, err := driver.HandleWebhook(ctx, rawBody, headers, config)
	if err != nil {
		return err
	}

	idempotencyKey := fmt.Sprintf("%s:%s", gateway, event.EventID)

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin webhook transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 1. Assert idempotency key
	if err := s.repo.LockIdempotencyKeyTx(ctx, tx, idempotencyKey, string(gateway)); err != nil {
		if errors.Is(err, ErrDuplicateWebhook) {
			// Already processed; return nil without repeating settlement
			return nil
		}
		return err
	}

	// 2. If status is paid, verify against the order and record settlement
	if event.Status == storeModels.PaymentStatusPaid {
		order, err := s.repo.GetOrderByNumber(ctx, stCtx.TenantDB, event.OrderID)
		if err != nil {
			return fmt.Errorf("loading order %q for webhook settlement: %w", event.OrderID, err)
		}
		if err := verifySettlementMatchesOrder(order, event.OrderID, event.Amount, event.Currency); err != nil {
			return err
		}
		if order.PaymentStatus != storeModels.PaymentStatusPaid {
			txn := &storeModels.PaymentTransaction{
				OrderID:       order.ID,
				Gateway:       string(gateway),
				TransactionID: event.TransactionID,
				Amount:        event.Amount,
				Status:        "PAID",
				RawResponse:   event.RawBody,
			}
			if err := s.repo.RecordTransactionTx(ctx, tx, txn); err != nil {
				return err
			}
			if err := s.repo.UpdateOrderPaymentSettledTx(ctx, tx, order.ID, string(gateway)); err != nil {
				return err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit webhook transaction: %w", err)
	}
	return nil
}

// settleOrderPayment records a provider-verified settlement once the amount, currency and order
// reference have been checked against the order.
func (s *Service) settleOrderPayment(ctx context.Context, db *sql.DB, gateway GatewayType, verified *PaymentVerifyResponse) error {
	order, err := s.repo.GetOrderByNumber(ctx, db, verified.OrderID)
	if err != nil {
		return err
	}

	if order.PaymentStatus == storeModels.PaymentStatusPaid {
		return nil
	}

	if err := verifySettlementMatchesOrder(order, verified.OrderID, verified.Amount, verified.Currency); err != nil {
		return err
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin settlement transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	txn := &storeModels.PaymentTransaction{
		OrderID:       order.ID,
		Gateway:       string(gateway),
		TransactionID: verified.TransactionID,
		Amount:        verified.Amount,
		Status:        "PAID",
		RawResponse:   verified.RawPayload,
	}

	if err := s.repo.RecordTransactionTx(ctx, tx, txn); err != nil {
		return err
	}

	if err := s.repo.UpdateOrderPaymentSettledTx(ctx, tx, order.ID, string(gateway)); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit settlement transaction: %w", err)
	}
	return nil
}

// SaveGatewayConfig allows store owners to configure credentials with AES encryption.
// It fails when encryption cannot run, so a client secret is never stored in plaintext, and it
// refuses a Stripe configuration that has no webhook secret.
func (s *Service) SaveGatewayConfig(ctx context.Context, req *UpdateGatewayConfigRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}

	webhookKey := strings.TrimSpace(req.WebhookKey)
	if req.Gateway == GatewayStripe && webhookKey == "" {
		return ErrStripeWebhookSecretRequired
	}

	encryptedSecret := strings.TrimSpace(req.ClientSecret)
	if encryptedSecret != "" {
		key, err := s.secretKey()
		if err != nil {
			return err
		}
		encrypted, err := crypto.EncryptAESGCM(encryptedSecret, key)
		if err != nil {
			return fmt.Errorf("failed to encrypt client secret: %w", err)
		}
		encryptedSecret = encrypted
	}

	c := &GatewayConfig{
		Gateway:      req.Gateway,
		IsEnabled:    req.IsEnabled,
		IsDefault:    req.IsDefault,
		IsTestMode:   req.IsTestMode,
		AccountID:    strings.TrimSpace(req.AccountID),
		ClientID:     strings.TrimSpace(req.ClientID),
		ClientSecret: encryptedSecret,
		WebhookKey:   webhookKey,
	}

	return s.repo.SaveGatewayConfig(ctx, stCtx.TenantDB, c)
}

// SetDefaultGateway marks a gateway as active and default for the store.
func (s *Service) SetDefaultGateway(ctx context.Context, gateway GatewayType) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}
	return s.repo.SetDefaultGateway(ctx, stCtx.TenantDB, gateway)
}

// ToggleGatewayActive activates or deactivates a payment gateway for the store.
func (s *Service) ToggleGatewayActive(ctx context.Context, gateway GatewayType, isEnabled bool) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}
	return s.repo.ToggleGatewayActive(ctx, stCtx.TenantDB, gateway, isEnabled)
}

// ListPublicGateways returns customer-facing payment options for the storefront checkout.
// Only enabled gateways are included. Deactivated gateways are excluded so they are hidden on the checkout page.
func (s *Service) ListPublicGateways(ctx context.Context) ([]PublicGatewayInfo, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}
	configs, err := s.repo.ListGatewayConfigs(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}

	metadata := map[GatewayType]struct {
		name string
		desc string
	}{
		GatewayCOD: {
			name: "Cash on Delivery (COD)",
			desc: "Pay cash when the parcel is delivered to you.",
		},
		GatewayBKash: {
			name: "bKash Direct",
			desc: "Fast and secure payment with bKash digital wallet.",
		},
		GatewayNagad: {
			name: "Nagad Gateway",
			desc: "Instant digital payment with Nagad mobile financial service.",
		},
		GatewaySSLCommerz: {
			name: "SSLCommerz Hosted",
			desc: "Pay securely with Visa, MasterCard, UnionPay, or Mobile Banking.",
		},
		GatewayStripe: {
			name: "Stripe International",
			desc: "Pay securely with Visa, MasterCard, or American Express.",
		},
	}

	var results []PublicGatewayInfo
	hasDefault := false

	for _, c := range configs {
		if !c.IsEnabled {
			// Skip deactivated gateways so they are completely hidden on checkout
			continue
		}
		meta, exists := metadata[c.Gateway]
		name := string(c.Gateway)
		desc := "Digital payment gateway"
		if exists {
			name = meta.name
			desc = meta.desc
		}
		if c.IsDefault {
			hasDefault = true
		}
		results = append(results, PublicGatewayInfo{
			ID:          string(c.Gateway),
			Name:        name,
			Description: desc,
			IsDefault:   c.IsDefault,
			IsEnabled:   true,
		})
	}

	// If no gateway is marked default among enabled ones, set the first enabled one as default
	if len(results) > 0 && !hasDefault {
		results[0].IsDefault = true
	}

	return results, nil
}

// ListGatewayConfigs lists configured payment options for store administration.
func (s *Service) ListGatewayConfigs(ctx context.Context) ([]GatewayConfig, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}
	configs, err := s.repo.ListGatewayConfigs(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}
	// Redact sensitive secrets for JSON response
	for i := range configs {
		if configs[i].ClientSecret != "" {
			configs[i].ClientSecret = "••••••••••••"
		}
	}
	return configs, nil
}
