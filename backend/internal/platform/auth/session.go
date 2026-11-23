// Package auth manages platform-level administrator authentication, sessions, and RBAC.
package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	redisPrefixSession   = "session:user:"
	redisPrefixBlacklist = "blacklist:token:"
)

// ErrSessionStoreUnavailable is returned when no Redis session store is configured.
// Sessions fail closed: nothing is stored and nothing is reported as valid.
var ErrSessionStoreUnavailable = errors.New("auth: session store unavailable (Redis is not configured)")

// SessionManager stores active user sessions in Redis and handles token revocation.
type SessionManager struct {
	redisClient *redis.Client
}

// NewSessionManager instantiates a session manager.
func NewSessionManager(redisClient *redis.Client) *SessionManager {
	return &SessionManager{redisClient: redisClient}
}

// StoreSession records an active refresh token in Redis mapped to user ID.
// It returns ErrSessionStoreUnavailable when Redis is not configured.
func (sm *SessionManager) StoreSession(ctx context.Context, userID, refreshToken string, ttl time.Duration) error {
	if sm == nil || sm.redisClient == nil {
		return ErrSessionStoreUnavailable
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	if err := sm.redisClient.Set(ctx, key, refreshToken, ttl).Err(); err != nil {
		return fmt.Errorf("auth: storing session in redis: %w", err)
	}
	return nil
}

// ValidateSession verifies if the presented refresh token matches the active session.
// It fails closed: without a session store it returns ErrSessionStoreUnavailable, never true.
func (sm *SessionManager) ValidateSession(ctx context.Context, userID, refreshToken string) (bool, error) {
	if sm == nil || sm.redisClient == nil {
		return false, ErrSessionStoreUnavailable
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	savedToken, err := sm.redisClient.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	} else if err != nil {
		return false, fmt.Errorf("auth: reading session from redis: %w", err)
	}
	return savedToken == refreshToken, nil
}

// RevokeSession removes the active refresh token session for a user.
// It returns ErrSessionStoreUnavailable when Redis is not configured.
func (sm *SessionManager) RevokeSession(ctx context.Context, userID string) error {
	if sm == nil || sm.redisClient == nil {
		return ErrSessionStoreUnavailable
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	if err := sm.redisClient.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("auth: revoking session in redis: %w", err)
	}
	return nil
}

// SessionActive reports whether the user still has a stored session. It is the access-token
// liveness check: logout, refresh-session revocation, admin deletion, suspension and demotion
// all delete the session key. It fails closed: without a session store it returns
// ErrSessionStoreUnavailable, never true.
func (sm *SessionManager) SessionActive(ctx context.Context, userID string) (bool, error) {
	if sm == nil || sm.redisClient == nil {
		return false, ErrSessionStoreUnavailable
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	n, err := sm.redisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("auth: checking session in redis: %w", err)
	}
	return n > 0, nil
}
