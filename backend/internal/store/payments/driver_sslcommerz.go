package payments

import (
	"context"
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

// SSLCommerzDriver implements PaymentGatewayDriver for SSLCommerz Hosted Checkout (v4).
type SSLCommerzDriver struct {
	httpClient *http.Client
}

// NewSSLCommerzDriver instantiates the SSLCommerz payment driver.
func NewSSLCommerzDriver() *SSLCommerzDriver {
	return &SSLCommerzDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *SSLCommerzDriver) getBaseURL(isTest bool) string {
	if isTest {
		return "https://sandbox.sslcommerz.com"
	}
	return "https://securepay.sslcommerz.com"
}

// InitiatePayment starts an SSLCommerz hosted session and returns the GatewayPageURL.
func (d *SSLCommerzDriver) InitiatePayment(ctx context.Context, order *storeModels.Order, config *GatewayConfig, returnURL, cancelURL string) (*PaymentInitResponse, error) {
	apiURL := fmt.Sprintf("%s/gwprocess/v4/api.php", d.getBaseURL(config.IsTestMode))

	formData := url.Values{}
	formData.Set("store_id", config.AccountID)
	formData.Set("store_passwd", config.ClientSecret)
	formData.Set("total_amount", fmt.Sprintf("%.2f", order.TotalAmount))
	formData.Set("currency", order.Currency)
	formData.Set("tran_id", order.OrderNumber)
	formData.Set("success_url", returnURL)
	formData.Set("fail_url", cancelURL)
	formData.Set("cancel_url", cancelURL)
	formData.Set("ipn_url", returnURL)

	// Customer parameters
	formData.Set("cus_name", order.ShippingAddress.RecipientName)
	formData.Set("cus_email", order.CustomerEmail)
	formData.Set("cus_add1", order.ShippingAddress.StreetAddress)
	formData.Set("cus_city", order.ShippingAddress.City)
	formData.Set("cus_country", "Bangladesh")
	formData.Set("cus_phone", order.CustomerPhone)

	// Shipping parameters
	formData.Set("shipping_method", "COURIER")
	formData.Set("num_of_item", "1")
	formData.Set("product_name", "Order-"+order.OrderNumber)
	formData.Set("product_category", "Retail")
	formData.Set("product_profile", "general")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sslcommerz init network error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status       string `json:"status"`
		FailedReason string `json:"failedreason"`
		GatewayURL   string `json:"GatewayPageURL"`
		SessionKey   string `json:"sessionkey"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != "SUCCESS" || result.GatewayURL == "" {
		return nil, fmt.Errorf("sslcommerz initiation rejected: %s", result.FailedReason)
	}

	return &PaymentInitResponse{
		Gateway:          GatewaySSLCommerz,
		TransactionID:    result.SessionKey,
		RedirectURL:      result.GatewayURL,
		RequiresRedirect: true,
	}, nil
}

// VerifyPayment validates an SSLCommerz payment settlement against validation server API.
func (d *SSLCommerzDriver) VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error) {
	valID := payload["val_id"]
	if valID == "" {
		return nil, errors.New("missing SSLCommerz val_id in validation payload")
	}

	validateURL := fmt.Sprintf("%s/validator/api/validationserverAPI.php?val_id=%s&store_id=%s&store_passwd=%s&v=1&format=json",
		d.getBaseURL(config.IsTestMode), valID, config.AccountID, config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, validateURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sslcommerz validation query error: %w", err)
	}
	defer resp.Body.Close()

	rawBytes, _ := io.ReadAll(resp.Body)
	var result struct {
		Status     string `json:"status"`
		TranID     string `json:"tran_id"`
		ValID      string `json:"val_id"`
		Amount     string `json:"amount"`
		Currency   string `json:"currency"`
		BankTranID string `json:"bank_tran_id"`
		CardType   string `json:"card_type"`
	}
	if err := json.Unmarshal(rawBytes, &result); err != nil {
		return nil, err
	}

	if result.Status != "VALID" && result.Status != "VALIDATED" {
		return nil, fmt.Errorf("sslcommerz settlement invalid: %s", result.Status)
	}

	amt, _ := strconv.ParseFloat(result.Amount, 64)

	return &PaymentVerifyResponse{
		TransactionID: result.BankTranID,
		OrderID:       result.TranID,
		Amount:        amt,
		Currency:      result.Currency,
		Status:        storeModels.PaymentStatusPaid,
		RawPayload:    string(rawBytes),
	}, nil
}

// HandleWebhook normalizes SSLCommerz Instant Payment Notifications (IPN).
func (d *SSLCommerzDriver) HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error) {
	vals, err := url.ParseQuery(string(rawBody))
	if err != nil {
		return nil, err
	}

	status := vals.Get("status")
	tranID := vals.Get("tran_id")
	valID := vals.Get("val_id")
	bankTranID := vals.Get("bank_tran_id")
	currency := vals.Get("currency")
	amt, _ := strconv.ParseFloat(vals.Get("amount"), 64)

	payStatus := storeModels.PaymentStatusPending
	if status == "VALID" || status == "VALIDATED" {
		payStatus = storeModels.PaymentStatusPaid
	} else if status == "FAILED" || status == "CANCELLED" {
		payStatus = storeModels.PaymentStatusFailed
	}

	return &WebhookEvent{
		Gateway:       GatewaySSLCommerz,
		EventID:       valID,
		EventType:     "IPN_" + status,
		TransactionID: bankTranID,
		OrderID:       tranID,
		Amount:        amt,
		Currency:      currency,
		Status:        payStatus,
		RawBody:       string(rawBody),
	}, nil
}
