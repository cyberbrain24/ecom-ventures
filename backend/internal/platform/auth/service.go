package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/hasher"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserSuspended      = errors.New("user account is suspended")
	ErrUserDeactivated    = errors.New("user account has been deactivated")
)

// Service coordinates platform user authentication and token issuance.
type Service struct {
	db             *sql.DB
	tokenManager   *pkgAuth.TokenManager
	sessionManager *SessionManager
}

// NewService instantiates the platform authentication service.
func NewService(db *sql.DB, tm *pkgAuth.TokenManager, sm *SessionManager) *Service {
	return &Service{
		db:             db,
		tokenManager:   tm,
		sessionManager: sm,
	}
}

// Login authenticates a platform administrator via email and password.
func (s *Service) Login(ctx context.Context, email, password, clientIP, userAgent string) (*pkgAuth.TokenPair, *models.PlatformUser, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, role, status, last_login_at, created_at, updated_at
		FROM platform_users
		WHERE email = LOWER(TRIM($1))
		LIMIT 1;`

	var user models.PlatformUser
	err := s.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.FirstName, &user.LastName,
		&user.Role, &user.Status, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil, ErrInvalidCredentials
	} else if err != nil {
		return nil, nil, fmt.Errorf("failed to query platform user: %w", err)
	}

	if user.Status == models.UserStatusSuspended {
		return nil, nil, ErrUserSuspended
	}
	if user.Status == models.UserStatusDeactivated {
		return nil, nil, ErrUserDeactivated
	}

	match, err := hasher.ComparePassword(password, user.PasswordHash)
	if err != nil || !match {
		return nil, nil, ErrInvalidCredentials
	}

	// Update last login timestamp and audit login
	now := time.Now().UTC()
	if _, err := s.db.ExecContext(ctx, "UPDATE platform_users SET last_login_at = $1 WHERE id = $2;", now, user.ID); err != nil {
		return nil, nil, fmt.Errorf("recording last login for user %s: %w", user.ID, err)
	}

	pair, err := s.tokenManager.GeneratePlatformTokenPair(user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	// Store refresh session in Redis; login fails closed when the session cannot be recorded.
	if err := s.sessionManager.StoreSession(ctx, user.ID, pair.RefreshToken, 7*24*time.Hour); err != nil {
		return nil, nil, fmt.Errorf("storing login session: %w", err)
	}

	return pair, &user, nil
}

// Refresh validates an existing refresh token and generates a new pair.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (*pkgAuth.TokenPair, error) {
	claims, err := s.tokenManager.VerifyToken(refreshToken)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != pkgAuth.TokenTypeRefresh || claims.UserType != pkgAuth.UserTypePlatform {
		return nil, pkgAuth.ErrInvalidToken
	}

	valid, err := s.sessionManager.ValidateSession(ctx, claims.UserID, refreshToken)
	if err != nil {
		return nil, fmt.Errorf("validating refresh session: %w", err)
	}
	if !valid {
		return nil, pkgAuth.ErrInvalidToken
	}

	pair, err := s.tokenManager.GeneratePlatformTokenPair(claims.UserID, claims.Email, claims.Role)
	if err != nil {
		return nil, err
	}

	if err := s.sessionManager.StoreSession(ctx, claims.UserID, pair.RefreshToken, 7*24*time.Hour); err != nil {
		return nil, fmt.Errorf("storing refreshed session: %w", err)
	}
	return pair, nil
}

// Logout terminates the platform user's session.
func (s *Service) Logout(ctx context.Context, userID string) error {
	return s.sessionManager.RevokeSession(ctx, userID)
}
