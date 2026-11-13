package marketing

import (
	"testing"
)

func TestHashSHA256(t *testing.T) {
	// Standard test case: "test@example.com"
	expected := "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b"
	hashed := HashSHA256("  Test@Example.COM  ") // Asserts lowercase and whitespace trimming

	if hashed != expected {
		t.Fatalf("expected SHA-256 %s, got %s", expected, hashed)
	}

	empty := HashSHA256("")
	if empty != "" {
		t.Errorf("expected empty string for empty input, got %s", empty)
	}
}

func TestNormalizeAndHashPhone(t *testing.T) {
	rawPhone := "+880 (171) 000-1122"
	hashed := NormalizeAndHashPhone(rawPhone)

	// Clean digits should be "8801710001122"
	expected := HashSHA256("8801710001122")
	if hashed != expected {
		t.Fatalf("expected phone hash %s, got %s", expected, hashed)
	}

	empty := NormalizeAndHashPhone("")
	if empty != "" {
		t.Errorf("expected empty string for empty phone, got %s", empty)
	}
}

func TestCAPIEventPayloadStructure(t *testing.T) {
	event := CAPIEvent{
		EventName: "Purchase",
		EventID:   "ORD-260101-999",
		UserData: CAPIUserData{
			EmailHash: HashSHA256("customer@mior.com"),
		},
		CustomData: &CAPICustomData{
			Value:    2500.00,
			Currency: "BDT",
		},
	}

	if event.EventName != "Purchase" {
		t.Errorf("unexpected event name: %s", event.EventName)
	}
	if event.CustomData.Value != 2500.00 {
		t.Errorf("unexpected event value: %.2f", event.CustomData.Value)
	}
}
