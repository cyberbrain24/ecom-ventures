// Package middleware provides HTTP middlewares for logging, recovery, tenant resolution,
// authentication, CORS, and distributed rate limiting.
package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"ecom-ventures/backend/pkg/response"
)

// RateLimiterConfig defines threshold boundaries for a protected route tier.
type RateLimiterConfig struct {
	MaxRequests int           // Maximum permitted hits within window
	Window      time.Duration // Time window duration (e.g. 1 minute)
	TierName    string        // Identifier for logging and header tags
}

// Tier presets for multi-tenant protection
var (
	TierStorefrontPublic = RateLimiterConfig{MaxRequests: 120, Window: time.Minute, TierName: "STOREFRONT_PUBLIC"}
	TierCustomerCheckout = RateLimiterConfig{MaxRequests: 15, Window: time.Minute, TierName: "CUSTOMER_CHECKOUT"}
	TierStaffAuth        = RateLimiterConfig{MaxRequests: 10, Window: time.Minute, TierName: "STAFF_AUTH"}
)

// RateLimiter enforces distributed sliding-window request throttling.
type RateLimiter struct {
	redis *redis.Client
}

// NewRateLimiter instantiates the Redis rate limiter.
func NewRateLimiter(client *redis.Client) *RateLimiter {
	return &RateLimiter{redis: client}
}

// Limit returns an HTTP middleware enforcing rate thresholds based on client IP and route context.
func (rl *RateLimiter) Limit(cfg RateLimiterConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if rl.redis == nil {
				// Fail open if Redis is unconfigured, logging the condition
				next.ServeHTTP(w, r)
				return
			}

			clientIP := extractClientIP(r)
			host := r.Host
			now := time.Now()
			nowNano := now.UnixNano()
			windowStartNano := now.Add(-cfg.Window).UnixNano()

			// Redis key partitioned by tenant host and route tier to prevent cross-brand quota exhaustion
			rateLimitKey := fmt.Sprintf("ratelimit:%s:%s:%s", host, cfg.TierName, clientIP)

			ctx, cancel := context.WithTimeout(r.Context(), 1*time.Second)
			defer cancel()

			pipe := rl.redis.Pipeline()
			// 1. Remove expired requests outside the sliding window
			pipe.ZRemRangeByScore(ctx, rateLimitKey, "-inf", strconv.FormatInt(windowStartNano, 10))
			// 2. Count current hits within window
			cardCmd := pipe.ZCard(ctx, rateLimitKey)
			// 3. Add current request timestamp
			pipe.ZAdd(ctx, rateLimitKey, redis.Z{Score: float64(nowNano), Member: strconv.FormatInt(nowNano, 10)})
			// 4. Set key expiration to clear stale records
			pipe.Expire(ctx, rateLimitKey, cfg.Window*2)

			_, err := pipe.Exec(ctx)
			if err != nil {
				slog.Default().Warn("Redis rate limit query failed; failing open", slog.String("error", err.Error()))
				next.ServeHTTP(w, r)
				return
			}

			currentHits := int(cardCmd.Val())

			// Standard rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.MaxRequests))
			remaining := cfg.MaxRequests - currentHits
			if remaining < 0 {
				remaining = 0
			}
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))

			if currentHits >= cfg.MaxRequests {
				retryAfterSec := int(cfg.Window.Seconds())
				w.Header().Set("Retry-After", strconv.Itoa(retryAfterSec))
				response.Problem(w, r, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too Many Requests",
					fmt.Sprintf("Rate limit exceeded for %s. Please retry in %d seconds.", cfg.TierName, retryAfterSec))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func extractClientIP(r *http.Request) string {
	if xForwarded := r.Header.Get("X-Forwarded-For"); xForwarded != "" {
		parts := strings.Split(xForwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xRealIP := r.Header.Get("X-Real-IP"); xRealIP != "" {
		return strings.TrimSpace(xRealIP)
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}
