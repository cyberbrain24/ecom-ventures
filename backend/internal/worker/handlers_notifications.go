package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"ecom-ventures/backend/internal/store/marketing"
)

// ErrNoEmailProvider is returned by UnconfiguredEmailSender. Returning an error (rather than
// reporting success) makes JOB_SEND_EMAIL retry and then dead-letter the job.
var ErrNoEmailProvider = errors.New("no email provider configured: transactional email was not sent")

// EmailSender specifies interface for sending transactional emails.
type EmailSender interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}

// UnconfiguredEmailSender is the sender used until a transactional email provider is configured.
// Every send fails with ErrNoEmailProvider so no email is ever reported as delivered.
type UnconfiguredEmailSender struct{}

// SendEmail always returns ErrNoEmailProvider.
func (s *UnconfiguredEmailSender) SendEmail(ctx context.Context, to, subject, body string) error {
	return ErrNoEmailProvider
}

// BuildEmailNotificationHandler creates a handler for JOB_SEND_EMAIL.
func BuildEmailNotificationHandler(sender EmailSender) JobHandlerFunc {
	return func(ctx context.Context, env *JobEnvelope) error {
		var payload SendEmailPayload
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return fmt.Errorf("invalid email payload: %w", err)
		}

		body := fmt.Sprintf("Template: %s | Data: %v", payload.Template, payload.TemplateData)
		return sender.SendEmail(ctx, payload.ToAddress, payload.Subject, body)
	}
}

// BuildCAPIRetryHandler creates a handler for JOB_META_CAPI_RETRY.
func BuildCAPIRetryHandler(dispatcher *marketing.MetaCAPIDispatcher) JobHandlerFunc {
	return func(ctx context.Context, env *JobEnvelope) error {
		var payload CAPIRetryPayload
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return fmt.Errorf("invalid CAPI retry payload: %w", err)
		}

		var event marketing.CAPIEvent
		if err := json.Unmarshal(payload.EventJSON, &event); err != nil {
			return fmt.Errorf("invalid inner CAPI event: %w", err)
		}

		return dispatcher.DispatchEvents(ctx, payload.PixelID, payload.AccessToken, payload.TestEventCode, []marketing.CAPIEvent{event})
	}
}
