// Package validation carries field-level input failures from platform services to HTTP
// handlers, which answer them as 422 RFC 7807 problems.
package validation

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"ecom-ventures/backend/pkg/response"
)

// Error is a set of field validation failures.
type Error struct {
	Fields []response.ValidationErrorDetail
}

// Error implements the error interface with a summary of every failing field.
func (e *Error) Error() string {
	parts := make([]string, 0, len(e.Fields))
	for _, f := range e.Fields {
		parts = append(parts, f.Field+": "+f.Message)
	}
	return "validation failed: " + strings.Join(parts, "; ")
}

// Collector accumulates field failures during validation.
type Collector struct {
	fields []response.ValidationErrorDetail
}

// Add records a failure for the named field.
func (c *Collector) Add(field, message string) {
	c.fields = append(c.fields, response.ValidationErrorDetail{Field: field, Message: message})
}

// Err returns a *Error when at least one failure was recorded, otherwise nil.
func (c *Collector) Err() error {
	if len(c.fields) == 0 {
		return nil
	}
	return &Error{Fields: c.fields}
}

// Write answers err with a 422 problem when it is, or wraps, a validation Error.
// It reports whether it wrote a response.
func Write(w http.ResponseWriter, r *http.Request, err error) bool {
	var ve *Error
	if !errors.As(err, &ve) {
		return false
	}
	response.ValidationProblem(w, r, ve.Fields)
	return true
}

// Email normalizes s to a lowercase bare address and reports whether it is a valid
// address of at most 255 characters. Display names and trailing text are rejected.
func Email(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if s == "" || len(s) > 255 {
		return "", false
	}
	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s || addr.Name != "" {
		return "", false
	}
	return strings.ToLower(s), true
}
