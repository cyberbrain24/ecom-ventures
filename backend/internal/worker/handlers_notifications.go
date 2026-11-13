package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"ecom-ventures/backend/internal/store/marketing"
)

// EmailSender specifies interface for sending transactional emails.
type EmailSender interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}

// LogEmailSender implements EmailSender for logging and development.
type LogEmailSender struct{}

// SendEmail logs the outgoing transactional email.
func (s *LogEmailSender) SendEmail(ctx context.Context, to, subject, body string) error {
	slog.Default().Info("Transactional Email Dispatched",
		slog.String("to", to),
		slog.String("subject", subject),
	)
	return nil
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
