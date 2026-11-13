package marketing

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// MetaCAPIDispatcher transmits server-side events directly to Meta Graph API.
type MetaCAPIDispatcher struct {
	httpClient *http.Client
}

// NewMetaCAPIDispatcher instantiates a new MetaCAPIDispatcher.
func NewMetaCAPIDispatcher() *MetaCAPIDispatcher {
	return &MetaCAPIDispatcher{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// HashSHA256 normalizes text (lowercase, trimmed) and generates a SHA-256 hex string according to Meta guidelines.
func HashSHA256(val string) string {
	clean := strings.ToLower(strings.TrimSpace(val))
	if clean == "" {
		return ""
	}
	hash := sha256.Sum256([]byte(clean))
	return hex.EncodeToString(hash[:])
}

// NormalizeAndHashPhone strips non-digit characters and hashes the phone number.
func NormalizeAndHashPhone(phone string) string {
	reg := regexp.MustCompile("[^0-9]+")
	digits := reg.ReplaceAllString(phone, "")
	if digits == "" {
		return ""
	}
	return HashSHA256(digits)
}

// DispatchEvents sends an array of normalized CAPI events to Meta Graph API v19.0.
func (d *MetaCAPIDispatcher) DispatchEvents(ctx context.Context, pixelID, accessToken, testEventCode string, events []CAPIEvent) error {
	if pixelID == "" || accessToken == "" {
		return errors.New("pixel_id and access_token are required for CAPI dispatch")
	}

	if len(events) == 0 {
		return nil
	}

	apiURL := fmt.Sprintf("https://graph.facebook.com/v19.0/%s/events?access_token=%s", pixelID, accessToken)

	payload := map[string]interface{}{
		"data": events,
	}
	if testEventCode != "" {
		payload["test_event_code"] = testEventCode
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to serialize CAPI payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("meta CAPI network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errResp struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
				Code    int    `json:"code"`
			} `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		return fmt.Errorf("meta CAPI rejected events: %s (code %d)", errResp.Error.Message, errResp.Error.Code)
	}

	return nil
}
