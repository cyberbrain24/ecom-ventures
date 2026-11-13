// Package reviews implements the tenant-isolated Product Reviews & Reputation Engine for Ecom Ventures.
package reviews

import (
	"time"
)

// ReviewStatus represents the moderation state of a customer review.
type ReviewStatus string

const (
	StatusPending  ReviewStatus = "PENDING"
	StatusApproved ReviewStatus = "APPROVED"
	StatusFeatured ReviewStatus = "FEATURED"
	StatusArchived ReviewStatus = "ARCHIVED"
)

// ProductReview models a customer review in the dedicated tenant database.
type ProductReview struct {
	ID                 string       `json:"id"`
	ProductID          string       `json:"product_id"`
	CustomerID         string       `json:"customer_id"`
	OrderID            *string      `json:"order_id,omitempty"`
	CreatedByStaffID   *string      `json:"created_by_staff_id,omitempty"`
	Rating             int          `json:"rating"`
	Title              string       `json:"title"`
	Comment            string       `json:"comment"`
	Status             ReviewStatus `json:"status"`
	IsFeatured         bool         `json:"is_featured"`
	IsVerifiedPurchase bool         `json:"is_verified_purchase"`
	DisplayOrder       int          `json:"display_order"`
	StaffNotes         *string      `json:"staff_notes,omitempty"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`

	// Joined metadata for UI presentation
	CustomerName       string        `json:"customer_name,omitempty"`
	CustomerEmail      string        `json:"customer_email,omitempty"`
	CustomerPhone      string        `json:"customer_phone,omitempty"`
	ProductTitle       string        `json:"product_title,omitempty"`
	ProductSlug        string        `json:"product_slug,omitempty"`
	ProductFeaturedImg string        `json:"product_featured_image,omitempty"`
	Images             []ReviewImage `json:"images"`
}

// ReviewImage models fit or unboxing photos attached to a review.
type ReviewImage struct {
	ID           string    `json:"id"`
	ReviewID     string    `json:"review_id"`
	ImageURL     string    `json:"image_url"`
	ThumbnailURL *string   `json:"thumbnail_url,omitempty"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
}

// RatingSummary provides pre-aggregated math for catalog cards and PDP hero sections.
type RatingSummary struct {
	ProductID          string      `json:"product_id"`
	AverageRating      float64     `json:"average_rating"`
	ReviewCount        int         `json:"review_count"`
	RatingBreakdown    map[int]int `json:"rating_breakdown"`
	PhotoCount         int         `json:"photo_count"`
	VerifiedBuyerCount int         `json:"verified_buyer_count"`
}

// ReviewFilter encapsulates filtering and pagination parameters.
type ReviewFilter struct {
	Status     *ReviewStatus
	ProductID  string
	CustomerID string
	Rating     int
	IsFeatured *bool
	Search     string
	Page       int
	Limit      int
}

// CreateStaffReviewRequest models Channel B staff-assisted review creation via CRM phone lookup.
type CreateStaffReviewRequest struct {
	ProductID     string   `json:"product_id"`
	CustomerID    string   `json:"customer_id,omitempty"`
	CustomerPhone string   `json:"customer_phone,omitempty"`
	CustomerName  string   `json:"customer_name,omitempty"`
	CustomerEmail string   `json:"customer_email,omitempty"`
	Rating        int      `json:"rating"`
	Title         string   `json:"title"`
	Comment       string   `json:"comment"`
	Images        []string `json:"images,omitempty"`
	IsFeatured    bool     `json:"is_featured"`
	DisplayOrder  int      `json:"display_order"`
	StaffNotes    string   `json:"staff_notes,omitempty"`
}

// CreateCustomerReviewRequest models Channel A online customer submission from the storefront.
type CreateCustomerReviewRequest struct {
	ProductID string   `json:"product_id"`
	Rating    int      `json:"rating"`
	Title     string   `json:"title"`
	Comment   string   `json:"comment"`
	Images    []string `json:"images,omitempty"`
	OrderID   *string  `json:"order_id,omitempty"`
}

// UpdateReviewRequest models review edits by store administrators.
type UpdateReviewRequest struct {
	Rating       int          `json:"rating"`
	Title        string       `json:"title"`
	Comment      string       `json:"comment"`
	Status       ReviewStatus `json:"status"`
	IsFeatured   bool         `json:"is_featured"`
	DisplayOrder int          `json:"display_order"`
	StaffNotes   string       `json:"staff_notes,omitempty"`
	Images       []string     `json:"images,omitempty"`
}

// QuickModerateRequest models one-click status transitions.
type QuickModerateRequest struct {
	Status     ReviewStatus `json:"status"`
	IsFeatured *bool        `json:"is_featured,omitempty"`
	StaffNotes *string      `json:"staff_notes,omitempty"`
}
