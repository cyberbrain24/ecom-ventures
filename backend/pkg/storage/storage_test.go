package storage

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateMime(t *testing.T) {
	tests := []struct {
		mime     string
		expected string
		err      error
	}{
		{"image/jpeg", ".jpg", nil},
		{"image/png", ".png", nil},
		{"image/webp", ".webp", nil},
		{"image/avif", ".avif", nil},
		{"IMAGE/JPEG", ".jpg", nil},
		{"application/pdf", "", ErrInvalidMimeType},
		{"text/plain", "", ErrInvalidMimeType},
	}

	for _, tc := range tests {
		ext, err := ValidateMime(tc.mime)
		if tc.err != nil {
			if err == nil || !strings.Contains(err.Error(), tc.err.Error()) {
				t.Errorf("mime %s: expected error %v, got %v", tc.mime, tc.err, err)
			}
		} else {
			if err != nil || ext != tc.expected {
				t.Errorf("mime %s: expected %s, got %s (err: %v)", tc.mime, tc.expected, ext, err)
			}
		}
	}
}

func TestSanitizeFilename(t *testing.T) {
	name := SanitizeFilename("../../../etc/passwd.jpg")
	if strings.Contains(name, "..") || strings.Contains(name, "/") {
		t.Errorf("SanitizeFilename failed to strip path traversal: %s", name)
	}
}

func TestLocalStorageSaveAndDelete(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "ecom_storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	store, err := NewLocalStorage(tempDir, "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("failed to init local storage: %v", err)
	}

	data := []byte("fake-jpeg-binary-payload")
	buf := bytes.NewReader(data)

	res, err := store.Save(context.Background(), "test-store/products", "shirt.jpg", "image/jpeg", buf, int64(len(data)))
	if err != nil {
		t.Fatalf("failed to save file: %v", err)
	}

	if res.Size != int64(len(data)) {
		t.Errorf("expected size %d, got %d", len(data), res.Size)
	}

	expectedPath := filepath.Join(tempDir, filepath.FromSlash(res.Key))
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Fatalf("file does not exist on disk at expected key: %s (path: %s)", res.Key, expectedPath)
	}

	// Verify GetURL
	url := store.GetURL(res.Key)
	if !strings.HasPrefix(url, "http://localhost:8080/uploads/") {
		t.Errorf("unexpected URL format: %s", url)
	}

	// Delete file
	if err := store.Delete(context.Background(), res.Key); err != nil {
		t.Fatalf("failed to delete file: %v", err)
	}

	if _, err := os.Stat(expectedPath); !os.IsNotExist(err) {
		t.Fatalf("file should have been removed from disk")
	}
}

func TestLocalStorageSizeLimits(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "ecom_storage_test_limits_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	store, err := NewLocalStorage(tempDir, "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("failed to init local storage: %v", err)
	}

	// Zero size
	_, err = store.Save(context.Background(), "folder", "test.png", "image/png", bytes.NewReader([]byte{}), 0)
	if err != ErrEmptyFilePayload {
		t.Errorf("expected ErrEmptyFilePayload, got %v", err)
	}

	// Exceeds max size
	_, err = store.Save(context.Background(), "folder", "test.png", "image/png", bytes.NewReader([]byte{}), MaxUploadSize+1)
	if err != ErrFileTooLarge {
		t.Errorf("expected ErrFileTooLarge, got %v", err)
	}
}
