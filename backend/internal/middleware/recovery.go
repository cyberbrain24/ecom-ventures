package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"ecom-ventures/backend/pkg/response"
)

// Recoverer catches unhandled panics, logs stack traces via slog, and writes an RFC 7807 500 error.
func Recoverer(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rvr := recover(); rvr != nil {
					reqID := GetRequestID(r.Context())
					stack := string(debug.Stack())

					logger.Error("Unhandled panic intercepted in HTTP pipeline",
						slog.String("request_id", reqID),
						slog.String("panic", fmt.Sprintf("%v", rvr)),
						slog.String("stack_trace", stack),
						slog.String("path", r.URL.Path),
						slog.String("method", r.Method),
					)

					response.InternalServerError(w, r)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}
