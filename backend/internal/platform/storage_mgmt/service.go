package storage_mgmt

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"ecom-ventures/backend/pkg/crypto"
	"ecom-ventures/backend/pkg/storage"
)

// Service coordinates platform storage configurations and dynamic driver lifecycle.
type Service struct {
	repo            *Repository
	dynamicProvider *storage.DynamicStorageProvider
	encryptionKey   []byte
	localBaseDir    string
	localBaseURL    string
}

// NewService instantiates the storage management service.
func NewService(
	repo *Repository,
	dynamicProvider *storage.DynamicStorageProvider,
	encryptionKey []byte,
	localBaseDir string,
	localBaseURL string,
) *Service {
	return &Service{
		repo:            repo,
		dynamicProvider: dynamicProvider,
		encryptionKey:   encryptionKey,
		localBaseDir:    localBaseDir,
		localBaseURL:    localBaseURL,
	}
}

// InitializeFromDB loads saved credentials on server boot and hot-swaps dynamic driver if R2 is active.
func (s *Service) InitializeFromDB(ctx context.Context) error {
	_ = s.repo.EnsureTable(ctx)
	settings, err := s.repo.GetSettings(ctx)
	if err != nil {
		return err
	}

	if settings.Provider == "cloudflare_r2" && settings.AccountID != "" && settings.BucketName != "" && settings.AccessKeyID != "" && settings.SecretAccessKeyEncrypted != "" {
		secretKey, err := crypto.Decrypt(settings.SecretAccessKeyEncrypted, s.encryptionKey)
		if err == nil && secretKey != "" {
			r2, err := storage.NewR2Storage(storage.R2Config{
				AccountID:       settings.AccountID,
				BucketName:      settings.BucketName,
				AccessKeyID:     settings.AccessKeyID,
				SecretAccessKey: secretKey,
				PublicURL:       settings.PublicURL,
				Region:          settings.Region,
			})
			if err == nil {
				s.dynamicProvider.UpdateProvider(r2, "cloudflare_r2")
			}
		}
	}
	return nil
}

// GetSettings retrieves the current storage settings with secrets masked.
func (s *Service) GetSettings(ctx context.Context) (*StorageSettings, error) {
	internal, err := s.repo.GetSettings(ctx)
	if err != nil {
		return nil, err
	}

	activeName := s.dynamicProvider.GetProviderName()

	return &StorageSettings{
		ID:                 internal.ID,
		Provider:           activeName,
		IsActive:           internal.IsActive,
		AccountID:          internal.AccountID,
		BucketName:         internal.BucketName,
		AccessKeyID:        internal.AccessKeyID,
		HasSecretAccessKey: internal.SecretAccessKeyEncrypted != "",
		PublicURL:          internal.PublicURL,
		Region:             internal.Region,
		LocalBasePath:      internal.LocalBasePath,
		LocalBaseURL:       internal.LocalBaseURL,
		LastTestedAt:       internal.LastTestedAt,
		LastTestStatus:     internal.LastTestStatus,
		LastTestError:      internal.LastTestError,
		UpdatedAt:          internal.UpdatedAt,
	}, nil
}

// UpdateSettings validates, saves, and hot-swaps storage configuration in real-time.
func (s *Service) UpdateSettings(ctx context.Context, req UpdateStorageSettingsRequest) (*StorageSettings, error) {
	internal, err := s.repo.GetSettings(ctx)
	if err != nil {
		return nil, err
	}

	provider := strings.TrimSpace(req.Provider)
	if provider != "local" && provider != "cloudflare_r2" {
		return nil, errors.New("invalid provider: must be 'local' or 'cloudflare_r2'")
	}

	accountID := strings.TrimSpace(req.AccountID)
	bucketName := strings.TrimSpace(req.BucketName)
	accessKeyID := strings.TrimSpace(req.AccessKeyID)
	publicURL := strings.TrimSpace(req.PublicURL)
	region := strings.TrimSpace(req.Region)
	if region == "" {
		region = "auto"
	}

	var encryptedSecret string
	var plainSecret string

	if provider == "cloudflare_r2" {
		if accountID == "" || bucketName == "" || accessKeyID == "" {
			return nil, errors.New("Account ID, Bucket Name, and Access Key ID are required for Cloudflare R2")
		}

		if req.SecretAccessKey != "" {
			plainSecret = strings.TrimSpace(req.SecretAccessKey)
			enc, err := crypto.Encrypt(plainSecret, s.encryptionKey)
			if err != nil {
				return nil, fmt.Errorf("failed to encrypt secret access key: %w", err)
			}
			encryptedSecret = enc
		} else {
			// Reuse existing encrypted secret
			if internal.SecretAccessKeyEncrypted == "" {
				return nil, errors.New("Secret Access Key is required for new Cloudflare R2 configuration")
			}
			encryptedSecret = internal.SecretAccessKeyEncrypted
			dec, err := crypto.Decrypt(encryptedSecret, s.encryptionKey)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt existing secret key: %w", err)
			}
			plainSecret = dec
		}

		// Initialize and test R2 client
		r2, err := storage.NewR2Storage(storage.R2Config{
			AccountID:       accountID,
			BucketName:      bucketName,
			AccessKeyID:     accessKeyID,
			SecretAccessKey: plainSecret,
			PublicURL:       publicURL,
			Region:          region,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to configure Cloudflare R2: %w", err)
		}

		// Verify connection
		if err := r2.TestConnection(ctx); err != nil {
			_ = s.repo.RecordTestResult(ctx, internal.ID, "FAILED", err.Error())
			return nil, fmt.Errorf("Cloudflare R2 connection test failed: %w", err)
		}

		// Hot-swap active driver
		s.dynamicProvider.UpdateProvider(r2, "cloudflare_r2")
		_ = s.repo.RecordTestResult(ctx, internal.ID, "CONNECTED", "")
	} else {
		// Switch to local disk storage
		local, err := storage.NewLocalStorage(s.localBaseDir, s.localBaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize local storage: %w", err)
		}
		s.dynamicProvider.UpdateProvider(local, "local")
	}

	// Update DB record
	if err := s.repo.UpdateSettings(ctx, internal.ID, provider, accountID, bucketName, accessKeyID, encryptedSecret, publicURL, region); err != nil {
		return nil, err
	}

	return s.GetSettings(ctx)
}

