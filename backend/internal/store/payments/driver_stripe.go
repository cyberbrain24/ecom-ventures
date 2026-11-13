package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// StripeDriver implements PaymentGatewayDriver for Stripe Checkout.
type StripeDriver struct {
	httpClient *http.Client
}

// NewStripeDriver instantiates the Stripe payment driver.
func NewStripeDriver() *StripeDriver {
	return &StripeDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// InitiatePayment creates a Stripe Checkout session and returns the session redirect URL.
func (d *StripeDriver) InitiatePayment(ctx context.Context, order *storeModels.Order, config *GatewayConfig, returnURL, cancelURL string) (*PaymentInitResponse, error) {
	apiURL := "https://api.stripe.com/v1/checkout/sessions"

	// Stripe accepts amounts in cents/smallest currency unit
	amountInCents := int64(order.TotalAmount * 100)

	formData := url.Values{}
	formData.Set("mode", "payment")
	formData.Set("success_url", returnURL+"?session_id={CHECKOUT_SESSION_ID}")
	formData.Set("cancel_url", cancelURL)
	formData.Set("client_reference_id", order.OrderNumber)
	formData.Set("customer_email", order.CustomerEmail)

	formData.Set("line_items[0][price_data][currency]", strings.ToLower(order.Currency))
	formData.Set("line_items[0][price_data][product_data][name]", "Order "+order.OrderNumber)
	formData.Set("line_items[0][price_data][unit_amount]", strconv.FormatInt(amountInCents, 10))
	formData.Set("line_items[0][quantity]", "1")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+config.ClientSecret)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stripe checkout init network error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		ID  string `json:"id"`
		URL string `json:"url"`
		Err *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Err != nil {
		return nil, fmt.Errorf("stripe session creation error: %s", result.Err.Message)
	}

	return &PaymentInitResponse{
		Gateway:          GatewayStripe,
		TransactionID:    result.ID,
		RedirectURL:      result.URL,
		RequiresRedirect: true,
	}, nil
}

// VerifyPayment queries Stripe to verify the status of a checkout session.
func (d *StripeDriver) VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error) {
	sessionID := payload["session_id"]
	if sessionID == "" {
		return nil, errors.New("missing stripe session_id")
	}

	apiURL := fmt.Sprintf("https://api.stripe.com/v1/checkout/sessions/%s", sessionID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+config.ClientSecret)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stripe query session network error: %w", err)
	}
	defer resp.Body.Close()

	rawBytes, _ := io.ReadAll(resp.Body)
	var session struct {
		PaymentStatus     string `json:"payment_status"`
		PaymentIntent     string `json:"payment_intent"`
		ClientReferenceID string `json:"client_reference_id"`
		AmountTotal       int64  `json:"amount_total"`
		Currency          string `json:"currency"`
	}
	if err := json.Unmarshal(rawBytes, &session); err != nil {
		return nil, err
	}

	if session.PaymentStatus != "paid" {
		return nil, fmt.Errorf("stripe session unpaid: %s", session.PaymentStatus)
	}

	return &PaymentVerifyResponse{
		TransactionID: session.PaymentIntent,
		OrderID:       session.ClientReferenceID,
		Amount:        float64(session.AmountTotal) / 100.0,
		Currency:      strings.ToUpper(session.Currency),
		Status:        storeModels.PaymentStatusPaid,
		RawPayload:    string(rawBytes),
	}, nil
}

// HandleWebhook validates Stripe webhook HMAC-SHA256 signature and parses events.
func (d *StripeDriver) HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error) {
	sigHeader := headers["Stripe-Signature"]
	if sigHeader == "" {
		sigHeader = headers["stripe-signature"]
	}
	if sigHeader == "" {
		return nil, errors.New("missing stripe-signature header")
	}

	// Verify HMAC-SHA256 signature
	if config.WebhookKey != "" {
		var timestamp, signature string
		for _, part := range strings.Split(sigHeader, ",") {
			kv := strings.SplitN(part, "=", 2)
			if len(kv) == 2 {
				if strings.TrimSpace(kv[0]) == "t" {
					timestamp = strings.TrimSpace(kv[1])
				} else if strings.TrimSpace(kv[0]) == "v1" {
					signature = strings.TrimSpace(kv[1])
				}
			}
		}

		mac := hmac.New(sha256.New, []byte(config.WebhookKey))
		mac.Write([]byte(timestamp + "." + string(rawBody)))
		expectedSig := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			return nil, ErrInvalidSignature
		}
	}

	var event struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			Object struct {
				PaymentIntent     string `json:"payment_intent"`
				ClientReferenceID string `json:"client_reference_id"`
				AmountTotal       int64  `json:"amount_total"`
				Currency          string `json:"currency"`
				PaymentStatus     string `json:"payment_status"`
			} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &event); err != nil {
		return nil, err
	}

	status := storeModels.PaymentStatusPending
	if event.Data.Object.PaymentStatus == "paid" {
		status = storeModels.PaymentStatusPaid
	}

	return &WebhookEvent{
		Gateway:       GatewayStripe,
		EventID:       event.ID,
		EventType:     event.Type,
		TransactionID: event.Data.Object.PaymentIntent,
		OrderID:       event.Data.Object.ClientReferenceID,
		Amount:        float64(event.Data.Object.AmountTotal) / 100.0,
		Currency:      strings.ToUpper(event.Data.Object.Currency),
		Status:        status,
		RawBody:       string(rawBody),
	}, nil
}
