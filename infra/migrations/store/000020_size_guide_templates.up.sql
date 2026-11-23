-- 000020_size_guide_templates.up.sql
-- Size Guide Templates architecture with multi-table JSON measurement matrices and product linking

CREATE TABLE IF NOT EXISTS size_guide_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tables JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_size_guide_templates_sort_order ON size_guide_templates(sort_order ASC, created_at ASC);

-- Add foreign-key column on products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_template_id UUID REFERENCES size_guide_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_size_template_id ON products(size_template_id);
