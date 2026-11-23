package tasks

import (
	"encoding/json"
	"net/http"
	"strings"

	"ecom-ventures/backend/internal/middleware"
	"ecom-ventures/backend/internal/store/context"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListCategories handles GET /api/v1/store/{slug}/tasks/categories.
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	categories, err := h.service.ListCategories(r.Context(), tenantDB)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list categories: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, categories)
}

// CreateCategory handles POST /api/v1/store/{slug}/tasks/categories.
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid category payload")
		return
	}

	cat, err := h.service.CreateCategory(r.Context(), tenantDB, &req)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, cat)
}

// ListTasks handles GET /api/v1/store/{slug}/tasks.
func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	assigneeID := r.URL.Query().Get("assignee_id")
	status := r.URL.Query().Get("status")
	categoryID := r.URL.Query().Get("category_id")

	tasks, err := h.service.ListTasks(r.Context(), tenantDB, assigneeID, status, categoryID)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to query tasks: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tasks)
}

// GetTask handles GET /api/v1/store/{slug}/tasks/{id}.
func (h *Handler) GetTask(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	id := strings.TrimSpace(chi.URLParam(r, "id"))
	task, err := h.service.GetTask(r.Context(), tenantDB, id)
	if err != nil {
		response.WriteInternalError(w, r, err.Error())
		return
	}
	if task == nil {
		response.WriteNotFound(w, r, "Task not found")
		return
	}

	response.WriteJSON(w, http.StatusOK, task)
}

// CreateTask handles POST /api/v1/store/{slug}/tasks.
func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	claims, _ := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	var creatorID string
	if claims != nil {
		creatorID = claims.Subject
	}

	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid task payload")
		return
	}

	task, err := h.service.CreateTask(r.Context(), tenantDB, creatorID, &req)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, task)
}

// UpdateTask handles PUT /api/v1/store/{slug}/tasks/{id}.
func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var req UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid task payload")
		return
	}

	task, err := h.service.UpdateTask(r.Context(), tenantDB, id, &req)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, task)
}

// CompleteTask handles PUT /api/v1/store/{slug}/tasks/{id}/complete.
func (h *Handler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var req CompleteTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid completion payload")
		return
	}

	task, err := h.service.CompleteTask(r.Context(), tenantDB, id, req.CompletionComment)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, task)
}

// DeleteTask handles DELETE /api/v1/store/{slug}/tasks/{id}.
func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if err := h.service.DeleteTask(r.Context(), tenantDB, id); err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{"message": "Task successfully deleted"})
}
