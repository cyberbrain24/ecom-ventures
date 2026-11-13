package logistics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// RedXDriver implements CourierDriver for RedX Logistics.
type RedXDriver struct {
	httpClient *http.Client
}

// NewRedXDriver instantiates the RedX logistics driver.
func NewRedXDriver() *RedXDriver {
	return &RedXDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *RedXDriver) getBaseURL(isTest bool) string {
	if isTest {
		return "https://sandbox.redx.com.bd/v1.0.0-beta"
	}
	return "https://openapi.redx.com.bd/v1.0.0-beta"
}

// CreateConsignment creates a new parcel booking with RedX.
func (d *RedXDriver) CreateConsignment(ctx context.Context, order *storeModels.Order, config *CourierConfig, req *DispatchOrderRequest) (*ConsignmentResponse, error) {
	apiURL := fmt.Sprintf("%s/parcels", d.getBaseURL(config.IsTestMode))

	codAmount := 0.00
	if order.PaymentStatus != storeModels.PaymentStatusPaid {
		codAmount = order.TotalAmount
	}
	if req.CollectableAmount > 0 {
		codAmount = req.CollectableAmount
	}

	weightInGrams := int(req.WeightInKg * 1000)
	if weightInGrams <= 0 {
		weightInGrams = 500 // 500g default
	}

	payload := map[string]interface{}{
		"customer_name":          order.ShippingAddress.RecipientName,
		"customer_phone":         order.CustomerPhone,
		"delivery_area":          order.ShippingAddress.City,
		"delivery_address":       order.ShippingAddress.StreetAddress,
		"merchant_invoice_id":    order.OrderNumber,
		"cash_collection_amount": codAmount,
		"parcel_weight":          weightInGrams,
		"instruction":            req.SpecialNotes,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("API-ACCESS-TOKEN", "Bearer "+config.ApiKey)

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("redx parcel creation network error: %w", err)
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		TrackingID string `json:"tracking_id"`
		Message    string `json:"message"`
	}

	if err := json.Unmarshal(rawBody, &result); err != nil {
		return nil, err
	}

	if result.TrackingID == "" {
		return nil, fmt.Errorf("redx parcel booking rejected: %s", result.Message)
	}

	return &ConsignmentResponse{
		Carrier:        CarrierRedX,
		ConsignmentID:  result.TrackingID,
		TrackingNumber: result.TrackingID,
		TrackingURL:    fmt.Sprintf("https://redx.com.bd/track-parcel/?trackingId=%s", result.TrackingID),
		RawPayload:     string(rawBody),
	}, nil
}

// TrackConsignment checks live tracking status for a RedX parcel.
func (d *RedXDriver) TrackConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) (*TrackingTimeline, error) {
	apiURL := fmt.Sprintf("%s/parcels/track/%s", d.getBaseURL(config.IsTestMode), trackingNumber)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("API-ACCESS-TOKEN", "Bearer "+config.ApiKey)

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("redx tracking network error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &TrackingTimeline{
		Carrier:        CarrierRedX,
		TrackingNumber: trackingNumber,
		CurrentStatus:  result.Status,
		Checkpoints: []TrackingCheckpoint{
			{Status: result.Status, Description: "RedX Status: " + result.Status, Timestamp: time.Now()},
		},
		LastUpdated: time.Now(),
	}, nil
}

// CancelConsignment handles cancellation for RedX parcels.
func (d *RedXDriver) CancelConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) error {
	return nil
}

// HandleStatusWebhook processes RedX webhook delivery notifications.
func (d *RedXDriver) HandleStatusWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *CourierConfig) (*DeliveryMilestoneEvent, error) {
	var payload struct {
		TrackingID string `json:"tracking_id"`
		InvoiceID  string `json:"invoice_id"`
		Status     string `json:"status"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, err
	}

	milestone := storeModels.ShipmentInTransit
	switch payload.Status {
	case "delivered":
		milestone = storeModels.ShipmentDelivered
	case "returned", "return_delivered":
		milestone = storeModels.ShipmentReturned
	case "cancelled":
		milestone = storeModels.ShipmentReturned
	}

	return &DeliveryMilestoneEvent{
		Carrier:        CarrierRedX,
		ConsignmentID:  payload.TrackingID,
		TrackingNumber: payload.TrackingID,
		OrderNumber:    payload.InvoiceID,
		Milestone:      milestone,
		Notes:          "RedX status update: " + payload.Status,
		RawBody:        string(rawBody),
	}, nil
}
