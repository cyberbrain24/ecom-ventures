package music

import (
	"encoding/json"
	"net/http"
	"strings"

	"ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// --- PUBLIC STOREFRONT ENDPOINTS ---

// GetStorefrontConfig handles GET /api/v1/storefront/music/config.
func (h *Handler) GetStorefrontConfig(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	cfg, err := h.service.GetConfig(r.Context(), tenantDB)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load music configuration: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, cfg)
}

// ListStorefrontTracks handles GET /api/v1/storefront/music/tracks.
func (h *Handler) ListStorefrontTracks(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	tracks, err := h.service.ListTracks(r.Context(), tenantDB, true)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load playlist: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tracks)
}

// --- AUTHENTICATED STORE ADMIN ENDPOINTS ---

// GetAdminConfig handles GET /api/v1/store/{slug}/music/config.
func (h *Handler) GetAdminConfig(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	cfg, err := h.service.GetConfig(r.Context(), tenantDB)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load music configuration: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, cfg)
}

// UpdateAdminConfig handles PUT /api/v1/store/{slug}/music/config.
func (h *Handler) UpdateAdminConfig(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	var req UpdateMusicConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid configuration payload: "+err.Error())
		return
	}

	cfg, err := h.service.UpdateConfig(r.Context(), tenantDB, req.IsActive)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to update music configuration: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, cfg)
}

// ListAdminTracks handles GET /api/v1/store/{slug}/music/tracks.
func (h *Handler) ListAdminTracks(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	tracks, err := h.service.ListTracks(r.Context(), tenantDB, false)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to query tracks: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tracks)
}

// CreateAdminTrack handles POST /api/v1/store/{slug}/music/tracks.
func (h *Handler) CreateAdminTrack(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	var req CreateTrackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid track payload: "+err.Error())
		return
	}

	track, err := h.service.CreateTrack(r.Context(), tenantDB, &req)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, track)
}

// UpdateAdminTrack handles PUT /api/v1/store/{slug}/music/tracks/{id}.
func (h *Handler) UpdateAdminTrack(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		response.WriteBadRequest(w, r, "Track ID is required")
		return
	}

	var req UpdateTrackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid track payload: "+err.Error())
		return
	}

	track, err := h.service.UpdateTrack(r.Context(), tenantDB, id, &req)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, track)
}

// DeleteAdminTrack handles DELETE /api/v1/store/{slug}/music/tracks/{id}.
func (h *Handler) DeleteAdminTrack(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		response.WriteBadRequest(w, r, "Track ID is required")
		return
	}

	if err := h.service.DeleteTrack(r.Context(), tenantDB, id); err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{"message": "Track successfully deleted"})
}

// ReorderAdminTracks handles POST /api/v1/store/{slug}/music/tracks/reorder.
func (h *Handler) ReorderAdminTracks(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := context.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	var req ReorderTracksRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid reorder payload: "+err.Error())
		return
	}

	if err := h.service.ReorderTracks(r.Context(), tenantDB, req.TrackIDs); err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{"message": "Tracks successfully reordered"})
}

// UploadTrackAudio handles POST /api/v1/store/{slug}/music/upload (Multipart upload for MP3/OGG).
func (h *Handler) UploadTrackAudio(w http.ResponseWriter, r *http.Request) {
	// 10MB max upload
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		response.WriteBadRequest(w, r, "File exceeds maximum upload size (10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.WriteBadRequest(w, r, "Audio file is required in 'file' form field")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	res, err := h.service.UploadAudioFile(r.Context(), header.Filename, contentType, file, header.Size)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}
