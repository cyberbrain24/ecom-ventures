// Package config manages environment variable loading, parsing, and strict validation
// for the Ecom Ventures backend modular monolith.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Development-only defaults. These values are committed to source and must never be
// used outside APP_ENV=development; Validate refuses to start in production when any
// secret is missing or still equal to one of these values.
const (
	devDefaultJWTSecret         = "super_secure_jwt_secret_key_minimum_32_characters_long_2026"
	devDefaultPlatformDBPass    = "platform_secure_password_2026"
	devDefaultStoreTemplatePass = "store_secure_password_2026"
	devDefaultRedisPass         = "redis_secure_password_2026"
	devDefaultEncryptionKey     = "dev_only_encryption_key_32bytes!"

	// EnvProduction is the APP_ENV value that enables strict secret requirements.
	EnvProduction = "production"
	// EnvDevelopment is the APP_ENV value that enables local-development defaults.
	EnvDevelopment = "development"
)

// DatabaseConfig encapsulates connection parameters for PostgreSQL instances.
type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// DSN returns the formatted PostgreSQL connection string.
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

// RedisConfig defines connection settings for Redis cache and job queues.
type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

// Addr returns the host:port string for Redis client initialization.
func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

// SecurityConfig holds cryptographic keys and token TTLs.
type SecurityConfig struct {
	JWTSecret                  string
	JWTExpirationHours         int
	RefreshTokenExpirationDays int
}

// RoutingConfig defines top-level domains used for tenant resolution.
type RoutingConfig struct {
	MasterAdminDomain  string
	StoreAdminDomain   string
	PlatformRootDomain string
}

// Config aggregates all operational configurations required by the backend.
type Config struct {
	AppEnv                string
	Port                  string
	LogLevel              string
	DatabaseEncryptionKey string
	PlatformDB            DatabaseConfig
	StoreDBTemplate       DatabaseConfig
	Redis                 RedisConfig
	Security              SecurityConfig
	Routing               RoutingConfig
}

// IsProduction reports whether the process runs with APP_ENV=production.
func (c *Config) IsProduction() bool {
	return c.AppEnv == EnvProduction
}

// IsDevelopment reports whether the process runs with APP_ENV=development.
func (c *Config) IsDevelopment() bool {
	return c.AppEnv == EnvDevelopment
}

