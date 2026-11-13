// Package payments provides domain logic, gateway abstractions, and HTTP APIs
// for processing payment initiations, webhooks, and settlement reconciliations.
package payments

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// GatewayType defines supported payment provider channels.
type GatewayType string

const (
	GatewayCOD        GatewayType = "COD"
	GatewayBKash      GatewayType = "BKASH"
	GatewayNagad      GatewayType = "NAGAD"
	GatewaySSLCommerz GatewayType = "SSLCOMMERZ"
	GatewayStripe     GatewayType = "STRIPE"
)

// GatewayConfig represents encrypted store-level credentials stored in the tenant DB.
type GatewayConfig struct {
	ID           string      `json:"id"`
	Gateway      GatewayType `json:"gateway"`
	IsEnabled    bool        `json:"is_enabled"`
	IsTestMode   bool        `json:"is_test_mode"`
	AccountID    string      `json:"account_id"`    // Merchant ID, Store ID, or Stripe Account
	ClientID     string      `json:"client_id"`     // App Key, Client ID
	ClientSecret string      `json:"client_secret"` // App Secret, Store Password, Stripe Secret Key
	WebhookKey   string      `json:"webhook_key"`   // Webhook signing secret or IPN password
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

// UpdateGatewayConfigRequest defines payload for store owners to configure provider keys.
type UpdateGatewayConfigRequest struct {
	Gateway      GatewayType `json:"gateway"`
	IsEnabled    bool        `json:"is_enabled"`
	IsTestMode   bool        `json:"is_test_mode"`
	AccountID    string      `json:"account_id"`
	ClientID     string      `json:"client_id"`
	ClientSecret string      `json:"client_secret"`
	WebhookKey   string      `json:"webhook_key"`
}

// InitiatePaymentRequest defines payload to start an online checkout transaction.
type InitiatePaymentRequest struct {
	OrderID   string      `json:"order_id"`
	Gateway   GatewayType `json:"gateway"`
	ReturnURL string      `json:"return_url"`
	CancelURL string      `json:"cancel_url"`
}

// PaymentInitResponse provides customer redirect instructions returned by the gateway.
type PaymentInitResponse struct {
	Gateway          GatewayType `json:"gateway"`
	TransactionID    string      `json:"transaction_id"`
	RedirectURL      string      `json:"redirect_url"`
	RequiresRedirect bool        `json:"requires_redirect"`
}

// PaymentVerifyResponse represents the validated settlement status from provider callbacks.
type PaymentVerifyResponse struct {
	TransactionID string                    `json:"transaction_id"`
	OrderID       string                    `json:"order_id"`
	Amount        float64                   `json:"amount"`
	Currency      string                    `json:"currency"`
	Status        storeModels.PaymentStatus `json:"status"`
	RawPayload    string                    `json:"raw_payload"`
}

// WebhookEvent represents a normalized asynchronous event parsed from provider webhooks.
type WebhookEvent struct {
	Gateway       GatewayType               `json:"gateway"`
	EventID       string                    `json:"event_id"`
	EventType     string                    `json:"event_type"`
	TransactionID string                    `json:"transaction_id"`
	OrderID       string                    `json:"order_id"`
	Amount        float64                   `json:"amount"`
	Currency      string                    `json:"currency"`
	Status        storeModels.PaymentStatus `json:"status"`
	RawBody       string                    `json:"raw_body"`
}
