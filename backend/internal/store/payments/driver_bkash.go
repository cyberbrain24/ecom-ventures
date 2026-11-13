package payments

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

// BKashDriver implements PaymentGatewayDriver for bKash Tokenized Checkout v1.2.0-M.
type BKashDriver struct {
	httpClient *http.Client
}

// NewBKashDriver instantiates the bKash payment driver.
func NewBKashDriver() *BKashDriver {
	return &BKashDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *BKashDriver) getBaseURL(isTest bool) string {
	if isTest {
		return "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout"
	}
	return "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout"
}

// grantToken retrieves an authorization bearer token from bKash.
func (d *BKashDriver) grantToken(ctx context.Context, config *GatewayConfig) (string, error) {
	url := fmt.Sprintf("%s/token/grant", d.getBaseURL(config.IsTestMode))
	payload := map[string]string{
		"app_key":    config.ClientID,
		"app_secret": config.ClientSecret,
	}
	jsonBody, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("username", config.AccountID)
	req.Header.Set("password", config.WebhookKey) // Used as merchant password in sandbox

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("bkash grant token network error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		IDToken       string `json:"id_token"`
		StatusCode    string `json:"statusCode"`
		StatusMessage string `json:"statusMessage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.IDToken == "" {
		return "", fmt.Errorf("bkash grant token failed: %s (%s)", result.StatusMessage, result.StatusCode)
	}

	return result.IDToken, nil
}

// InitiatePayment creates a tokenized checkout URL for bKash.
func (d *BKashDriver) InitiatePayment(ctx context.Context, order *storeModels.Order, config *GatewayConfig, returnURL, cancelURL string) (*PaymentInitResponse, error) {
	idToken, err := d.grantToken(ctx, config)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/create", d.getBaseURL(config.IsTestMode))
	payload := map[string]interface{}{
		"mode":                  "0011",
		"payerReference":        order.CustomerPhone,
		"callbackURL":           returnURL,
		"amount":                fmt.Sprintf("%.2f", order.TotalAmount),
		"currency":              "BDT",
		"intent":                "sale",
		"merchantInvoiceNumber": order.OrderNumber,
	}
	jsonBody, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", idToken)
	req.Header.Set("X-APP-Key", config.ClientID)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bkash create payment request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		PaymentID     string `json:"paymentID"`
		BKashURL      string `json:"bkashURL"`
		StatusCode    string `json:"statusCode"`
		StatusMessage string `json:"statusMessage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if result.PaymentID == "" || result.BKashURL == "" {
		return nil, fmt.Errorf("bkash create payment error: %s (%s)", result.StatusMessage, result.StatusCode)
	}

	return &PaymentInitResponse{
		Gateway:          GatewayBKash,
		TransactionID:    result.PaymentID,
		RedirectURL:      result.BKashURL,
		RequiresRedirect: true,
	}, nil
}

// VerifyPayment captures and verifies the executed bKash transaction.
func (d *BKashDriver) VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error) {
	paymentID := payload["paymentID"]
	status := payload["status"]

	if status == "cancel" || status == "failure" {
		return nil, ErrPaymentFailed
	}

	idToken, err := d.grantToken(ctx, config)
	if err != nil {
		return nil, err
	}

	// Execute payment to capture transaction
	url := fmt.Sprintf("%s/execute", d.getBaseURL(config.IsTestMode))
	execPayload := map[string]string{"paymentID": paymentID}
	jsonBody, _ := json.Marshal(execPayload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", idToken)
	req.Header.Set("X-APP-Key", config.ClientID)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bkash execute payment network error: %w", err)
	}
	defer resp.Body.Close()

	rawBytes, _ := io.ReadAll(resp.Body)
	var execResult struct {
		PaymentID             string `json:"paymentID"`
		TrxID                 string `json:"trxID"`
		MerchantInvoiceNumber string `json:"merchantInvoiceNumber"`
		Amount                string `json:"amount"`
		Currency              string `json:"currency"`
		TransactionStatus     string `json:"transactionStatus"`
		StatusCode            string `json:"statusCode"`
		StatusMessage         string `json:"statusMessage"`
	}
	if err := json.Unmarshal(rawBytes, &execResult); err != nil {
		return nil, err
	}

	if execResult.TransactionStatus != "Completed" {
		return nil, fmt.Errorf("bkash execution failed: %s (%s)", execResult.StatusMessage, execResult.StatusCode)
	}

	amt, _ := strconv.ParseFloat(execResult.Amount, 64)

	return &PaymentVerifyResponse{
		TransactionID: execResult.TrxID,
		OrderID:       execResult.MerchantInvoiceNumber,
		Amount:        amt,
		Currency:      execResult.Currency,
		Status:        storeModels.PaymentStatusPaid,
		RawPayload:    string(rawBytes),
	}, nil
}

// HandleWebhook normalizes asynchronous bKash webhook notifications.
func (d *BKashDriver) HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error) {
	var event struct {
		PaymentID             string `json:"paymentID"`
		TrxID                 string `json:"trxID"`
		MerchantInvoiceNumber string `json:"merchantInvoiceNumber"`
		Amount                string `json:"amount"`
		Currency              string `json:"currency"`
		TransactionStatus     string `json:"transactionStatus"`
	}
	if err := json.Unmarshal(rawBody, &event); err != nil {
		return nil, err
	}

	status := storeModels.PaymentStatusPending
	if event.TransactionStatus == "Completed" {
		status = storeModels.PaymentStatusPaid
	}

	amt, _ := strconv.ParseFloat(event.Amount, 64)

	return &WebhookEvent{
		Gateway:       GatewayBKash,
		EventID:       event.PaymentID,
		EventType:     "PAYMENT_" + event.TransactionStatus,
		TransactionID: event.TrxID,
		OrderID:       event.MerchantInvoiceNumber,
		Amount:        amt,
		Currency:      event.Currency,
		Status:        status,
		RawBody:       string(rawBody),
	}, nil
}
