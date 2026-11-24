-- Ecom Ventures: Convert all dark storefront themes to crisp white background designs
-- Migration Version: 000008_light_theme_backgrounds.up.sql

UPDATE themes
SET config_schema = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(config_schema, '{colors,background}', '"#ffffff"'::jsonb),
            '{colors,surface}', '"#ffffff"'::jsonb
        ),
        '{colors,text}', '"#0a0a0a"'::jsonb
    ),
    '{colors,muted}', '"#525252"'::jsonb
),
description = 'Streetwear and street-culture clothing. Bold, high-contrast editorial layout on a crisp white canvas.',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'streetculture-fashion';

UPDATE themes
SET config_schema = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(config_schema, '{colors,background}', '"#ffffff"'::jsonb),
            '{colors,surface}', '"#ffffff"'::jsonb
        ),
        '{colors,text}', '"#1e1b4b"'::jsonb
    ),
    '{colors,muted}', '"#64748b"'::jsonb
),
description = 'Women''s jewelry. Deep indigo and gold showcase layout on a crisp white background.',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'jewelry-women';

UPDATE themes
SET config_schema = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(config_schema, '{colors,background}', '"#ffffff"'::jsonb),
            '{colors,surface}', '"#ffffff"'::jsonb
        ),
        '{colors,text}', '"#0f172a"'::jsonb
    ),
    '{colors,muted}', '"#64748b"'::jsonb
),
description = 'Consumer electronics, smart hardware, and computer accessories. Clean high-tech matrix layout with electric cyan highlights on white.',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'gadget-tech';

UPDATE themes
SET config_schema = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(config_schema, '{colors,background}', '"#ffffff"'::jsonb),
            '{colors,surface}', '"#ffffff"'::jsonb
        ),
        '{colors,text}', '"#18181b"'::jsonb
    ),
    '{colors,muted}', '"#71717a"'::jsonb
),
description = 'Opulent gold & charcoal aesthetic on a crisp white background tailored for luxury timepieces, fine perfumes, and lifestyle accessories.',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'midnight-gold';

UPDATE themes
SET config_schema = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(config_schema, '{colors,background}', '"#ffffff"'::jsonb),
            '{colors,surface}', '"#ffffff"'::jsonb
        ),
        '{colors,text}', '"#064e3b"'::jsonb
    ),
    '{colors,muted}', '"#475569"'::jsonb
),
description = 'Vibrant cybernetic emerald highlights on a clean white canvas for gaming gear, tech accessories, and audio hardware.',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'cyber-neo';
