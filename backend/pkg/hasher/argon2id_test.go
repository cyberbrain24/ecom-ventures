package hasher

import (
	"testing"
)

func TestHashAndComparePassword(t *testing.T) {
	password := "PlatformSuperSecretPass2026!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("unexpected error hashing password: %v", err)
	}

	if hash == password {
		t.Fatalf("hash should not match plain password")
	}

	// Verify valid match
	match, err := ComparePassword(password, hash)
	if err != nil {
		t.Fatalf("unexpected error comparing password: %v", err)
	}
	if !match {
		t.Errorf("expected password to match hash")
	}

	// Verify invalid match
	match, err = ComparePassword("WrongPassword!", hash)
	if err != nil {
		t.Fatalf("unexpected error on mismatched password: %v", err)
	}
	if match {
		t.Errorf("expected mismatched password to return false")
	}
}

func TestDecodeMalformedHash(t *testing.T) {
	malformed := "$argon2id$v=19$m=65536$invalid$hash"
	_, err := ComparePassword("test", malformed)
	if err == nil {
		t.Fatalf("expected error on malformed hash, got nil")
	}
}
