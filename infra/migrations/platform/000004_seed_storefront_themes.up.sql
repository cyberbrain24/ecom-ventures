-- Ecom Ventures: Seed the four storefront design themes
-- Migration Version: 000004_seed_storefront_themes.up.sql
-- Each theme changes presentation only. Business logic is shared by every theme.
-- Existing rows with the same slug are left untouched (ON CONFLICT DO NOTHING).

INSERT INTO themes (name, slug, description, version, preview_image_url, config_schema, is_active) VALUES
(
    'Fashion',
    'fashion-universal',
    'Universal clothing and fashion store. Editorial layout with a charcoal and camel palette.',
    '1.0.0',
    NULL,
    '{"variant":"fashion","colors":{"primary":"#1f2937","secondary":"#b45309","accent":"#0f766e","background":"#fafaf9","surface":"#ffffff","text":"#111827","muted":"#6b7280"},"fonts":{"heading":"Playfair Display","body":"Inter"},"radius":"md","density":"airy","hero":"editorial"}'::jsonb,
    TRUE
),
(
    'Streetculture',
    'streetculture-fashion',
    'Streetwear and street-culture clothing. Bold, dark, high-contrast layout.',
    '1.0.0',
    NULL,
    '{"variant":"streetculture","colors":{"primary":"#0a0a0a","secondary":"#facc15","accent":"#ef4444","background":"#111111","surface":"#1c1c1c","text":"#f5f5f5","muted":"#a3a3a3"},"fonts":{"heading":"Bebas Neue","body":"Space Grotesk"},"radius":"none","density":"compact","hero":"bold-streetwear"}'::jsonb,
    TRUE
),
(
    'Inner Wear',
    'inner-wear-women',
    'Women''s undergarments and lingerie. Soft rose palette with a gentle minimal hero.',
    '1.0.0',
    NULL,
    '{"variant":"innerwear","colors":{"primary":"#9d174d","secondary":"#fbcfe8","accent":"#be185d","background":"#fff7fb","surface":"#ffffff","text":"#3b0a1f","muted":"#9f6b84"},"fonts":{"heading":"Cormorant Garamond","body":"Nunito Sans"},"radius":"lg","density":"airy","hero":"soft-minimal"}'::jsonb,
    TRUE
),
(
    'Jewelry',
    'jewelry-women',
    'Women''s jewelry. Deep indigo and gold showcase layout.',
    '1.0.0',
    NULL,
    '{"variant":"jewelry","colors":{"primary":"#1e1b4b","secondary":"#d4af37","accent":"#b8860b","background":"#0f0d1a","surface":"#17142b","text":"#f8f4e8","muted":"#b9b3cc"},"fonts":{"heading":"Cinzel","body":"Lato"},"radius":"sm","density":"airy","hero":"luxe-showcase"}'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;
