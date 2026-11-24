package storage_mgmt

import "time"

// StorageSettings represents platform storage configuration with sensitive secrets masked.
type StorageSettings struct {
	ID                 string     `json:"id"`
	Provider           string     `json:"provider"` // "local" or "cloudflare_r2"
	IsActive           bool       `json:"is_active"`
	AccountID          string     `json:"account_id"`
	BucketName         string     `json:"bucket_name"`
	AccessKeyID        string     `json:"access_key_id"`
	HasSecretAccessKey bool       `json:"has_secret_access_key"`
	PublicURL          string     `json:"public_url"`
	Region             string     `json:"region"`
	LocalBasePath      string     `json:"local_base_path"`
	LocalBaseURL       string     `json:"local_base_url"`
	LastTestedAt       *time.Time `json:"last_tested_at,omitempty"`
	LastTestStatus     string     `json:"last_test_status,omitempty"` // "CONNECTED" or "FAILED"
	LastTestError      string     `json:"last_test_error,omitempty"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// StorageSettingsInternal holds plaintext secrets in-memory after authenticated decryption.
type StorageSettingsInternal struct {
	ID                       string
	Provider                 string
	IsActive                 bool
	AccountID                string
	BucketName               string
	AccessKeyID              string
	SecretAccessKeyEncrypted string
	SecretAccessKeyPlain     string
	PublicURL                string
	Region                   string
	LocalBasePath            string
	LocalBaseURL             string
	LastTestedAt             *time.Time
	LastTestStatus           string
	LastTestError            string
	UpdatedAt                time.Time
}

// UpdateStorageSettingsRequest encapsulates user payload when saving storage configuration.
type UpdateStorageSettingsRequest struct {
	Provider        string `json:"provider"` // "local" or "cloudflare_r2"
	AccountID       string `json:"account_id"`
	BucketName      string `json:"bucket_name"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key,omitempty"` // Omit or empty to keep current secret
	PublicURL       string `json:"public_url"`
	Region          string `json:"region"`
}

// TestConnectionRequest encapsulates payload for testing Cloudflare R2 connectivity.
type TestConnectionRequest struct {
	AccountID       string `json:"account_id"`
	BucketName      string `json:"bucket_name"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"` // If empty, will use stored secret
	Region          string `json:"region"`
}

// TestConnectionResponse encapsulates results of R2 connectivity probe.
type TestConnectionResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	LatencyMs  int64  `json:"latency_ms"`
	BucketName string `json:"bucket_name"`
	TestedAt   string `json:"tested_at"`
}
