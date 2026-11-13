package security

import (
	"net/http"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles administrative security audit queries.
type Handler struct {
	runner *AuditRunner
}

// NewHandler instantiates a new security Handler.
func NewHandler(runner *AuditRunner) *Handler {
	return &Handler{runner: runner}
}

// GetSecurityAuditReport handles GET /api/v1/platform/security/audit
func (h *Handler) GetSecurityAuditReport(w http.ResponseWriter, r *http.Request) {
	report, err := h.runner.RunFullAudit(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to execute security audit: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, report)
}
