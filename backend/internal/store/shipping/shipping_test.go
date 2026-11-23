package shipping

import (
	"errors"
	"strings"
	"testing"

	"ecom-ventures/backend/pkg/response"
)

// invalidFields returns the names of the fields reported by a validation error, or nil if err is not one.
func invalidFields(err error) []string {
	var ve *ValidationError
	if !errors.As(err, &ve) {
		return nil
	}
	names := make([]string, 0, len(ve.Params))
	for _, p := range ve.Params {
		names = append(names, p.Name)
	}
	return names
}

func validRequest() ZoneRequest {
	return ZoneRequest{
		District:    "Dhaka",
		Zone:        "Dhaka City",
		ShippingFee: 60,
		Thanas:      []string{"Mirpur", "Uttara"},
	}
}

func TestValidateAcceptsValidRequestAndTrims(t *testing.T) {
	req := validRequest()
	req.District = "  Dhaka  "
	req.Thanas = []string{" Mirpur ", "Uttara"}

	clean, err := req.Validate()
	if err != nil {
		t.Fatalf("expected valid request, got %v", err)
	}
	if clean.District != "Dhaka" {
		t.Errorf("expected trimmed district, got %q", clean.District)
	}
	if clean.Thanas[0] != "Mirpur" {
		t.Errorf("expected trimmed thana, got %q", clean.Thanas[0])
	}
}

func TestValidateRejectsInvalidFields(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(r *ZoneRequest)
		field  string
	}{
		{"blank district", func(r *ZoneRequest) { r.District = "   " }, "district"},
		{"blank zone", func(r *ZoneRequest) { r.Zone = "" }, "zone"},
		{"long zone", func(r *ZoneRequest) { r.Zone = strings.Repeat("a", 101) }, "zone"},
		{"negative fee", func(r *ZoneRequest) { r.ShippingFee = -1 }, "shipping_fee"},
		{"three decimals", func(r *ZoneRequest) { r.ShippingFee = 10.005 }, "shipping_fee"},
		{"fee too large", func(r *ZoneRequest) { r.ShippingFee = 1e11 }, "shipping_fee"},
		{"no thanas", func(r *ZoneRequest) { r.Thanas = nil }, "thanas"},
		{"blank thana", func(r *ZoneRequest) { r.Thanas = []string{"Mirpur", "  "} }, "thanas[1]"},
		{"duplicate thana ignoring case", func(r *ZoneRequest) { r.Thanas = []string{"Mirpur", "mirpur"} }, "thanas[1]"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validRequest()
			tt.mutate(&req)
			_, err := req.Validate()
			if err == nil {
				t.Fatal("expected validation error")
			}
			fields := invalidFields(err)
			if len(fields) == 0 || fields[0] != tt.field {
				t.Fatalf("expected invalid field %q, got %v", tt.field, fields)
			}
		})
	}
}

func TestValidateAcceptsZeroFee(t *testing.T) {
	req := validRequest()
	req.ShippingFee = 0
	if _, err := req.Validate(); err != nil {
		t.Fatalf("expected zero fee to be valid, got %v", err)
	}
}

func TestValidationErrorListsEveryField(t *testing.T) {
	req := ZoneRequest{ShippingFee: -5}
	_, err := req.Validate()
	fields := invalidFields(err)
	want := []string{"district", "zone", "shipping_fee", "thanas"}
	if len(fields) != len(want) {
		t.Fatalf("expected %v, got %v", want, fields)
	}
	for i := range want {
		if fields[i] != want[i] {
			t.Errorf("field %d: expected %q, got %q", i, want[i], fields[i])
		}
	}
	var ve *ValidationError
	if !errors.As(err, &ve) || ve.Params[0] != (response.InvalidParam{Name: "district", Reason: "is required"}) {
		t.Errorf("unexpected first validation detail: %+v", ve)
	}
}

func testZones() []Zone {
	return []Zone{
		{ID: "1", District: "Dhaka", Zone: "Inside Dhaka", ShippingFee: 60, Thanas: []string{"Mirpur", "Uttara"}},
		{ID: "2", District: "Chattogram", Zone: "Chattogram City", ShippingFee: 120, Thanas: []string{"Agrabad", "Pahartali"}},
	}
}

func TestFindZoneForMatchesDistrictAndThana(t *testing.T) {
	zone := FindZoneFor(testZones(), "Dhaka", "Mirpur")
	if zone == nil || zone.ID != "1" {
		t.Fatalf("expected zone 1, got %+v", zone)
	}
}

func TestFindZoneForIsCaseInsensitiveAndTrimsWhitespace(t *testing.T) {
	zone := FindZoneFor(testZones(), "  chattogram ", "AGRABAD")
	if zone == nil || zone.ID != "2" {
		t.Fatalf("expected zone 2, got %+v", zone)
	}
}

func TestFindZoneForReturnsNilWithoutMatch(t *testing.T) {
	tests := []struct {
		name     string
		district string
		city     string
	}{
		{"thana in another district", "Chattogram", "Mirpur"},
		{"unknown district", "Khulna", "Mirpur"},
		{"blank district", "", "Mirpur"},
		{"blank city", "Dhaka", "  "},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if zone := FindZoneFor(testZones(), tt.district, tt.city); zone != nil {
				t.Fatalf("expected no zone, got %+v", zone)
			}
		})
	}
}

func TestFindZoneForEmptyZoneList(t *testing.T) {
	if zone := FindZoneFor(nil, "Dhaka", "Mirpur"); zone != nil {
		t.Fatalf("expected nil for empty zone list, got %+v", zone)
	}
}

func TestToPublicOmitsIDAndCopiesThanas(t *testing.T) {
	z := testZones()[0]
	pub := z.ToPublic()
	if pub.District != "Dhaka" || pub.Zone != "Inside Dhaka" || pub.ShippingFee != 60 {
		t.Fatalf("unexpected public zone: %+v", pub)
	}
	pub.Thanas[0] = "changed"
	if z.Thanas[0] != "Mirpur" {
		t.Error("ToPublic must not share the thana slice with the source zone")
	}
}
