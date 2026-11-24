-- Ecom Ventures: Rollback seeded extended storefront design themes
-- Migration Version: 000006_seed_extended_storefront_themes.down.sql

DELETE FROM themes
WHERE slug IN (
    'gadget-tech',
    'inner-fashion-couture',
    'traditional-fashion-heritage',
    'minimal-mono',
    'midnight-gold',
    'cyber-neo',
    'terracotta-sand',
    'deep-oceanic'
)
AND NOT EXISTS (
    SELECT 1 FROM store_themes st WHERE st.theme_id = themes.id
);
