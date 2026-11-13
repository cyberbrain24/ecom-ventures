package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Handler provides HTTP controller methods for platform auth routes.
type Handler struct {
	service *Service
}

// NewHandler instantiates the platform auth handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Login handles POST /api/v1/platform/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
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

	tokens, user, err := h.service.Login(r.Context(), req.Email, req.Password, r.RemoteAddr, r.UserAgent())
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Unauthorized(w, r, "Invalid email or password.")
			return
		}
		if errors.Is(err, ErrUserSuspended) {
			response.Problem(w, r, http.StatusForbidden, "ACCOUNT_SUSPENDED", "Account Suspended", "Your account has been suspended.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"tokens": tokens,
		"user": map[string]interface{}{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       user.Role,
		},
	})
}

// Refresh handles POST /api/v1/platform/auth/refresh.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		response.BadRequest(w, r, "Missing mandatory refresh_token parameter.")
		return
	}

	tokens, err := h.service.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		response.Unauthorized(w, r, "The provided refresh token is expired, invalid, or revoked.")
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"tokens": tokens,
	})
}

// Logout handles POST /api/v1/platform/auth/logout.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value("auth_claims").(*pkgAuth.Claims)
	if !ok || claims == nil {
		claims, _ = r.Context().Value(pkgAuth.TokenTypeAccess).(*pkgAuth.Claims)
	}
	if claims != nil {
		_ = h.service.Logout(r.Context(), claims.UserID)
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Successfully logged out.",
	})
}
