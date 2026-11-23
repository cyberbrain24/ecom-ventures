ALTER TABLE store_settings
DROP COLUMN IF EXISTS font_body,
DROP COLUMN IF EXISTS font_heading,
DROP COLUMN IF EXISTS secondary_color,
DROP COLUMN IF EXISTS primary_color,
DROP COLUMN IF EXISTS footer_content,
DROP COLUMN IF EXISTS site_description,
DROP COLUMN IF EXISTS mobile_hero_banner_url,
DROP COLUMN IF EXISTS desktop_hero_banner_url,
DROP COLUMN IF EXISTS logo_url;
