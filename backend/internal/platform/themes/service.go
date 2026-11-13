package themes

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/store/resolver"
	"github.com/redis/go-redis/v9"
)

var (
	ErrThemeNotFound      = errors.New("themes: theme blueprint not found")
	ErrThemeSlugConflict  = errors.New("themes: theme slug is already registered")
	ErrCannotDeleteActive = errors.New("themes: cannot delete a theme currently used by active stores")
)

const (
	redisThemeStorePrefix = "theme:store:"
	redisThemeTTL         = 30 * time.Minute
)

// Service coordinates Master Admin theme registry and storefront theme resolution.
type Service struct {
	db          *sql.DB
	redisClient *redis.Client
	validator   *ThemeConfigValidator
	resolver    *resolver.StoreResolver
}

// NewService instantiates the theme management service.
func NewService(db *sql.DB, rdb *redis.Client, resolver *resolver.StoreResolver) *Service {
	return &Service{
		db:          db,
		redisClient: rdb,
		validator:   NewThemeConfigValidator(),
		resolver:    resolver,
	}
}

// RegisterTheme creates a new reusable theme blueprint in the Central Platform DB.
func (s *Service) RegisterTheme(ctx context.Context, req RegisterThemeRequest) (*models.Theme, error) {
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	if req.Slug == "" || req.Name == "" {
		return nil, errors.New("themes: name and slug are mandatory")
	}

	var exists bool
	_ = s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM themes WHERE slug = $1);", req.Slug).Scan(&exists)
	if exists {
		return nil, ErrThemeSlugConflict
	}

	if len(req.ConfigSchema) == 0 {
		req.ConfigSchema = json.RawMessage("{}")
	}
	version := req.Version
	if version == "" {
		version = "1.0.0"
	}

	query := `
		INSERT INTO themes (name, slug, description, version, preview_image_url, config_schema, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE)
		RETURNING id, is_active, created_at, updated_at;`

	var t models.Theme
	t.Name = req.Name
	t.Slug = req.Slug
	t.Description = req.Description
	t.Version = version
	t.PreviewImageURL = req.PreviewImageURL
	t.ConfigSchema = req.ConfigSchema

	err := s.db.QueryRowContext(ctx, query,
		t.Name, t.Slug, t.Description, t.Version, t.PreviewImageURL, t.ConfigSchema,
	).Scan(&t.ID, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to register theme: %w", err)
	}

	return &t, nil
}

// ListThemes retrieves all registered themes alongside their active store adoption count.
func (s *Service) ListThemes(ctx context.Context) ([]ThemeSummaryResponse, error) {
	query := `
		SELECT t.id, t.name, t.slug, COALESCE(t.description, ''), t.version, COALESCE(t.preview_image_url, ''),
		       t.config_schema, t.is_active, t.created_at, t.updated_at,
		       COUNT(st.id) AS active_stores_count
		FROM themes t
		LEFT JOIN store_themes st ON st.theme_id = t.id AND st.is_active = TRUE
		GROUP BY t.id
		ORDER BY t.created_at ASC;`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query themes: %w", err)
	}
	defer rows.Close()

	var results []ThemeSummaryResponse
	for rows.Next() {
		var item ThemeSummaryResponse
		if err := rows.Scan(
			&item.ID, &item.Name, &item.Slug, &item.Description, &item.Version,
			&item.PreviewImageURL, &item.ConfigSchema, &item.IsActive,
			&item.CreatedAt, &item.UpdatedAt, &item.ActiveStoresCount,
		); err != nil {
			return nil, fmt.Errorf("failed to scan theme row: %w", err)
		}
		results = append(results, item)
	}

	return results, nil
}

// AssignThemeToStore binds or updates the active theme and custom brand configuration for a store.
func (s *Service) AssignThemeToStore(ctx context.Context, storeID string, req AssignThemeRequest) error {
	// Validate custom configuration against styling rules
	if err := s.validator.ValidateCustomConfig(req.CustomConfig); err != nil {
		return fmt.Errorf("theme validation failed: %w", err)
	}

	// Verify theme existence
	var themeExists bool
	_ = s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM themes WHERE id = $1 AND is_active = TRUE);", req.ThemeID).Scan(&themeExists)
	if !themeExists {
		return ErrThemeNotFound
	}

	// Fetch store slug for validation
	var storeSlug string
	err := s.db.QueryRowContext(ctx, "SELECT slug FROM stores WHERE id = $1;", storeID).Scan(&storeSlug)
	if err == sql.ErrNoRows {
		return errors.New("themes: target store does not exist")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// Deactivate currently active theme for this store
	_, err = tx.ExecContext(ctx, `UPDATE store_themes SET is_active = FALSE WHERE store_id = $1;`, storeID)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("failed to demote active theme: %w", err)
	}

	// Insert new active store theme record
	customJSON := req.CustomConfig
	if len(customJSON) == 0 {
		customJSON = json.RawMessage("{}")
	}

	insertSQL := `
		INSERT INTO store_themes (store_id, theme_id, custom_config, is_active, activated_at)
		VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP);`

	if _, err := tx.ExecContext(ctx, insertSQL, storeID, req.ThemeID, customJSON); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("failed to bind new store theme: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// Invalidate Redis theme cache immediately
	s.invalidateThemeCache(ctx, storeID)

	return nil
}

// GetStoreTheme resolves the active theme and brand overrides for a store, backed by Redis.
func (s *Service) GetStoreTheme(ctx context.Context, storeID string) (*StoreThemeResponse, error) {
	cacheKey := redisThemeStorePrefix + storeID

	// Attempt Redis cache hit
	if s.redisClient != nil {
		val, err := s.redisClient.Get(ctx, cacheKey).Bytes()
		if err == nil {
			var resp StoreThemeResponse
			if jsonErr := json.Unmarshal(val, &resp); jsonErr == nil {
				return &resp, nil
			}
		}
	}

	// Query Central Platform Database
	query := `
		SELECT t.id, t.name, t.slug, t.version, st.custom_config, st.activated_at
		FROM store_themes st
		JOIN themes t ON t.id = st.theme_id
		WHERE st.store_id = $1 AND st.is_active = TRUE
		LIMIT 1;`

	var resp StoreThemeResponse
	err := s.db.QueryRowContext(ctx, query, storeID).Scan(
		&resp.ThemeID, &resp.ThemeName, &resp.ThemeSlug, &resp.Version,
		&resp.CustomConfig, &resp.ActivatedAt,
	)
	if err == sql.ErrNoRows {
		// Fallback to platform default theme if unassigned
		fallbackQuery := `
			SELECT id, name, slug, version, '{}'::jsonb, CURRENT_TIMESTAMP
			FROM themes WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1;`
		err = s.db.QueryRowContext(ctx, fallbackQuery).Scan(
			&resp.ThemeID, &resp.ThemeName, &resp.ThemeSlug, &resp.Version,
			&resp.CustomConfig, &resp.ActivatedAt,
		)
		if err != nil {
			return nil, ErrThemeNotFound
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to query active store theme: %w", err)
	}

	// Cache resolved theme configuration in Redis
	if s.redisClient != nil {
		if data, err := json.Marshal(resp); err == nil {
			_ = s.redisClient.Set(ctx, cacheKey, data, redisThemeTTL).Err()
		}
	}

	return &resp, nil
}

func (s *Service) invalidateThemeCache(ctx context.Context, storeID string) {
	if s.redisClient != nil {
		_ = s.redisClient.Del(ctx, redisThemeStorePrefix+storeID).Err()
	}
}
