package marketing

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/crypto"
)

// Service coordinates marketing configurations and CAPI telemetry.
type Service struct {
	repo           Repository
	capiDispatcher *MetaCAPIDispatcher
	encryptionKey  []byte
}

// NewService constructs a new marketing Service.
func NewService(repo Repository, capi *MetaCAPIDispatcher, encKey []byte) *Service {
	return &Service{
		repo:           repo,
		capiDispatcher: capi,
		encryptionKey:  encKey,
	}
}

// GetPublicConfig returns sanitized tracking IDs for the active storefront tenant.
func (s *Service) GetPublicConfig(ctx context.Context) (*PublicMarketingConfig, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	cfg, err := s.repo.GetConfig(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}

	pub := &PublicMarketingConfig{
		IsPixelEnabled: cfg.IsPixelEnabled,
		IsGA4Enabled:   cfg.IsGA4Enabled,
		IsGTMEnabled:   cfg.IsGTMEnabled,
	}

	if cfg.IsPixelEnabled {
		pub.MetaPixelID = cfg.MetaPixelID
	}
	if cfg.IsGA4Enabled {
		pub.GA4MeasurementID = cfg.GA4MeasurementID
	}
	if cfg.IsGTMEnabled {
		pub.GTMContainerID = cfg.GTMContainerID
	}
	if cfg.GoogleAdsID != "" {
		pub.GoogleAdsID = cfg.GoogleAdsID
	}

	return pub, nil
}

// GetAdminConfig returns the complete marketing settings including redacted secrets for store managers.
func (s *Service) GetAdminConfig(ctx context.Context) (*MarketingConfig, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	cfg, err := s.repo.GetConfig(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}

	if cfg.MetaCAPIToken != "" {
		cfg.MetaCAPIToken = "••••••••••••"
	}
	return cfg, nil
}

// SaveAdminConfig updates store-level marketing credentials with AES encryption for the CAPI token.
func (s *Service) SaveAdminConfig(ctx context.Context, req *UpdateMarketingConfigRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
		return err
	}

	current, err := s.repo.GetConfig(ctx, stCtx.TenantDB)
	if err != nil {
		return err
	}

	encryptedToken := current.MetaCAPIToken
	newToken := strings.TrimSpace(req.MetaCAPIToken)
	if newToken != "" && newToken != "••••••••••••" && len(s.encryptionKey) > 0 {
		enc, err := crypto.EncryptAESGCM(newToken, s.encryptionKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt CAPI token: %w", err)
		}
		encryptedToken = enc
	}

	cfg := &MarketingConfig{
		ID:               "1",
		MetaPixelID:      strings.TrimSpace(req.MetaPixelID),
		MetaCAPIToken:    encryptedToken,
		MetaTestCode:     strings.TrimSpace(req.MetaTestCode),
		GA4MeasurementID: strings.TrimSpace(req.GA4MeasurementID),
		GTMContainerID:   strings.TrimSpace(req.GTMContainerID),
		GoogleAdsID:      strings.TrimSpace(req.GoogleAdsID),
		IsPixelEnabled:   req.IsPixelEnabled,
		IsCAPIEnabled:    req.IsCAPIEnabled,
		IsGA4Enabled:     req.IsGA4Enabled,
		IsGTMEnabled:     req.IsGTMEnabled,
	}

	return s.repo.SaveConfig(ctx, stCtx.TenantDB, cfg)
}

// DispatchPurchaseCAPI triggers an asynchronous non-blocking server-side Meta Purchase event.
func (s *Service) DispatchPurchaseCAPI(ctx context.Context, order *storeModels.Order, clientIP, userAgent, fbc, fbp string) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return
	}

	cfg, err := s.repo.GetConfig(ctx, stCtx.TenantDB)
	if err != nil || !cfg.IsCAPIEnabled || cfg.MetaPixelID == "" || cfg.MetaCAPIToken == "" {
		return
	}

	rawToken := cfg.MetaCAPIToken
	if len(s.encryptionKey) > 0 {
		if dec, err := crypto.DecryptAESGCM(rawToken, s.encryptionKey); err == nil {
			rawToken = dec
		}
	}

	event := CAPIEvent{
		EventName:      "Purchase",
		EventTime:      time.Now().Unix(),
		EventID:        order.OrderNumber, // Exact deduplication match with client pixel
		EventSourceURL: fmt.Sprintf("https://%s/order-confirmed/%s", stCtx.Domain, order.OrderNumber),
		ActionSource:   "website",
		UserData: CAPIUserData{
			EmailHash:       HashSHA256(order.CustomerEmail),
			PhoneHash:       NormalizeAndHashPhone(order.CustomerPhone),
			ClientIP:        clientIP,
			ClientUserAgent: userAgent,
			Fbc:             fbc,
			Fbp:             fbp,
		},
		CustomData: &CAPICustomData{
			Value:       order.TotalAmount,
			Currency:    order.Currency,
			ContentType: "product",
			OrderID:     order.OrderNumber,
		},
	}

	// Dispatch in non-blocking background goroutine to preserve checkout performance
	go func(pixelID, token, testCode string, ev CAPIEvent) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		if err := s.capiDispatcher.DispatchEvents(bgCtx, pixelID, token, testCode, []CAPIEvent{ev}); err != nil {
			slog.Default().Warn("Failed to dispatch Meta CAPI Purchase event", slog.String("error", err.Error()))
		}
	}(cfg.MetaPixelID, rawToken, cfg.MetaTestCode, event)
}
