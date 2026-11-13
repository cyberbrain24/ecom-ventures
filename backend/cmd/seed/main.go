// Package main provides the automated database provisioning and catalog seeder
// for the three initial Ecom Ventures retail pilot brands (Mior, Artisan, Urban).
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"ecom-ventures/backend/internal/config"
	"ecom-ventures/backend/internal/platform/database"
	"ecom-ventures/backend/internal/platform/provisioner"
	"ecom-ventures/backend/internal/platform/store_mgmt"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/internal/store/resolver"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("FATAL: Failed to load config", slog.String("error", err.Error()))
		os.Exit(1)
	}

	platformPool, err := database.NewPlatformConnection(&cfg.PlatformDB)
	if err != nil {
		logger.Error("FATAL: Failed to connect to platform database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer platformPool.Close()

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	defer redisClient.Close()

	tenantPool := storeDB.NewTenantPoolManager(
		cfg.StoreDBTemplate.MaxOpenConns,
		cfg.StoreDBTemplate.MaxIdleConns,
		cfg.StoreDBTemplate.ConnMaxLifetime,
	)
	defer tenantPool.CloseAll()

	encryptionKeyBytes := []byte(cfg.Security.JWTSecret[:32])
	if len(cfg.DatabaseEncryptionKey) >= 32 {
		encryptionKeyBytes = []byte(cfg.DatabaseEncryptionKey[:32])
	}

	storeResolver, err := resolver.NewStoreResolver(platformPool.DB, redisClient, tenantPool, encryptionKeyBytes)
	if err != nil {
		logger.Error("FATAL: Failed to initialize StoreResolver", slog.String("error", err.Error()))
		os.Exit(1)
	}

	clusterAdminDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=disable",
		cfg.PlatformDB.Host, cfg.PlatformDB.Port, cfg.PlatformDB.User, cfg.PlatformDB.Password)
	clusterAdminDB, err := sql.Open("postgres", clusterAdminDSN)
	if err != nil {
		logger.Error("FATAL: Failed to connect to PostgreSQL cluster admin DB", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer clusterAdminDB.Close()

	storeMigrationsPath := "../infra/migrations/store"
	if _, err := os.Stat(storeMigrationsPath); os.IsNotExist(err) {
		storeMigrationsPath = "infra/migrations/store"
	}

	dbProvisioner, err := provisioner.NewProvisioner(platformPool.DB, clusterAdminDB, storeMigrationsPath, encryptionKeyBytes)
	if err != nil {
		logger.Error("FATAL: Failed to initialize Provisioner", slog.String("error", err.Error()))
		os.Exit(1)
	}

	storeService := store_mgmt.NewService(platformPool.DB, dbProvisioner, storeResolver, tenantPool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	logger.Info("Starting Phase 30 Automated Pilot Brand Seeder...")

	// 1. Seed Core Theme Blueprints
	themes := []struct {
		Name         string
		Slug         string
		Description  string
		Version      string
		ConfigSchema string
	}{
		{
			Name:         "Modern Minimal",
			Slug:         "modern-minimal",
			Description:  "Clean typography, generous whitespace, and responsive luxury apparel layouts.",
			Version:      "1.0.0",
			ConfigSchema: `{"colors":{"primary":"#0f172a","secondary":"#64748b","accent":"#be185d"},"fonts":{"heading":"Inter","body":"Inter"}}`,
		},
		{
			Name:         "Artisan Boutique",
			Slug:         "artisan-boutique",
			Description:  "Warm earthy tones, rich typography, and tailored craft presentation.",
			Version:      "1.0.0",
			ConfigSchema: `{"colors":{"primary":"#78350f","secondary":"#92400e","accent":"#d97706"},"fonts":{"heading":"Playfair Display","body":"Source Sans Pro"}}`,
		},
		{
			Name:         "Urban Streetwear",
			Slug:         "urban-streetwear",
			Description:  "High-contrast dark mode, bold brutalist typography, and vivid neon accents.",
			Version:      "1.0.0",
			ConfigSchema: `{"colors":{"primary":"#18181b","secondary":"#27272a","accent":"#e11d48"},"fonts":{"heading":"Cabinet Grotesk","body":"Inter"}}`,
		},
	}

	for _, th := range themes {
		_, err := platformPool.DB.ExecContext(ctx, `
			INSERT INTO themes (name, slug, description, version, config_schema, is_active)
			VALUES ($1, $2, $3, $4, $5, TRUE)
			ON CONFLICT (slug) DO NOTHING;`,
			th.Name, th.Slug, th.Description, th.Version, th.ConfigSchema,
		)
		if err != nil {
			logger.Warn("Failed to seed theme", slog.String("slug", th.Slug), slog.String("error", err.Error()))
		}
	}

	// 2. Seed Default Platform Super Admin (Password: admin123)
	_, _ = platformPool.DB.ExecContext(ctx, `
		INSERT INTO platform_users (email, password_hash, first_name, last_name, role, status)
		VALUES ($1, '$argon2id$v=19$m=65536,t=3,p=4$mNEw1m7je5ypTVbBkE6pnw$DnsVwyt2cTD9gSkuPbiem+xo3/IIDwpBwVOd2dOn4Rc', 'Platform', 'Administrator', 'SUPER_ADMIN', 'ACTIVE')
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
		"admin@dropiobd.com",
	)
	_, _ = platformPool.DB.ExecContext(ctx, `
		INSERT INTO platform_users (email, password_hash, first_name, last_name, role, status)
		VALUES ($1, '$argon2id$v=19$m=65536,t=3,p=4$mNEw1m7je5ypTVbBkE6pnw$DnsVwyt2cTD9gSkuPbiem+xo3/IIDwpBwVOd2dOn4Rc', 'Super', 'Administrator', 'SUPER_ADMIN', 'ACTIVE')
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
		"superadmin@dropiobd.com",
	)

	// 3. Pilot Brands Specifications
	pilotBrands := []struct {
		Name          string
		Slug          string
		Description   string
		ThemeSlug     string
		Email         string
		Currency      string
		PrimaryDomain string
	}{
		{
			Name:          "Mior Fashion",
			Slug:          "mior",
			Description:   "Luxury mulberry silk, evening dresses, and contemporary formalwear.",
			ThemeSlug:     "modern-minimal",
			Email:         "admin@mior.com",
			Currency:      "BDT",
			PrimaryDomain: "mior.localhost",
		},
		{
			Name:          "Artisan Leather & Fragrance",
			Slug:          "artisan",
			Description:   "Handcrafted full-grain leather goods and artisanal botanical perfumes.",
			ThemeSlug:     "artisan-boutique",
			Email:         "owner@artisan.com",
			Currency:      "BDT",
			PrimaryDomain: "artisan.localhost",
		},
		{
			Name:          "Urban Movement Footwear",
			Slug:          "urban",
			Description:   "Engineered streetwear sneakers, utility jackets, and technical apparel.",
			ThemeSlug:     "urban-streetwear",
			Email:         "ops@urbanmovement.com",
			Currency:      "BDT",
			PrimaryDomain: "urban.localhost",
		},
	}

	for _, pb := range pilotBrands {
		logger.Info("Provisioning pilot brand store...", slog.String("brand", pb.Name), slog.String("slug", pb.Slug))

		req := &store_mgmt.CreateStoreRequest{
			Name:          pb.Name,
			Slug:          pb.Slug,
			Description:   pb.Description,
			ThemeSlug:     pb.ThemeSlug,
			ContactEmail:  pb.Email,
			ContactPhone:  "+880 1711 000000",
			Currency:      pb.Currency,
			Timezone:      "Asia/Dhaka",
			PrimaryDomain: pb.PrimaryDomain,
			InitialOwner: store_mgmt.OwnerCredentials{
				Email:     pb.Email,
				Password:  "SecurePilotPass2026!",
				FirstName: "Lead",
				LastName:  "Operator",
			},
		}

		storeDetail, err := storeService.CreateStore(ctx, req, "system-seeder")
		if err != nil {
			logger.Warn("Store may already be provisioned or skipped", slog.String("slug", pb.Slug), slog.String("error", err.Error()))
			continue
		}

		logger.Info("Store provisioned successfully",
			slog.String("store_id", storeDetail.Store.ID),
			slog.String("status", string(storeDetail.Store.Status)),
		)
	}

	logger.Info("All pilot brands initialized and primed for go-live validation.")
}
