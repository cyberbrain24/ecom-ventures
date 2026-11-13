package payments

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/crypto"
)

// Service coordinates payment processing across external providers.
type Service struct {
	repo          Repository
	registry      *DriverRegistry
	encryptionKey []byte
}

// NewService instantiates the payment service.
func NewService(repo Repository, reg *DriverRegistry, encKey []byte) *Service {
	return &Service{
		repo:          repo,
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
		if err != nil || !config.IsEnabled {
			return nil, ErrGatewayDisabled
		}
		// Decrypt sensitive secrets
		key := s.get32ByteKey()
		if config.ClientSecret != "" && key != nil {
			if decrypted, err := crypto.DecryptAESGCM(config.ClientSecret, key); err == nil {
				config.ClientSecret = decrypted
			}
		}
	}

	return driver.InitiatePayment(ctx, order, config, req.ReturnURL, req.CancelURL)
}

// ProcessCallback verifies return URL callbacks from client redirects.
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

	key := s.get32ByteKey()
	if config.ClientSecret != "" && key != nil {
		if decrypted, err := crypto.DecryptAESGCM(config.ClientSecret, key); err == nil {
			config.ClientSecret = decrypted
		}
	}

	verifyResult, err := driver.VerifyPayment(ctx, payload, config)
	if err != nil {
		return nil, err
	}

	// Reconcile order settlement atomically
	if verifyResult.Status == storeModels.PaymentStatusPaid {
		if err := s.settleOrderPayment(ctx, stCtx.TenantDB, verifyResult.OrderID, string(gateway), verifyResult.TransactionID, verifyResult.Amount, verifyResult.RawPayload); err != nil {
			return nil, err
		}
	}

	return verifyResult, nil
}

// ProcessWebhook handles asynchronous webhook events with idempotency locking.
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

	key := s.get32ByteKey()
	if config.ClientSecret != "" && key != nil {
		if decrypted, err := crypto.DecryptAESGCM(config.ClientSecret, key); err == nil {
			config.ClientSecret = decrypted
		}
	}

	event, err := driver.HandleWebhook(ctx, rawBody, headers, config)
	if err != nil {
		return err
	}

	idempotencyKey := fmt.Sprintf("%s:%s", gateway, event.EventID)

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Assert idempotency key
	if err := s.repo.LockIdempotencyKeyTx(ctx, tx, idempotencyKey, string(gateway)); err != nil {
		if errors.Is(err, ErrDuplicateWebhook) {
			// Already processed; return nil without repeating settlement
			return nil
		}
		return err
	}

	// 2. If status is paid, record settlement
	if event.Status == storeModels.PaymentStatusPaid && event.OrderID != "" {
		order, err := s.repo.GetOrderByNumber(ctx, stCtx.TenantDB, event.OrderID)
		if err == nil && order.PaymentStatus != storeModels.PaymentStatusPaid {
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

	return tx.Commit()
}

func (s *Service) settleOrderPayment(ctx context.Context, db *sql.DB, orderNumber, gateway, transactionID string, amount float64, rawPayload string) error {
	order, err := s.repo.GetOrderByNumber(ctx, db, orderNumber)
	if err != nil {
		return err
	}

	if order.PaymentStatus == storeModels.PaymentStatusPaid {
		return nil
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	txn := &storeModels.PaymentTransaction{
		OrderID:       order.ID,
		Gateway:       gateway,
		TransactionID: transactionID,
		Amount:        amount,
		Status:        "PAID",
		RawResponse:   rawPayload,
	}

	if err := s.repo.RecordTransactionTx(ctx, tx, txn); err != nil {
		return err
	}

	if err := s.repo.UpdateOrderPaymentSettledTx(ctx, tx, order.ID, gateway); err != nil {
		return err
	}

	return tx.Commit()
}

// SaveGatewayConfig allows store owners to configure credentials with AES encryption.
func (s *Service) SaveGatewayConfig(ctx context.Context, req *UpdateGatewayConfigRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}

	encryptedSecret := strings.TrimSpace(req.ClientSecret)
	key := s.get32ByteKey()
	if encryptedSecret != "" && key != nil {
		encrypted, err := crypto.EncryptAESGCM(encryptedSecret, key)
		if err != nil {
			return fmt.Errorf("failed to encrypt client secret: %w", err)
		}
		encryptedSecret = encrypted
	}

	c := &GatewayConfig{
		Gateway:      req.Gateway,
		IsEnabled:    req.IsEnabled,
		IsTestMode:   req.IsTestMode,
		AccountID:    strings.TrimSpace(req.AccountID),
		ClientID:     strings.TrimSpace(req.ClientID),
		ClientSecret: encryptedSecret,
		WebhookKey:   strings.TrimSpace(req.WebhookKey),
	}

	return s.repo.SaveGatewayConfig(ctx, stCtx.TenantDB, c)
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
