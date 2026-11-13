package database

import (
	"context"
	"testing"
	"time"

	"ecom-ventures/backend/internal/config"
)

func TestNewPlatformConnectionInvalidDSN(t *testing.T) {
	invalidCfg := &config.DatabaseConfig{
		Host:            "non_existent_host_xyz",
		Port:            5432,
		User:            "invalid_user",
		Password:        "invalid_pass",
		DBName:          "invalid_db",
		SSLMode:         "disable",
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 1 * time.Minute,
	}

	_, err := NewPlatformConnection(invalidCfg)
	if err == nil {
		t.Fatalf("expected error when connecting to non-existent database host, got nil")
	}
}

func TestPlatformDBNilPing(t *testing.T) {
	p := &PlatformDB{DB: nil}
	err := p.Ping(context.Background())
	if err == nil {
		t.Fatalf("expected ping error on nil DB instance, got nil")
	}
}

func TestPlatformDBCloseNil(t *testing.T) {
	p := &PlatformDB{DB: nil}
	err := p.Close()
	if err != nil {
		t.Fatalf("expected nil error on Close() with nil DB, got %v", err)
	}
}
