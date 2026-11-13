// Package logistics provides domain logic, courier abstractions, and HTTP APIs
// for managing carrier integrations, parcel consignments, and tracking synchronization.
package logistics

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// CarrierType defines supported courier logistics networks.
type CarrierType string

const (
	CarrierSteadfast CarrierType = "STEADFAST"
	CarrierPathao    CarrierType = "PATHAO"
	CarrierRedX      CarrierType = "REDX"
	CarrierManual    CarrierType = "MANUAL"
)

// CourierConfig represents encrypted store-level carrier credentials stored in the tenant DB.
type CourierConfig struct {
	ID         string      `json:"id"`
	Carrier    CarrierType `json:"carrier"`
	IsEnabled  bool        `json:"is_enabled"`
	IsTestMode bool        `json:"is_test_mode"`
	ApiKey     string      `json:"api_key"`
	SecretKey  string      `json:"secret_key"`
	ClientID   string      `json:"client_id"`   // Store ID, Merchant ID, or Hub ID
	WebhookKey string      `json:"webhook_key"` // Webhook verification secret
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

// UpdateCourierConfigRequest defines payload for store managers to update courier keys.
type UpdateCourierConfigRequest struct {
	Carrier    CarrierType `json:"carrier"`
	IsEnabled  bool        `json:"is_enabled"`
	IsTestMode bool        `json:"is_test_mode"`
	ApiKey     string      `json:"api_key"`
	SecretKey  string      `json:"secret_key"`
	ClientID   string      `json:"client_id"`
	WebhookKey string      `json:"webhook_key"`
}

// DispatchOrderRequest defines payload to dispatch an order parcel to a courier.
type DispatchOrderRequest struct {
	Carrier           CarrierType `json:"carrier"`
	ItemDescription   string      `json:"item_description,omitempty"`
	SpecialNotes      string      `json:"special_notes,omitempty"`
	PackagingType     string      `json:"packaging_type,omitempty"` // BOX, BAG, FRAGILE
	WeightInKg        float64     `json:"weight_in_kg"`
	CollectableAmount float64     `json:"collectable_amount"` // COD amount; 0.00 if already paid online
}

// ConsignmentResponse represents the carrier confirmation payload upon booking.
type ConsignmentResponse struct {
	Carrier        CarrierType `json:"carrier"`
	ConsignmentID  string      `json:"consignment_id"`
	TrackingNumber string      `json:"tracking_number"`
	TrackingURL    string      `json:"tracking_url,omitempty"`
	DeliveryFee    float64     `json:"delivery_fee,omitempty"`
	RawPayload     string      `json:"raw_payload"`
}

// TrackingCheckpoint represents a single transit milestone in a tracking timeline.
type TrackingCheckpoint struct {
	Status      string    `json:"status"`
	Location    string    `json:"location,omitempty"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
}

// TrackingTimeline represents the complete journey of a dispatched parcel.
type TrackingTimeline struct {
	Carrier        CarrierType          `json:"carrier"`
	TrackingNumber string               `json:"tracking_number"`
	CurrentStatus  string               `json:"current_status"`
	Checkpoints    []TrackingCheckpoint `json:"checkpoints"`
	LastUpdated    time.Time            `json:"last_updated"`
}

// DeliveryMilestoneEvent represents a normalized carrier status change from webhooks.
type DeliveryMilestoneEvent struct {
	Carrier        CarrierType                `json:"carrier"`
	ConsignmentID  string                     `json:"consignment_id"`
	TrackingNumber string                     `json:"tracking_number"`
	OrderNumber    string                     `json:"order_number"`
	Milestone      storeModels.ShipmentStatus `json:"milestone"`
	Notes          string                     `json:"notes"`
	RawBody        string                     `json:"raw_body"`
}
