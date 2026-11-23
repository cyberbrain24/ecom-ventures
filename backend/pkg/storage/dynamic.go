// Package storage provides an abstracted object storage engine.
package storage

import (
	"context"
	"io"
	"sync"
)

// DynamicStorageProvider wraps an active ObjectStorage implementation behind a thread-safe mutex.
// This allows Master Admin to hot-swap between Local disk and Cloudflare R2 on-the-fly without server restarts.
type DynamicStorageProvider struct {
	mu           sync.RWMutex
	active       ObjectStorage
	providerName string
}

// NewDynamicStorageProvider creates a dynamic storage coordinator initialized with an active driver.
func NewDynamicStorageProvider(initial ObjectStorage, name string) *DynamicStorageProvider {
	return &DynamicStorageProvider{
		active:       initial,
		providerName: name,
	}
}

// UpdateProvider swaps the active storage implementation safely.
func (d *DynamicStorageProvider) UpdateProvider(newStorage ObjectStorage, name string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.active = newStorage
	d.providerName = name
}

// GetProviderName returns the identifier of the active storage driver ("local" or "cloudflare_r2").
func (d *DynamicStorageProvider) GetProviderName() string {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.providerName
}

// Save delegates upload to the active storage driver.
func (d *DynamicStorageProvider) Save(ctx context.Context, folder string, filename string, contentType string, reader io.Reader, size int64) (*UploadResult, error) {
	d.mu.RLock()
	active := d.active
	d.mu.RUnlock()
	return active.Save(ctx, folder, filename, contentType, reader, size)
}

// Delete delegates removal to the active storage driver.
func (d *DynamicStorageProvider) Delete(ctx context.Context, key string) error {
	d.mu.RLock()
	active := d.active
	d.mu.RUnlock()
	return active.Delete(ctx, key)
}

// GetURL delegates URL resolution to the active storage driver.
func (d *DynamicStorageProvider) GetURL(key string) string {
	d.mu.RLock()
	active := d.active
	d.mu.RUnlock()
	return active.GetURL(key)
}
