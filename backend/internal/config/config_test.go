package config

import (
	"os"
	"testing"
)

func TestConfigLoadDefaults(t *testing.T) {
	// Clear relevant environment variables to verify default fallbacks
	os.Clearenv()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected successful config load with defaults, got error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("expected default port 8080, got %s", cfg.Port)
	}

	if cfg.PlatformDB.DBName != "ecom_platform_main" {
		t.Errorf("expected default DBName 'ecom_platform_main', got %s", cfg.PlatformDB.DBName)
	}

	if cfg.StoreDBTemplate.Port != 5433 {
		t.Errorf("expected default store template port 5433, got %d", cfg.StoreDBTemplate.Port)
	}

	expectedPlatformDSN := "host=localhost port=5432 user=platform_user password=platform_secure_password_2026 dbname=ecom_platform_main sslmode=disable"
	if cfg.PlatformDB.DSN() != expectedPlatformDSN {
		t.Errorf("expected DSN %q, got %q", expectedPlatformDSN, cfg.PlatformDB.DSN())
	}
}

func TestConfigValidateShortJWTSecret(t *testing.T) {
	os.Clearenv()
	_ = os.Setenv("JWT_SECRET", "short_secret")

	_, err := Load()
	if err == nil {
		t.Fatalf("expected error due to short JWT secret (<32 chars), got nil")
	}
}
