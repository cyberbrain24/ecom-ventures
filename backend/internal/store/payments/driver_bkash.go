package payments

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

// BKashDriver implements PaymentGatewayDriver for bKash Tokenized Checkout v1.2.0-M.
type BKashDriver struct {
	httpClient *http.Client
	// baseURL overrides the sandbox or production host; empty in production code paths.
	baseURL string
}

// NewBKashDriver instantiates the bKash payment driver.
func NewBKashDriver() *BKashDriver {
	return &BKashDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *BKashDriver) getBaseURL(isTest bool) string {
	if d.baseURL != "" {
		return d.baseURL
	}
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
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("encoding bkash grant token request: %w", err)
	}

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
		return "", fmt.Errorf("decoding bkash grant token response: %w", err)
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
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encoding bkash create payment request: %w", err)
	}

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
		return nil, fmt.Errorf("decoding bkash create payment response: %w", err)
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

// bkashPaymentRecord is the verified payment state returned by bKash for a payment ID.
type bkashPaymentRecord struct {
	PaymentID             string `json:"paymentID"`
	TrxID                 string `json:"trxID"`
	MerchantInvoiceNumber string `json:"merchantInvoiceNumber"`
	Amount                string `json:"amount"`
	Currency              string `json:"currency"`
	TransactionStatus     string `json:"transactionStatus"`
	StatusCode            string `json:"statusCode"`
	StatusMessage         string `json:"statusMessage"`
}

// executePayment captures a payment after the customer approves it. It returns the provider record.
func (d *BKashDriver) executePayment(ctx context.Context, idToken string, config *GatewayConfig, paymentID string) ([]byte, error) {
	url := fmt.Sprintf("%s/execute", d.getBaseURL(config.IsTestMode))
	jsonBody, err := json.Marshal(map[string]string{"paymentID": paymentID})
	if err != nil {
		return nil, fmt.Errorf("encoding bkash execute request: %w", err)
	}

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

	rawBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading bkash execute response: %w", err)
	}
	return rawBytes, nil
}

// queryPayment asks bKash for the authoritative state of a payment ID using the store's credentials.
func (d *BKashDriver) queryPayment(ctx context.Context, idToken string, config *GatewayConfig, paymentID string) (*bkashPaymentRecord, []byte, error) {
	url := fmt.Sprintf("%s/payment/status", d.getBaseURL(config.IsTestMode))
	jsonBody, err := json.Marshal(map[string]string{"paymentID": paymentID})
	if err != nil {
		return nil, nil, fmt.Errorf("encoding bkash query request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", idToken)
	req.Header.Set("X-APP-Key", config.ClientID)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("bkash query payment network error: %w", err)
	}
	defer resp.Body.Close()

	rawBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("reading bkash query response: %w", err)
	}
	var record bkashPaymentRecord
	if err := json.Unmarshal(rawBytes, &record); err != nil {
		return nil, nil, fmt.Errorf("decoding bkash query response: %w", err)
	}
	return &record, rawBytes, nil
}

// VerifyPayment captures and verifies the executed bKash transaction.
func (d *BKashDriver) VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error) {
	paymentID := payload["paymentID"]
	status := payload["status"]

	if status == "cancel" || status == "failure" {
		return nil, ErrPaymentFailed
	}
	if paymentID == "" {
		return nil, errors.New("missing bKash paymentID in callback payload")
	}

	idToken, err := d.grantToken(ctx, config)
	if err != nil {
		return nil, err
	}

	rawBytes, err := d.executePayment(ctx, idToken, config, paymentID)
	if err != nil {
		return nil, err
	}

	var execResult bkashPaymentRecord
	if err := json.Unmarshal(rawBytes, &execResult); err != nil {
		return nil, fmt.Errorf("decoding bkash execute response: %w", err)
	}

	if execResult.TransactionStatus != "Completed" {
		return nil, fmt.Errorf("bkash execution failed: %s (%s)", execResult.StatusMessage, execResult.StatusCode)
	}

	amt, err := strconv.ParseFloat(execResult.Amount, 64)
	if err != nil {
		return nil, fmt.Errorf("bkash execution amount %q is not a number: %w", execResult.Amount, err)
	}

	return &PaymentVerifyResponse{
		TransactionID: execResult.TrxID,
		OrderID:       execResult.MerchantInvoiceNumber,
		Amount:        amt,
		Currency:      execResult.Currency,
		Status:        storeModels.PaymentStatusPaid,
		RawPayload:    string(rawBytes),
	}, nil
}

// HandleWebhook handles asynchronous bKash notifications. The notification body is not trusted:
// it is used only for its paymentID, and the payment state is re-queried from bKash with the
// store's credentials. The returned event is built from the bKash query response only.
func (d *BKashDriver) HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error) {
	if config == nil {
		return nil, errors.New("bkash webhook requires a gateway configuration")
	}
	var notice struct {
		PaymentID string `json:"paymentID"`
	}
	if err := json.Unmarshal(rawBody, &notice); err != nil {
		return nil, fmt.Errorf("decoding bkash webhook body: %w", err)
	}
	if notice.PaymentID == "" {
		return nil, errors.New("bkash webhook is missing paymentID; cannot verify settlement")
	}

	idToken, err := d.grantToken(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("verifying bkash webhook: %w", err)
	}

	record, rawResponse, err := d.queryPayment(ctx, idToken, config, notice.PaymentID)
	if err != nil {
		return nil, fmt.Errorf("verifying bkash webhook: %w", err)
	}
	if record.PaymentID != notice.PaymentID {
		return nil, fmt.Errorf("%w: bkash query returned a different paymentID", ErrSettlementMismatch)
	}

	status := storeModels.PaymentStatusPending
	if record.TransactionStatus == "Completed" {
		status = storeModels.PaymentStatusPaid
	}

	amt, err := strconv.ParseFloat(record.Amount, 64)
	if err != nil {
		return nil, fmt.Errorf("bkash query amount %q is not a number: %w", record.Amount, err)
	}

	return &WebhookEvent{
		Gateway:       GatewayBKash,
		EventID:       record.PaymentID,
		EventType:     "PAYMENT_" + record.TransactionStatus,
		TransactionID: record.TrxID,
		OrderID:       record.MerchantInvoiceNumber,
		Amount:        amt,
		Currency:      record.Currency,
		Status:        status,
		RawBody:       string(rawResponse),
	}, nil
}
