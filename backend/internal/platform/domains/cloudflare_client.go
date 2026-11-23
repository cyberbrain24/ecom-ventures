// Package domains manages custom domain registrations, DNS TXT verification,
// and SSL certificate provisioning across the Ecom Ventures platform.
package domains

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CloudflareClient defines operations for edge custom hostname provisioning.
type CloudflareClient interface {
	CreateCustomHostname(ctx context.Context, domain string) (*CustomHostnameResponse, error)
	DeleteCustomHostname(ctx context.Context, hostnameID string) error
	GetCustomHostnameStatus(ctx context.Context, hostnameID string) (string, error)
}

// CustomHostnameResponse represents Cloudflare's custom hostname payload.
type CustomHostnameResponse struct {
	ID        string `json:"id"`
	Hostname  string `json:"hostname"`
	SSLStatus string `json:"ssl_status"` // PENDING, ACTIVE, FAILED, REVOKED
}

// HTTPCloudflareClient manages live Cloudflare for SaaS API integrations.
type HTTPCloudflareClient struct {
	apiToken string
	zoneID   string
	baseURL  string
	client   *http.Client
}

// cloudflareAPIBase is the production Cloudflare v4 API root.
const cloudflareAPIBase = "https://api.cloudflare.com/client/v4"

// NewCloudflareClient instantiates the Cloudflare API client.
func NewCloudflareClient(apiToken, zoneID string) *HTTPCloudflareClient {
	return &HTTPCloudflareClient{
		apiToken: apiToken,
		zoneID:   zoneID,
		baseURL:  cloudflareAPIBase,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *HTTPCloudflareClient) validateConfig() error {
	if c.apiToken == "" || c.zoneID == "" {
		return fmt.Errorf("Cloudflare API token and zone ID are required")
	}
	return nil
}

// CreateCustomHostname requests an SSL certificate and edge route for a custom domain.
func (c *HTTPCloudflareClient) CreateCustomHostname(ctx context.Context, domain string) (*CustomHostnameResponse, error) {
	if err := c.validateConfig(); err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/custom_hostnames", c.zoneID)
	payload := map[string]interface{}{
		"hostname": domain,
		"ssl": map[string]interface{}{
			"method": "http",
			"type":   "dv",
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode cloudflare payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cloudflare API request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("cloudflare returned status: %d", resp.StatusCode)
	}

	var res struct {
		Success bool `json:"success"`
		Result  struct {
			ID     string `json:"id"`
			Status string `json:"status"`
			SSL    struct {
				Status string `json:"status"`
			} `json:"ssl"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode cloudflare response: %w", err)
	}
	if !res.Success {
		return nil, fmt.Errorf("cloudflare rejected custom hostname creation")
	}
	if res.Result.ID == "" {
		return nil, fmt.Errorf("cloudflare response did not include a hostname ID")
	}

	return &CustomHostnameResponse{
		ID:        res.Result.ID,
		Hostname:  domain,
		SSLStatus: strings.ToUpper(res.Result.SSL.Status),
	}, nil
}

// DeleteCustomHostname removes a custom hostname mapping from the edge.
// A hostname that no longer exists (HTTP 404) counts as success so deletes and renames are idempotent.
func (c *HTTPCloudflareClient) DeleteCustomHostname(ctx context.Context, hostnameID string) error {
	if err := c.validateConfig(); err != nil {
		return err
	}

	url := fmt.Sprintf("%s/zones/%s/custom_hostnames/%s", c.baseURL, c.zoneID, hostnameID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("build Cloudflare delete request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send Cloudflare delete request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// The hostname is already gone, which is the state the caller wants.
		return nil
	}
	if resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("Cloudflare delete returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode Cloudflare delete response: %w", err)
	}
	if !result.Success {
		return fmt.Errorf("Cloudflare rejected custom hostname deletion")
	}
	return nil
}

// GetCustomHostnameStatus queries the current SSL certificate resolution status.
func (c *HTTPCloudflareClient) GetCustomHostnameStatus(ctx context.Context, hostnameID string) (string, error) {
	if err := c.validateConfig(); err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/custom_hostnames/%s", c.zoneID, hostnameID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("build Cloudflare status request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("send Cloudflare status request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("Cloudflare status request returned HTTP %d", resp.StatusCode)
	}

	var result struct {
		Success bool `json:"success"`
		Result  struct {
			SSL struct {
				Status string `json:"status"`
			} `json:"ssl"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode Cloudflare status response: %w", err)
	}
	if !result.Success {
		return "", fmt.Errorf("Cloudflare rejected custom hostname status request")
	}
	if result.Result.SSL.Status == "" {
		return "", fmt.Errorf("Cloudflare status response did not include SSL status")
	}
	return strings.ToUpper(result.Result.SSL.Status), nil
}
