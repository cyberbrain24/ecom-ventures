package validation

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCollectorEmptyIsNil(t *testing.T) {
	var c Collector
	if c.Err() != nil {
		t.Fatal("an empty collector must return nil")
	}
}

func TestWriteMapsValidationErrorTo422(t *testing.T) {
	var c Collector
	c.Add("name", "required")
	err := fmt.Errorf("wrapped: %w", c.Err())

	rr := httptest.NewRecorder()
	if !Write(rr, httptest.NewRequest(http.MethodPatch, "/x", nil), err) {
		t.Fatal("expected Write to handle a validation error")
	}
	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	if Write(rr, httptest.NewRequest(http.MethodPatch, "/x", nil), errors.New("other")) {
		t.Error("Write must not handle other errors")
	}
}

func TestEmail(t *testing.T) {
	if got, ok := Email(" Ada@Example.COM "); !ok || got != "ada@example.com" {
		t.Errorf("unexpected result %q %v", got, ok)
	}
	for _, s := range []string{"", "plain", "A <a@b.com>", "a@b.com, c@d.com"} {
		if _, ok := Email(s); ok {
			t.Errorf("%q must be rejected", s)
		}
	}
}
