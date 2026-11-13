package worker

import (
	"encoding/json"
	"math"
	"testing"
	"time"
)

func TestJobEnvelopeSerialization(t *testing.T) {
	payload := SendEmailPayload{
		ToAddress: "buyer@domain.com",
		Subject:   "Order Confirmed ORD-123",
		Template:  "ORDER_CONFIRMED",
	}
	payloadBytes, _ := json.Marshal(payload)

	envelope := JobEnvelope{
		ID:         "job-999",
		Type:       JobSendEmail,
		TenantID:   "tenant-1",
		StoreSlug:  "mior",
		Payload:    payloadBytes,
		MaxRetries: 3,
		Attempt:    1,
		EnqueuedAt: time.Now(),
	}

	raw, err := json.Marshal(envelope)
	if err != nil {
		t.Fatalf("failed to marshal envelope: %v", err)
	}

	var parsed JobEnvelope
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatalf("failed to unmarshal envelope: %v", err)
	}

	if parsed.ID != "job-999" || parsed.StoreSlug != "mior" {
		t.Errorf("unexpected envelope fields: %v", parsed)
	}
}

func TestExponentialBackoffMath(t *testing.T) {
	// Formula: 2^attempt * 5 seconds
	for attempt := 1; attempt <= 4; attempt++ {
		backoff := int(math.Pow(2, float64(attempt))) * 5
		expected := 10 // attempt 1 -> 2^1 * 5 = 10
		if attempt == 2 {
			expected = 20
		} else if attempt == 3 {
			expected = 40
		} else if attempt == 4 {
			expected = 80
		}
		if backoff != expected {
			t.Errorf("attempt %d: expected backoff %d, got %d", attempt, expected, backoff)
		}
	}
}
