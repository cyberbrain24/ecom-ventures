package worker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// DefaultStreamName is the primary Redis Stream for background job enqueuing.
	DefaultStreamName = "stream:ecom:jobs"
	// DLQStreamName is the Dead-Letter Queue stream for permanently failed jobs.
	DLQStreamName = "stream:ecom:jobs:dlq"
)

// QueueProducer defines methods for enqueuing asynchronous background tasks.
type QueueProducer interface {
	Enqueue(ctx context.Context, jobType JobType, tenantID, storeSlug string, payload interface{}, maxRetries int) (string, error)
	EnqueueDLQ(ctx context.Context, envelope *JobEnvelope, failureReason string) error
}

// RedisQueueProducer implements QueueProducer using Redis Streams.
type RedisQueueProducer struct {
	client     *redis.Client
	streamName string
}

// NewRedisQueueProducer instantiates the queue producer.
func NewRedisQueueProducer(client *redis.Client) *RedisQueueProducer {
	return &RedisQueueProducer{
		client:     client,
		streamName: DefaultStreamName,
	}
}

// Enqueue serializes and pushes a background task to the Redis Stream.
func (p *RedisQueueProducer) Enqueue(ctx context.Context, jobType JobType, tenantID, storeSlug string, payload interface{}, maxRetries int) (string, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to serialize job payload: %w", err)
	}

	jobID := generateJobID()
	if maxRetries <= 0 {
		maxRetries = 3
	}

	envelope := JobEnvelope{
		ID:         jobID,
		Type:       jobType,
		TenantID:   tenantID,
		StoreSlug:  storeSlug,
		Payload:    payloadBytes,
		MaxRetries: maxRetries,
		Attempt:    0,
		EnqueuedAt: time.Now(),
	}

	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		return "", fmt.Errorf("failed to serialize job envelope: %w", err)
	}

	args := &redis.XAddArgs{
		Stream: p.streamName,
		Values: map[string]interface{}{
			"data": string(envelopeBytes),
		},
	}

	res, err := p.client.XAdd(ctx, args).Result()
	if err != nil {
		return "", fmt.Errorf("failed to enqueue to redis stream: %w", err)
	}

	return res, nil
}

// EnqueueDLQ routes a permanently failed job envelope to the Dead-Letter Queue stream.
func (p *RedisQueueProducer) EnqueueDLQ(ctx context.Context, envelope *JobEnvelope, failureReason string) error {
	envelope.LastError = failureReason
	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		return err
	}

	args := &redis.XAddArgs{
		Stream: DLQStreamName,
		Values: map[string]interface{}{
			"data":   string(envelopeBytes),
			"reason": failureReason,
		},
	}

	return p.client.XAdd(ctx, args).Err()
}

func generateJobID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
