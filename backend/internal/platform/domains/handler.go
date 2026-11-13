// Package domains manages custom domain registrations, DNS TXT verification,
// and SSL certificate provisioning across the Ecom Ventures platform.
package domains

import (
	"encoding/json"
	"errors"
	"net/http"

	"ecom-ventures/backend/pkg/response"
	"github.com/go-chi/chi/v5"
)

// Handler manages domain REST endpoints under `/api/v1/platform/domains`.
type Handler struct {
	service *Service
}

// NewHandler instantiates the domain HTTP controller.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListAll handles GET /api/v1/platform/domains.
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	domainsList, err := h.service.ListAllDomains(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}
	response.JSON(w, http.StatusOK, domainsList)
}

// AddDomain handles POST /api/v1/platform/domains.
func (h *Handler) AddDomain(w http.ResponseWriter, r *http.Request) {
	var req AddDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	if req.StoreID == "" || req.Domain == "" {
		response.ValidationProblem(w, r, []response.ValidationErrorDetail{
			{Field: "store_id", Message: "Store ID is required"},
			{Field: "domain", Message: "Domain is required"},
		})
		return
	}

	domain, err := h.service.AddDomain(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrDomainConflict) {
			response.Problem(w, r, http.StatusConflict, "DOMAIN_CONFLICT", "Conflict", "Domain is already mapped to a store.")
			return
		}
		if errors.Is(err, ErrInvalidDomainFormat) {
			response.BadRequest(w, r, "Invalid domain format. Must be a valid FQDN (e.g. mior.com).")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusCreated, domain)
}

// Verify handles POST /api/v1/platform/domains/{id}/verify.
func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "id")
	if domainID == "" {
		response.BadRequest(w, r, "Domain ID parameter is required.")
		return
	}

	domain, err := h.service.VerifyDomain(r.Context(), domainID)
	if err != nil {
		if errors.Is(err, ErrDomainNotFound) {
			response.NotFound(w, r, "Domain record not found.")
			return
		}
		if errors.Is(err, ErrVerificationFailed) {
			response.Problem(w, r, http.StatusUnprocessableEntity, "DNS_VERIFICATION_FAILED", "DNS Verification Failed", "DNS TXT record matching verification token was not detected. Please ensure DNS propagation is complete.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, domain)
}

// SetPrimary handles PATCH /api/v1/platform/domains/{id}/primary.
func (h *Handler) SetPrimary(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "id")
	if domainID == "" {
		response.BadRequest(w, r, "Domain ID parameter is required.")
		return
	}

	if err := h.service.SetPrimaryDomain(r.Context(), domainID); err != nil {
		if errors.Is(err, ErrDomainNotFound) {
			response.NotFound(w, r, "Domain record not found.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Domain successfully promoted to primary storefront route.",
	})
}

// Delete handles DELETE /api/v1/platform/domains/{id}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "id")
	if domainID == "" {
		response.BadRequest(w, r, "Domain ID parameter is required.")
		return
	}

	if err := h.service.DeleteDomain(r.Context(), domainID); err != nil {
		if errors.Is(err, ErrDomainNotFound) {
			response.NotFound(w, r, "Domain not found.")
			return
		}
		if errors.Is(err, ErrCannotDeletePrimary) {
			response.Problem(w, r, http.StatusBadRequest, "CANNOT_DELETE_PRIMARY", "Cannot Delete Primary", "Designate an alternative primary domain before removing this route.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Domain successfully dissociated and purged from edge routing.",
	})
}
