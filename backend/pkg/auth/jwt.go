// Package auth manages cryptographic JSON Web Tokens (JWT) for both platform
// super-administrators and isolated store staff across Ecom Ventures.
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken = errors.New("auth: token is invalid or corrupted")
	ErrExpiredToken = errors.New("auth: token has expired")
)

// TokenType designates whether a token is for access or refresh purposes.
type TokenType string

const (
	TokenTypeAccess  TokenType = "ACCESS"
	TokenTypeRefresh TokenType = "REFRESH"
)

// UserType distinguishes platform operators from brand store staff.
type UserType string

const (
	UserTypePlatform UserType = "PLATFORM"
	UserTypeStore    UserType = "STORE"
)

// Claims represents the standardized JWT payload used across the platform.
type Claims struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	UserType  UserType  `json:"user_type"`
	StoreID   string    `json:"store_id,omitempty"`   // Empty for platform users; mandatory for store staff
	StoreSlug string    `json:"store_slug,omitempty"` // Store URL slug
	TokenType TokenType `json:"token_type"`
	jwt.RegisteredClaims
}

// TokenPair encapsulates newly generated access and refresh tokens.
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// TokenManager handles issuing and verifying JWT signatures.
type TokenManager struct {
	secretKey  []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewTokenManager instantiates a token manager with the provided HMAC secret.
func NewTokenManager(secretKey string, accessHours, refreshDays int) (*TokenManager, error) {
	if len(secretKey) < 32 {
		return nil, errors.New("auth: secret key must be at least 32 characters long")
	}
	return &TokenManager{
		secretKey:  []byte(secretKey),
		accessTTL:  time.Duration(accessHours) * time.Hour,
		refreshTTL: time.Duration(refreshDays) * 24 * time.Hour,
	}, nil
}

// GeneratePlatformTokenPair issues access and refresh tokens for platform users.
func (tm *TokenManager) GeneratePlatformTokenPair(userID, email, role string) (*TokenPair, error) {
	return tm.generatePair(userID, email, role, UserTypePlatform, "", "")
}

// GenerateStoreTokenPair issues access and refresh tokens for store-scoped staff.
func (tm *TokenManager) GenerateStoreTokenPair(userID, email, role, storeID, storeSlug string) (*TokenPair, error) {
	if storeID == "" {
		return nil, errors.New("auth: store_id cannot be empty for store token pair")
	}
	return tm.generatePair(userID, email, role, UserTypeStore, storeID, storeSlug)
}

func (tm *TokenManager) generatePair(userID, email, role string, uType UserType, storeID, storeSlug string) (*TokenPair, error) {
	now := time.Now().UTC()
	accessExpiry := now.Add(tm.accessTTL)

	// Build Access Token Claims
	accessClaims := &Claims{
		UserID:    userID,
		Email:     email,
		Role:      role,
		UserType:  uType,
		StoreID:   storeID,
		StoreSlug: storeSlug,
		TokenType: TokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			Issuer:    "ecom-ventures-auth",
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessString, err := accessToken.SignedString(tm.secretKey)
	if err != nil {
		return nil, fmt.Errorf("auth: failed to sign access token: %w", err)
	}

	// Build Refresh Token Claims
	refreshExpiry := now.Add(tm.refreshTTL)
	refreshClaims := &Claims{
		UserID:    userID,
		Email:     email,
		Role:      role,
		UserType:  uType,
		StoreID:   storeID,
		StoreSlug: storeSlug,
		TokenType: TokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(refreshExpiry),
			Issuer:    "ecom-ventures-auth",
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshToken.SignedString(tm.secretKey)
	if err != nil {
		return nil, fmt.Errorf("auth: failed to sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessString,
		RefreshToken: refreshString,
		ExpiresAt:    accessExpiry,
	}, nil
}

// VerifyToken validates token signature, expiration, and extracts claims.
func (tm *TokenManager) VerifyToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("auth: unexpected signing algorithm: %v", t.Header["alg"])
		}
		return tm.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
