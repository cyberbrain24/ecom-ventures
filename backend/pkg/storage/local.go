// Package storage provides an abstracted object storage engine supporting
// local disk storage and S3-compatible cloud object storage providers.
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// LocalStorage implements ObjectStorage writing directly to the host filesystem.
type LocalStorage struct {
	baseDir string
	baseURL string
}

// NewLocalStorage instantiates a local disk storage provider.
func NewLocalStorage(baseDir, baseURL string) (*LocalStorage, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("storage: failed to initialize upload directory %s: %w", baseDir, err)
	}
	return &LocalStorage{
		baseDir: filepath.Clean(baseDir),
		baseURL: strings.TrimRight(baseURL, "/"),
	}, nil
}

// Save stores the incoming stream to disk, ensuring directory safety and size enforcement.
func (s *LocalStorage) Save(ctx context.Context, folder string, filename string, contentType string, reader io.Reader, size int64) (*UploadResult, error) {
	if size > MaxUploadSize {
		return nil, ErrFileTooLarge
	}
	if size <= 0 {
		return nil, ErrEmptyFilePayload
	}

	ext, err := ValidateMime(contentType)
	if err != nil {
		return nil, err
	}

	// Generate unique hash to avoid collisions
	tokenBytes := make([]byte, 8)
	_, _ = rand.Read(tokenBytes)
	uniqueSuffix := hex.EncodeToString(tokenBytes)

	cleanFolder := filepath.Clean(folder)
	cleanFolder = strings.TrimPrefix(cleanFolder, "/")
	cleanFolder = strings.TrimPrefix(cleanFolder, "\\")
	targetDir := filepath.Join(s.baseDir, cleanFolder)

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return nil, fmt.Errorf("storage: failed to create target folder: %w", err)
	}

	baseName := strings.TrimSuffix(SanitizeFilename(filename), filepath.Ext(filename))
	if baseName == "" {
		baseName = "media"
	}

	storedFilename := fmt.Sprintf("%d-%s-%s%s", time.Now().Unix(), baseName, uniqueSuffix, ext)
	filePath := filepath.Join(targetDir, storedFilename)

	dst, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return nil, fmt.Errorf("storage: failed to create destination file: %w", err)
	}
	defer dst.Close()

	written, err := io.Copy(dst, io.LimitReader(reader, MaxUploadSize))
	if err != nil {
		_ = os.Remove(filePath)
		return nil, fmt.Errorf("storage: failed to write file to disk: %w", err)
	}

	relKey := filepath.ToSlash(filepath.Join(cleanFolder, storedFilename))
	publicURL := fmt.Sprintf("%s/%s", s.baseURL, relKey)

	return &UploadResult{
		Key:         relKey,
		URL:         publicURL,
		Size:        written,
		ContentType: contentType,
	}, nil
}

// Delete removes a stored file from the local filesystem.
func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	cleanKey := filepath.Clean(key)
	fullPath := filepath.Join(s.baseDir, cleanKey)

	// Guard against directory traversal
	if !strings.HasPrefix(fullPath, s.baseDir) {
		return fmt.Errorf("storage: illegal path traversal attempt")
	}

	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("storage: failed to delete file: %w", err)
	}
	return nil
}

// GetURL returns the publicly addressable HTTP URL for a given storage key.
func (s *LocalStorage) GetURL(key string) string {
	cleanKey := strings.TrimPrefix(filepath.ToSlash(key), "/")
	return fmt.Sprintf("%s/%s", s.baseURL, cleanKey)
}
