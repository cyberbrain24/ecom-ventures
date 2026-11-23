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

// StoreIdentity is the public description of the store a staff member is signed in to.
// It carries registry metadata only: no database coordinates and no credentials.
type StoreIdentity struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	Status        string `json:"status"`
	LogoURL       string `json:"logo_url"`
	Currency      string `json:"currency"`
	Timezone      string `json:"timezone"`
	PrimaryDomain string `json:"primary_domain"`
}

// Service manages staff login and token issuance strictly against the resolved StoreContext.
type Service struct {
	tokenManager *pkgAuth.TokenManager
	platformDB   *sql.DB
}

// NewService instantiates store staff auth service. platformDB is used only to read the
// store's own primary domain from the registry; it may be nil, in which case the primary
// domain is reported as empty.
func NewService(tm *pkgAuth.TokenManager, platformDB *sql.DB) *Service {
	return &Service{tokenManager: tm, platformDB: platformDB}
}

// StoreIdentity returns the identity of the store resolved for this request.
// Tenant isolation: the store comes from the request's StoreContext, and the domain
// lookup is filtered by that store's ID.
func (s *Service) StoreIdentity(ctx context.Context) (*StoreIdentity, error) {
	sc, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	identity := &StoreIdentity{
		ID:       sc.Store.ID,
		Name:     sc.Store.Name,
		Slug:     sc.Store.Slug,
		Status:   string(sc.Store.Status),
		LogoURL:  sc.Store.LogoURL,
		Currency: sc.Store.Currency,
		Timezone: sc.Store.Timezone,
	}

	if s.platformDB != nil {
		var domain string
		err := s.platformDB.QueryRowContext(ctx, `
			SELECT domain FROM domains
			WHERE store_id = $1
			ORDER BY is_primary DESC, created_at ASC
			LIMIT 1;`, sc.Store.ID).Scan(&domain)
		if err != nil && err != sql.ErrNoRows {
			return nil, fmt.Errorf("failed to query primary domain for store %s: %w", sc.Store.Slug, err)
		}
		identity.PrimaryDomain = domain
	}

	return identity, nil
}

// GetActiveStaff loads a staff member of the current store by ID. It returns
// ErrStoreStaffInvalidCredentials when the account no longer exists and
// ErrStoreStaffInactive when it has been disabled.
func (s *Service) GetActiveStaff(ctx context.Context, staffID string) (*StoreStaff, error) {
	sc, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	var staff StoreStaff
	err = sc.TenantDB.QueryRowContext(ctx, `
		SELECT id, email, first_name, last_name, role, is_active
		FROM store_staff
		WHERE id = $1
		LIMIT 1;`, staffID).Scan(
		&staff.ID, &staff.Email, &staff.FirstName, &staff.LastName, &staff.Role, &staff.IsActive,
	)
	if err == sql.ErrNoRows {
		return nil, ErrStoreStaffInvalidCredentials
	} else if err != nil {
		return nil, fmt.Errorf("failed to query store staff %s: %w", staffID, err)
	}
	if !staff.IsActive {
		return nil, ErrStoreStaffInactive
	}
	return &staff, nil
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
