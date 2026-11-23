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

// sslcommerzWebhookPath is the storefront route that receives SSLCommerz Instant Payment Notifications.
const sslcommerzWebhookPath = "/api/v1/storefront/payments/SSLCOMMERZ/webhook"

// SSLCommerzDriver implements PaymentGatewayDriver for SSLCommerz Hosted Checkout (v4).
type SSLCommerzDriver struct {
	httpClient *http.Client
	// baseURL overrides the sandbox or production host; empty in production code paths.
	baseURL string
}

// NewSSLCommerzDriver instantiates the SSLCommerz payment driver.
func NewSSLCommerzDriver() *SSLCommerzDriver {
	return &SSLCommerzDriver{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (d *SSLCommerzDriver) getBaseURL(isTest bool) string {
	if d.baseURL != "" {
		return d.baseURL
	}
	if isTest {
		return "https://sandbox.sslcommerz.com"
	}
	return "https://securepay.sslcommerz.com"
}

// ipnURLFor derives the IPN endpoint on the same storefront origin as the return URL.
// SSLCommerz posts IPNs to this URL, and the handler then verifies them with the validation API.
func ipnURLFor(returnURL string) string {
	parsed, err := url.Parse(returnURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host + sslcommerzWebhookPath
}

// InitiatePayment starts an SSLCommerz hosted session and returns the GatewayPageURL.
func (d *SSLCommerzDriver) InitiatePayment(ctx context.Context, order *storeModels.Order, config *GatewayConfig, returnURL, cancelURL string) (*PaymentInitResponse, error) {
	apiURL := fmt.Sprintf("%s/gwprocess/v4/api.php", d.getBaseURL(config.IsTestMode))

	ipnURL := ipnURLFor(returnURL)
	if ipnURL == "" {
		return nil, errors.New("sslcommerz: return URL must be an absolute URL to derive the IPN endpoint")
	}

	formData := url.Values{}
	formData.Set("store_id", config.AccountID)
	formData.Set("store_passwd", config.ClientSecret)
	formData.Set("total_amount", fmt.Sprintf("%.2f", order.TotalAmount))
	formData.Set("currency", order.Currency)
	formData.Set("tran_id", order.OrderNumber)
	formData.Set("success_url", returnURL)
	formData.Set("fail_url", cancelURL)
	formData.Set("cancel_url", cancelURL)
	formData.Set("ipn_url", ipnURL)

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

// VerifyPayment validates an SSLCommerz payment settlement against the validation server API.
// The returned amount, currency and transaction reference come from the validation response only.
func (d *SSLCommerzDriver) VerifyPayment(ctx context.Context, payload map[string]string, config *GatewayConfig) (*PaymentVerifyResponse, error) {
	valID := payload["val_id"]
	if valID == "" {
		return nil, errors.New("missing SSLCommerz val_id in validation payload")
	}

	query := url.Values{}
	query.Set("val_id", valID)
	query.Set("store_id", config.AccountID)
	query.Set("store_passwd", config.ClientSecret)
	query.Set("v", "1")
	query.Set("format", "json")
	validateURL := fmt.Sprintf("%s/validator/api/validationserverAPI.php?%s", d.getBaseURL(config.IsTestMode), query.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, validateURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sslcommerz validation query error: %w", err)
	}
	defer resp.Body.Close()

	rawBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading sslcommerz validation response: %w", err)
	}
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
		return nil, fmt.Errorf("decoding sslcommerz validation response: %w", err)
	}

	if result.Status != "VALID" && result.Status != "VALIDATED" {
		return nil, fmt.Errorf("sslcommerz settlement invalid: %s", result.Status)
	}
	if result.ValID != valID {
		return nil, fmt.Errorf("%w: validation response val_id does not match the request", ErrSettlementMismatch)
	}

	amt, err := strconv.ParseFloat(result.Amount, 64)
	if err != nil {
		return nil, fmt.Errorf("sslcommerz validation amount %q is not a number: %w", result.Amount, err)
	}

	return &PaymentVerifyResponse{
		TransactionID: result.BankTranID,
		OrderID:       result.TranID,
		Amount:        amt,
		Currency:      result.Currency,
		Status:        storeModels.PaymentStatusPaid,
		RawPayload:    string(rawBytes),
	}, nil
}

// HandleWebhook handles SSLCommerz Instant Payment Notifications (IPN). The IPN body is not trusted:
// a VALID or VALIDATED notification is confirmed through the validation API with the store's
// credentials, and the event returned is built from that validation response only.
func (d *SSLCommerzDriver) HandleWebhook(ctx context.Context, rawBody []byte, headers map[string]string, config *GatewayConfig) (*WebhookEvent, error) {
	if config == nil {
		return nil, errors.New("sslcommerz webhook requires a gateway configuration")
	}
	vals, err := url.ParseQuery(string(rawBody))
	if err != nil {
		return nil, fmt.Errorf("parsing sslcommerz IPN body: %w", err)
	}

	status := vals.Get("status")
	valID := vals.Get("val_id")

	if status == "FAILED" || status == "CANCELLED" {
		return &WebhookEvent{
			Gateway:   GatewaySSLCommerz,
			EventID:   valID,
			EventType: "IPN_" + status,
			OrderID:   vals.Get("tran_id"),
			Status:    storeModels.PaymentStatusFailed,
			RawBody:   string(rawBody),
		}, nil
	}
	if status != "VALID" && status != "VALIDATED" {
		return &WebhookEvent{
			Gateway:   GatewaySSLCommerz,
			EventID:   valID,
			EventType: "IPN_" + status,
			OrderID:   vals.Get("tran_id"),
			Status:    storeModels.PaymentStatusPending,
			RawBody:   string(rawBody),
		}, nil
	}

	if valID == "" {
		return nil, errors.New("sslcommerz IPN is missing val_id; cannot verify settlement")
	}

	verified, err := d.VerifyPayment(ctx, map[string]string{"val_id": valID}, config)
	if err != nil {
		return nil, fmt.Errorf("verifying sslcommerz IPN: %w", err)
	}

	return &WebhookEvent{
		Gateway:       GatewaySSLCommerz,
		EventID:       valID,
		EventType:     "IPN_" + status,
		TransactionID: verified.TransactionID,
		OrderID:       verified.OrderID,
		Amount:        verified.Amount,
		Currency:      verified.Currency,
		Status:        verified.Status,
		RawBody:       verified.RawPayload,
	}, nil
}
