package auth

import (
	"encoding/json"
	"errors"
	"net/http"

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

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"tokens": tokens,
		"staff": map[string]interface{}{
			"id":         staff.ID,
			"email":      staff.Email,
			"first_name": staff.FirstName,
			"last_name":  staff.LastName,
			"role":       staff.Role,
		},
	})
}
