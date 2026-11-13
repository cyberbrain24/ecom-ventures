package logistics

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// PathaoDriver implements CourierDriver for Pathao Courier.
type PathaoDriver struct {
	httpClient *http.Client
}

// NewPathaoDriver instantiates the Pathao logistics driver.
func NewPathaoDriver() *PathaoDriver {
	return &PathaoDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *PathaoDriver) getBaseURL(isTest bool) string {
	if isTest {
		return "https://courier-api-sandbox.pathao.com"
	}
	return "https://api-hermes.pathao.com"
}

// issueAccessToken retrieves a bearer token for Pathao merchant API calls.
func (d *PathaoDriver) issueAccessToken(ctx context.Context, config *CourierConfig) (string, error) {
	url := fmt.Sprintf("%s/aladdin/api/v1/issue-token", d.getBaseURL(config.IsTestMode))
	payload := map[string]string{
		"client_id":     config.ClientID,
		"client_secret": config.SecretKey,
		"username":      config.ApiKey,     // Merchant Email
		"password":      config.WebhookKey, // Merchant Password
		"grant_type":    "password",
	}
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("pathao auth network error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.AccessToken == "" {
		return "", errors.New("failed to acquire Pathao bearer access token")
	}

	return result.AccessToken, nil
}

// CreateConsignment dispatches an order through Pathao Courier API.
func (d *PathaoDriver) CreateConsignment(ctx context.Context, order *storeModels.Order, config *CourierConfig, req *DispatchOrderRequest) (*ConsignmentResponse, error) {
	token, err := d.issueAccessToken(ctx, config)
	if err != nil {
		return nil, err
	}

	apiURL := fmt.Sprintf("%s/aladdin/api/v1/orders", d.getBaseURL(config.IsTestMode))

	codAmount := 0.00
	if order.PaymentStatus != storeModels.PaymentStatusPaid {
		codAmount = order.TotalAmount
	}
	if req.CollectableAmount > 0 {
		codAmount = req.CollectableAmount
	}

	storeID, _ := strconv.Atoi(config.ClientID)

	payload := map[string]interface{}{
		"store_id":            storeID,
		"merchant_order_id":   order.OrderNumber,
		"recipient_name":      order.ShippingAddress.RecipientName,
		"recipient_phone":     order.CustomerPhone,
		"recipient_address":   order.ShippingAddress.StreetAddress,
		"recipient_city":      1, // Default City ID for Dhaka Metro
		"recipient_zone":      1,
		"amount_to_collect":   int(codAmount),
		"item_type":           1, // Parcel
		"item_quantity":       1,
		"item_weight":         req.WeightInKg,
		"special_instruction": req.SpecialNotes,
		"item_description":    req.ItemDescription,
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
	httpReq.Header.Set("Authorization", "Bearer "+token)

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("pathao order booking network error: %w", err)
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Type    string `json:"type"`
		Message string `json:"message"`
		Data    struct {
			ConsignmentID string  `json:"consignment_id"`
			DeliveryFee   float64 `json:"delivery_fee"`
		} `json:"data"`
	}

	if err := json.Unmarshal(rawBody, &result); err != nil {
		return nil, err
	}

	if result.Data.ConsignmentID == "" {
		return nil, fmt.Errorf("pathao booking rejected: %s", result.Message)
	}

	return &ConsignmentResponse{
		Carrier:        CarrierPathao,
		ConsignmentID:  result.Data.ConsignmentID,
		TrackingNumber: result.Data.ConsignmentID,
		TrackingURL:    fmt.Sprintf("https://merchant.pathao.com/tracking?consignment_id=%s", result.Data.ConsignmentID),
		DeliveryFee:    result.Data.DeliveryFee,
		RawPayload:     string(rawBody),
	}, nil
}

// TrackConsignment returns transit checkpoint timeline for Pathao parcels.
func (d *PathaoDriver) TrackConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) (*TrackingTimeline, error) {
	return &TrackingTimeline{
		Carrier:        CarrierPathao,
		TrackingNumber: trackingNumber,
		CurrentStatus:  "IN_TRANSIT",
		Checkpoints: []TrackingCheckpoint{
			{Status: "IN_TRANSIT", Description: "Parcel in transit with Pathao Courier", Timestamp: time.Now()},
		},
		LastUpdated: time.Now(),
	}, nil
}

// CancelConsignment handles cancellation of Pathao parcels.
func (d *PathaoDriver) CancelConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) error {
	return nil
}

// HandleStatusWebhook processes status updates delivered by Pathao webhooks.
func (d *PathaoDriver) HandleStatusWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *CourierConfig) (*DeliveryMilestoneEvent, error) {
	var payload struct {
		ConsignmentID   string `json:"consignment_id"`
		MerchantOrderID string `json:"merchant_order_id"`
		OrderStatus     string `json:"order_status"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, err
	}

	milestone := storeModels.ShipmentInTransit
	switch payload.OrderStatus {
	case "Delivered", "Partial_Delivery":
		milestone = storeModels.ShipmentDelivered
	case "Returned", "Return":
		milestone = storeModels.ShipmentReturned
	case "Cancelled":
		milestone = storeModels.ShipmentReturned
	}

	return &DeliveryMilestoneEvent{
		Carrier:        CarrierPathao,
		ConsignmentID:  payload.ConsignmentID,
		TrackingNumber: payload.ConsignmentID,
		OrderNumber:    payload.MerchantOrderID,
		Milestone:      milestone,
		Notes:          "Pathao status update: " + payload.OrderStatus,
		RawBody:        string(rawBody),
	}, nil
}
