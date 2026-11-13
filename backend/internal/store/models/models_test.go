package models

import (
	"testing"
)

func TestCartTotalCalculation(t *testing.T) {
	cart := &Cart{
		Currency: "BDT",
		Items: []CartItem{
			{Quantity: 2, UnitPrice: 1250.00},
			{Quantity: 1, UnitPrice: 500.50},
			{Quantity: 3, UnitPrice: 100.00},
		},
	}

	expectedTotal := (2 * 1250.00) + (1 * 500.50) + (3 * 100.00)
	if cart.Total() != expectedTotal {
		t.Fatalf("expected cart total %f, got %f", expectedTotal, cart.Total())
	}
}

func TestOrderStatusConstants(t *testing.T) {
	validStatuses := []OrderStatus{
		OrderStatusPending,
		OrderStatusProcessing,
		OrderStatusShipped,
		OrderStatusDelivered,
		OrderStatusCancelled,
		OrderStatusRefunded,
	}

	for _, s := range validStatuses {
		if s == "" {
			t.Errorf("order status constant must not be empty string")
		}
	}
}

func TestPaymentAndShipmentStatusConstants(t *testing.T) {
	validPaymentStatuses := []PaymentStatus{
		PaymentStatusPending,
		PaymentStatusPaid,
		PaymentStatusFailed,
		PaymentStatusRefunded,
	}

	for _, s := range validPaymentStatuses {
		if s == "" {
			t.Errorf("payment status constant must not be empty string")
		}
	}

	validShipmentStatuses := []ShipmentStatus{
		ShipmentPending,
		ShipmentLabelCreated,
		ShipmentInTransit,
		ShipmentOutForDelivery,
		ShipmentDelivered,
		ShipmentFailedAttempt,
		ShipmentReturned,
	}

	for _, s := range validShipmentStatuses {
		if s == "" {
			t.Errorf("shipment status constant must not be empty string")
		}
	}
}
