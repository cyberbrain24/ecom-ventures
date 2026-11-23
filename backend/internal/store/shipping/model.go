// Package shipping manages a store's delivery zones and resolves the shipping
// fee for a customer address. Each zone maps a district and a set of thanas
// (sub-districts) to one flat shipping fee. Fees are never defaulted: an
// address that matches no zone cannot be checked out.
package shipping

import (
	"errors"
	"strings"
	"time"
)

var (
	// ErrZoneNotFound indicates no delivery zone exists for the requested zone ID or address.
	ErrZoneNotFound = errors.New("delivery zone not found")
	// ErrNoZonesConfigured indicates the store has not defined any delivery zones yet.
	ErrNoZonesConfigured = errors.New("store has no delivery zones configured")
	// ErrZoneConflict indicates another zone already uses the same district and zone label.
	ErrZoneConflict = errors.New("a delivery zone with this district and zone already exists")
)

// Zone is a delivery zone as stored in the tenant database and returned to store staff.
type Zone struct {
	ID          string    `json:"id"`
	District    string    `json:"district"`
	Zone        string    `json:"zone"`
	ShippingFee float64   `json:"shipping_fee"`
	Thanas      []string  `json:"thanas"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PublicZone is the storefront view of a delivery zone. It omits the internal ID.
type PublicZone struct {
	District    string   `json:"district"`
	Zone        string   `json:"zone"`
	ShippingFee float64  `json:"shipping_fee"`
	Thanas      []string `json:"thanas"`
}

// ToPublic converts a stored zone into its storefront representation.
func (z Zone) ToPublic() PublicZone {
	thanas := make([]string, len(z.Thanas))
	copy(thanas, z.Thanas)
	return PublicZone{
		District:    z.District,
		Zone:        z.Zone,
		ShippingFee: z.ShippingFee,
		Thanas:      thanas,
	}
}

// FindZoneFor returns the first zone whose district equals district and whose
// thanas contain city. Matching ignores letter case and collapses runs of
// whitespace. It returns nil when either argument is blank or nothing matches.
// Callers pass the address state_province as district, because customer
// addresses carry no separate district field.
func FindZoneFor(zones []Zone, district, city string) *Zone {
	wantDistrict := normalizeKey(district)
	wantCity := normalizeKey(city)
	if wantDistrict == "" || wantCity == "" {
		return nil
	}
	for i := range zones {
		if normalizeKey(zones[i].District) != wantDistrict {
			continue
		}
		for _, thana := range zones[i].Thanas {
			if normalizeKey(thana) == wantCity {
				return &zones[i]
			}
		}
	}
	return nil
}

// normalizeKey lowercases a value and collapses internal whitespace for comparison.
func normalizeKey(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(value), " "))
}
