package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// DefaultGroupName is the consumer group name used by the worker pool.
	DefaultGroupName = "ecom-worker-group"
)

// JobHandlerFunc represents an execution handler for a specific JobType.
type JobHandlerFunc func(ctx context.Context, envelope *JobEnvelope) error

// ConsumerEngine coordinates distributed worker execution across Redis Streams.
type ConsumerEngine struct {
	client       *redis.Client
	producer     QueueProducer
	handlers     map[JobType]JobHandlerFunc
	groupName    string
	consumerName string
	streamName   string
	concurrency  int
	stopChan     chan struct{}
	wg           sync.WaitGroup
}

// NewConsumerEngine instantiates the worker consumer.
func NewConsumerEngine(client *redis.Client, producer QueueProducer, consumerName string, concurrency int) *ConsumerEngine {
	if concurrency <= 0 {
		concurrency = 4
	}
	return &ConsumerEngine{
		client:       client,
		producer:     producer,
		handlers:     make(map[JobType]JobHandlerFunc),
		groupName:    DefaultGroupName,
		consumerName: consumerName,
		streamName:   DefaultStreamName,
		concurrency:  concurrency,
		stopChan:     make(chan struct{}),
	}
}

// RegisterHandler binds an execution handler to a job type.
func (e *ConsumerEngine) RegisterHandler(t JobType, h JobHandlerFunc) {
	e.handlers[t] = h
}

// EnsureGroup creates the consumer group in Redis if not already present.
func (e *ConsumerEngine) EnsureGroup(ctx context.Context) error {
	err := e.client.XGroupCreateMkStream(ctx, e.streamName, e.groupName, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("failed to initialize consumer group: %w", err)
	}
	return nil
}

// Start launches worker goroutines consuming messages from the stream.
func (e *ConsumerEngine) Start(ctx context.Context) error {
	if err := e.EnsureGroup(ctx); err != nil {
		return err
	}

	for i := 0; i < e.concurrency; i++ {
		e.wg.Add(1)
		go e.workerLoop(ctx, i)
	}

	slog.Default().Info("Background worker pool started",
		slog.String("consumer", e.consumerName),
		slog.Int("concurrency", e.concurrency),
	)
	return nil
}

// Stop signals worker loops to exit and waits for in-flight tasks to finish.
func (e *ConsumerEngine) Stop() {
	close(e.stopChan)
	e.wg.Wait()
	slog.Default().Info("Background worker pool stopped cleanly")
}

func (e *ConsumerEngine) workerLoop(ctx context.Context, workerID int) {
	defer e.wg.Done()

	for {
		select {
		case <-e.stopChan:
			return
		case <-ctx.Done():
			return
		default:
			// Read unread messages via XREADGROUP
			streams, err := e.client.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    e.groupName,
				Consumer: fmt.Sprintf("%s-%d", e.consumerName, workerID),
				Streams:  []string{e.streamName, ">"},
				Count:    1,
				Block:    2 * time.Second,
			}).Result()

			if err != nil {
				if errors.Is(err, redis.Nil) || strings.Contains(err.Error(), "timeout") {
					continue
				}
				time.Sleep(500 * time.Millisecond)
				continue
			}

			for _, stream := range streams {
				for _, msg := range stream.Messages {
					e.processMessage(ctx, msg)
				}
			}
		}
	}
}

func (e *ConsumerEngine) processMessage(ctx context.Context, msg redis.XMessage) {
	raw, ok := msg.Values["data"].(string)
	if !ok {
		_ = e.client.XAck(ctx, e.streamName, e.groupName, msg.ID)
		return
	}

	var envelope JobEnvelope
	if err := json.Unmarshal([]byte(raw), &envelope); err != nil {
		slog.Default().Error("Corrupt job envelope in stream", slog.String("msg_id", msg.ID))
		_ = e.client.XAck(ctx, e.streamName, e.groupName, msg.ID)
		return
	}

	handler, exists := e.handlers[envelope.Type]
	if !exists {
		slog.Default().Warn("No registered handler for job type", slog.String("type", string(envelope.Type)))
		_ = e.client.XAck(ctx, e.streamName, e.groupName, msg.ID)
		return
	}

	envelope.Attempt++
	err := handler(ctx, &envelope)

	if err == nil {
		// Job successful: Acknowledge from consumer group
		_ = e.client.XAck(ctx, e.streamName, e.groupName, msg.ID)
		return
	}

	slog.Default().Warn("Job execution failed",
		slog.String("job_id", envelope.ID),
		slog.String("type", string(envelope.Type)),
		slog.Int("attempt", envelope.Attempt),
		slog.String("error", err.Error()),
	)

	// Check if retry threshold reached
	if envelope.Attempt >= envelope.MaxRetries {
		slog.Default().Error("Job exceeded max retries, routing to DLQ",
			slog.String("job_id", envelope.ID),
			slog.String("type", string(envelope.Type)),
		)
		_ = e.producer.EnqueueDLQ(ctx, &envelope, err.Error())
		_ = e.client.XAck(ctx, e.streamName, e.groupName, msg.ID)
		return
	}

	// Exponential backoff retry
	backoffSec := int(math.Pow(2, float64(envelope.Attempt))) * 5
	time.Sleep(time.Duration(backoffSec) * time.Millisecond) // Short delay before next attempt
}
