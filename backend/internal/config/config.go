// Package config manages environment variable loading, parsing, and strict validation
// for the Ecom Ventures backend modular monolith.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
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

// Load extracts configuration from the environment, applies fallbacks, and validates all parameters.
func Load() (*Config, error) {
	jwtSecret := getEnv("JWT_SECRET", "super_secure_jwt_secret_key_minimum_32_characters_long_2026")
	dbEncKey := getEnv("DATABASE_ENCRYPTION_KEY", "")
	if dbEncKey == "" {
		if len(jwtSecret) >= 32 {
			dbEncKey = jwtSecret[:32]
		} else {
			dbEncKey = "super_secure_jwt_secret_key_mini"
		}
	}

	cfg := &Config{
		AppEnv:                getEnv("APP_ENV", "development"),
		Port:                  getEnv("PORT", "8080"),
		LogLevel:              getEnv("LOG_LEVEL", "debug"),
		DatabaseEncryptionKey: dbEncKey,
		PlatformDB: DatabaseConfig{
			Host:            getEnv("PLATFORM_DB_HOST", "localhost"),
			Port:            getEnvAsInt("PLATFORM_DB_PORT", 5432),
			User:            getEnv("PLATFORM_DB_USER", "platform_user"),
			Password:        getEnv("PLATFORM_DB_PASSWORD", "platform_secure_password_2026"),
			DBName:          getEnv("PLATFORM_DB_NAME", "ecom_platform_main"),
			SSLMode:         getEnv("PLATFORM_DB_SSLMODE", "disable"),
			MaxOpenConns:    getEnvAsInt("PLATFORM_DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvAsInt("PLATFORM_DB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: getEnvAsDuration("PLATFORM_DB_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		StoreDBTemplate: DatabaseConfig{
			Host:            getEnv("STORE_DB_TEMPLATE_HOST", "localhost"),
			Port:            getEnvAsInt("STORE_DB_TEMPLATE_PORT", 5433),
			User:            getEnv("STORE_DB_TEMPLATE_USER", "store_prototype_user"),
			Password:        getEnv("STORE_DB_TEMPLATE_PASSWORD", "store_secure_password_2026"),
			DBName:          getEnv("STORE_DB_TEMPLATE_NAME", "ecom_store_template"),
			SSLMode:         getEnv("STORE_DB_TEMPLATE_SSLMODE", "disable"),
			MaxOpenConns:    getEnvAsInt("STORE_DB_TEMPLATE_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvAsInt("STORE_DB_TEMPLATE_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: getEnvAsDuration("STORE_DB_TEMPLATE_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvAsInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", "redis_secure_password_2026"),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		Security: SecurityConfig{
			JWTSecret:                  getEnv("JWT_SECRET", "super_secure_jwt_secret_key_minimum_32_characters_long_2026"),
			JWTExpirationHours:         getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
			RefreshTokenExpirationDays: getEnvAsInt("REFRESH_TOKEN_EXPIRATION_DAYS", 7),
		},
		Routing: RoutingConfig{
			MasterAdminDomain:  getEnv("MASTER_ADMIN_DOMAIN", "master.dropiobd.localhost"),
			StoreAdminDomain:   getEnv("STORE_ADMIN_DOMAIN", "store.dropiobd.localhost"),
			PlatformRootDomain: getEnv("PLATFORM_ROOT_DOMAIN", "dropiobd.localhost"),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failure: %w", err)
	}

	return cfg, nil
}

// Validate executes assertions on critical configuration fields.
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
	if c.Routing.MasterAdminDomain == "" {
		return fmt.Errorf("MASTER_ADMIN_DOMAIN must not be empty")
	}
	return nil
}

func getEnv(key string, defaultVal string) string {
	if val, exists := os.LookupEnv(key); exists && val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}

func getEnvAsDuration(key string, defaultVal time.Duration) time.Duration {
	valStr := getEnv(key, "")
	if val, err := time.ParseDuration(valStr); err == nil {
		return val
	}
	return defaultVal
}
