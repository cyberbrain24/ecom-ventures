// Package worker provides background task processing, Redis Streams job queues,
// and scheduled multi-tenant database maintenance routines.
package worker

import (
	"time"
)

// JobType defines supported asynchronous background task identifiers.
type JobType string

const (
	JobSendEmail      JobType = "JOB_SEND_EMAIL"
	JobMetaCAPIRetry  JobType = "JOB_META_CAPI_RETRY"
	JobExpireCarts    JobType = "JOB_EXPIRE_CARTS"
	JobAuditLowStock  JobType = "JOB_AUDIT_LOW_STOCK"
	JobTenantDBBackup JobType = "JOB_TENANT_DB_BACKUP"
)

// JobEnvelope represents the serialized message persisted into Redis Streams.
type JobEnvelope struct {
	ID         string    `json:"id"`
	Type       JobType   `json:"type"`
	TenantID   string    `json:"tenant_id,omitempty"`
	StoreSlug  string    `json:"store_slug,omitempty"`
	Payload    []byte    `json:"payload"`
	MaxRetries int       `json:"max_retries"`
	Attempt    int       `json:"attempt"`
	LastError  string    `json:"last_error,omitempty"`
	EnqueuedAt time.Time `json:"enqueued_at"`
}

// SendEmailPayload defines parameters for transactional email delivery.
type SendEmailPayload struct {
	ToAddress    string            `json:"to_address"`
	Subject      string            `json:"subject"`
	Template     string            `json:"template"` // ORDER_CONFIRMED, SHIPMENT_DISPATCHED, PASSWORD_RESET
	TemplateData map[string]string `json:"template_data"`
}

// CAPIRetryPayload defines parameters for re-submitting failed Meta CAPI conversion events.
type CAPIRetryPayload struct {
	PixelID       string `json:"pixel_id"`
	AccessToken   string `json:"access_token"`
	TestEventCode string `json:"test_event_code,omitempty"`
	EventJSON     []byte `json:"event_json"`
}

// BackupPayload defines parameters for generating tenant database dumps.
type BackupPayload struct {
	DBHost     string `json:"db_host"`
	DBPort     int    `json:"db_port"`
	DBName     string `json:"db_name"`
	DBUser     string `json:"db_user"`
	DBPassword string `json:"db_password"`
}
