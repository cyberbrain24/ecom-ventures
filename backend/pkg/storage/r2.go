// Package storage provides an abstracted object storage engine supporting
// local disk storage and S3-compatible cloud object storage providers like Cloudflare R2.
package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

// R2Config contains the credentials and endpoints required to connect to Cloudflare R2.
type R2Config struct {
	AccountID       string `json:"account_id"`
	BucketName      string `json:"bucket_name"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	PublicURL       string `json:"public_url"` // e.g. https://media.ecomventures.com or https://pub-xxx.r2.dev
	Region          string `json:"region"`     // Defaults to "auto"
}

// R2Storage implements ObjectStorage for Cloudflare R2 using AWS Signature Version 4 (SigV4).
type R2Storage struct {
	config     R2Config
	endpoint   string
	httpClient *http.Client
}

// NewR2Storage initializes a high-performance Cloudflare R2 storage client.
func NewR2Storage(cfg R2Config) (*R2Storage, error) {
	if cfg.AccountID == "" {
		return nil, errors.New("storage/r2: AccountID is required")
	}
	if cfg.BucketName == "" {
		return nil, errors.New("storage/r2: BucketName is required")
	}
	if cfg.AccessKeyID == "" {
		return nil, errors.New("storage/r2: AccessKeyID is required")
	}
	if cfg.SecretAccessKey == "" {
		return nil, errors.New("storage/r2: SecretAccessKey is required")
	}
	if cfg.Region == "" {
		cfg.Region = "auto"
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", strings.TrimSpace(cfg.AccountID))

	// Optimized transport for high concurrency and connection reuse
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	return &R2Storage{
		config:   cfg,
		endpoint: endpoint,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   60 * time.Second,
		},
	}, nil
}

// Save streams the file payload into Cloudflare R2 with validated MIME and cache headers.
func (r *R2Storage) Save(ctx context.Context, folder string, filename string, contentType string, reader io.Reader, size int64) (*UploadResult, error) {
	if size > MaxUploadSize {
		return nil, ErrFileTooLarge
	}
	if size <= 0 {
		return nil, ErrEmptyFilePayload
	}

	ext, err := ValidateMime(contentType, filename)
	if err != nil {
		return nil, err
	}

	// Generate unique collision-resistant suffix
	tokenBytes := make([]byte, 8)
	_, _ = rand.Read(tokenBytes)
	uniqueSuffix := hex.EncodeToString(tokenBytes)

	cleanFolder := filepath.ToSlash(filepath.Clean(folder))
	cleanFolder = strings.TrimPrefix(cleanFolder, "/")
	cleanFolder = strings.TrimPrefix(cleanFolder, "\\")

	baseName := strings.TrimSuffix(SanitizeFilename(filename), filepath.Ext(filename))
	if baseName == "" {
		baseName = "media"
	}

	storedFilename := fmt.Sprintf("%d-%s-%s%s", time.Now().Unix(), baseName, uniqueSuffix, ext)
	relKey := fmt.Sprintf("%s/%s", cleanFolder, storedFilename)
	relKey = strings.TrimPrefix(relKey, "/")

	// Read payload into memory for exact SHA-256 payload calculation and streaming
	payloadBuf := new(bytes.Buffer)
	written, err := io.Copy(payloadBuf, io.LimitReader(reader, MaxUploadSize))
	if err != nil {
		return nil, fmt.Errorf("storage/r2: failed to read upload stream: %w", err)
	}

	payloadBytes := payloadBuf.Bytes()
	payloadHash := sha256.Sum256(payloadBytes)
	payloadHashHex := hex.EncodeToString(payloadHash[:])

	// Target S3 URL: https://<account_id>.r2.cloudflarestorage.com/<bucket>/<key>
	rawPath := fmt.Sprintf("/%s/%s", r.config.BucketName, relKey)
	reqURL := fmt.Sprintf("%s%s", r.endpoint, rawPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, reqURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("storage/r2: failed to construct HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Content-Length", fmt.Sprintf("%d", written))
	// 1 year immutable edge cache for media assets
	req.Header.Set("Cache-Control", "public, max-age=31536000, immutable")

	// Sign request using AWS SigV4
	if err := r.signRequest(req, payloadHashHex); err != nil {
		return nil, fmt.Errorf("storage/r2: failed to sign request: %w", err)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("storage/r2: network failure executing upload: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("storage/r2: upload failed with HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	publicURL := r.GetURL(relKey)

	return &UploadResult{
		Key:         relKey,
		URL:         publicURL,
		Size:        written,
		ContentType: contentType,
	}, nil
}

// Delete removes an object from Cloudflare R2 by key.
func (r *R2Storage) Delete(ctx context.Context, key string) error {
	cleanKey := strings.TrimPrefix(key, "/")

	// If a full URL was passed, extract relative key
	if strings.HasPrefix(cleanKey, "http://") || strings.HasPrefix(cleanKey, "https://") {
		if u, err := url.Parse(cleanKey); err == nil {
			cleanKey = strings.TrimPrefix(u.Path, "/")
			// If URL had bucket in path, strip bucket
			bucketPrefix := r.config.BucketName + "/"
			if strings.HasPrefix(cleanKey, bucketPrefix) {
				cleanKey = strings.TrimPrefix(cleanKey, bucketPrefix)
			}
		}
	}

	rawPath := fmt.Sprintf("/%s/%s", r.config.BucketName, cleanKey)
	reqURL := fmt.Sprintf("%s%s", r.endpoint, rawPath)

	emptyHash := sha256.Sum256([]byte(""))
	emptyHashHex := hex.EncodeToString(emptyHash[:])

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, reqURL, nil)
	if err != nil {
		return fmt.Errorf("storage/r2: failed to construct delete request: %w", err)
	}

	if err := r.signRequest(req, emptyHashHex); err != nil {
		return fmt.Errorf("storage/r2: failed to sign delete request: %w", err)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("storage/r2: network failure during delete: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage/r2: delete failed with HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// GetURL formats the public CDN or custom domain URL for an object key.
func (r *R2Storage) GetURL(key string) string {
	cleanKey := strings.TrimPrefix(key, "/")
	if r.config.PublicURL != "" {
		return fmt.Sprintf("%s/%s", strings.TrimRight(r.config.PublicURL, "/"), cleanKey)
	}
	// Fallback to direct R2 endpoint path
	return fmt.Sprintf("%s/%s/%s", r.endpoint, r.config.BucketName, cleanKey)
}

// TestConnection executes a fast HEAD or GET bucket probe to verify R2 credentials and bucket existence.
func (r *R2Storage) TestConnection(ctx context.Context) error {
	rawPath := fmt.Sprintf("/%s?max-keys=1", r.config.BucketName)
	reqURL := fmt.Sprintf("%s%s", r.endpoint, rawPath)

	emptyHash := sha256.Sum256([]byte(""))
	emptyHashHex := hex.EncodeToString(emptyHash[:])

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to construct probe request: %w", err)
	}

	if err := r.signRequest(req, emptyHashHex); err != nil {
		return fmt.Errorf("failed to sign probe request: %w", err)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connection to Cloudflare R2 failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Cloudflare R2 returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	return nil
}

// signRequest applies AWS Signature Version 4 (SigV4) headers to the HTTP request.
func (r *R2Storage) signRequest(req *http.Request, payloadHash string) error {
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("x-amz-content-sha256", payloadHash)
	req.Header.Set("Host", req.URL.Host)

	// Step 1: Create Canonical Request
	// CanonicalHeaders must be sorted lowercase
	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		req.URL.Host, payloadHash, amzDate)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"

	canonicalURI := req.URL.EscapedPath()
	if canonicalURI == "" {
		canonicalURI = "/"
	}

	canonicalQuery := req.URL.RawQuery

	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	canonicalRequestHash := sha256.Sum256([]byte(canonicalRequest))

	// Step 2: Create String to Sign
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, r.config.Region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		hex.EncodeToString(canonicalRequestHash[:]),
	}, "\n")

	// Step 3: Calculate Signature
	signingKey := getSignatureKey(r.config.SecretAccessKey, dateStamp, r.config.Region, "s3")
	signature := hmacSHA256(signingKey, []byte(stringToSign))
	signatureHex := hex.EncodeToString(signature)

	// Step 4: Add Authorization header
	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		r.config.AccessKeyID, credentialScope, signedHeaders, signatureHex)
	req.Header.Set("Authorization", authHeader)

	return nil
}

func hmacSHA256(key []byte, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func getSignatureKey(key, dateStamp, regionName, serviceName string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+key), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(regionName))
	kService := hmacSHA256(kRegion, []byte(serviceName))
	kSigning := hmacSHA256(kService, []byte("aws4_request"))
	return kSigning
}