// Load extracts configuration from the environment and validates all parameters.
// Local-development defaults exist for every secret; in production Validate requires
// the secrets to be set explicitly. Malformed numeric or duration variables are errors
// that name the variable.
func Load() (*Config, error) {
	loadDotEnv()
	p := &envParser{}

	appEnv := p.getEnv("APP_ENV", EnvDevelopment)

	cfg := &Config{
		AppEnv:                appEnv,
		Port:                  p.getEnv("PORT", "8080"),
		LogLevel:              p.getEnv("LOG_LEVEL", "debug"),
		DatabaseEncryptionKey: p.getEnv("DATABASE_ENCRYPTION_KEY", devDefaultEncryptionKey),
		PlatformDB: DatabaseConfig{
			Host:            p.getFirstEnv([]string{"PLATFORM_DB_HOST", "DB_HOST"}, "localhost"),
			Port:            p.getFirstEnvAsInt([]string{"PLATFORM_DB_PORT", "DB_PORT"}, 5432),
			User:            p.getFirstEnv([]string{"PLATFORM_DB_USER", "DB_USER"}, "platform_user"),
			Password:        p.getFirstEnv([]string{"PLATFORM_DB_PASSWORD", "DB_PASSWORD"}, devDefaultPlatformDBPass),
			DBName:          p.getFirstEnv([]string{"PLATFORM_DB_NAME", "DB_MAIN_NAME"}, "ecom_platform_main"),
			SSLMode:         p.getFirstEnv([]string{"PLATFORM_DB_SSLMODE", "DB_SSLMODE"}, "disable"),
			MaxOpenConns:    p.getEnvAsInt("PLATFORM_DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    p.getEnvAsInt("PLATFORM_DB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: p.getEnvAsDuration("PLATFORM_DB_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		StoreDBTemplate: DatabaseConfig{
			Host:            p.getFirstEnv([]string{"STORE_DB_TEMPLATE_HOST", "DB_HOST"}, "localhost"),
			Port:            p.getFirstEnvAsInt([]string{"STORE_DB_TEMPLATE_PORT", "DB_PORT"}, 5433),
			User:            p.getFirstEnv([]string{"STORE_DB_TEMPLATE_USER", "DB_USER"}, "store_prototype_user"),
			Password:        p.getFirstEnv([]string{"STORE_DB_TEMPLATE_PASSWORD", "DB_PASSWORD"}, devDefaultStoreTemplatePass),
			DBName:          p.getFirstEnv([]string{"STORE_DB_TEMPLATE_NAME", "DB_TEMPLATE_NAME"}, "ecom_store_template"),
			SSLMode:         p.getFirstEnv([]string{"STORE_DB_TEMPLATE_SSLMODE", "DB_SSLMODE"}, "disable"),
			MaxOpenConns:    p.getEnvAsInt("STORE_DB_TEMPLATE_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    p.getEnvAsInt("STORE_DB_TEMPLATE_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: p.getEnvAsDuration("STORE_DB_TEMPLATE_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		Redis: p.parseRedisConfig(),
		Security: SecurityConfig{
			JWTSecret:                  p.getEnv("JWT_SECRET", devDefaultJWTSecret),
			JWTExpirationHours:         p.getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
			RefreshTokenExpirationDays: p.getEnvAsInt("REFRESH_TOKEN_EXPIRATION_DAYS", 7),
		},
		Routing: RoutingConfig{
			MasterAdminDomain:  p.getEnv("MASTER_ADMIN_DOMAIN", "master.dropiobd.localhost"),
			StoreAdminDomain:   p.getEnv("STORE_ADMIN_DOMAIN", "store.dropiobd.localhost"),
			PlatformRootDomain: p.getEnv("PLATFORM_ROOT_DOMAIN", "dropiobd.localhost"),
		},
	}

	if p.err != nil {
		return nil, fmt.Errorf("configuration parse failure: %w", p.err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failure: %w", err)
	}

	return cfg, nil
}

// Validate executes assertions on critical configuration fields. When APP_ENV is
// "production" it also requires every secret to come from the environment and rejects
// known development defaults.
func (c *Config) Validate() error {
	if c.PlatformDB.Host == "" {
		return fmt.Errorf("PLATFORM_DB_HOST is required")
	}
	if c.PlatformDB.DBName == "" {
		return fmt.Errorf("PLATFORM_DB_NAME is required")
	}
	if c.StoreDBTemplate.Host == "" {
		return fmt.Errorf("STORE_DB_TEMPLATE_HOST is required")
	}
	if len(c.Security.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters for HMAC-SHA256 integrity")
	}
	if len(c.DatabaseEncryptionKey) != 32 {
		return fmt.Errorf("DATABASE_ENCRYPTION_KEY must be exactly 32 bytes for AES-256")
	}
	if c.Routing.MasterAdminDomain == "" {
		return fmt.Errorf("MASTER_ADMIN_DOMAIN must not be empty")
	}
	if c.IsProduction() {
		return c.validateProduction()
	}
	return nil
}

// validateProduction enforces the production secret policy. It runs only when APP_ENV is "production".
func (c *Config) validateProduction() error {
	required := []struct {
		name  string
		value string
		dev   string
	}{
		{"JWT_SECRET", c.Security.JWTSecret, devDefaultJWTSecret},
		{"PLATFORM_DB_PASSWORD", c.PlatformDB.Password, devDefaultPlatformDBPass},
		{"REDIS_PASSWORD", os.Getenv("REDIS_PASSWORD"), devDefaultRedisPass},
		{"DATABASE_ENCRYPTION_KEY", c.DatabaseEncryptionKey, devDefaultEncryptionKey},
		{"STORE_DB_TEMPLATE_PASSWORD", c.StoreDBTemplate.Password, devDefaultStoreTemplatePass},
	}
	for _, r := range required {
		if !envIsSet(r.name) {
			return fmt.Errorf("%s must be set in the environment when APP_ENV=production", r.name)
		}
		if r.value == r.dev {
			return fmt.Errorf("%s must not use the development default when APP_ENV=production", r.name)
		}
	}
	if c.PlatformDB.Password == "" || c.PlatformDB.Password == devDefaultPlatformDBPass {
		return fmt.Errorf("PLATFORM_DB_PASSWORD/DB_PASSWORD must not use the development default when APP_ENV=production")
	}
	if c.StoreDBTemplate.Password == "" || c.StoreDBTemplate.Password == devDefaultStoreTemplatePass {
		return fmt.Errorf("STORE_DB_TEMPLATE_PASSWORD/DB_PASSWORD must not use the development default when APP_ENV=production")
	}
	if c.DatabaseEncryptionKey == c.Security.JWTSecret {
		return errors.New("DATABASE_ENCRYPTION_KEY must not equal JWT_SECRET when APP_ENV=production")
	}
	if strings.Contains(c.Security.JWTSecret, c.DatabaseEncryptionKey) || strings.Contains(c.DatabaseEncryptionKey, c.Security.JWTSecret) {
		return errors.New("DATABASE_ENCRYPTION_KEY must not overlap JWT_SECRET when APP_ENV=production")
	}
	return nil
}

// envIsSet reports whether the variable is present and non-empty in the process environment.
func envIsSet(key string) bool {
	val, ok := os.LookupEnv(key)
	return ok && val != ""
}

// envParser collects the first parse error so Load can report malformed values by name.
type envParser struct {
	err error
}

// parseRedisConfig parses redis connection parameters from REDIS_HOST/PORT or REDIS_ADDR.
func (p *envParser) parseRedisConfig() RedisConfig {
	host := p.getFirstEnv([]string{"REDIS_HOST"}, "")
	port := p.getFirstEnvAsInt([]string{"REDIS_PORT"}, 0)

	if addr := os.Getenv("REDIS_ADDR"); addr != "" && host == "" {
		parts := strings.Split(addr, ":")
		host = parts[0]
		if len(parts) > 1 {
			if portNum, err := strconv.Atoi(parts[1]); err == nil {
				port = portNum
			}
		}
	}

	if host == "" {
		host = "localhost"
	}
	if port == 0 {
		port = 6379
	}

	redisPass := p.getEnv("REDIS_PASSWORD", "")
	if strings.EqualFold(redisPass, "none") || strings.EqualFold(redisPass, "disabled") {
		redisPass = ""
	}

	return RedisConfig{
		Host:     host,
		Port:     port,
		Password: redisPass,
		DB:       p.getFirstEnvAsInt([]string{"REDIS_DB"}, 0),
	}
}

// getFirstEnv returns the first set environment variable among keys, or defaultVal.
func (p *envParser) getFirstEnv(keys []string, defaultVal string) string {
	for _, key := range keys {
		if val, exists := os.LookupEnv(key); exists && val != "" {
			return val
		}
	}
	return defaultVal
}

// getFirstEnvAsInt parses an integer from the first set environment variable among keys.
func (p *envParser) getFirstEnvAsInt(keys []string, defaultVal int) int {
	for _, key := range keys {
		if raw, exists := os.LookupEnv(key); exists && raw != "" {
			val, err := strconv.Atoi(raw)
			if err != nil {
				p.setErr(fmt.Errorf("%s must be an integer, got %q: %w", key, raw, err))
				return defaultVal
			}
			return val
		}
	}
	return defaultVal
}

// getEnv returns the environment value for key, or defaultVal when unset or empty.
func (p *envParser) getEnv(key string, defaultVal string) string {
	if val, exists := os.LookupEnv(key); exists && val != "" {
		return val
	}
	return defaultVal
}

// getEnvAsInt parses an integer environment variable; a malformed value records an error.
func (p *envParser) getEnvAsInt(key string, defaultVal int) int {
	raw, exists := os.LookupEnv(key)
	if !exists || raw == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(raw)
	if err != nil {
		p.setErr(fmt.Errorf("%s must be an integer, got %q: %w", key, raw, err))
		return defaultVal
	}
	return val
}

// getEnvAsDuration parses a duration environment variable; a malformed value records an error.
func (p *envParser) getEnvAsDuration(key string, defaultVal time.Duration) time.Duration {
	raw, exists := os.LookupEnv(key)
	if !exists || raw == "" {
		return defaultVal
	}
	val, err := time.ParseDuration(raw)
	if err != nil {
		p.setErr(fmt.Errorf("%s must be a duration such as 5m, got %q: %w", key, raw, err))
		return defaultVal
	}
	return val
}

// setErr keeps only the first parse error encountered.
func (p *envParser) setErr(err error) {
	if p.err == nil {
		p.err = err
	}
}

// loadDotEnv loads environment variables from .env.production, .env, or ../.env if they are not already set in the environment.
func loadDotEnv() {
	paths := []string{".env.production", "../.env.production", ".env", "../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				if os.Getenv(k) == "" {
					_ = os.Setenv(k, v)
				}
			}
		}
		break
	}
}
