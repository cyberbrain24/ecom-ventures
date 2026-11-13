// Package auth manages platform-level administrator authentication, sessions, and RBAC.
package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	redisPrefixSession   = "session:user:"
	redisPrefixBlacklist = "blacklist:token:"
)

// SessionManager stores active user sessions in Redis and handles token revocation.
type SessionManager struct {
	redisClient *redis.Client
}

// NewSessionManager instantiates a session manager.
func NewSessionManager(redisClient *redis.Client) *SessionManager {
	return &SessionManager{redisClient: redisClient}
}

// StoreSession records an active refresh token in Redis mapped to user ID.
func (sm *SessionManager) StoreSession(ctx context.Context, userID, refreshToken string, ttl time.Duration) error {
	if sm.redisClient == nil {
		return nil
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	return sm.redisClient.Set(ctx, key, refreshToken, ttl).Err()
}

// ValidateSession verifies if the presented refresh token matches the active session.
func (sm *SessionManager) ValidateSession(ctx context.Context, userID, refreshToken string) (bool, error) {
	if sm.redisClient == nil {
		return true, nil // Degraded fallback if Redis is disabled locally
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	savedToken, err := sm.redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	} else if err != nil {
		return false, err
	}
	return savedToken == refreshToken, nil
}

// RevokeSession removes the active refresh token session for a user.
func (sm *SessionManager) RevokeSession(ctx context.Context, userID string) error {
	if sm.redisClient == nil {
		return nil
	}
	key := fmt.Sprintf("%s%s", redisPrefixSession, userID)
	return sm.redisClient.Del(ctx, key).Err()
}
