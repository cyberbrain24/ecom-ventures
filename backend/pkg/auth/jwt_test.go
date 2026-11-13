package auth

import (
	"testing"
)

func TestPlatformTokenGenerationAndVerification(t *testing.T) {
	secret := "test_super_secret_key_minimum_32_characters_2026!"
	tm, err := NewTokenManager(secret, 2, 7)
	if err != nil {
		t.Fatalf("failed to initialize token manager: %v", err)
	}

	pair, err := tm.GeneratePlatformTokenPair("user-123", "admin@dropiobd.com", "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to generate platform token pair: %v", err)
	}

	claims, err := tm.VerifyToken(pair.AccessToken)
	if err != nil {
		t.Fatalf("failed to verify access token: %v", err)
	}

	if claims.UserID != "user-123" || claims.Role != "SUPER_ADMIN" || claims.UserType != UserTypePlatform {
		t.Errorf("claims do not match expected values: %+v", claims)
	}

	if claims.StoreID != "" {
		t.Errorf("platform user token should not contain store_id")
	}
}

func TestStoreTokenGenerationAndVerification(t *testing.T) {
	secret := "test_super_secret_key_minimum_32_characters_2026!"
	tm, _ := NewTokenManager(secret, 2, 7)

	pair, err := tm.GenerateStoreTokenPair("staff-456", "manager@mior.com", "STORE_ADMIN", "store-uuid-001", "mior")
	if err != nil {
		t.Fatalf("failed to generate store token pair: %v", err)
	}

	claims, err := tm.VerifyToken(pair.AccessToken)
	if err != nil {
		t.Fatalf("failed to verify access token: %v", err)
	}

	if claims.StoreID != "store-uuid-001" || claims.StoreSlug != "mior" || claims.UserType != UserTypeStore {
		t.Errorf("store claims do not match: %+v", claims)
	}
}

func TestShortSecret(t *testing.T) {
	_, err := NewTokenManager("short-key", 1, 1)
	if err == nil {
		t.Fatalf("expected error for short secret, got nil")
	}
}

func TestEmptyStoreID(t *testing.T) {
	secret := "test_super_secret_key_minimum_32_characters_2026!"
	tm, _ := NewTokenManager(secret, 2, 7)
	_, err := tm.GenerateStoreTokenPair("staff-456", "staff@mior.com", "STORE_STAFF", "", "mior")
	if err == nil {
		t.Fatalf("expected error for empty store_id, got nil")
	}
}
