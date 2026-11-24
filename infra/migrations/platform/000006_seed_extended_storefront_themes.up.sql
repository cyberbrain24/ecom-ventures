-- Ecom Ventures: Seed extended storefront design themes
-- Migration Version: 000006_seed_extended_storefront_themes.up.sql
-- Enriches the platform catalog with Gadgets, Haute Couture, Royal Heritage, and specialized aesthetic blueprints.
-- Existing rows with the same slug are preserved (ON CONFLICT DO NOTHING).

INSERT INTO themes (name, slug, description, version, preview_image_url, config_schema, is_active) VALUES
(
    'Gadgets & Tech',
    'gadget-tech',
    'Consumer electronics, smart hardware, and computer accessories. High-tech obsidian matrix layout with electric cyan highlights.',
    '1.0.0',
    NULL,
    '{"variant":"gadget","colors":{"primary":"#0284c7","secondary":"#06b6d4","accent":"#3b82f6","background":"#090d16","surface":"#0f172a","text":"#f8fafc","muted":"#94a3b8"},"fonts":{"heading":"Space Grotesk","body":"Inter"},"radius":"md","density":"compact","hero":"tech-matrix"}'::jsonb,
    TRUE
),
(
    'Sensual Couture',
    'inner-fashion-couture',
    'Designer silk lingerie, haute loungewear, and intimate apparel. Deep mulberry noir with soft whipped ivory and rosewood velvet accents.',
    '1.0.0',
    NULL,
    '{"variant":"inner-fashion","colors":{"primary":"#4a0e2e","secondary":"#e2a7b8","accent":"#c05c7e","background":"#faf6f7","surface":"#ffffff","text":"#220817","muted":"#8e6b7b"},"fonts":{"heading":"Playfair Display","body":"Montserrat"},"radius":"lg","density":"airy","hero":"sensual-couture"}'::jsonb,
    TRUE
),
(
    'Royal Heritage',
    'traditional-fashion-heritage',
    'Traditional Jamdani sarees, panjabis, festive bridalwear, and ethnic artisanal crafts. Royal crimson with antique zari gold.',
    '1.0.0',
    NULL,
    '{"variant":"traditional-fashion","colors":{"primary":"#6b1124","secondary":"#c59b27","accent":"#1e3d34","background":"#faf7f2","surface":"#ffffff","text":"#2a161b","muted":"#8a7378"},"fonts":{"heading":"Cinzel","body":"Hind Siliguri"},"radius":"sm","density":"airy","hero":"royal-heritage"}'::jsonb,
    TRUE
),
(
    'Minimal Mono',
    'minimal-mono',
    'Ultra-clean high-contrast monochrome design for modern fashion essentials, independent studios, and minimalist boutiques.',
    '1.0.0',
    NULL,
    '{"variant":"fashion","colors":{"primary":"#000000","secondary":"#262626","accent":"#000000","background":"#ffffff","surface":"#ffffff","text":"#0a0a0a","muted":"#737373"},"fonts":{"heading":"Inter","body":"Inter"},"radius":"none","density":"compact","hero":"editorial"}'::jsonb,
    TRUE
),
(
    'Midnight Luxury Gold',
    'midnight-gold',
    'Opulent dark aesthetic tailored for luxury timepieces, fine perfumes, and high-end lifestyle accessories.',
    '1.0.0',
    NULL,
    '{"variant":"jewelry","colors":{"primary":"#121212","secondary":"#d4af37","accent":"#f59e0b","background":"#0a0a0a","surface":"#18181b","text":"#fafafa","muted":"#a1a1aa"},"fonts":{"heading":"Playfair Display","body":"Lato"},"radius":"sm","density":"airy","hero":"luxe-showcase"}'::jsonb,
    TRUE
),
(
    'Cyber Neo Emerald',
    'cyber-neo',
    'Vibrant cybernetic emerald against deep night obsidian for gaming gear, tech accessories, and futuristic audio hardware.',
    '1.0.0',
    NULL,
    '{"variant":"gadget","colors":{"primary":"#064e3b","secondary":"#10b981","accent":"#059669","background":"#022c22","surface":"#064e3b","text":"#ecfdf5","muted":"#6ee7b7"},"fonts":{"heading":"Space Grotesk","body":"Space Grotesk"},"radius":"md","density":"compact","hero":"tech-matrix"}'::jsonb,
    TRUE
),
(
    'Terracotta & Sand',
    'terracotta-sand',
    'Warm organic desert earth tones for handcrafted home living, artisan pottery, linen, and sustainable organic apparel.',
    '1.0.0',
    NULL,
    '{"variant":"fashion","colors":{"primary":"#9a3412","secondary":"#d97706","accent":"#ea580c","background":"#fffbeb","surface":"#ffffff","text":"#431407","muted":"#92400e"},"fonts":{"heading":"Playfair Display","body":"Inter"},"radius":"md","density":"airy","hero":"editorial"}'::jsonb,
    TRUE
),
(
    'Deep Oceanic Cyan',
    'deep-oceanic',
    'Cool refreshing marine and aqua hues for athletic swimwear, beauty cosmetics, skincare, and wellness products.',
    '1.0.0',
    NULL,
    '{"variant":"fashion","colors":{"primary":"#0f766e","secondary":"#06b6d4","accent":"#14b8a6","background":"#f0fdfa","surface":"#ffffff","text":"#134e4a","muted":"#2dd4bf"},"fonts":{"heading":"Playfair Display","body":"Inter"},"radius":"lg","density":"airy","hero":"editorial"}'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;
