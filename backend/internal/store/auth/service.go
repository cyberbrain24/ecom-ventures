// Package auth manages isolated brand store staff authentication and authorizations.
package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/hasher"
)

var (
	ErrStoreStaffInvalidCredentials = errors.New("invalid email or password")
	ErrStoreStaffInactive           = errors.New("store staff account is inactive")
)

// StoreStaff represents a local administrative user inside a tenant database.
type StoreStaff struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Role         string     `json:"role"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Service manages staff login and token issuance strictly against the resolved StoreContext.
type Service struct {
	tokenManager *pkgAuth.TokenManager
}

// NewService instantiates store staff auth service.
func NewService(tm *pkgAuth.TokenManager) *Service {
	return &Service{tokenManager: tm}
}

// Login authenticates staff against the current store's isolated database.
func (s *Service) Login(ctx context.Context, email, password string) (*pkgAuth.TokenPair, *StoreStaff, error) {
	sc, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, nil, err
	}

	query := `
		SELECT id, email, password_hash, first_name, last_name, role, is_active, last_login_at, created_at, updated_at
		FROM store_staff
		WHERE email = LOWER(TRIM($1))
		LIMIT 1;`

	var staff StoreStaff
	err = sc.TenantDB.QueryRowContext(ctx, query, email).Scan(
		&staff.ID, &staff.Email, &staff.PasswordHash, &staff.FirstName, &staff.LastName,
		&staff.Role, &staff.IsActive, &staff.LastLoginAt, &staff.CreatedAt, &staff.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil, ErrStoreStaffInvalidCredentials
	} else if err != nil {
		return nil, nil, fmt.Errorf("failed to query store staff: %w", err)
	}

	if !staff.IsActive {
		return nil, nil, ErrStoreStaffInactive
	}

	match, err := hasher.ComparePassword(password, staff.PasswordHash)
	if err != nil || !match {
		return nil, nil, ErrStoreStaffInvalidCredentials
	}

	// Update last login in the store's database
	now := time.Now().UTC()
	_, _ = sc.TenantDB.ExecContext(ctx, "UPDATE store_staff SET last_login_at = $1 WHERE id = $2;", now, staff.ID)

	// Issue token containing the store ID and store slug claims
	pair, err := s.tokenManager.GenerateStoreTokenPair(staff.ID, staff.Email, staff.Role, sc.Store.ID, sc.Store.Slug)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate store token pair: %w", err)
	}

	return pair, &staff, nil
}
