package worker

import (
	"context"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// CronScheduler triggers scheduled recurring jobs using Redis distributed locks.
type CronScheduler struct {
	producer QueueProducer
	redis    *redis.Client
	stopChan chan struct{}
}

// NewCronScheduler instantiates the periodic task coordinator.
func NewCronScheduler(producer QueueProducer, client *redis.Client) *CronScheduler {
	return &CronScheduler{
		producer: producer,
		redis:    client,
		stopChan: make(chan struct{}),
	}
}

// Start begins periodic task tickers.
func (s *CronScheduler) Start(ctx context.Context) {
	cartTicker := time.NewTicker(1 * time.Hour)
	auditTicker := time.NewTicker(6 * time.Hour)
	backupTicker := time.NewTicker(24 * time.Hour)

	go func() {
		for {
			select {
			case <-s.stopChan:
				cartTicker.Stop()
				auditTicker.Stop()
				backupTicker.Stop()
				return
			case <-ctx.Done():
				return

			case <-cartTicker.C:
				if s.acquireLock(ctx, "lock:cron:expire_carts", 10*time.Minute) {
					_, _ = s.producer.Enqueue(ctx, JobExpireCarts, "", "", map[string]string{}, 3)
				}

			case <-auditTicker.C:
				if s.acquireLock(ctx, "lock:cron:audit_low_stock", 30*time.Minute) {
					_, _ = s.producer.Enqueue(ctx, JobAuditLowStock, "", "", map[string]string{}, 3)
				}

			case <-backupTicker.C:
				if s.acquireLock(ctx, "lock:cron:db_backup", 2*time.Hour) {
					_, _ = s.producer.Enqueue(ctx, JobTenantDBBackup, "", "platform", map[string]string{}, 3)
				}
			}
		}
	}()

	slog.Default().Info("Distributed cron maintenance scheduler started")
}

// Stop halts the periodic scheduler.
func (s *CronScheduler) Stop() {
	close(s.stopChan)
}

func (s *CronScheduler) acquireLock(ctx context.Context, lockKey string, ttl time.Duration) bool {
	res, err := s.redis.SetNX(ctx, lockKey, "locked", ttl).Result()
	return err == nil && res
}
