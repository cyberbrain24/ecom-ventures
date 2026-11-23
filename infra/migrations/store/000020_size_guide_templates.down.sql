-- 000020_size_guide_templates.down.sql

ALTER TABLE products DROP COLUMN IF EXISTS size_template_id;
DROP TABLE IF EXISTS size_guide_templates CASCADE;