// TestConnection executes a live connectivity check against Cloudflare R2 without saving.
func (s *Service) TestConnection(ctx context.Context, req TestConnectionRequest) (*TestConnectionResponse, error) {
	internal, err := s.repo.GetSettings(ctx)
	if err != nil {
		return nil, err
	}

	accountID := strings.TrimSpace(req.AccountID)
	bucketName := strings.TrimSpace(req.BucketName)
	accessKeyID := strings.TrimSpace(req.AccessKeyID)
	secretKey := strings.TrimSpace(req.SecretAccessKey)
	region := strings.TrimSpace(req.Region)
	if region == "" {
		region = "auto"
	}

	if accountID == "" || bucketName == "" || accessKeyID == "" {
		return nil, errors.New("Account ID, Bucket Name, and Access Key ID are required to test connection")
	}

	if secretKey == "" {
		if internal.SecretAccessKeyEncrypted == "" {
			return nil, errors.New("Secret Access Key is required for connection testing")
		}
		dec, err := crypto.Decrypt(internal.SecretAccessKeyEncrypted, s.encryptionKey)
		if err != nil {
			return nil, errors.New("failed to decrypt saved secret access key")
		}
		secretKey = dec
	}

	r2, err := storage.NewR2Storage(storage.R2Config{
		AccountID:       accountID,
		BucketName:      bucketName,
		AccessKeyID:     accessKeyID,
		SecretAccessKey: secretKey,
		Region:          region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize R2 client: %w", err)
	}

	start := time.Now()
	testErr := r2.TestConnection(ctx)
	latency := time.Since(start).Milliseconds()

	if testErr != nil {
		_ = s.repo.RecordTestResult(ctx, internal.ID, "FAILED", testErr.Error())
		return &TestConnectionResponse{
			Success:    false,
			Message:    testErr.Error(),
			LatencyMs:  latency,
			BucketName: bucketName,
			TestedAt:   time.Now().UTC().Format(time.RFC3339),
		}, testErr
	}

	_ = s.repo.RecordTestResult(ctx, internal.ID, "CONNECTED", "")
	return &TestConnectionResponse{
		Success:    true,
		Message:    fmt.Sprintf("Successfully connected to Cloudflare R2 bucket '%s' in %dms", bucketName, latency),
		LatencyMs:  latency,
		BucketName: bucketName,
		TestedAt:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// ResetToLocal reverts the platform storage driver to local filesystem storage.
func (s *Service) ResetToLocal(ctx context.Context) error {
	internal, err := s.repo.GetSettings(ctx)
	if err != nil {
		return err
	}

	local, err := storage.NewLocalStorage(s.localBaseDir, s.localBaseURL)
	if err != nil {
		return fmt.Errorf("failed to initialize local storage: %w", err)
	}

	s.dynamicProvider.UpdateProvider(local, "local")
	return s.repo.ResetToLocal(ctx, internal.ID)
}

// UploadTestAsset uploads a sample image to verify end-to-end file persistence in the active storage driver.
func (s *Service) UploadTestAsset(ctx context.Context, filename, contentType string, reader io.Reader, size int64) (*storage.UploadResult, error) {
	folder := storage.BuildPlatformPath(storage.ModulePlatformBranding, "test-probes")
	return s.dynamicProvider.Save(ctx, folder, filename, contentType, reader, size)
}

// GetDynamicProvider returns the thread-safe dynamic storage provider.
func (s *Service) GetDynamicProvider() *storage.DynamicStorageProvider {
	return s.dynamicProvider
}
