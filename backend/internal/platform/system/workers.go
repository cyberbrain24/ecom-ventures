package system

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/worker"
	"ecom-ventures/backend/pkg/response"
)

// WorkerConsumerInfo describes a live Redis Stream consumer in the worker group.
type WorkerConsumerInfo struct {
	Name    string `json:"name"`
	Pending int64  `json:"pending"`
	IdleMs  int64  `json:"idle_ms"`
}

// SchedulerJobStatus describes a distributed cron job lock in Redis.
type SchedulerJobStatus struct {
	JobType        string `json:"job_type"`
	Label          string `json:"label"`
	Interval       string `json:"interval"`
	LockKey        string `json:"lock_key"`
	Locked         bool   `json:"locked"`
	LockTTLSeconds int64  `json:"lock_ttl_seconds"`
}

// WorkerJobSummary is a sanitized view of a queued or dead-lettered job envelope.
type WorkerJobSummary struct {
	StreamID   string    `json:"stream_id"`
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	StoreSlug  string    `json:"store_slug"`
	Attempt    int       `json:"attempt"`
	MaxRetries int       `json:"max_retries"`
	EnqueuedAt time.Time `json:"enqueued_at"`
	LastError  string    `json:"last_error,omitempty"`
}

// WorkerTelemetry exposes real-time Redis Stream queue depths, consumer health, and cron lock status.
type WorkerTelemetry struct {
	RedisConnected  bool                 `json:"redis_connected"`
	WorkerStatus    string               `json:"worker_status"`
	StreamName      string               `json:"stream_name"`
	DLQStreamName   string               `json:"dlq_stream_name"`
	ConsumerGroup   string               `json:"consumer_group"`
	StreamLength    int64                `json:"stream_length"`
	DLQLength       int64                `json:"dlq_length"`
	PendingCount    int64                `json:"pending_count"`
	ActiveConsumers []WorkerConsumerInfo `json:"active_consumers"`
	Schedulers      []SchedulerJobStatus `json:"schedulers"`
	RecentJobs      []WorkerJobSummary   `json:"recent_jobs"`
	RecentDLQ       []WorkerJobSummary   `json:"recent_dlq"`
	Timestamp       time.Time            `json:"timestamp"`
}

// TriggerWorkerJobRequest is the payload for POST /api/v1/platform/system/workers/trigger.
type TriggerWorkerJobRequest struct {
	JobType   string `json:"job_type"`
	StoreSlug string `json:"store_slug"`
}

// GetWorkerTelemetry inspects live Redis Streams, consumer groups, and scheduler lock keys.
func (s *Service) GetWorkerTelemetry(ctx context.Context) (*WorkerTelemetry, error) {
	wt := &WorkerTelemetry{
		StreamName:      worker.DefaultStreamName,
		DLQStreamName:   worker.DLQStreamName,
		ConsumerGroup:   worker.DefaultGroupName,
		WorkerStatus:    "DISCONNECTED",
		ActiveConsumers: make([]WorkerConsumerInfo, 0),
		Schedulers:      make([]SchedulerJobStatus, 0),
		RecentJobs:      make([]WorkerJobSummary, 0),
		RecentDLQ:       make([]WorkerJobSummary, 0),
		Timestamp:       time.Now().UTC(),
	}

	if s.redis == nil {
		return wt, nil
	}

	if err := s.redis.Ping(ctx).Err(); err != nil {
		return wt, nil
	}
	wt.RedisConnected = true

	// 1. Stream depths
	if xlen, err := s.redis.XLen(ctx, worker.DefaultStreamName).Result(); err == nil {
		wt.StreamLength = xlen
	}
	if dlqLen, err := s.redis.XLen(ctx, worker.DLQStreamName).Result(); err == nil {
		wt.DLQLength = dlqLen
	}

	// 2. Consumer group & active consumers
	if groups, err := s.redis.XInfoGroups(ctx, worker.DefaultStreamName).Result(); err == nil {
		for _, g := range groups {
			if g.Name == worker.DefaultGroupName {
				wt.PendingCount = g.Pending
				break
			}
		}
	}
	if consumers, err := s.redis.XInfoConsumers(ctx, worker.DefaultStreamName, worker.DefaultGroupName).Result(); err == nil {
		for _, c := range consumers {
			wt.ActiveConsumers = append(wt.ActiveConsumers, WorkerConsumerInfo{
				Name:    c.Name,
				Pending: c.Pending,
				IdleMs:  c.Idle.Milliseconds(),
			})
		}
	}

	if len(wt.ActiveConsumers) > 0 {
		wt.WorkerStatus = "ACTIVE"
	} else {
		wt.WorkerStatus = "NO_ACTIVE_CONSUMERS"
	}

	// 3. Distributed scheduler locks
	cronDefs := []struct {
		jobType  string
		label    string
		interval string
		lockKey  string
	}{
		{string(worker.JobExpireCarts), "Expire Abandoned Carts", "Every 1 hour", "lock:cron:expire_carts"},
		{string(worker.JobAuditLowStock), "Audit Low Stock Alerts", "Every 6 hours", "lock:cron:audit_low_stock"},
		{string(worker.JobTenantDBBackup), "Tenant Database Backup", "Every 24 hours", "lock:cron:db_backup"},
	}
	for _, def := range cronDefs {
		ttl, err := s.redis.TTL(ctx, def.lockKey).Result()
		locked := err == nil && ttl > 0
		ttlSec := int64(0)
		if locked {
			ttlSec = int64(ttl.Seconds())
		}
		wt.Schedulers = append(wt.Schedulers, SchedulerJobStatus{
			JobType:        def.jobType,
			Label:          def.label,
			Interval:       def.interval,
			LockKey:        def.lockKey,
			Locked:         locked,
			LockTTLSeconds: ttlSec,
		})
	}

	// 4. Recent stream entries (primary + DLQ)
	wt.RecentJobs = s.readRecentStreamJobs(ctx, worker.DefaultStreamName, 10)
	wt.RecentDLQ = s.readRecentStreamJobs(ctx, worker.DLQStreamName, 10)

	return wt, nil
}

