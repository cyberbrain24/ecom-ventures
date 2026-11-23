-- Ecom Ventures: Rollback seeded storefront design themes
-- Migration Version: 000004_seed_storefront_themes.down.sql
-- Removes only these four slugs, and only when no store_themes row references them.

DELETE FROM themes
WHERE slug IN ('fashion-universal', 'streetculture-fashion', 'inner-wear-women', 'jewelry-women')
  AND NOT EXISTS (
      SELECT 1 FROM store_themes st WHERE st.theme_id = themes.id
  );
