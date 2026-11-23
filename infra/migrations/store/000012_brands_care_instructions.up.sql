-- Product brands and care instructions, each with a merchant-controlled display order.
-- Keep this identical to catalog.EnsureBrandCareSchema (backend/internal/store/catalog/schema.go).
CREATE TABLE IF NOT EXISTS brands (
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
);
CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON brands (sort_order ASC, name ASC);
DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();

CREATE TABLE IF NOT EXISTS care_instructions (
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
);
CREATE INDEX IF NOT EXISTS idx_care_instructions_sort_order ON care_instructions (sort_order ASC, title ASC);
DROP TRIGGER IF EXISTS trg_care_instructions_updated_at ON care_instructions;
CREATE TRIGGER trg_care_instructions_updated_at BEFORE UPDATE ON care_instructions FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();