func (s *Service) readRecentStreamJobs(ctx context.Context, stream string, count int64) []WorkerJobSummary {
	msgs, err := s.redis.XRevRangeN(ctx, stream, "+", "-", count).Result()
	if err != nil {
		return make([]WorkerJobSummary, 0)
	}
	out := make([]WorkerJobSummary, 0, len(msgs))
	for _, m := range msgs {
		summary := WorkerJobSummary{
			StreamID: m.ID,
		}
		if raw, ok := m.Values["data"].(string); ok && raw != "" {
			var env worker.JobEnvelope
			if err := json.Unmarshal([]byte(raw), &env); err == nil {
				summary.ID = env.ID
				summary.Type = string(env.Type)
				summary.StoreSlug = env.StoreSlug
				summary.Attempt = env.Attempt
				summary.MaxRetries = env.MaxRetries
				summary.EnqueuedAt = env.EnqueuedAt
				summary.LastError = env.LastError
			}
		}
		if reason, ok := m.Values["reason"].(string); ok && reason != "" && summary.LastError == "" {
			summary.LastError = reason
		}
		out = append(out, summary)
	}
	return out
}

// TriggerWorkerJob enqueues a supported maintenance job onto the Redis Stream and logs an audit entry.
func (s *Service) TriggerWorkerJob(ctx context.Context, req TriggerWorkerJobRequest, actor audit.Actor) (string, error) {
	if s.redis == nil {
		return "", fmt.Errorf("redis client is not configured")
	}

	jobType := worker.JobType(strings.TrimSpace(req.JobType))
	switch jobType {
	case worker.JobExpireCarts, worker.JobAuditLowStock, worker.JobTenantDBBackup:
	default:
		return "", fmt.Errorf("unsupported maintenance job_type %q", req.JobType)
	}

	storeSlug := strings.TrimSpace(req.StoreSlug)
	if storeSlug == "" {
		storeSlug = "platform"
	}

	producer := worker.NewRedisQueueProducer(s.redis)
	streamID, err := producer.Enqueue(ctx, jobType, "", storeSlug, map[string]string{
		"triggered_by": actor.Email,
	}, 3)
	if err != nil {
		return "", err
	}

	if s.platformDB != nil {
		_ = audit.Record(ctx, s.platformDB, actor, "WORKER_JOB_ENQUEUED", "worker_stream", streamID, "", nil, map[string]string{
			"job_type":   string(jobType),
			"store_slug": storeSlug,
			"stream_id":  streamID,
		})
	}

	return streamID, nil
}

// GetWorkerTelemetry handles GET /api/v1/platform/system/workers.
func (h *Handler) GetWorkerTelemetry(w http.ResponseWriter, r *http.Request) {
	telemetry, err := h.service.GetWorkerTelemetry(r.Context())
	if err != nil {
		response.Problem(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read worker telemetry", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, telemetry)
}

// TriggerWorkerJob handles POST /api/v1/platform/system/workers/trigger.
func (h *Handler) TriggerWorkerJob(w http.ResponseWriter, r *http.Request) {
	var req TriggerWorkerJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid request JSON", err.Error())
		return
	}

	streamID, err := h.service.TriggerWorkerJob(r.Context(), req, audit.ActorFromRequest(r))
	if err != nil {
		response.Problem(w, r, http.StatusBadRequest, "ENQUEUE_FAILED", "Failed to enqueue worker job", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, map[string]string{
		"stream_id": streamID,
		"job_type":  strings.TrimSpace(req.JobType),
		"status":    "ENQUEUED",
	})
}
