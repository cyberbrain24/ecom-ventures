-- Delivery zones map a district and its thanas to a flat shipping fee.
-- Keep this identical to the DDL in shipping.EnsureSchema (backend/internal/store/shipping/repository.go).
-- Numbered 000014 because 000011 is already used by catalog_display_order.
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district VARCHAR(100) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    shipping_fee NUMERIC(12,2) NOT NULL CHECK (shipping_fee >= 0),
    thanas TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_delivery_zones_district_zone UNIQUE (district, zone)
);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_district ON delivery_zones (district ASC, zone ASC);
DROP TRIGGER IF EXISTS trg_delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();
