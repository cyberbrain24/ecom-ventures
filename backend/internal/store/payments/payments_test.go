package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

func TestGatewayRegistryResolution(t *testing.T) {
	registry := NewDriverRegistry()

	gateways := []GatewayType{GatewayBKash, GatewaySSLCommerz, GatewayStripe, GatewayCOD}
	for _, gw := range gateways {
		driver, err := registry.GetDriver(gw)
		if err != nil || driver == nil {
			t.Errorf("expected driver for gateway %s, got error: %v", gw, err)
		}
	}

	// Unknown gateway resolution
	_, err := registry.GetDriver("UNKNOWN_PAY")
	if err == nil {
		t.Errorf("expected error for unsupported gateway")
	}
}

func TestCODSettlementDriver(t *testing.T) {
	driver := NewCODSettlementDriver()
	order := &storeModels.Order{
		OrderNumber: "ORD-260101-ABC",
		TotalAmount: 1500.00,
	}

	initResp, err := driver.InitiatePayment(context.Background(), order, nil, "http://localhost/success", "http://localhost/cancel")
	if err != nil {
		t.Fatalf("unexpected COD error: %v", err)
	}

	if initResp.RequiresRedirect {
		t.Errorf("COD should not require external redirect")
	}
	if initResp.TransactionID != "ORD-260101-ABC" {
		t.Errorf("expected order number as COD transaction reference")
	}

	verifyResp, err := driver.VerifyPayment(context.Background(), map[string]string{
		"transaction_id": "ORD-260101-ABC",
		"order_id":       "ORD-260101-ABC",
	}, nil)
	if err != nil {
		t.Fatalf("unexpected COD verification error: %v", err)
	}
	if verifyResp.Status != storeModels.PaymentStatusPending {
		t.Errorf("expected COD status to be PENDING, got %s", verifyResp.Status)
	}

	// COD should reject digital webhooks
	_, err = driver.HandleWebhook(context.Background(), []byte("{}"), nil, nil)
	if err == nil {
		t.Errorf("expected COD to reject webhook")
	}
}

// signedStripeHeader builds a Stripe-Signature header for the payload at the given timestamp.
func signedStripeHeader(secret, timestamp, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "." + payload))
	return fmt.Sprintf("t=%s,v1=%s", timestamp, hex.EncodeToString(mac.Sum(nil)))
}

func TestStripeWebhookSignatureVerification(t *testing.T) {
	driver := NewStripeDriver()
	secret := "whsec_test_secret_key"
	payload := `{"id":"evt_123","type":"checkout.session.completed","data":{"object":{"payment_intent":"pi_999","client_reference_id":"ORD-1","amount_total":5000,"currency":"bdt","payment_status":"paid"}}}`
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	headers := map[string]string{
		"Stripe-Signature": signedStripeHeader(secret, timestamp, payload),
	}

	config := &GatewayConfig{
		WebhookKey: secret,
	}

	event, err := driver.HandleWebhook(context.Background(), []byte(payload), headers, config)
	if err != nil {
		t.Fatalf("signature verification failed: %v", err)
	}

	if event.TransactionID != "pi_999" {
		t.Errorf("expected transaction ID pi_999, got %s", event.TransactionID)
	}
	if event.Amount != 50.00 {
		t.Errorf("expected amount 50.00 (from 5000 cents), got %.2f", event.Amount)
	}
	if event.Status != storeModels.PaymentStatusPaid {
		t.Errorf("expected status PAID, got %s", event.Status)
	}

	// Invalid signature test
	badHeaders := map[string]string{
		"Stripe-Signature": fmt.Sprintf("t=%s,v1=bad_signature_here", timestamp),
	}
	_, err = driver.HandleWebhook(context.Background(), []byte(payload), badHeaders, config)
	if err != ErrInvalidSignature {
		t.Errorf("expected ErrInvalidSignature, got: %v", err)
	}
}

func TestStripeWebhookRequiresSecret(t *testing.T) {
	driver := NewStripeDriver()
	payload := `{"id":"evt_1","type":"checkout.session.completed","data":{"object":{}}}`
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	headers := map[string]string{"Stripe-Signature": signedStripeHeader("any", timestamp, payload)}

	_, err := driver.HandleWebhook(context.Background(), []byte(payload), headers, &GatewayConfig{})
	if !errors.Is(err, ErrStripeWebhookSecretRequired) {
		t.Fatalf("expected ErrStripeWebhookSecretRequired when no webhook secret is configured, got: %v", err)
	}
}

func TestStripeWebhookRejectsStaleTimestamp(t *testing.T) {
	driver := NewStripeDriver()
	secret := "whsec_test_secret_key"
	payload := `{"id":"evt_2","type":"checkout.session.completed","data":{"object":{"payment_status":"paid"}}}`
	stale := fmt.Sprintf("%d", time.Now().Add(-6*time.Minute).Unix())
	headers := map[string]string{"Stripe-Signature": signedStripeHeader(secret, stale, payload)}

	_, err := driver.HandleWebhook(context.Background(), []byte(payload), headers, &GatewayConfig{WebhookKey: secret})
	if !errors.Is(err, ErrStripeTimestampOutOfTolerance) {
		t.Fatalf("expected ErrStripeTimestampOutOfTolerance for a 6 minute old event, got: %v", err)
	}
}

