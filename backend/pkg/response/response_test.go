package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSONSuccess(t *testing.T) {
	rr := httptest.NewRecorder()
	payload := map[string]string{"message": "success"}

	JSON(rr, http.StatusOK, payload)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	if contentType := rr.Header().Get("Content-Type"); contentType != "application/json; charset=utf-8" {
		t.Errorf("unexpected content type: %s", contentType)
	}

	var resp SuccessEnvelope
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode json body: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success to be true")
	}
}

func TestProblemDetails(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rr := httptest.NewRecorder()

	NotFound(rr, req, "The requested brand catalog could not be located.")

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rr.Code)
	}

	if contentType := rr.Header().Get("Content-Type"); contentType != "application/problem+json; charset=utf-8" {
		t.Errorf("unexpected problem+json content type, got: %s", contentType)
	}

	var problem ProblemDetails
	if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
		t.Fatalf("failed to decode problem details: %v", err)
	}

	if problem.Code != "NOT_FOUND" {
		t.Errorf("expected code NOT_FOUND, got %s", problem.Code)
	}

	if problem.Instance != "/api/v1/test" {
		t.Errorf("expected instance /api/v1/test, got %s", problem.Instance)
	}
}

func TestValidationProblemDetails(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/stores", nil)
	rr := httptest.NewRecorder()

	params := []ValidationErrorDetail{
		{Field: "slug", Message: "slug must contain only lowercase letters and dashes", Rule: "slug_regex"},
	}

	ValidationProblem(rr, req, params)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d", rr.Code)
	}

	var problem ProblemDetails
	if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
		t.Fatalf("failed to decode problem details: %v", err)
	}

	if len(problem.InvalidParams) != 1 {
		t.Fatalf("expected 1 invalid param, got %d", len(problem.InvalidParams))
	}

	if problem.InvalidParams[0].Field != "slug" {
		t.Errorf("expected field 'slug', got '%s'", problem.InvalidParams[0].Field)
	}
}

func TestWriteProblemCompatibility(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test-prob", nil)

	WriteProblem(rr, req, http.StatusBadRequest, "Invalid Request", "Parameter is missing")

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var prob ProblemDetails
	if err := json.NewDecoder(rr.Body).Decode(&prob); err != nil {
		t.Fatalf("failed to decode problem response: %v", err)
	}

	if prob.Status != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, prob.Status)
	}
	if prob.Title != "Invalid Request" {
		t.Errorf("expected title 'Invalid Request', got %q", prob.Title)
	}
}

func TestConvenienceHelpers(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test-helpers", nil)

	helpers := []struct {
		call   func(http.ResponseWriter, *http.Request)
		status int
		code   string
	}{
		{func(w http.ResponseWriter, r *http.Request) { BadRequest(w, r, "bad") }, http.StatusBadRequest, "BAD_REQUEST"},
		{func(w http.ResponseWriter, r *http.Request) { Unauthorized(w, r, "unauth") }, http.StatusUnauthorized, "UNAUTHORIZED"},
		{func(w http.ResponseWriter, r *http.Request) { Forbidden(w, r, "forbid") }, http.StatusForbidden, "FORBIDDEN"},
		{func(w http.ResponseWriter, r *http.Request) { InternalServerError(w, r) }, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR"},
	}

	for _, tc := range helpers {
		rr := httptest.NewRecorder()
		tc.call(rr, req)
		if rr.Code != tc.status {
			t.Errorf("expected status %d, got %d", tc.status, rr.Code)
		}
	}
}
