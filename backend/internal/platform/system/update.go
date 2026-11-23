package system

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"ecom-ventures/backend/internal/platform/audit"
	platformAuth "ecom-ventures/backend/internal/platform/auth"
	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/validation"
	"ecom-ventures/backend/pkg/hasher"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

var (
	// ErrAdminNotFound is returned when no platform user has the requested ID.
	ErrAdminNotFound = errors.New("system: platform administrator not found")
	// ErrAdminEmailTaken is returned when the new email belongs to another administrator.
	ErrAdminEmailTaken = errors.New("system: email is already used by another administrator")
	// ErrLastSuperAdmin is returned when a change would leave the platform without an active SUPER_ADMIN.
	ErrLastSuperAdmin = errors.New("system: the last active SUPER_ADMIN cannot be demoted, deactivated or deleted")
	// ErrCannotDeleteSelf is returned when an administrator tries to delete their own account.
	ErrCannotDeleteSelf = errors.New("system: an administrator cannot delete their own account")
	// ErrCannotModifyOwnAccess is returned when an administrator tries to demote, suspend or
	// deactivate their own account.
	ErrCannotModifyOwnAccess = errors.New("system: an administrator cannot demote, suspend or deactivate their own account")
)

const (
	roleSuperAdmin = string(models.RoleSuperAdmin)
	statusActive   = string(models.UserStatusActive)

	minAdminPasswordLen = 8
	maxAdminPasswordLen = 128
)

// SessionRevoker removes a user's stored Redis sessions. *platformAuth.SessionManager implements it
// and fails closed with ErrSessionStoreUnavailable when Redis is not configured.
type SessionRevoker interface {
	RevokeSession(ctx context.Context, userID string) error
}

// UpdateAdminRequest is the body of PATCH /platform/admins/{id}. Every field is optional and an
// absent field is left unchanged. Password, when present, is hashed with Argon2id and never returned.
type UpdateAdminRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Email     *string `json:"email"`
	Role      *string `json:"role"`
	Status    *string `json:"status"`
	Password  *string `json:"password"`
}

// adminRow is the stored state of a platform user that an edit or delete works on.
type adminRow struct {
	models.PlatformUser
	role   string
	status string
}

// normalizeUpdateAdmin trims and validates the request in place.
func normalizeUpdateAdmin(req *UpdateAdminRequest) error {
	var c validation.Collector
	editable := false

	name := func(field string, p **string) {
		if *p == nil {
			return
		}
		editable = true
		v := strings.TrimSpace(**p)
		if v == "" || len(v) > 100 {
			c.Add(field, field+" is required and must be at most 100 characters")
		}
		*p = &v
	}
	name("first_name", &req.FirstName)
	name("last_name", &req.LastName)

	if req.Email != nil {
		editable = true
		if v, ok := validation.Email(*req.Email); ok {
			req.Email = &v
		} else {
			c.Add("email", "email must be a valid email address of at most 255 characters")
		}
	}
	if req.Role != nil {
		editable = true
		v := strings.ToUpper(strings.TrimSpace(*req.Role))
		if v != roleSuperAdmin && v != string(models.RolePlatformStaff) {
			c.Add("role", "role must be SUPER_ADMIN or PLATFORM_STAFF")
		}
		req.Role = &v
	}
	if req.Status != nil {
		editable = true
		v := strings.ToUpper(strings.TrimSpace(*req.Status))
		switch models.PlatformUserStatus(v) {
		case models.UserStatusActive, models.UserStatusSuspended, models.UserStatusDeactivated:
		default:
			c.Add("status", "status must be ACTIVE, SUSPENDED or DEACTIVATED")
		}
		req.Status = &v
	}
	if req.Password != nil {
		editable = true
		if n := len(*req.Password); n < minAdminPasswordLen || n > maxAdminPasswordLen {
			c.Add("password", fmt.Sprintf("password must be %d to %d characters", minAdminPasswordLen, maxAdminPasswordLen))
		}
	}
	if !editable {
		c.Add("body", "at least one editable field is required: first_name, last_name, email, role, status or password")
	}
	return c.Err()
}