// newGatewayStub starts an HTTP server that answers the provider endpoints a driver calls.
func newGatewayStub(t *testing.T, routes map[string]string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := routes[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestSSLCommerzWebhookUsesValidationResponseNotBody(t *testing.T) {
	server := newGatewayStub(t, map[string]string{
		"/validator/api/validationserverAPI.php": `{"status":"VALID","tran_id":"ORD-999","val_id":"VAL_12345","amount":"850.00","currency":"BDT","bank_tran_id":"BANK_TXN_001"}`,
	})
	driver := NewSSLCommerzDriver()
	driver.baseURL = server.URL

	// The forged body claims a different amount; the event must carry the validated amount.
	formData := "status=VALID&tran_id=ORD-999&val_id=VAL_12345&bank_tran_id=FORGED&currency=BDT&amount=1.00"
	event, err := driver.HandleWebhook(context.Background(), []byte(formData), nil, &GatewayConfig{AccountID: "store", ClientSecret: "pwd"})
	if err != nil {
		t.Fatalf("expected validated IPN to succeed, got: %v", err)
	}
	if event.OrderID != "ORD-999" || event.TransactionID != "BANK_TXN_001" {
		t.Errorf("expected identifiers from validation response, got order %s txn %s", event.OrderID, event.TransactionID)
	}
	if event.Amount != 850.00 {
		t.Errorf("expected validated amount 850.00, got %.2f", event.Amount)
	}
	if event.Status != storeModels.PaymentStatusPaid {
		t.Errorf("expected status PAID, got %s", event.Status)
	}
}

func TestSSLCommerzWebhookRejectsUnvalidatedSettlement(t *testing.T) {
	server := newGatewayStub(t, map[string]string{
		"/validator/api/validationserverAPI.php": `{"status":"INVALID_TRANSACTION"}`,
	})
	driver := NewSSLCommerzDriver()
	driver.baseURL = server.URL

	formData := "status=VALID&tran_id=ORD-999&val_id=VAL_FAKE&amount=850.00&currency=BDT"
	if _, err := driver.HandleWebhook(context.Background(), []byte(formData), nil, &GatewayConfig{AccountID: "store", ClientSecret: "pwd"}); err == nil {
		t.Fatalf("expected an IPN that the validation API does not confirm to be rejected")
	}
}

func TestBKashWebhookRequeriesPaymentState(t *testing.T) {
	server := newGatewayStub(t, map[string]string{
		"/token/grant":    `{"id_token":"tok"}`,
		"/payment/status": `{"paymentID":"bkash_pay_123","trxID":"TRX_XYZ789","merchantInvoiceNumber":"ORD-2026-001","amount":"1250.50","currency":"BDT","transactionStatus":"Completed"}`,
	})
	driver := NewBKashDriver()
	driver.baseURL = server.URL

	// The forged notice claims a different state; only the query response is trusted.
	payload := `{"paymentID":"bkash_pay_123","transactionStatus":"Initiated","amount":"1.00"}`
	event, err := driver.HandleWebhook(context.Background(), []byte(payload), nil, &GatewayConfig{ClientID: "app", ClientSecret: "sec", AccountID: "acc", WebhookKey: "pw"})
	if err != nil {
		t.Fatalf("failed to verify bKash webhook: %v", err)
	}
	if event.TransactionID != "TRX_XYZ789" {
		t.Errorf("expected TrxID TRX_XYZ789, got %s", event.TransactionID)
	}
	if event.Amount != 1250.50 {
		t.Errorf("expected amount 1250.50 from query, got %.2f", event.Amount)
	}
	if event.Status != storeModels.PaymentStatusPaid {
		t.Errorf("expected status PAID, got %s", event.Status)
	}
}

func TestBKashWebhookRejectsMismatchedPaymentID(t *testing.T) {
	server := newGatewayStub(t, map[string]string{
		"/token/grant":    `{"id_token":"tok"}`,
		"/payment/status": `{"paymentID":"other_payment","trxID":"T","merchantInvoiceNumber":"ORD-1","amount":"10.00","currency":"BDT","transactionStatus":"Completed"}`,
	})
	driver := NewBKashDriver()
	driver.baseURL = server.URL

	_, err := driver.HandleWebhook(context.Background(), []byte(`{"paymentID":"bkash_pay_123"}`), nil, &GatewayConfig{ClientID: "app", ClientSecret: "sec", WebhookKey: "pw"})
	if !errors.Is(err, ErrSettlementMismatch) {
		t.Fatalf("expected ErrSettlementMismatch for a query response with a different paymentID, got: %v", err)
	}
}

func TestVerifySettlementMatchesOrder(t *testing.T) {
	order := &storeModels.Order{OrderNumber: "ORD-1", TotalAmount: 900.00, Currency: "BDT"}

	if err := verifySettlementMatchesOrder(order, "ORD-1", 900.00, "bdt"); err != nil {
		t.Fatalf("expected matching settlement to pass, got: %v", err)
	}
	if err := verifySettlementMatchesOrder(order, "ORD-1", 1.00, "BDT"); !errors.Is(err, ErrSettlementMismatch) {
		t.Errorf("expected amount mismatch to be rejected, got: %v", err)
	}
	if err := verifySettlementMatchesOrder(order, "ORD-1", 900.00, "USD"); !errors.Is(err, ErrSettlementMismatch) {
		t.Errorf("expected currency mismatch to be rejected, got: %v", err)
	}
	if err := verifySettlementMatchesOrder(order, "ORD-2", 900.00, "BDT"); !errors.Is(err, ErrSettlementMismatch) {
		t.Errorf("expected order reference mismatch to be rejected, got: %v", err)
	}
}
