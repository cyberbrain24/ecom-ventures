-- 000021_specification_attributes_enhancement.down.sql

ALTER TABLE attribute_values DROP COLUMN IF EXISTS image_url;
ALTER TABLE attributes DROP COLUMN IF EXISTS data_type;