// guardLastSuperAdmin refuses a change that would leave no active SUPER_ADMIN.
// cur is the stored account; nextRole and nextStatus are its values after the change, both
// empty for a deletion. otherActiveSuperAdmins counts active SUPER_ADMINs other than cur.
func guardLastSuperAdmin(cur *adminRow, nextRole, nextStatus string, otherActiveSuperAdmins int) error {
	currentlyCounts := cur.role == roleSuperAdmin && cur.status == statusActive
	stillCounts := nextRole == roleSuperAdmin && nextStatus == statusActive
	if currentlyCounts && !stillCounts && otherActiveSuperAdmins == 0 {
		return ErrLastSuperAdmin
	}
	return nil
}

// guardOwnAccess refuses an administrator lowering their own access: a role change away from
// SUPER_ADMIN or a move away from ACTIVE. Other self-edits (name, email, password) are allowed.
func guardOwnAccess(actorID string, cur *adminRow, nextRole, nextStatus string) error {
	if !strings.EqualFold(actorID, cur.ID) {
		return nil
	}
	demoted := cur.role == roleSuperAdmin && nextRole != roleSuperAdmin
	leavesActive := cur.status == statusActive && nextStatus != statusActive
	if demoted || leavesActive {
		return ErrCannotModifyOwnAccess
	}
	return nil
}

// needsSessionRevocation reports whether an edit changes the account's access: a different
// role, a move away from ACTIVE, or a new password. Such edits end the user's sessions.
func needsSessionRevocation(cur *adminRow, nextRole, nextStatus string, passwordChanged bool) bool {
	return passwordChanged || nextRole != cur.role || (nextStatus != cur.status && nextStatus != statusActive)
}

// revokeSessions ends the user's sessions, failing closed when no session store is available.
func (s *Service) revokeSessions(ctx context.Context, userID string) error {
	if s.sessions == nil {
		return platformAuth.ErrSessionStoreUnavailable
	}
	if err := s.sessions.RevokeSession(ctx, userID); err != nil {
		return fmt.Errorf("revoking sessions of administrator %s: %w", userID, err)
	}
	return nil
}

