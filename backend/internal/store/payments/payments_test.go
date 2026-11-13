package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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

func TestStripeWebhookSignatureVerification(t *testing.T) {
	driver := NewStripeDriver()
	secret := "whsec_test_secret_key"
	payload := `{"id":"evt_123","type":"checkout.session.completed","data":{"object":{"payment_intent":"pi_999","client_reference_id":"ORD-1","amount_total":5000,"currency":"bdt","payment_status":"paid"}}}`
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "." + payload))
	sig := hex.EncodeToString(mac.Sum(nil))

	headers := map[string]string{
		"Stripe-Signature": fmt.Sprintf("t=%s,v1=%s", timestamp, sig),
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

func TestBKashWebhookParsing(t *testing.T) {
	driver := NewBKashDriver()
	payload := `{"paymentID":"bkash_pay_123","trxID":"TRX_XYZ789","merchantInvoiceNumber":"ORD-2026-001","amount":"1250.50","currency":"BDT","transactionStatus":"Completed"}`

	event, err := driver.HandleWebhook(context.Background(), []byte(payload), nil, nil)
	if err != nil {
		t.Fatalf("failed to parse bKash webhook: %v", err)
	}

	if event.TransactionID != "TRX_XYZ789" {
		t.Errorf("expected TrxID TRX_XYZ789, got %s", event.TransactionID)
	}
	if event.Amount != 1250.50 {
		t.Errorf("expected amount 1250.50, got %.2f", event.Amount)
	}
	if event.Status != storeModels.PaymentStatusPaid {
		t.Errorf("expected status PAID, got %s", event.Status)
	}
}

func TestSSLCommerzWebhookParsing(t *testing.T) {
	driver := NewSSLCommerzDriver()
	formData := "status=VALID&tran_id=ORD-999&val_id=VAL_12345&bank_tran_id=BANK_TXN_001&currency=BDT&amount=850.00"

	event, err := driver.HandleWebhook(context.Background(), []byte(formData), nil, nil)
	if err != nil {
		t.Fatalf("failed to parse SSLCommerz IPN: %v", err)
	}

	if event.OrderID != "ORD-999" {
		t.Errorf("expected order ID ORD-999, got %s", event.OrderID)
	}
	if event.TransactionID != "BANK_TXN_001" {
		t.Errorf("expected bank tran id BANK_TXN_001, got %s", event.TransactionID)
	}
	if event.Amount != 850.00 {
		t.Errorf("expected amount 850.00, got %.2f", event.Amount)
	}
	if event.Status != storeModels.PaymentStatusPaid {
		t.Errorf("expected status PAID, got %s", event.Status)
	}
}
