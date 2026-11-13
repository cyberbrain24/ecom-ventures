-- Ecom Ventures: Dedicated Store Database Schema Extension
-- Migration Version: 000005_product_reviews_reputation.up.sql
-- Scope: Product reviews, unboxing & fit photo gallery, moderation state machine, anti-fraud single-review constraint

-- 1. Create Review Status Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
        CREATE TYPE review_status AS ENUM (
            'PENDING',
            'APPROVED',
            'FEATURED',
            'ARCHIVED'
        );
    END IF;
END$$;

-- 2. Create Product Reviews Table
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_by_staff_id UUID REFERENCES store_staff(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(150),
    comment TEXT NOT NULL,
    status review_status NOT NULL DEFAULT 'PENDING',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    staff_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_customer_review UNIQUE (product_id, customer_id)
);

-- 3. Create Review Images Table (Proof Gallery)
CREATE TABLE IF NOT EXISTS review_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Indexes for Storefront Math and CRM Moderation
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status ON product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created ON product_reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_display_order ON product_reviews(product_id, display_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_images_review ON review_images(review_id);

-- 5. Attach Automated Updated_At Trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_reviews_updated_at'
    ) THEN
        CREATE TRIGGER trg_product_reviews_updated_at 
        BEFORE UPDATE ON product_reviews 
        FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();
    END IF;
END$$;

-- 6. Record Migration Version
INSERT INTO store_schema_migrations (version) VALUES ('000005')
ON CONFLICT (version) DO NOTHING;

