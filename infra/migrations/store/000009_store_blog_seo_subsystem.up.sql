-- Ecom Ventures: Dedicated Store Database Schema Extension
-- Migration Version: 000009_store_blog_seo_subsystem.up.sql
-- Scope: 100% SEO-focused Blog & Editorial Content Subsystem

CREATE TABLE IF NOT EXISTS blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories (slug);
CREATE INDEX IF NOT EXISTS idx_blog_categories_active_order ON blog_categories (is_active, display_order ASC);

CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_url TEXT,
    featured_image_alt VARCHAR(255),
    author_name VARCHAR(100) NOT NULL DEFAULT 'Editorial Team',
    author_avatar_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED')),
    published_at TIMESTAMP WITH TIME ZONE,
    reading_time_minutes INTEGER NOT NULL DEFAULT 3,
    view_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] NOT NULL DEFAULT '{}',
    
    -- 100% SEO Focused Columns
    meta_title VARCHAR(255),
    meta_description TEXT,
    focus_keyword VARCHAR(100),
    secondary_keywords TEXT[] NOT NULL DEFAULT '{}',
    canonical_url TEXT,
    meta_robots VARCHAR(50) NOT NULL DEFAULT 'index, follow',
    og_title VARCHAR(255),
    og_description TEXT,
    og_image_url TEXT,
    twitter_title VARCHAR(255),
    twitter_description TEXT,
    twitter_image_url TEXT,
    schema_type VARCHAR(50) NOT NULL DEFAULT 'BlogPosting',
    seo_score INTEGER NOT NULL DEFAULT 0,
    seo_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category_id ON blog_posts (category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN (tags);

CREATE TABLE IF NOT EXISTS blog_post_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_products_post ON blog_post_products (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_products_product ON blog_post_products (product_id);

-- Initial Category Seeding
INSERT INTO blog_categories (id, name, slug, description, meta_title, meta_description, display_order, is_active)
VALUES
    (
        'b1a2c3d4-0001-4000-8000-000000000001',
        'Style & Guides',
        'style-guides',
        'Expert fashion curation, modern styling tips, and essential wardrobe essentials.',
        'Style & Wardrobe Guides | Expert Fashion Insights',
        'Discover seasonal styling guides, outfit pairing inspirations, and contemporary fashion tips curated by our in-house designers.',
        1,
        TRUE
    ),
    (
        'b1a2c3d4-0001-4000-8000-000000000002',
        'Craftsmanship & Care',
        'craftsmanship-care',
        'Behind the seams: artisanal production, textile preservation, and sustainable garment care.',
        'Garment Care & Artisan Craftsmanship | Preservation Guide',
        'Learn how to properly care for premium fabrics, full-grain leathers, and tailored garments to maximize longevity and sustainability.',
        2,
        TRUE
    ),
    (
        'b1a2c3d4-0001-4000-8000-000000000003',
        'Brand Stories',
        'brand-stories',
        'Interviews with artisans, material sourcing journeys, and design philosophy.',
        'Our Stories & Sustainable Philosophy | Brand Journal',
        'Explore the heritage, ethical production commitments, and creative inspirations driving our design team.',
        3,
        TRUE
    )
ON CONFLICT (slug) DO NOTHING;

-- Initial 100% SEO-Optimized Article Seeding
INSERT INTO blog_posts (
    id,
    category_id,
    title,
    slug,
    excerpt,
    content,
    featured_image_url,
    featured_image_alt,
    author_name,
    author_avatar_url,
    status,
    published_at,
    reading_time_minutes,
    view_count,
    tags,
    meta_title,
    meta_description,
    focus_keyword,
    secondary_keywords,
    canonical_url,
    meta_robots,
    og_title,
    og_description,
    og_image_url,
    twitter_title,
    twitter_description,
    twitter_image_url,
    schema_type,
    seo_score,
    seo_analysis
) VALUES
    (
        'f1a2c3d4-0001-4000-8000-000000000001',
        'b1a2c3d4-0001-4000-8000-000000000001',
        'The Ultimate Guide to Modern Silk Styling: Day-to-Evening Transition',
        'ultimate-guide-modern-silk-styling',
        'Discover how to effortlessly elevate your everyday wardrobe with versatile mulberry silk ensembles designed for all-day comfort and sophistication.',
        '<h2>Elevating Everyday Elegance with Pure Silk</h2><p>Mulberry silk has long been celebrated as the queen of textiles, balancing unmatched breathability with subtle, natural luster. In modern fashion, silk is no longer reserved exclusively for formal galas or black-tie occasions. Today’s minimalist wardrobe embraces silk as an everyday luxury that flows effortlessly from high-stakes boardroom meetings to ambient evening dinners.</p><h3>1. The Foundation: Tailored Silk Blouse & High-Waist Trousers</h3><p>When selecting your daytime base, opt for relaxed cuts with clean architectural lines. A muted ivory or sage silk shirt provides understated polish when tucked into tailored pleated wool trousers. The breathable, thermoregulating properties of 100% mulberry silk ensure you remain cool during active mornings and comfortable in climate-controlled spaces.</p><blockquote>"Luxury is not about ostentation; it is the quiet tactile satisfaction of fine natural fibers moving effortlessly with the body."</blockquote><h3>2. The Seamless Evening Transformation</h3><p>Transitioning into dusk requires only deliberate adjustments in accessorizing and layering. Swap daytime structured tote bags for a sleek structured leather clutch, unbutton the mandarin collar for a softer neckline, and add sculpted brass jewelry to catch ambient candlelight.</p><h3>3. Silk Longevity & Preservation</h3><p>To preserve the exquisite sheen of hand-dyed mulberry silk, hand-wash in tepid water with pH-neutral detergent and dry flat away from direct sunlight. Never wring natural silk; instead, gently press between clean cotton towels to absorb excess moisture.</p>',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
        'Model styled in elegant modern mulberry silk blouse for evening transition',
        'Zara Rahman',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        'PUBLISHED',
        CURRENT_TIMESTAMP - INTERVAL '2 days',
        5,
        142,
        ARRAY['Silk Styling', 'Fashion Guide', 'Capsule Wardrobe', 'Sustainable Luxury'],
        'Modern Silk Styling Guide: Day-to-Evening Transition | Brand Journal',
        'Master the art of modern silk styling. Learn how to transition pure mulberry silk outfits from business daytime to evening elegance with minimal adjustments.',
        'modern silk styling',
        ARRAY['mulberry silk fashion', 'day to evening outfit', 'luxury capsule wardrobe'],
        '',
        'index, follow',
        'The Ultimate Guide to Modern Silk Styling: Day-to-Evening Transition',
        'Master the art of modern silk styling. Transition pure mulberry silk outfits from business daytime to evening elegance effortlessly.',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
        'The Ultimate Guide to Modern Silk Styling: Day-to-Evening Transition',
        'Master the art of modern silk styling. Transition pure mulberry silk outfits from business daytime to evening elegance effortlessly.',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
        'BlogPosting',
        96,
        '{"title_length": 58, "meta_description_length": 154, "focus_keyword_in_title": true, "focus_keyword_in_meta_desc": true, "focus_keyword_in_slug": true, "focus_keyword_in_content": true, "has_featured_image_alt": true, "word_count": 348, "reading_time": 5, "score": 96}'::jsonb
    ),
    (
        'f1a2c3d4-0001-4000-8000-000000000002',
        'b1a2c3d4-0001-4000-8000-000000000002',
        'How to Care for Premium Full-Grain Leather: Essential Longevity Tips',
        'how-to-care-for-full-grain-leather',
        'Protect and nourish your handcrafted leather goods with this comprehensive care regimen designed to cultivate a deep, rich patina over decades.',
        '<h2>The Timeless Character of Genuine Full-Grain Leather</h2><p>Full-grain leather is the highest grade of bovine leather available. Unlike corrected or bonded leather, full-grain retains the complete exterior epidermis, celebrating authentic natural grain textures, strength, and breathability. Over time, instead of degrading, properly conditioned leather develops a luminous patina that reflects the journey of its owner.</p><h3>1. Routine Dusting & Cleaning</h3><p>Everyday maintenance is straightforward. Use a dry, soft microfiber cloth to remove surface particulates. For deeper cleaning, apply a lightly dampened sponge with gentle glycerin saddle soap in circular motions, wiping immediately with a dry cloth.</p><h3>2. Conditioning with Natural Oils</h3><p>Leather is organic animal hide that requires hydration. Apply beeswax or lanolin-based conditioner every 3 to 6 months. Allow the conditioner to penetrate the grain for 20 minutes before buffing to a soft sheen with a horsehair brush.</p><h3>3. Storage & Moisture Protection</h3><p>Store full-grain bags and jackets in breathable cotton dust bags. Never seal leather in non-breathable plastic containers, as lack of air circulation encourages mold growth. If exposed to heavy monsoon rain, stuff the interior with undyed tissue paper and dry naturally at room temperature.</p>',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&auto=format&fit=crop&q=80',
        'Handcrafted full-grain leather bag treated with natural beeswax conditioning',
        'Tariq Chowdhury',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        'PUBLISHED',
        CURRENT_TIMESTAMP - INTERVAL '5 days',
        4,
        210,
        ARRAY['Leather Care', 'Artisan Craft', 'Patina', 'Product Longevity'],
        'How to Care for Full-Grain Leather Goods | Expert Preservation Guide',
        'Learn professional care techniques for handcrafted full-grain leather bags and accessories. Discover conditioning tips to cultivate a deep, lustrous patina.',
        'care for full-grain leather',
        ARRAY['leather conditioning guide', 'clean leather bag', 'leather patina maintenance'],
        '',
        'index, follow',
        'How to Care for Premium Full-Grain Leather: Essential Longevity Tips',
        'Protect and nourish your handcrafted leather goods with this comprehensive care regimen for deep, lustrous patina.',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&auto=format&fit=crop&q=80',
        'How to Care for Premium Full-Grain Leather: Essential Longevity Tips',
        'Protect and nourish your handcrafted leather goods with this comprehensive care regimen for deep, lustrous patina.',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&auto=format&fit=crop&q=80',
        'BlogPosting',
        98,
        '{"title_length": 62, "meta_description_length": 152, "focus_keyword_in_title": true, "focus_keyword_in_meta_desc": true, "focus_keyword_in_slug": true, "focus_keyword_in_content": true, "has_featured_image_alt": true, "word_count": 312, "reading_time": 4, "score": 98}'::jsonb
    )
ON CONFLICT (slug) DO NOTHING;

