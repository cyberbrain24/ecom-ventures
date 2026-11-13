package themes

import (
	"encoding/json"
	"errors"
	"net/http"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"
	"github.com/go-chi/chi/v5"
)

// Handler manages HTTP endpoints for theme registry and delivery.
type Handler struct {
	service *Service
}

// NewHandler instantiates the theme handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetService returns the underlying theme Service instance.
func (h *Handler) GetService() *Service {
	return h.service
}

// List handles GET /api/v1/platform/themes (Master Admin Theme Catalog).
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	themesList, err := h.service.ListThemes(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}
	response.JSON(w, http.StatusOK, themesList)
}

// Register handles POST /api/v1/platform/themes.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	theme, err := h.service.RegisterTheme(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrThemeSlugConflict) {
			response.Problem(w, r, http.StatusConflict, "THEME_SLUG_CONFLICT", "Conflict", "A theme with this slug already exists.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, theme)
}

// Assign handles PUT /api/v1/platform/stores/{id}/theme.
func (h *Handler) Assign(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "id")
	if storeID == "" {
		response.BadRequest(w, r, "Missing store ID parameter.")
		return
	}

	var req AssignThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	if req.ThemeID == "" {
		response.ValidationProblem(w, r, []response.ValidationErrorDetail{
			{Field: "theme_id", Message: "theme_id is required"},
		})
		return
	}

	if err := h.service.AssignThemeToStore(r.Context(), storeID, req); err != nil {
		if errors.Is(err, ErrThemeNotFound) {
			response.NotFound(w, r, "The requested theme does not exist.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Theme successfully assigned to store with cache invalidated.",
	})
}

// GetStorefrontTheme handles GET /api/v1/storefront/theme (Dynamic Storefront Delivery).
func (h *Handler) GetStorefrontTheme(w http.ResponseWriter, r *http.Request) {
	sc, err := storeCtx.GetStoreContext(r.Context())
	if err != nil {
		response.Problem(w, r, http.StatusForbidden, "STORE_CONTEXT_REQUIRED", "Access Denied", "Store context is required to resolve theme.")
		return
	}

	themeConfig, err := h.service.GetStoreTheme(r.Context(), sc.Store.ID)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, themeConfig)
}
