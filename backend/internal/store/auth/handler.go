package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"ecom-ventures/backend/internal/middleware"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

type StoreLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Handler manages store staff auth endpoints.
type Handler struct {
	service *Service
}

// NewHandler instantiates store staff handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Login handles POST /api/v1/store/{store_slug}/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req StoreLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	if req.Email == "" || req.Password == "" {
		response.ValidationProblem(w, r, []response.ValidationErrorDetail{
			{Field: "email", Message: "Email is required"},
			{Field: "password", Message: "Password is required"},
		})
		return
	}

	tokens, staff, err := h.service.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrStoreStaffInvalidCredentials) {
			response.Unauthorized(w, r, "Invalid store email or password.")
			return
		}
		if errors.Is(err, ErrStoreStaffInactive) {
			response.Problem(w, r, http.StatusForbidden, "ACCOUNT_INACTIVE", "Account Inactive", "Your staff access has been disabled by the store owner.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	store, err := h.service.StoreIdentity(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"tokens": tokens,
		"staff":  staffPayload(staff),
		"store":  store,
	})
}

// Me handles GET /api/v1/store/{store_slug}/auth/me.
// It confirms that the bearer token is still valid for this store and returns the
// signed-in staff member together with the store identity. The route must be mounted
// behind Authenticate and RequireStoreRole, which reject tokens issued for another store.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	if !ok || claims == nil {
		response.Unauthorized(w, r, "Invalid session.")
		return
	}

	store, err := h.service.StoreIdentity(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	// A platform super admin may inspect any store and has no row in store_staff.
	if claims.UserType != "STORE" {
		response.JSON(w, http.StatusOK, map[string]interface{}{
			"staff": map[string]interface{}{
				"id":         claims.UserID,
				"email":      claims.Email,
				"first_name": "",
				"last_name":  "",
				"role":       claims.Role,
			},
			"store": store,
		})
		return
	}

	staff, err := h.service.GetActiveStaff(r.Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, ErrStoreStaffInvalidCredentials) {
			response.Unauthorized(w, r, "This staff account no longer exists.")
			return
		}
		if errors.Is(err, ErrStoreStaffInactive) {
			response.Problem(w, r, http.StatusForbidden, "ACCOUNT_INACTIVE", "Account Inactive", "Your staff access has been disabled by the store owner.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"staff": staffPayload(staff),
		"store": store,
	})
}

// staffPayload is the staff shape returned to the Store Admin client. It never includes the password hash.
func staffPayload(staff *StoreStaff) map[string]interface{} {
	return map[string]interface{}{
		"id":         staff.ID,
		"email":      staff.Email,
		"first_name": staff.FirstName,
		"last_name":  staff.LastName,
		"role":       staff.Role,
	}
}
