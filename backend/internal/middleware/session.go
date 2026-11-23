package middleware

import (
	"context"
	"log/slog"
	"net/http"

	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

// PlatformSessionChecker reports whether a platform user still has a live session.
// *auth.SessionManager implements it.
type PlatformSessionChecker interface {
	SessionActive(ctx context.Context, userID string) (bool, error)
}

// RequireActivePlatformSession rejects platform access tokens whose session was revoked
// (logout, admin deleted, suspended, deactivated, demoted or password changed). It must run
// after Authenticate. Tokens of other user types pass through untouched. It fails closed:
// when the session store is unavailable or errors, the answer is 503, never a pass.
func RequireActivePlatformSession(sessions PlatformSessionChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(AuthClaimsKey).(*pkgAuth.Claims)
			if !ok || claims == nil {
				response.Unauthorized(w, r, "Authentication token required.")
				return
			}
			if claims.UserType != pkgAuth.UserTypePlatform {
				next.ServeHTTP(w, r)
				return
			}

			active, err := sessions.SessionActive(r.Context(), claims.UserID)
			if err != nil {
				slog.ErrorContext(r.Context(), "middleware: platform session check failed", slog.String("error", err.Error()))
				response.Problem(w, r, http.StatusServiceUnavailable, "SESSION_STORE_UNAVAILABLE", "Service Unavailable", "The session store is unavailable. Try again shortly.")
				return
			}
			if !active {
				response.Unauthorized(w, r, "Your session has ended. Sign in again.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
