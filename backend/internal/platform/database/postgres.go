// Package database provides connection pool initialization and lifecycle management
// for the PostgreSQL Central Platform Database.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"ecom-ventures/backend/internal/config"
	_ "github.com/lib/pq"
)

// PlatformDB encapsulates the master database connection pool.
type PlatformDB struct {
	DB *sql.DB
}

// NewPlatformConnection initializes, validates, and pools connections to the central database.
func NewPlatformConnection(cfg *config.DatabaseConfig) (*PlatformDB, error) {
	connStr := cfg.DSN()

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse platform postgres connection string: %w", err)
	}

	// Configure pool boundaries to prevent connection exhaustion
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Validate connectivity with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("platform database ping failure at %s:%d/%s: %w",
			cfg.Host, cfg.Port, cfg.DBName, err)
	}

	log.Printf("Successfully established connection pool to Platform DB [%s:%d/%s]",
		cfg.Host, cfg.Port, cfg.DBName)

	return &PlatformDB{DB: db}, nil
}

// Ping checks if the database is responding within the allotted context duration.
func (p *PlatformDB) Ping(ctx context.Context) error {
	if p.DB == nil {
		return fmt.Errorf("platform database connection handle is nil")
	}
	return p.DB.PingContext(ctx)
}

// Close gracefully terminates all open connections in the pool.
func (p *PlatformDB) Close() error {
	if p.DB != nil {
		log.Println("Closing Platform DB connection pool.")
		return p.DB.Close()
	}
	return nil
}

// NewPostgresPool opens and validates a connection pool directly from a PostgreSQL connection string.
func NewPostgresPool(connStr string) (*sql.DB, error) {
	if connStr == "" {
		return nil, fmt.Errorf("postgres connection string is empty")
	}
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres connection: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("postgres ping failure: %w", err)
	}
	return db, nil
}
