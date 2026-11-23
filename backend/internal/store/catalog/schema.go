package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
)

// orderingSchemaDDL adds the display-order columns that the catalog ordering feature needs.
// It is idempotent and must stay identical to infra/migrations/store/000011_catalog_display_order.up.sql,
// because store databases created before that migration are only reached through this function.
var orderingSchemaDDL = []string{
	`ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,
	`ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_order INTEGER NOT NULL DEFAULT 0`,
	`ALTER TABLE attributes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,
	`ALTER TABLE categories ADD COLUMN IF NOT EXISTS og_image_url TEXT NOT NULL DEFAULT ''`,
	`CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products (sort_order ASC, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_products_featured_order ON products (featured_order ASC) WHERE is_featured = TRUE`,
}

// brandCareSchemaDDL creates the brands and care_instructions tables. It is idempotent and must stay
// identical to infra/migrations/store/000012_brands_care_instructions.up.sql.
var brandCareSchemaDDL = []string{
	`CREATE TABLE IF NOT EXISTS brands (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name VARCHAR(120) NOT NULL,
		slug VARCHAR(140) NOT NULL UNIQUE,
		logo_url TEXT NOT NULL DEFAULT '',
		origin VARCHAR(120) NOT NULL DEFAULT '',
		description TEXT NOT NULL DEFAULT '',
		website_url TEXT NOT NULL DEFAULT '',
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON brands (sort_order ASC, name ASC)`,
	`DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands`,
	`CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column()`,
	`CREATE TABLE IF NOT EXISTS care_instructions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title VARCHAR(160) NOT NULL,
		material_category VARCHAR(120) NOT NULL DEFAULT '',
		instructions TEXT[] NOT NULL DEFAULT '{}',
		care_symbols TEXT[] NOT NULL DEFAULT '{}',
		description TEXT NOT NULL DEFAULT '',
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS idx_care_instructions_sort_order ON care_instructions (sort_order ASC, title ASC)`,
	`DROP TRIGGER IF EXISTS trg_care_instructions_updated_at ON care_instructions`,
	`CREATE TRIGGER trg_care_instructions_updated_at BEFORE UPDATE ON care_instructions FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column()`,
	// Product links (migration 000013). These run after the two tables above exist.
	`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL`,
	`ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instruction_id UUID REFERENCES care_instructions(id) ON DELETE SET NULL`,
	`CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products (brand_id)`,
	`CREATE INDEX IF NOT EXISTS idx_products_care_instruction_id ON products (care_instruction_id)`,
}

var (
	schemaMu            sync.Mutex
	orderingSchemaReady sync.Map // *sql.DB -> struct{}
	brandCareReady      sync.Map // *sql.DB -> struct{}
)

// ensureSchemaOnce runs ddl against db once per connection pool, remembering success in ready.
// It is safe for concurrent use; concurrent first calls are serialised so DDL never races itself.
func ensureSchemaOnce(ctx context.Context, db *sql.DB, ready *sync.Map, name string, ddl []string) error {
	if db == nil {
		return fmt.Errorf("ensuring %s schema: %w", name, errors.New("nil database handle"))
	}
	if _, ok := ready.Load(db); ok {
		return nil
	}

	schemaMu.Lock()
	defer schemaMu.Unlock()
	if _, ok := ready.Load(db); ok {
		return nil
	}

	for _, stmt := range ddl {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("ensuring %s schema: %w", name, err)
		}
	}
	ready.Store(db, struct{}{})
	return nil
}

// EnsureOrderingSchema makes sure the tenant database has the catalog display-order columns.
// Each connection pool is checked once per process; later calls return immediately. It is called by every
// repository method that reads or writes those columns, in both the store-admin and storefront catalog modules.
func EnsureOrderingSchema(ctx context.Context, db *sql.DB) error {
	// Product queries read brand_id and care_instruction_id too, so the brand and care schema must exist first.
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return err
	}
	return ensureSchemaOnce(ctx, db, &orderingSchemaReady, "catalog ordering", orderingSchemaDDL)
}

// EnsureBrandCareSchema makes sure the tenant database has the brands and care_instructions tables.
// It is called by every brand and care instruction repository method.
func EnsureBrandCareSchema(ctx context.Context, db *sql.DB) error {
	return ensureSchemaOnce(ctx, db, &brandCareReady, "brand and care instruction", brandCareSchemaDDL)
}
