package crypto

import (
	"crypto/rand"
	"testing"
)

func TestEncryptDecryptSuccess(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatalf("failed to generate random test key: %v", err)
	}

	secret := "store_postgres_db_password_super_secret_9988"
	encrypted, err := Encrypt(secret, key)
	if err != nil {
		t.Fatalf("unexpected encryption error: %v", err)
	}

	if encrypted == secret {
		t.Fatalf("ciphertext must not match plaintext")
	}

	decrypted, err := Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("unexpected decryption error: %v", err)
	}

	if decrypted != secret {
		t.Errorf("expected decrypted text %q, got %q", secret, decrypted)
	}
}

func TestEncryptInvalidKeySize(t *testing.T) {
	shortKey := []byte("short-16-bytes--")
	_, err := Encrypt("secret", shortKey)
	if err != ErrInvalidKeySize {
		t.Fatalf("expected ErrInvalidKeySize, got: %v", err)
	}
}

func TestDecryptTamperedCiphertext(t *testing.T) {
	key := make([]byte, 32)
	_, _ = rand.Read(key)

	encrypted, err := Encrypt("secret", key)
	if err != nil {
		t.Fatalf("encryption error: %v", err)
	}

	tampered := encrypted[:len(encrypted)-4] + "AAAA"
	_, err = Decrypt(tampered, key)
	if err == nil {
		t.Fatalf("expected error when decrypting tampered data, got nil")
	}
}
