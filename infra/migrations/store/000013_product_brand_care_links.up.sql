-- Links each product to at most one brand and one care instruction.
-- Deleting a brand or care instruction clears the link instead of deleting the product.
-- Keep this identical to the link DDL in catalog.EnsureBrandCareSchema (backend/internal/store/catalog/schema.go).
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instruction_id UUID REFERENCES care_instructions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_care_instruction_id ON products (care_instruction_id);
