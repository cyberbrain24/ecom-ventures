-- Locations & Delivery Zones Hierarchical System (Districts, Thanas, and Zone Rates)
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    division VARCHAR(100) NOT NULL DEFAULT 'Dhaka',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thanas (
    id SERIAL PRIMARY KEY,
    district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 120.00 CHECK (shipping_cost >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_district_thana_name UNIQUE (district_id, name)
);

CREATE INDEX IF NOT EXISTS idx_thanas_district_id ON thanas(district_id);
CREATE INDEX IF NOT EXISTS idx_thanas_is_active ON thanas(is_active);
CREATE INDEX IF NOT EXISTS idx_districts_is_active ON districts(is_active);

DROP TRIGGER IF EXISTS trg_districts_updated_at ON districts;
CREATE TRIGGER trg_districts_updated_at BEFORE UPDATE ON districts FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();

DROP TRIGGER IF EXISTS trg_thanas_updated_at ON thanas;
CREATE TRIGGER trg_thanas_updated_at BEFORE UPDATE ON thanas FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();
