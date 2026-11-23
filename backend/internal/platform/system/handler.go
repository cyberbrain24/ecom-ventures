package system

import (
	"encoding/json"
	"net/http"
	"strconv"

	"ecom-ventures/backend/pkg/response"
)

// Handler exposes system, admin staff, and audit endpoints.
type Handler struct {
	service *Service
}

// NewHandler instantiates the system HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListAdmins handles GET /api/v1/platform/admins.
func (h *Handler) ListAdmins(w http.ResponseWriter, r *http.Request) {
	users, err := h.service.ListAdmins(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}
	response.JSON(w, http.StatusOK, users)
}

// CreateAdminRequest payload for creating a new platform operator.
type CreateAdminRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
}

// CreateAdmin handles POST /api/v1/platform/admins.
func (h *Handler) CreateAdmin(w http.ResponseWriter, r *http.Request) {
	var req CreateAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON.")
		return
	}

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		response.BadRequest(w, r, "All fields (email, password, first_name, last_name) are required.")
		return
	}

	if req.Role != "SUPER_ADMIN" && req.Role != "PLATFORM_STAFF" {
		req.Role = "PLATFORM_STAFF"
	}

	user, err := h.service.CreateAdmin(r.Context(), req.Email, req.Password, req.FirstName, req.LastName, req.Role)
	if err != nil {
		response.BadRequest(w, r, "Failed to create administrator: "+err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, user)
}

// ListAuditLogs handles GET /api/v1/platform/audit-logs.
func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	action := q.Get("action")
	limit, _ := strconv.Atoi(q.Get("limit"))

	logs, err := h.service.ListAuditLogs(r.Context(), action, limit)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, logs)
}

// GetClusterOverview handles GET /api/v1/platform/system/overview.
func (h *Handler) GetClusterOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.service.GetClusterOverview(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, overview)
}
