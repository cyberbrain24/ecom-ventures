package shipping

import "time"

// DistrictEntity represents an administrative district (e.g. Dhaka City, Chattogram, Bogura).
type DistrictEntity struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Division    string    `json:"division"`
	TotalThanas int       `json:"total_thanas"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ThanaEntity represents a sub-district / thana police station linked to a district.
type ThanaEntity struct {
	ID           int       `json:"id"`
	DistrictID   int       `json:"district_id"`
	DistrictName string    `json:"district_name"`
	Name         string    `json:"name"`
	ShippingCost float64   `json:"shipping_cost"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// DistrictRequest is the input payload for creating or editing a district.
type DistrictRequest struct {
	Name     string `json:"name"`
	Division string `json:"division"`
	IsActive bool   `json:"is_active"`
}

// ThanaRequest is the input payload for creating or editing a thana.
type ThanaRequest struct {
	DistrictID   int     `json:"district_id"`
	Name         string  `json:"name"`
	ShippingCost float64 `json:"shipping_cost"`
	IsActive     bool    `json:"is_active"`
}
