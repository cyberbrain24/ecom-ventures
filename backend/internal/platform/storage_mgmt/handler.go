package storage_mgmt

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"
	"ecom-ventures/backend/pkg/storage"
)

// Handler exposes REST endpoints for managing Cloudflare R2 and platform storage.
type Handler struct {
	service *Service
}

// NewHandler instantiates the storage management HTTP controller.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetSettings handles GET /api/v1/platform/storage/settings.
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.service.GetSettings(r.Context())
	if err != nil {
		response.Problem(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve storage configuration", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, settings)
}

// UpdateSettings handles PUT /api/v1/platform/storage/settings.
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateStorageSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid request body JSON", err.Error())
		return
	}

	updated, err := h.service.UpdateSettings(r.Context(), req)
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "CONFIGURATION_FAILED", "Failed to update storage configuration", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, updated)
}

// TestConnection handles POST /api/v1/platform/storage/test.
func (h *Handler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req TestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid request body JSON", err.Error())
		return
	}

	res, err := h.service.TestConnection(r.Context(), req)
	if err != nil {
		response.Problem(w, r, http.StatusBadGateway, "R2_CONNECTION_FAILED", "Failed to connect to Cloudflare R2", res.Message)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// ResetToLocal handles POST /api/v1/platform/storage/reset.
func (h *Handler) ResetToLocal(w http.ResponseWriter, r *http.Request) {
	if err := h.service.ResetToLocal(r.Context()); err != nil {
		response.Problem(w, r, http.StatusInternalServerError, "RESET_FAILED", "Failed to reset to local storage", err.Error())
		return
	}
	settings, _ := h.service.GetSettings(r.Context())
	response.JSON(w, http.StatusOK, settings)
}

// UploadTestAsset handles POST /api/v1/platform/storage/upload-test.
func (h *Handler) UploadTestAsset(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_MULTIPART", "Failed to parse multipart upload payload", err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "MISSING_FILE", "A valid multipart 'file' field is required", err.Error())
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	res, err := h.service.UploadTestAsset(r.Context(), header.Filename, contentType, file, header.Size)
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "UPLOAD_FAILED", "Test upload failed", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, res)
}

// UploadPlatformMedia handles POST /api/v1/platform/media/upload for platform assets.
func (h *Handler) UploadPlatformMedia(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_MULTIPART", "Failed to parse multipart upload payload", err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "MISSING_FILE", "A valid multipart 'file' field is required", err.Error())
		return
	}
	defer file.Close()

	moduleInput := strings.TrimSpace(r.FormValue("module"))
	subPathInput := strings.TrimSpace(r.FormValue("sub_path"))

	category := storage.ModulePlatformBranding
	switch moduleInput {
	case "admin-avatars", "avatars":
		category = storage.ModulePlatformAvatars
	case "themes":
		category = storage.ModulePlatformThemes
	case "attachments":
		category = storage.ModulePlatformAttachments
	}

	folder := storage.BuildPlatformPath(category, subPathInput)
	contentType := header.Header.Get("Content-Type")

	res, err := h.service.GetDynamicProvider().Save(r.Context(), folder, header.Filename, contentType, file, header.Size)
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "UPLOAD_FAILED", "Failed to upload platform media", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, res)
}

// UploadStoreMedia handles POST /api/v1/store/{store_slug}/media/upload for tenant store media.
func (h *Handler) UploadStoreMedia(w http.ResponseWriter, r *http.Request) {
	sc, err := storeCtx.GetStoreContext(r.Context())
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "MISSING_STORE_CONTEXT", "Tenant store context missing", err.Error())
		return
	}

	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_MULTIPART", "Failed to parse multipart upload payload", err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "MISSING_FILE", "A valid multipart 'file' field is required", err.Error())
		return
	}
	defer file.Close()

	moduleInput := strings.TrimSpace(r.FormValue("module"))
	subPathInput := strings.TrimSpace(r.FormValue("sub_path"))

	category := storage.ModuleGeneral
	switch moduleInput {
	case "products":
		category = storage.ModuleProducts
	case "reviews":
		category = storage.ModuleReviews
	case "categories":
		category = storage.ModuleCategories
	case "brand":
		category = storage.ModuleBrand
	case "blog":
		category = storage.ModuleBlog
	case "music":
		category = storage.ModuleMusic
	case "orders":
		category = storage.ModuleOrders
	}

	folder := storage.BuildStorePath(sc.Store.Slug, category, subPathInput)
	contentType := header.Header.Get("Content-Type")

	res, err := h.service.GetDynamicProvider().Save(r.Context(), folder, header.Filename, contentType, file, header.Size)
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "UPLOAD_FAILED", fmt.Sprintf("Failed to upload store media: %v", err), err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, res)
}

// DeleteStoreMedia handles DELETE /api/v1/store/{store_slug}/media?key=... for cleaning up unsaved/removed store uploads.
func (h *Handler) DeleteStoreMedia(w http.ResponseWriter, r *http.Request) {
	sc, err := storeCtx.GetStoreContext(r.Context())
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "MISSING_STORE_CONTEXT", "Tenant store context missing", err.Error())
		return
	}

	key := strings.TrimSpace(r.URL.Query().Get("key"))
	expectedPrefix := fmt.Sprintf("stores/%s/", sc.Store.Slug)
	if key == "" || !strings.HasPrefix(key, expectedPrefix) || strings.Contains(key, "..") {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_MEDIA_KEY", "A valid store-scoped media key is required", "")
		return
	}

	if err := h.service.GetDynamicProvider().Delete(r.Context(), key); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "DELETE_FAILED", "Failed to delete store media", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"deleted_key": key})
}
