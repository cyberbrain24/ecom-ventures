// Package storage provides an abstracted object storage engine.
package storage

import (
	"path/filepath"
	"strings"
)

// StorageScope defines the top-level partition (platform vs tenant store).
type StorageScope string

const (
	ScopePlatform StorageScope = "platform"
	ScopeStore    StorageScope = "stores"
)

// ModuleCategory identifies the specific business logic or entity owning the uploaded media.
type ModuleCategory string

const (
	// Tenant store modules
	ModuleProducts   ModuleCategory = "products"
	ModuleReviews    ModuleCategory = "reviews"
	ModuleCategories ModuleCategory = "categories"
	ModuleBrand      ModuleCategory = "brand"
	ModuleBlog       ModuleCategory = "blog"
	ModuleMusic      ModuleCategory = "music"
	ModuleOrders     ModuleCategory = "orders"
	ModuleGeneral    ModuleCategory = "general"

	// Platform modules
	ModulePlatformAvatars     ModuleCategory = "admin-avatars"
	ModulePlatformBranding    ModuleCategory = "branding"
	ModulePlatformThemes      ModuleCategory = "themes"
	ModulePlatformAttachments ModuleCategory = "attachments"
)

// CleanSlug sanitizes a store slug or folder identifier.
func CleanSlug(slug string) string {
	clean := strings.ToLower(strings.TrimSpace(slug))
	clean = strings.ReplaceAll(clean, " ", "-")
	return strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		return -1
	}, clean)
}

// BuildStorePath constructs a partitioned folder path for tenant store media:
// "stores/{store_slug}/{module}/{optional_subpaths...}"
// Example: BuildStorePath("poshplex", ModuleProducts, "prod_123") -> "stores/poshplex/products/prod_123"
// Example: BuildStorePath("poshplex", ModuleReviews) -> "stores/poshplex/reviews"
func BuildStorePath(storeSlug string, module ModuleCategory, subPaths ...string) string {
	cleanStore := CleanSlug(storeSlug)
	if cleanStore == "" {
		cleanStore = "unknown-store"
	}

	cleanModule := CleanSlug(string(module))
	if cleanModule == "" {
		cleanModule = "general"
	}

	parts := []string{string(ScopeStore), cleanStore, cleanModule}
	for _, sub := range subPaths {
		subClean := strings.Trim(filepath.ToSlash(sub), "/")
		if subClean != "" {
			parts = append(parts, subClean)
		}
	}

	return strings.Join(parts, "/")
}

// BuildPlatformPath constructs a partitioned folder path for platform master admin media:
// "platform/{module}/{optional_subpaths...}"
// Example: BuildPlatformPath(ModulePlatformBranding) -> "platform/branding"
// Example: BuildPlatformPath(ModulePlatformAvatars) -> "platform/admin-avatars"
func BuildPlatformPath(module ModuleCategory, subPaths ...string) string {
	cleanModule := CleanSlug(string(module))
	if cleanModule == "" {
		cleanModule = "general"
	}

	parts := []string{string(ScopePlatform), cleanModule}
	for _, sub := range subPaths {
		subClean := strings.Trim(filepath.ToSlash(sub), "/")
		if subClean != "" {
			parts = append(parts, subClean)
		}
	}

	return strings.Join(parts, "/")
}
