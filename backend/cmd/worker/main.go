// Package main provides the standalone daemon entrypoint for Ecom Ventures background workers.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"

	"ecom-ventures/backend/internal/config"
	"ecom-ventures/backend/internal/platform/database"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/internal/store/marketing"
	"ecom-ventures/backend/internal/worker"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("FATAL: Failed to load environment config", slog.String("error", err.Error()))
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

	producer := worker.NewRedisQueueProducer(redisClient)
	consumer := worker.NewConsumerEngine(redisClient, producer, "worker-daemon-1", 4)

	// Register Task Handlers
	emailSender := &worker.UnconfiguredEmailSender{}
	capiDispatcher := marketing.NewMetaCAPIDispatcher()

	consumer.RegisterHandler(worker.JobSendEmail, worker.BuildEmailNotificationHandler(emailSender))
	consumer.RegisterHandler(worker.JobMetaCAPIRetry, worker.BuildCAPIRetryHandler(capiDispatcher))
	consumer.RegisterHandler(worker.JobExpireCarts, worker.BuildExpireCartsHandler(platformPool.DB, tenantPool, []byte(cfg.DatabaseEncryptionKey)))
	consumer.RegisterHandler(worker.JobAuditLowStock, worker.BuildAuditLowStockHandler(platformPool.DB, tenantPool, []byte(cfg.DatabaseEncryptionKey)))
	consumer.RegisterHandler(worker.JobTenantDBBackup, worker.BuildTenantBackupHandler(platformPool.DB, "./backups", []byte(cfg.DatabaseEncryptionKey)))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := consumer.Start(ctx); err != nil {
		logger.Error("FATAL: Failed to start consumer engine", slog.String("error", err.Error()))
		os.Exit(1)
	}

	scheduler := worker.NewCronScheduler(producer, redisClient)
	scheduler.Start(ctx)

	// Wait for process termination
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Info("Graceful worker shutdown initiated...")
	scheduler.Stop()
	consumer.Stop()
	logger.Info("Background worker daemon stopped cleanly.")
}
