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
	"strings"
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

// pathaoLocation is one entry of a Pathao city or zone listing.
type pathaoLocation struct {
	ID   int
	Name string
}

// fetchLocations reads a Pathao location listing. idKey and nameKey select the id and name fields
// of each entry (city_id/city_name or zone_id/zone_name).
func (d *PathaoDriver) fetchLocations(ctx context.Context, token, url, idKey, nameKey string) ([]pathaoLocation, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("building pathao location request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pathao location lookup network error: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pathao location lookup returned HTTP %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Data []map[string]interface{} `json:"data"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding pathao location listing: %w", err)
	}
	out := make([]pathaoLocation, 0, len(result.Data.Data))
	for _, row := range result.Data.Data {
		idVal, ok := row[idKey].(float64)
		if !ok {
			continue
		}
		name, _ := row[nameKey].(string)
		out = append(out, pathaoLocation{ID: int(idVal), Name: name})
	}
	return out, nil
}

// matchLocation finds the entry whose name equals want, ignoring case and surrounding space.
func matchLocation(locs []pathaoLocation, want string) (int, bool) {
	want = strings.ToLower(strings.TrimSpace(want))
	if want == "" {
		return 0, false
	}
	for _, l := range locs {
		if strings.ToLower(strings.TrimSpace(l.Name)) == want {
			return l.ID, true
		}
	}
	return 0, false
}

// resolveLocation maps the order's city and state/province (zone) names to Pathao city and zone IDs
// through the Pathao location API. An address that does not match is an error; no default city or
// zone is ever substituted.
func (d *PathaoDriver) resolveLocation(ctx context.Context, token string, config *CourierConfig, city string, zone *string) (int, int, error) {
	if strings.TrimSpace(city) == "" {
		return 0, 0, errors.New("pathao: the shipping address has no city")
	}
	if zone == nil || strings.TrimSpace(*zone) == "" {
		return 0, 0, errors.New("pathao: the shipping address has no zone; set the state/province field to the Pathao zone name")
	}
	base := d.getBaseURL(config.IsTestMode)

	cities, err := d.fetchLocations(ctx, token, base+"/aladdin/api/v1/countries/1/city-list", "city_id", "city_name")
	if err != nil {
		return 0, 0, err
	}
	cityID, ok := matchLocation(cities, city)
	if !ok {
		return 0, 0, fmt.Errorf("pathao: city %q is not a Pathao city", city)
	}

	zones, err := d.fetchLocations(ctx, token, fmt.Sprintf("%s/aladdin/api/v1/cities/%d/zone-list", base, cityID), "zone_id", "zone_name")
	if err != nil {
		return 0, 0, err
	}
	zoneID, ok := matchLocation(zones, *zone)
	if !ok {
		return 0, 0, fmt.Errorf("pathao: zone %q is not a Pathao zone in city %q", *zone, city)
	}
	return cityID, zoneID, nil
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

	storeID, err := strconv.Atoi(config.ClientID)
	if err != nil {
		return nil, fmt.Errorf("pathao store id (stored in the client id field) must be numeric, got %q: %w", config.ClientID, err)
	}

	cityID, zoneID, err := d.resolveLocation(ctx, token, config, order.ShippingAddress.City, order.ShippingAddress.StateProvince)
	if err != nil {
		return nil, err
	}

	payload := map[string]interface{}{
		"store_id":            storeID,
		"merchant_order_id":   order.OrderNumber,
		"recipient_name":      order.ShippingAddress.RecipientName,
		"recipient_phone":     order.CustomerPhone,
		"recipient_address":   order.ShippingAddress.StreetAddress,
		"recipient_city":      cityID,
		"recipient_zone":      zoneID,
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

// TrackConsignment is not integrated for Pathao yet. It returns ErrTrackingNotImplemented rather than
// a fixed status, so no shipment is ever shown as in transit without the carrier confirming it.
func (d *PathaoDriver) TrackConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) (*TrackingTimeline, error) {
	return nil, fmt.Errorf("pathao: %w", ErrTrackingNotImplemented)
}

// CancelConsignment is not integrated for Pathao yet. It returns an explicit error instead of
// reporting a cancellation that never reached the carrier.
func (d *PathaoDriver) CancelConsignment(ctx context.Context, trackingNumber string, config *CourierConfig) error {
	return fmt.Errorf("pathao: %w", ErrCancellationNotImplemented)
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
