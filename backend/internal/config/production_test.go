package config

import (
	"os"
	"strings"
	"testing"
)

// setProductionEnv clears the environment and sets a complete, valid production secret set.
func setProductionEnv(t *testing.T) {
	t.Helper()
	os.Clearenv()
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "prod_jwt_secret_value_for_tests_0123456789abcdef")
	t.Setenv("PLATFORM_DB_PASSWORD", "prod_platform_db_password_xyz")
	t.Setenv("REDIS_PASSWORD", "prod_redis_password_xyz")
	t.Setenv("STORE_DB_TEMPLATE_PASSWORD", "prod_store_template_password_xyz")
	t.Setenv("DATABASE_ENCRYPTION_KEY", "prodEncKey_0123456789abcdefghijk")
}

func TestProductionLoadAcceptsCompleteSecrets(t *testing.T) {
	setProductionEnv(t)
	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected production config with complete secrets to load, got: %v", err)
	}
	if !cfg.IsProduction() {
		t.Fatalf("expected production mode")
	}
}

func TestProductionRefusesMissingSecret(t *testing.T) {
	for _, name := range []string{"JWT_SECRET", "PLATFORM_DB_PASSWORD", "REDIS_PASSWORD", "DATABASE_ENCRYPTION_KEY", "STORE_DB_TEMPLATE_PASSWORD"} {
		t.Run(name, func(t *testing.T) {
			setProductionEnv(t)
			if err := os.Unsetenv(name); err != nil {
				t.Fatalf("unsetenv: %v", err)
			}
			_, err := Load()
			if err == nil {
				t.Fatalf("expected production load to fail when %s is unset", name)
			}
			if !strings.Contains(err.Error(), name) {
				t.Fatalf("expected error to name %s, got: %v", name, err)
			}
		})
	}
}

func TestProductionRefusesDevelopmentDefaults(t *testing.T) {
	cases := map[string]string{
		"JWT_SECRET":                 "super_secure_jwt_secret_key_minimum_32_characters_long_2026",
		"PLATFORM_DB_PASSWORD":       "platform_secure_password_2026",
		"REDIS_PASSWORD":             "redis_secure_password_2026",
		"STORE_DB_TEMPLATE_PASSWORD": "store_secure_password_2026",
		"DATABASE_ENCRYPTION_KEY":    "dev_only_encryption_key_32bytes!",
	}
	for name, value := range cases {
		t.Run(name, func(t *testing.T) {
			setProductionEnv(t)
			t.Setenv(name, value)
			if _, err := Load(); err == nil {
				t.Fatalf("expected production load to refuse the development default for %s", name)
			}
		})
	}
}

func TestProductionRefusesEncryptionKeyDerivedFromJWT(t *testing.T) {
	setProductionEnv(t)
	jwt := "prod_jwt_secret_value_for_tests_0123456789abcdef"
	t.Setenv("DATABASE_ENCRYPTION_KEY", jwt[:32])
	if _, err := Load(); err == nil {
		t.Fatalf("expected production load to refuse an encryption key taken from JWT_SECRET")
	}
}

func TestDevelopmentAllowsDefaults(t *testing.T) {
	os.Clearenv()
	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected development defaults to load, got: %v", err)
	}
	if !cfg.IsDevelopment() {
		t.Fatalf("expected development mode by default")
	}
	if len(cfg.DatabaseEncryptionKey) != 32 {
		t.Fatalf("expected 32-byte development encryption key, got %d bytes", len(cfg.DatabaseEncryptionKey))
	}
}

func TestMalformedNumericEnvFailsLoad(t *testing.T) {
	os.Clearenv()
	t.Setenv("PLATFORM_DB_PORT", "54x2")
	_, err := Load()
	if err == nil {
		t.Fatalf("expected malformed PLATFORM_DB_PORT to fail Load")
	}
	if !strings.Contains(err.Error(), "PLATFORM_DB_PORT") {
		t.Fatalf("expected error to name PLATFORM_DB_PORT, got: %v", err)
	}
}

func TestMalformedDurationEnvFailsLoad(t *testing.T) {
	os.Clearenv()
	t.Setenv("PLATFORM_DB_CONN_MAX_LIFETIME", "five minutes")
	_, err := Load()
	if err == nil {
		t.Fatalf("expected malformed duration to fail Load")
	}
	if !strings.Contains(err.Error(), "PLATFORM_DB_CONN_MAX_LIFETIME") {
		t.Fatalf("expected error to name the duration variable, got: %v", err)
	}
}