// lockAdmin locks every active SUPER_ADMIN (in ID order, so concurrent edits cannot deadlock),
// then the target row, and returns the target and the number of other active SUPER_ADMINs.
// Locking the whole set makes two simultaneous demotions of different SUPER_ADMINs serialize,
// so the last-SUPER_ADMIN rule cannot be raced.
func lockAdmin(ctx context.Context, tx *sql.Tx, id string) (*adminRow, int, error) {
	rows, err := tx.QueryContext(ctx, `SELECT id FROM platform_users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' ORDER BY id FOR UPDATE;`)
	if err != nil {
		return nil, 0, fmt.Errorf("locking active super administrators: %w", err)
	}
	others := 0
	for rows.Next() {
		var sid string
		if err := rows.Scan(&sid); err != nil {
			_ = rows.Close()
			return nil, 0, fmt.Errorf("scanning active super administrator: %w", err)
		}
		if !strings.EqualFold(sid, id) {
			others++
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, 0, fmt.Errorf("iterating active super administrators: %w", err)
	}
	if err := rows.Close(); err != nil {
		return nil, 0, fmt.Errorf("closing super administrator cursor: %w", err)
	}

	var a adminRow
	err = tx.QueryRowContext(ctx, `
		SELECT id, email, first_name, last_name, role::text, status::text, last_login_at, created_at, updated_at
		FROM platform_users WHERE id = $1 FOR UPDATE;`, id,
	).Scan(&a.ID, &a.Email, &a.FirstName, &a.LastName, &a.role, &a.status, &a.LastLoginAt, &a.CreatedAt, &a.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, ErrAdminNotFound
	} else if err != nil {
		return nil, 0, fmt.Errorf("reading administrator %s: %w", id, err)
	}
	a.Role = models.PlatformUserRole(a.role)
	a.Status = models.PlatformUserStatus(a.status)
	return &a, others, nil
}

func adminAuditView(a *adminRow) map[string]string {
	return map[string]string{
		"email": a.Email, "first_name": a.FirstName, "last_name": a.LastName, "role": a.role, "status": a.status,
	}
}

// UpdateAdmin edits a platform administrator's name, email, role, status and password.
// It refuses to demote or deactivate the last active SUPER_ADMIN (ErrLastSuperAdmin).
// When the edit changes the account's access (role, a move away from ACTIVE, new password)
// the user's Redis sessions are revoked before the transaction commits; if that fails the
// edit is rolled back and the error is returned, including ErrSessionStoreUnavailable.
// The returned user never carries the password hash.
func (s *Service) UpdateAdmin(ctx context.Context, id string, req UpdateAdminRequest, actor audit.Actor) (*models.PlatformUser, error) {
	if err := normalizeUpdateAdmin(&req); err != nil {
		return nil, err
	}
	if !audit.IsUUID(id) {
		return nil, ErrAdminNotFound
	}
	if s.platformDB == nil {
		return nil, fmt.Errorf("system: platform database connection handle is nil")
	}

	var newHash sql.NullString
	if req.Password != nil {
		hashed, err := hasher.HashPassword(*req.Password)
		if err != nil {
			return nil, fmt.Errorf("hashing administrator password: %w", err)
		}
		newHash = sql.NullString{String: hashed, Valid: true}
	}

	tx, err := s.platformDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning administrator update transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	cur, others, err := lockAdmin(ctx, tx, id)
	if err != nil {
		return nil, err
	}

	next := *cur
	if req.FirstName != nil {
		next.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		next.LastName = *req.LastName
	}
	if req.Email != nil {
		next.Email = *req.Email
	}
	if req.Role != nil {
		next.role = *req.Role
	}
	if req.Status != nil {
		next.status = *req.Status
	}

	if err := guardOwnAccess(actor.UserID, cur, next.role, next.status); err != nil {
		return nil, err
	}
	if err := guardLastSuperAdmin(cur, next.role, next.status, others); err != nil {
		return nil, err
	}

	err = tx.QueryRowContext(ctx, `
		UPDATE platform_users
		SET first_name = $1, last_name = $2, email = $3, role = $4::platform_user_role,
		    status = $5::platform_user_status, password_hash = COALESCE($6, password_hash),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $7
		RETURNING updated_at;`,
		next.FirstName, next.LastName, next.Email, next.role, next.status, newHash, id,
	).Scan(&next.UpdatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, ErrAdminEmailTaken
		}
		return nil, fmt.Errorf("updating administrator %s: %w", id, err)
	}
	next.Role = models.PlatformUserRole(next.role)
	next.Status = models.PlatformUserStatus(next.status)

	after := adminAuditView(&next)
	after["password_changed"] = fmt.Sprintf("%t", newHash.Valid)
	if err := audit.Record(ctx, tx, actor, "STAFF_UPDATED", "platform_users", id, "", adminAuditView(cur), after); err != nil {
		return nil, fmt.Errorf("auditing administrator update: %w", err)
	}

	if needsSessionRevocation(cur, next.role, next.status, newHash.Valid) {
		if err := s.revokeSessions(ctx, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing administrator update: %w", err)
	}

	return &next.PlatformUser, nil
}

// DeleteAdmin permanently removes a platform administrator and revokes their Redis sessions.
// It refuses to delete the caller's own account (ErrCannotDeleteSelf) and the last active
// SUPER_ADMIN (ErrLastSuperAdmin). Session revocation fails closed: if Redis is unavailable
// the delete is rolled back and the error is returned.
func (s *Service) DeleteAdmin(ctx context.Context, id string, actor audit.Actor) error {
	if !audit.IsUUID(id) {
		return ErrAdminNotFound
	}
	if strings.EqualFold(actor.UserID, id) {
		return ErrCannotDeleteSelf
	}
	if s.platformDB == nil {
		return fmt.Errorf("system: platform database connection handle is nil")
	}

	tx, err := s.platformDB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning administrator delete transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	cur, others, err := lockAdmin(ctx, tx, id)
	if err != nil {
		return err
	}
	if err := guardLastSuperAdmin(cur, "", "", others); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM platform_users WHERE id = $1;`, id); err != nil {
		return fmt.Errorf("deleting administrator %s: %w", id, err)
	}
	if err := audit.Record(ctx, tx, actor, "STAFF_DELETED", "platform_users", id, "", adminAuditView(cur), nil); err != nil {
		return fmt.Errorf("auditing administrator delete: %w", err)
	}
	if err := s.revokeSessions(ctx, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing administrator delete: %w", err)
	}
	return nil
}

// writeAdminError maps administrator service errors to RFC 7807 responses.
func writeAdminError(w http.ResponseWriter, r *http.Request, err error, op string) {
	if validation.Write(w, r, err) {
		return
	}
	switch {
	case errors.Is(err, ErrAdminNotFound):
		response.NotFound(w, r, "Administrator not found.")
	case errors.Is(err, ErrAdminEmailTaken):
		response.Problem(w, r, http.StatusConflict, "EMAIL_ALREADY_EXISTS", "Conflict", "Another administrator already uses this email.")
	case errors.Is(err, ErrLastSuperAdmin):
		response.Problem(w, r, http.StatusConflict, "LAST_SUPER_ADMIN", "Conflict", "The last active SUPER_ADMIN cannot be demoted, deactivated or deleted. Promote another administrator first.")
	case errors.Is(err, ErrCannotDeleteSelf):
		response.Problem(w, r, http.StatusConflict, "CANNOT_DELETE_SELF", "Conflict", "You cannot delete your own administrator account.")
	case errors.Is(err, ErrCannotModifyOwnAccess):
		response.Problem(w, r, http.StatusConflict, "CANNOT_MODIFY_OWN_ACCESS", "Conflict", "You cannot demote, suspend or deactivate your own administrator account.")
	case errors.Is(err, platformAuth.ErrSessionStoreUnavailable):
		response.Problem(w, r, http.StatusServiceUnavailable, "SESSION_STORE_UNAVAILABLE", "Service Unavailable", "The session store (Redis) is unavailable, so the administrator's sessions cannot be revoked. No change was made.")
	default:
		slog.ErrorContext(r.Context(), "system: administrator "+op+" failed", slog.String("error", err.Error()))
		response.InternalServerError(w, r)
	}
}

// UpdateAdmin handles PATCH /api/v1/platform/admins/{id} (SUPER_ADMIN only).
// Unknown administrator: 404. Invalid input: 422. Last SUPER_ADMIN or duplicate email: 409.
func (h *Handler) UpdateAdmin(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Missing admin ID.")
		return
	}

	var req UpdateAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON.")
		return
	}

	user, err := h.service.UpdateAdmin(r.Context(), id, req, audit.ActorFromRequest(r))
	if err != nil {
		writeAdminError(w, r, err, "update")
		return
	}
	response.JSON(w, http.StatusOK, user)
}

// DeleteAdmin handles DELETE /api/v1/platform/admins/{id} (SUPER_ADMIN only).
// Own account or last SUPER_ADMIN: 409. Unknown administrator: 404. Redis unavailable: 503.
func (h *Handler) DeleteAdmin(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Missing admin ID.")
		return
	}

	if err := h.service.DeleteAdmin(r.Context(), id, audit.ActorFromRequest(r)); err != nil {
		writeAdminError(w, r, err, "delete")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Administrator deleted."})
}
