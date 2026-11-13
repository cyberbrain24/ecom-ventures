package accounts

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/internal/middleware"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

// Handler exposes HTTP handlers for the store-level accounts module.
type Handler struct {
	service *Service
}

// NewHandler instantiates the store accounts HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetOverview handles GET /api/v1/store/{store_slug}/accounts/overview
func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	ov, err := h.service.GetAccountsOverview(r.Context())
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, ov)
}

// ListTransactions handles GET /api/v1/store/{store_slug}/accounts/transactions
func (h *Handler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	gateway := r.URL.Query().Get("gateway")

	txs, err := h.service.ListTransactions(r.Context(), status, gateway)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, txs)
}

// ListExpenses handles GET /api/v1/store/{store_slug}/accounts/expenses
func (h *Handler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")

	expenses, err := h.service.ListExpenses(r.Context(), category)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, expenses)
}

// CreateExpense handles POST /api/v1/store/{store_slug}/accounts/expenses
func (h *Handler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	var req CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON request payload"})
		return
	}

	claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	staffEmail := "Store Admin"
	if ok && claims != nil {
		staffEmail = claims.Email
	}

	exp, err := h.service.LogExpense(r.Context(), &req, staffEmail)
	if err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusCreated, exp)
}

// DeleteExpense handles DELETE /api/v1/store/{store_slug}/accounts/expenses/{id}
func (h *Handler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "Missing expense ID"})
		return
	}

	if err := h.service.DeleteExpense(r.Context(), id); err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Expense deleted successfully"})
}

// ListPayouts handles GET /api/v1/store/{store_slug}/accounts/payouts
func (h *Handler) ListPayouts(w http.ResponseWriter, r *http.Request) {
	payouts, err := h.service.ListPayouts(r.Context())
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, payouts)
}

// GetReconciliation handles GET /api/v1/store/{store_slug}/accounts/reconciliation
func (h *Handler) GetReconciliation(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.GetReconciliationSummary(r.Context())
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, items)
}

// GetProfitLoss handles GET /api/v1/store/{store_slug}/accounts/profit-loss
func (h *Handler) GetProfitLoss(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")

	report, err := h.service.GetProfitLoss(r.Context(), period)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, report)
}

// ExportLedger handles GET /api/v1/store/{store_slug}/accounts/export
func (h *Handler) ExportLedger(w http.ResponseWriter, r *http.Request) {
	ledgerType := r.URL.Query().Get("type") // "transactions" or "expenses"
	if ledgerType == "" {
		ledgerType = "transactions"
	}

	csvData, filename, err := h.service.ExportLedgerCSV(r.Context(), ledgerType)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(csvData)
}
