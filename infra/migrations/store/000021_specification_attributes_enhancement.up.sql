-- 000021_specification_attributes_enhancement.up.sql
-- Adds data_type to attributes and image_url to attribute_values for rich swatches and specification options

ALTER TABLE attributes ADD COLUMN IF NOT EXISTS data_type VARCHAR(30) NOT NULL DEFAULT 'select';
ALTER TABLE attribute_values ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
