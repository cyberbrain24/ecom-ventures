// Package main provides a command-line interface for executing Central Platform Database migrations.
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"time"

	"ecom-ventures/backend/internal/config"
	"ecom-ventures/backend/internal/platform/database"
	"ecom-ventures/backend/internal/platform/migrator"
)

func main() {
	direction := flag.String("direction", "up", "Migration direction: 'up' or 'down'")
	path := flag.String("path", "../infra/migrations/platform", "Path to SQL migration files")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("FATAL: Failed to load configuration: %v", err)
	}

	platformDB, err := database.NewPlatformConnection(&cfg.PlatformDB)
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to platform database: %v", err)
	}
	defer platformDB.Close()

	mgr := migrator.New(platformDB.DB, *path)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	switch *direction {
	case "up":
		log.Println("Starting database migration: UP")
		if err := mgr.Up(ctx); err != nil {
			log.Fatalf("FATAL: Migration UP failed: %v", err)
		}
		log.Println("Database migration UP completed successfully.")
	case "down":
		log.Println("Starting database migration: DOWN")
		if err := mgr.Down(ctx); err != nil {
			log.Fatalf("FATAL: Migration DOWN failed: %v", err)
		}
		log.Println("Database migration DOWN completed successfully.")
	default:
		log.Fatalf("Unknown migration direction: %s. Use 'up' or 'down'", *direction)
		os.Exit(1)
	}
}
