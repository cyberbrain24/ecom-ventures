package shipping

import (
	"fmt"
	"math"
	"strings"
	"unicode/utf8"

	"ecom-ventures/backend/pkg/response"
)

const (
	// maxFieldLength is the longest accepted district, zone or thana name, in characters.
	maxFieldLength = 100
	// maxShippingFee matches the NUMERIC(12,2) column limit.
	maxShippingFee = 9999999999.99
)

// ZoneRequest is the payload for creating or replacing a delivery zone.
type ZoneRequest struct {
	District    string   `json:"district"`
	Zone        string   `json:"zone"`
	ShippingFee float64  `json:"shipping_fee"`
	Thanas      []string `json:"thanas"`
}

// ValidationError reports one or more invalid fields in a ZoneRequest.
type ValidationError struct {
	Params []response.InvalidParam
}

// Error describes every invalid field in a single line.
func (e *ValidationError) Error() string {
	parts := make([]string, 0, len(e.Params))
	for _, p := range e.Params {
		parts = append(parts, p.Name+": "+p.Reason)
	}
	return "invalid delivery zone: " + strings.Join(parts, "; ")
}

// Validate trims the request fields and checks every constraint. It returns the
// normalised request, or a *ValidationError listing each invalid field.
// Thanas must be non-empty, each 1 to 100 characters, and unique regardless of case.
// The shipping fee must be zero or positive, have at most two decimals and fit NUMERIC(12,2).
func (r ZoneRequest) Validate() (ZoneRequest, error) {
	normalised := ZoneRequest{
		District:    strings.TrimSpace(r.District),
		Zone:        strings.TrimSpace(r.Zone),
		ShippingFee: r.ShippingFee,
		Thanas:      make([]string, 0, len(r.Thanas)),
	}

	var params []response.InvalidParam
	if msg := checkName(normalised.District); msg != "" {
		params = append(params, response.InvalidParam{Name: "district", Reason: msg})
	}
	if msg := checkName(normalised.Zone); msg != "" {
		params = append(params, response.InvalidParam{Name: "zone", Reason: msg})
	}
	if msg := checkFee(r.ShippingFee); msg != "" {
		params = append(params, response.InvalidParam{Name: "shipping_fee", Reason: msg})
	}

	if len(r.Thanas) == 0 {
		params = append(params, response.InvalidParam{Name: "thanas", Reason: "at least one thana is required"})
	}
	seen := make(map[string]struct{}, len(r.Thanas))
	for i, raw := range r.Thanas {
		name := strings.TrimSpace(raw)
		field := fmt.Sprintf("thanas[%d]", i)
		if msg := checkName(name); msg != "" {
			params = append(params, response.InvalidParam{Name: field, Reason: msg})
			continue
		}
		key := strings.ToLower(name)
		if _, dup := seen[key]; dup {
			params = append(params, response.InvalidParam{Name: field, Reason: fmt.Sprintf("thana %q is listed more than once", name)})
			continue
		}
		seen[key] = struct{}{}
		normalised.Thanas = append(normalised.Thanas, name)
	}

	if len(params) > 0 {
		return ZoneRequest{}, &ValidationError{Params: params}
	}
	return normalised, nil
}

// checkName returns a reason when a trimmed name is empty or too long, and an empty string otherwise.
func checkName(name string) string {
	length := utf8.RuneCountInString(name)
	switch {
	case length == 0:
		return "is required"
	case length > maxFieldLength:
		return fmt.Sprintf("must be at most %d characters", maxFieldLength)
	}
	return ""
}

// checkFee returns a reason when a shipping fee is not a valid money amount, and an empty string otherwise.
func checkFee(fee float64) string {
	switch {
	case math.IsNaN(fee) || math.IsInf(fee, 0):
		return "must be a finite number"
	case fee < 0:
		return "must not be negative"
	case fee > maxShippingFee:
		return fmt.Sprintf("must be at most %.2f", maxShippingFee)
	}
	cents := fee * 100
	if math.Abs(cents-math.Round(cents)) > 1e-6 {
		return "must have at most two decimal places"
	}
	return ""
}
