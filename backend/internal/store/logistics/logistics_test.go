package logistics

import (
	"context"
	"strings"
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
)

func TestCourierDriverRegistry(t *testing.T) {
	registry := NewDriverRegistry()

	carriers := []CarrierType{CarrierSteadfast, CarrierPathao, CarrierRedX, CarrierManual}
	for _, c := range carriers {
		driver, err := registry.GetDriver(c)
		if err != nil || driver == nil {
			t.Errorf("expected driver for carrier %s, got error: %v", c, err)
		}
	}

	_, err := registry.GetDriver("UNKNOWN_CARRIER")
	if err == nil {
		t.Errorf("expected error for unsupported carrier")
	}
}

func TestManualCourierBooking(t *testing.T) {
	driver := NewManualCourierDriver()
	order := &storeModels.Order{
		OrderNumber: "ORD-260101-999",
	}

	resp, err := driver.CreateConsignment(context.Background(), order, nil, &DispatchOrderRequest{WeightInKg: 1.5})
	if err != nil {
		t.Fatalf("unexpected manual booking error: %v", err)
	}

	if !strings.HasPrefix(resp.TrackingNumber, "MANUAL-") {
		t.Errorf("expected manual tracking prefix, got: %s", resp.TrackingNumber)
	}
	if resp.Carrier != CarrierManual {
		t.Errorf("expected CarrierManual, got: %s", resp.Carrier)
	}
}

func TestSteadfastWebhookMilestoneMapping(t *testing.T) {
	driver := NewSteadfastDriver()

	testCases := []struct {
		statusStr string
		expected  storeModels.ShipmentStatus
	}{
		{"delivered", storeModels.ShipmentDelivered},
		{"delivered_approval_pending", storeModels.ShipmentDelivered},
		{"cancelled", storeModels.ShipmentReturned},
		{"cancelled_approval_pending", storeModels.ShipmentReturned},
		{"in_review", storeModels.ShipmentPending},
		{"pending", storeModels.ShipmentPending},
		{"in_transit", storeModels.ShipmentInTransit},
	}

	for _, tc := range testCases {
		payload := `{"consignment_id":1001,"tracking_code":"STDF999","invoice":"ORD-123","status":"` + tc.statusStr + `"}`
		event, err := driver.HandleStatusWebhook(context.Background(), []byte(payload), nil, nil)
		if err != nil {
			t.Fatalf("unexpected error parsing webhook status '%s': %v", tc.statusStr, err)
		}
		if event.Milestone != tc.expected {
			t.Errorf("for status '%s', expected milestone %s, got %s", tc.statusStr, tc.expected, event.Milestone)
		}
		if event.ConsignmentID != "1001" {
			t.Errorf("expected consignment_id 1001, got %s", event.ConsignmentID)
		}
		if event.TrackingNumber != "STDF999" {
			t.Errorf("expected tracking code STDF999, got %s", event.TrackingNumber)
		}
		if event.OrderNumber != "ORD-123" {
			t.Errorf("expected order invoice ORD-123, got %s", event.OrderNumber)
		}
	}
}

func TestPathaoWebhookMilestoneMapping(t *testing.T) {
	driver := NewPathaoDriver()

	payload := `{"consignment_id":"PATHAO-123","merchant_order_id":"ORD-456","order_status":"Delivered"}`
	event, err := driver.HandleStatusWebhook(context.Background(), []byte(payload), nil, nil)
	if err != nil {
		t.Fatalf("unexpected error parsing pathao webhook: %v", err)
	}
	if event.Milestone != storeModels.ShipmentDelivered {
		t.Errorf("expected ShipmentDelivered, got %s", event.Milestone)
	}
}

func TestRedXWebhookMilestoneMapping(t *testing.T) {
	driver := NewRedXDriver()

	payload := `{"tracking_id":"REDX-789","invoice_id":"ORD-789","status":"returned"}`
	event, err := driver.HandleStatusWebhook(context.Background(), []byte(payload), nil, nil)
	if err != nil {
		t.Fatalf("unexpected error parsing redx webhook: %v", err)
	}
	if event.Milestone != storeModels.ShipmentReturned {
		t.Errorf("expected ShipmentReturned, got %s", event.Milestone)
	}
}
