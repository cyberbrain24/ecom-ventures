package storage_mgmt

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Repository handles database operations for platform storage configurations.
type Repository struct {
	db *sql.DB
}

// NewRepository initializes the storage settings repository.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// EnsureTable creates the platform_storage_settings table and default row if not yet migrated.
func (r *Repository) EnsureTable(ctx context.Context) error {
	query := `
	CREATE TABLE IF NOT EXISTS platform_storage_settings (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		provider VARCHAR(50) NOT NULL DEFAULT 'local',
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		account_id VARCHAR(255) NOT NULL DEFAULT '',
		bucket_name VARCHAR(255) NOT NULL DEFAULT '',
		access_key_id VARCHAR(255) NOT NULL DEFAULT '',
		secret_access_key_encrypted TEXT NOT NULL DEFAULT '',
		public_url VARCHAR(500) NOT NULL DEFAULT '',
		region VARCHAR(50) NOT NULL DEFAULT 'auto',
		local_base_path VARCHAR(255) NOT NULL DEFAULT './uploads',
		local_base_url VARCHAR(500) NOT NULL DEFAULT 'http://localhost:8080/uploads',
		last_tested_at TIMESTAMP WITH TIME ZONE,
		last_test_status VARCHAR(50),
		last_test_error TEXT,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	INSERT INTO platform_storage_settings (
		id, provider, is_active, local_base_path, local_base_url
	) VALUES (
		'00000000-0000-0000-0000-000000000001', 'local', TRUE, './uploads', 'http://localhost:8080/uploads'
	) ON CONFLICT (id) DO NOTHING;
	`
	_, err := r.db.ExecContext(ctx, query)
	return err
}

// GetSettings retrieves the active platform storage configuration record.
func (r *Repository) GetSettings(ctx context.Context) (*StorageSettingsInternal, error) {
	query := `
	SELECT id, provider, is_active, account_id, bucket_name, access_key_id,
	       secret_access_key_encrypted, public_url, region, local_base_path,
	       local_base_url, last_tested_at, last_test_status, last_test_error, updated_at
	FROM platform_storage_settings
	ORDER BY created_at ASC
	LIMIT 1
	`
	var s StorageSettingsInternal
	var lastTestedAt sql.NullTime
	var lastTestStatus, lastTestError sql.NullString

	err := r.db.QueryRowContext(ctx, query).Scan(
		&s.ID, &s.Provider, &s.IsActive, &s.AccountID, &s.BucketName, &s.AccessKeyID,
		&s.SecretAccessKeyEncrypted, &s.PublicURL, &s.Region, &s.LocalBasePath,
		&s.LocalBaseURL, &lastTestedAt, &lastTestStatus, &lastTestError, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("platform storage settings not initialized")
		}
		return nil, fmt.Errorf("failed to query storage settings: %w", err)
	}

	if lastTestedAt.Valid {
		s.LastTestedAt = &lastTestedAt.Time
	}
	if lastTestStatus.Valid {
		s.LastTestStatus = lastTestStatus.String
	}
	if lastTestError.Valid {
		s.LastTestError = lastTestError.String
	}

	return &s, nil
}

// UpdateSettings updates the storage provider and credentials.
func (r *Repository) UpdateSettings(ctx context.Context, id, provider, accountID, bucketName, accessKeyID, encryptedSecret, publicURL, region string) error {
	query := `
	UPDATE platform_storage_settings
	SET provider = $2,
	    account_id = $3,
	    bucket_name = $4,
	    access_key_id = $5,
	    secret_access_key_encrypted = CASE WHEN $6 <> '' THEN $6 ELSE secret_access_key_encrypted END,
	    public_url = $7,
	    region = $8,
	    updated_at = CURRENT_TIMESTAMP
	WHERE id = $1
	`
	res, err := r.db.ExecContext(ctx, query, id, provider, accountID, bucketName, accessKeyID, encryptedSecret, publicURL, region)
	if err != nil {
		return fmt.Errorf("failed to update storage settings: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("no storage settings record updated")
	}
	return nil
}

// RecordTestResult updates the latest connectivity verification status in the database.
func (r *Repository) RecordTestResult(ctx context.Context, id string, status string, errMsg string) error {
	query := `
	UPDATE platform_storage_settings
	SET last_tested_at = CURRENT_TIMESTAMP,
	    last_test_status = $2,
	    last_test_error = $3,
	    updated_at = CURRENT_TIMESTAMP
	WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, id, status, errMsg)
	return err
}

// ResetToLocal resets provider back to local storage and clears credentials.
func (r *Repository) ResetToLocal(ctx context.Context, id string) error {
	query := `
	UPDATE platform_storage_settings
	SET provider = 'local',
	    last_test_status = NULL,
	    last_test_error = NULL,
	    updated_at = CURRENT_TIMESTAMP
	WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
