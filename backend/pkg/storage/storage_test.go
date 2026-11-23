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

func TestStorageResolverPaths(t *testing.T) {
	// Test tenant store paths
	p1 := BuildStorePath("PoshPlex BD", ModuleProducts, "prod_abc123")
	if p1 != "stores/poshplex-bd/products/prod_abc123" {
		t.Errorf("unexpected store path: %s", p1)
	}

	p2 := BuildStorePath("urban-movement", ModuleReviews)
	if p2 != "stores/urban-movement/reviews" {
		t.Errorf("unexpected reviews path: %s", p2)
	}

	p3 := BuildStorePath("mior", ModuleBrand)
	if p3 != "stores/mior/brand" {
		t.Errorf("unexpected brand path: %s", p3)
	}

	// Test platform paths
	pl1 := BuildPlatformPath(ModulePlatformBranding)
	if pl1 != "platform/branding" {
		t.Errorf("unexpected platform branding path: %s", pl1)
	}

	pl2 := BuildPlatformPath(ModulePlatformAvatars, "superadmin")
	if pl2 != "platform/admin-avatars/superadmin" {
		t.Errorf("unexpected platform avatar path: %s", pl2)
	}
}

func TestDynamicStorageProvider(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "ecom_dynamic_storage_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	local, err := NewLocalStorage(tempDir, "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("failed to init local storage: %v", err)
	}

	dyn := NewDynamicStorageProvider(local, "local")
	if dyn.GetProviderName() != "local" {
		t.Errorf("expected provider local, got %s", dyn.GetProviderName())
	}

	data := []byte("dynamic-test-payload")
	res, err := dyn.Save(context.Background(), "test/folder", "dynamic.png", "image/png", bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("dyn save failed: %v", err)
	}

	if !strings.HasPrefix(res.URL, "http://localhost:8080/uploads/") {
		t.Errorf("unexpected dynamic URL: %s", res.URL)
	}
}

func TestR2StorageConfigValidation(t *testing.T) {
	_, err := NewR2Storage(R2Config{})
	if err == nil {
		t.Errorf("expected error for empty R2Config")
	}

	r2, err := NewR2Storage(R2Config{
		AccountID:       "test-account-id",
		BucketName:      "test-bucket",
		AccessKeyID:     "test-key-id",
		SecretAccessKey: "test-secret-key",
		PublicURL:       "https://media.dropiobd.com",
	})
	if err != nil {
		t.Fatalf("unexpected error initializing R2: %v", err)
	}

	url := r2.GetURL("stores/poshplex/products/item.jpg")
	if url != "https://media.dropiobd.com/stores/poshplex/products/item.jpg" {
		t.Errorf("unexpected R2 public URL: %s", url)
	}
}

