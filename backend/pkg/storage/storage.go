// Package storage provides an abstracted object storage engine supporting
// local disk storage and S3-compatible cloud object storage providers.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

var (
	ErrFileTooLarge     = errors.New("storage: file exceeds maximum allowed size (10MB)")
	ErrInvalidMimeType  = errors.New("storage: unsupported file format, only JPEG, PNG, WebP, AVIF, MP3, and OGG are permitted")
	ErrFileNotFound     = errors.New("storage: requested object could not be found")
	ErrEmptyFilePayload = errors.New("storage: file payload is empty")
)

const (
	MaxUploadSize = 10 * 1024 * 1024 // 10 Megabytes
)

// AllowedMediaMimes defines verified binary image and audio signatures.
var AllowedMediaMimes = map[string]string{
	"image/jpeg":        ".jpg",
	"image/png":         ".png",
	"image/webp":        ".webp",
	"image/avif":        ".avif",
	"audio/mpeg":        ".mp3",
	"audio/mp3":         ".mp3",
	"audio/ogg":         ".ogg",
	"audio/vorbis":      ".ogg",
	"application/ogg":   ".ogg",
}

// AllowedImageMimes defines verified binary image signatures (for backward compatibility).
var AllowedImageMimes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
}

// UploadResult encapsulates the persisted file coordinates.
type UploadResult struct {
	Key         string `json:"key"`          // Relative object storage key
	URL         string `json:"url"`          // Publicly accessible URL
	Size        int64  `json:"size"`         // Size in bytes
	ContentType string `json:"content_type"` // Validated MIME type
}

// ObjectStorage defines the contract required for storing and removing media assets.
type ObjectStorage interface {
	Save(ctx context.Context, folder string, filename string, contentType string, reader io.Reader, size int64) (*UploadResult, error)
	Delete(ctx context.Context, key string) error
	GetURL(key string) string
}

// ValidateMime ensures uploaded files conform to accepted media types.
func ValidateMime(contentType string) (string, error) {
	cleanType := strings.ToLower(strings.TrimSpace(contentType))
	// Allow audio or image MIME
	ext, ok := AllowedMediaMimes[cleanType]
	if !ok {
		return "", fmt.Errorf("%w: received %s", ErrInvalidMimeType, cleanType)
	}
	return ext, nil
}

// SanitizeFilename formats a base filename preventing directory traversal attacks.
func SanitizeFilename(name string) string {
	base := filepath.Base(name)
	return strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			return r
		}
		return -1
	}, base)
}
