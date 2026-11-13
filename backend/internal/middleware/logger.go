package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// responseWriterInterceptor captures the HTTP status code and response size.
type responseWriterInterceptor struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int64
}

func (w *responseWriterInterceptor) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *responseWriterInterceptor) Write(b []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytesWritten += int64(n)
	return n, err
}

// StructuredLogger logs every incoming HTTP request as structured JSON via log/slog.
func StructuredLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			startTime := time.Now()
			reqID := GetRequestID(r.Context())

			interceptor := &responseWriterInterceptor{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(interceptor, r)

			duration := time.Since(startTime)
			status := interceptor.statusCode

			level := slog.LevelInfo
			if status >= 400 && status < 500 {
				level = slog.LevelWarn
			} else if status >= 500 {
				level = slog.LevelError
			}

			logger.Log(r.Context(), level, "HTTP request handled",
				slog.String("request_id", reqID),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.String("query", r.URL.RawQuery),
				slog.String("remote_ip", r.RemoteAddr),
				slog.String("host", r.Host),
				slog.Int("status", status),
				slog.Int64("bytes_sent", interceptor.bytesWritten),
				slog.Duration("latency", duration),
				slog.String("user_agent", r.UserAgent()),
			)
		})
	}
}
