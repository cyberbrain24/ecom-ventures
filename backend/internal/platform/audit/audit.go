// Package audit writes platform audit log rows for administrative mutations.
// Callers pass the transaction that performs the mutation so that the change and its
// audit record commit or roll back together.
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"

	"ecom-ventures/backend/internal/middleware"
	pkgAuth "ecom-ventures/backend/pkg/auth"
)

const (
	maxClientIPLen  = 45
	maxUserAgentLen = 512
	unknownClientIP = "unknown"
)

var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// IsUUID reports whether s is a canonical UUID string. Path identifiers that fail this
// check can never match a row, so handlers answer 404 without querying the database.
func IsUUID(s string) bool {
	return uuidRegex.MatchString(s)
}

// Actor identifies who performed an administrative action.
type Actor struct {
	UserID    string
	Email     string
	IP        string
	UserAgent string
}

// ActorFromRequest builds the Actor from the authenticated JWT claims and the request.
// Missing claims yield an Actor with empty UserID and Email.
func ActorFromRequest(r *http.Request) Actor {
	a := Actor{IP: clientIP(r), UserAgent: truncate(r.UserAgent(), maxUserAgentLen)}
	if claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims); ok && claims != nil {
		a.UserID = claims.UserID
		a.Email = claims.Email
	}
	return a
}

func clientIP(r *http.Request) string {
	host := strings.TrimSpace(r.RemoteAddr)
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	if host == "" {
		return unknownClientIP
	}
	return truncate(host, maxClientIPLen)
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// Execer is satisfied by *sql.DB and *sql.Tx.
type Execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// Record inserts one audit_logs row. before and after are JSON-encoded when non-nil.
// audit_logs.user_id is a UUID column, so an actor whose ID is not a UUID is stored with a NULL user_id.
// storeID links the row to a store when the action concerns one; pass "" otherwise.
func Record(ctx context.Context, ex Execer, actor Actor, action, resourceType, resourceID, storeID string, before, after any) error {
	if ex == nil {
		return fmt.Errorf("audit: executor is nil")
	}
	beforeJSON, err := encode(before)
	if err != nil {
		return fmt.Errorf("encoding audit payload_before for %s: %w", action, err)
	}
	afterJSON, err := encode(after)
	if err != nil {
		return fmt.Errorf("encoding audit payload_after for %s: %w", action, err)
	}

	var userID, store sql.NullString
	if IsUUID(actor.UserID) {
		userID = sql.NullString{String: actor.UserID, Valid: true}
	}
	if IsUUID(storeID) {
		store = sql.NullString{String: storeID, Valid: true}
	}
	ip := actor.IP
	if ip == "" {
		ip = unknownClientIP
	}

	const query = `
		INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, store_id, payload_before, payload_after, client_ip, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10);`
	if _, err := ex.ExecContext(ctx, query,
		userID, actor.Email, action, resourceType, resourceID, store, beforeJSON, afterJSON, ip, actor.UserAgent,
	); err != nil {
		return fmt.Errorf("inserting audit log %s for %s %s: %w", action, resourceType, resourceID, err)
	}
	return nil
}

func encode(v any) (sql.NullString, error) {
	if v == nil {
		return sql.NullString{}, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return sql.NullString{}, err
	}
	return sql.NullString{String: string(b), Valid: true}, nil
}
