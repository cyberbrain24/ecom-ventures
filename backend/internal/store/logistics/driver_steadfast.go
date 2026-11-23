package logistics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// SteadfastDriver implements CourierDriver for Steadfast Courier (Bangladesh).
type SteadfastDriver struct {
	httpClient *http.Client
}

// NewSteadfastDriver instantiates the Steadfast logistics driver.
func NewSteadfastDriver() *SteadfastDriver {
	return &SteadfastDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *SteadfastDriver) getBaseURL() string {
	return "https://api.steadfast.com.bd/v1"
}

// CreateConsignment registers a parcel consignment via Steadfast POST /create_order.
func (d *SteadfastDriver) CreateConsignment(ctx context.Context, order *storeModels.Order, config *CourierConfig, req *DispatchOrderRequest) (*ConsignmentResponse, error) {
	apiURL := fmt.Sprintf("%s/create_order", d.getBaseURL())

	codAmount := 0.00
	if order.PaymentStatus != storeModels.PaymentStatusPaid {
		codAmount = order.TotalAmount
	}
	if req.CollectableAmount > 0 {
		codAmount = req.CollectableAmount
	}

	payload := map[string]interface{}{
		"invoice":           order.OrderNumber,
		"recipient_name":    order.ShippingAddress.RecipientName,
		"recipient_phone":   order.CustomerPhone,
		"recipient_address": order.ShippingAddress.StreetAddress + ", " + order.ShippingAddress.City,
		"cod_amount":        codAmount,
		"note":              req.SpecialNotes,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize steadfast payload: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Api-Key", config.ApiKey)
	httpReq.Header.Set("Secret-Key", config.SecretKey)

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("steadfast booking network error: %w", err)
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read steadfast response: %w", err)
	}

	var result struct {
		Status  int    `json:"status"`
		Message string `json:"message"`
		Order   struct {
			ConsignmentID int    `json:"consignment_id"`
			TrackingCode  string `json:"tracking_code"`
			Invoice       string `json:"invoice"`
		} `json:"order"`
	}

	if err := json.Unmarshal(rawBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode steadfast response: %w", err)
	}

	if result.Status != 200 || result.Order.TrackingCode == "" {
		return nil, fmt.Errorf("steadfast booking rejected: %s", result.Message)
	}

	trackingCode := result.Order.TrackingCode
	return &ConsignmentResponse{
		Carrier:        CarrierSteadfast,
		ConsignmentID:  strconv.Itoa(result.Order.ConsignmentID),
		TrackingNumber: trackingCode,
		TrackingURL:    fmt.Sprintf("https://steadfast.com.bd/t/%s", trackingCode),
		RawPayload:     string(rawBody),
	}, nil
}

// TrackConsignment queries live delivery milestones from Steadfast.
func (d *SteadfastDriver) TrackConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) (*TrackingTimeline, error) {
	apiURL := fmt.Sprintf("%s/status_by_trackingcode/%s", d.getBaseURL(), trackingNumber)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Api-Key", config.ApiKey)
	httpReq.Header.Set("Secret-Key", config.SecretKey)

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("steadfast tracking network error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status         int    `json:"status"`
		DeliveryStatus string `json:"delivery_status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &TrackingTimeline{
		Carrier:        CarrierSteadfast,
		TrackingNumber: trackingNumber,
		CurrentStatus:  result.DeliveryStatus,
		Checkpoints: []TrackingCheckpoint{
			{Status: result.DeliveryStatus, Description: "Steadfast Carrier Status: " + result.DeliveryStatus, Timestamp: time.Now()},
		},
		LastUpdated: time.Now(),
	}, nil
}

// CancelConsignment handles cancellation requests for Steadfast parcels.
func (d *SteadfastDriver) CancelConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) error {
	// Steadfast does not support automated API cancellation once booked; requires manual courier support contact
	return fmt.Errorf("steadfast: manual cancellation required with the courier: %w", ErrCancellationNotImplemented)
}

// HandleStatusWebhook processes asynchronous delivery milestone notifications from Steadfast.
func (d *SteadfastDriver) HandleStatusWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *CourierConfig) (*DeliveryMilestoneEvent, error) {
	var payload struct {
		ConsignmentID int    `json:"consignment_id"`
		TrackingCode  string `json:"tracking_code"`
		Invoice       string `json:"invoice"`
		Status        string `json:"status"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, err
	}

	milestone := storeModels.ShipmentInTransit
	switch payload.Status {
	case "delivered", "delivered_approval_pending":
		milestone = storeModels.ShipmentDelivered
	case "cancelled", "cancelled_approval_pending":
		milestone = storeModels.ShipmentReturned
	case "in_review", "pending":
		milestone = storeModels.ShipmentPending
	}

	return &DeliveryMilestoneEvent{
		Carrier:        CarrierSteadfast,
		ConsignmentID:  strconv.Itoa(payload.ConsignmentID),
		TrackingNumber: payload.TrackingCode,
		OrderNumber:    payload.Invoice,
		Milestone:      milestone,
		Notes:          "Steadfast status update: " + payload.Status,
		RawBody:        string(rawBody),
	}, nil
}
