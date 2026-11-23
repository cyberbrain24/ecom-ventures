package shipping

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"
)

// pgUniqueViolation is the Postgres SQLSTATE for a unique constraint violation.
const pgUniqueViolation = "23505"

// Repository specifies database interactions for delivery zones, districts, and thanas.
// Every method runs against the tenant database passed in by the service.
type Repository interface {
	EnsureSchema(ctx context.Context, db *sql.DB) error
	ListZones(ctx context.Context, db *sql.DB) ([]Zone, error)
	CreateZone(ctx context.Context, db *sql.DB, z *Zone) error
	UpdateZone(ctx context.Context, db *sql.DB, z *Zone) error
	DeleteZone(ctx context.Context, db *sql.DB, id string) error

	// Locations & Zones Hierarchical Subsystem
	ListDistricts(ctx context.Context, db *sql.DB, search string) ([]DistrictEntity, error)
	CreateDistrict(ctx context.Context, db *sql.DB, req DistrictRequest) (*DistrictEntity, error)
	UpdateDistrict(ctx context.Context, db *sql.DB, id int, req DistrictRequest) (*DistrictEntity, error)
	DeleteDistrict(ctx context.Context, db *sql.DB, id int) error

	ListThanas(ctx context.Context, db *sql.DB, districtID int, search string) ([]ThanaEntity, error)
	CreateThana(ctx context.Context, db *sql.DB, req ThanaRequest) (*ThanaEntity, error)
	UpdateThana(ctx context.Context, db *sql.DB, id int, req ThanaRequest) (*ThanaEntity, error)
	DeleteThana(ctx context.Context, db *sql.DB, id int) error
	SyncDeliveryZonesFromLocations(ctx context.Context, db *sql.DB) error
}

// SQLRepository implements Repository with parameterised SQL.
type SQLRepository struct{}

// NewSQLRepository instantiates the delivery zone repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// EnsureSchema creates the delivery_zones table and its trigger when they are missing.
// The DDL matches infra/migrations/store/000014_delivery_zones.up.sql, because tenant
// databases created before that migration never run it.
func (r *SQLRepository) EnsureSchema(ctx context.Context, db *sql.DB) error {
	query := `
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
	`
	if _, err := db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("ensuring delivery_zones schema: %w", err)
	}
	return nil
}

// ListZones returns every delivery zone ordered by district and zone label.
func (r *SQLRepository) ListZones(ctx context.Context, db *sql.DB) ([]Zone, error) {
	query := `
		SELECT id, district, zone, shipping_fee, thanas, created_at, updated_at
		FROM delivery_zones
		ORDER BY district ASC, zone ASC;
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying delivery zones: %w", err)
	}
	defer rows.Close()

	zones := []Zone{}
	for rows.Next() {
		var z Zone
		var thanas pq.StringArray
		if err := rows.Scan(&z.ID, &z.District, &z.Zone, &z.ShippingFee, &thanas, &z.CreatedAt, &z.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning delivery zone: %w", err)
		}
		z.Thanas = []string(thanas)
		zones = append(zones, z)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating delivery zones: %w", err)
	}
	return zones, nil
}

// CreateZone inserts a zone and fills in its ID and timestamps.
// It returns ErrZoneConflict when the district and zone label are already used.
func (r *SQLRepository) CreateZone(ctx context.Context, db *sql.DB, z *Zone) error {
	query := `
		INSERT INTO delivery_zones (district, zone, shipping_fee, thanas)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at;
	`
	err := db.QueryRowContext(ctx, query, z.District, z.Zone, z.ShippingFee, pq.Array(z.Thanas)).
		Scan(&z.ID, &z.CreatedAt, &z.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrZoneConflict
		}
		return fmt.Errorf("inserting delivery zone: %w", err)
	}
	return nil
}

// UpdateZone replaces the editable fields of a zone and refreshes its timestamps.
// It returns ErrZoneNotFound when no zone has the ID, and ErrZoneConflict on a duplicate label.
func (r *SQLRepository) UpdateZone(ctx context.Context, db *sql.DB, z *Zone) error {
	query := `
		UPDATE delivery_zones
		SET district = $2, zone = $3, shipping_fee = $4, thanas = $5, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at;
	`
	err := db.QueryRowContext(ctx, query, z.ID, z.District, z.Zone, z.ShippingFee, pq.Array(z.Thanas)).
		Scan(&z.CreatedAt, &z.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrZoneNotFound
		}
		if isUniqueViolation(err) {
			return ErrZoneConflict
		}
		return fmt.Errorf("updating delivery zone %s: %w", z.ID, err)
	}
	return nil
}

// DeleteZone removes a zone by ID. It returns ErrZoneNotFound when no row was deleted.
func (r *SQLRepository) DeleteZone(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM delivery_zones WHERE id = $1;`, id)
	if err != nil {
		return fmt.Errorf("deleting delivery zone %s: %w", id, err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("reading delete result for delivery zone %s: %w", id, err)
	}
	if affected == 0 {
		return ErrZoneNotFound
	}
	return nil
}

// isUniqueViolation reports whether err is a Postgres unique constraint violation.
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == pgUniqueViolation
}

// ListDistricts returns all districts with total thanas count.
func (r *SQLRepository) ListDistricts(ctx context.Context, db *sql.DB, search string) ([]DistrictEntity, error) {
	query := `
		SELECT 
			d.id, d.name, d.division, d.is_active, d.created_at, d.updated_at,
			COUNT(t.id) as total_thanas
		FROM districts d
		LEFT JOIN thanas t ON t.district_id = d.id
		WHERE ($1 = '' OR d.name ILIKE '%' || $1 || '%' OR d.division ILIKE '%' || $1 || '%')
		GROUP BY d.id
		ORDER BY d.name ASC;
	`
	rows, err := db.QueryContext(ctx, query, strings.TrimSpace(search))
	if err != nil {
		return nil, fmt.Errorf("listing districts: %w", err)
	}
	defer rows.Close()

	list := []DistrictEntity{}
	for rows.Next() {
		var item DistrictEntity
		if err := rows.Scan(&item.ID, &item.Name, &item.Division, &item.IsActive, &item.CreatedAt, &item.UpdatedAt, &item.TotalThanas); err != nil {
			return nil, fmt.Errorf("scanning district: %w", err)
		}
		list = append(list, item)
	}
	return list, nil
}

// CreateDistrict inserts a new district record.
func (r *SQLRepository) CreateDistrict(ctx context.Context, db *sql.DB, req DistrictRequest) (*DistrictEntity, error) {
	div := strings.TrimSpace(req.Division)
	if div == "" {
		div = "Dhaka"
	}
	query := `
		INSERT INTO districts (name, division, is_active)
		VALUES ($1, $2, $3)
		RETURNING id, name, division, is_active, created_at, updated_at;
	`
	var item DistrictEntity
	err := db.QueryRowContext(ctx, query, strings.TrimSpace(req.Name), div, req.IsActive).
		Scan(&item.ID, &item.Name, &item.Division, &item.IsActive, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating district: %w", err)
	}
	_ = r.SyncDeliveryZonesFromLocations(ctx, db)
	return &item, nil
}

// UpdateDistrict modifies an existing district record.
func (r *SQLRepository) UpdateDistrict(ctx context.Context, db *sql.DB, id int, req DistrictRequest) (*DistrictEntity, error) {
	div := strings.TrimSpace(req.Division)
	if div == "" {
		div = "Dhaka"
	}
	query := `
		UPDATE districts
		SET name = $2, division = $3, is_active = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, division, is_active, created_at, updated_at;
	`
	var item DistrictEntity
	err := db.QueryRowContext(ctx, query, id, strings.TrimSpace(req.Name), div, req.IsActive).
		Scan(&item.ID, &item.Name, &item.Division, &item.IsActive, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("updating district %d: %w", id, err)
	}
	_ = r.SyncDeliveryZonesFromLocations(ctx, db)
	return &item, nil
}

// DeleteDistrict deletes a district and its child thanas.
func (r *SQLRepository) DeleteDistrict(ctx context.Context, db *sql.DB, id int) error {
	_, err := db.ExecContext(ctx, `DELETE FROM districts WHERE id = $1;`, id)
	if err != nil {
		return fmt.Errorf("deleting district %d: %w", id, err)
	}
	_ = r.SyncDeliveryZonesFromLocations(ctx, db)
	return nil
}

// ListThanas returns all thanas, optionally filtered by district_id or search.
func (r *SQLRepository) ListThanas(ctx context.Context, db *sql.DB, districtID int, search string) ([]ThanaEntity, error) {
	query := `
		SELECT 
			t.id, t.district_id, d.name as district_name, t.name, t.shipping_cost, t.is_active, t.created_at, t.updated_at
		FROM thanas t
		JOIN districts d ON d.id = t.district_id
		WHERE ($1 = 0 OR t.district_id = $1)
		  AND ($2 = '' OR t.name ILIKE '%' || $2 || '%' OR d.name ILIKE '%' || $2 || '%')
		ORDER BY d.name ASC, t.name ASC;
	`
	rows, err := db.QueryContext(ctx, query, districtID, strings.TrimSpace(search))
	if err != nil {
		return nil, fmt.Errorf("listing thanas: %w", err)
	}
	defer rows.Close()

	list := []ThanaEntity{}
	for rows.Next() {
		var item ThanaEntity
		if err := rows.Scan(&item.ID, &item.DistrictID, &item.DistrictName, &item.Name, &item.ShippingCost, &item.IsActive, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning thana: %w", err)
		}
		list = append(list, item)
	}
	return list, nil
}

// CreateThana inserts a new thana record.
func (r *SQLRepository) CreateThana(ctx context.Context, db *sql.DB, req ThanaRequest) (*ThanaEntity, error) {
	query := `
		INSERT INTO thanas (district_id, name, shipping_cost, is_active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, district_id, name, shipping_cost, is_active, created_at, updated_at;
	`
	var item ThanaEntity
	err := db.QueryRowContext(ctx, query, req.DistrictID, strings.TrimSpace(req.Name), req.ShippingCost, req.IsActive).
		Scan(&item.ID, &item.DistrictID, &item.Name, &item.ShippingCost, &item.IsActive, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating thana: %w", err)
	}
	_ = db.QueryRowContext(ctx, `SELECT name FROM districts WHERE id = $1;`, item.DistrictID).Scan(&item.DistrictName)
	_ = r.SyncDeliveryZonesFromLocations(ctx, db)
	return &item, nil
}

// UpdateThana updates an existing thana record.
func (r *SQLRepository) UpdateThana(ctx context.Context, db *sql.DB, id int, req ThanaRequest) (*ThanaEntity, error) {
	query := `
		UPDATE thanas
		SET district_id = $2, name = $3, shipping_cost = $4, is_active = $5, updated_at = NOW()
		WHERE id = $1
		RETURNING id, district_id, name, shipping_cost, is_active, created_at, updated_at;
	`
	var item ThanaEntity
	err := db.QueryRowContext(ctx, query, id, req.DistrictID, strings.TrimSpace(req.Name), req.ShippingCost, req.IsActive).
		Scan(&item.ID, &item.DistrictID, &item.Name, &item.ShippingCost, &item.IsActive, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("updating thana %d: %w", id, err)
	}
	_ = db.QueryRowContext(ctx, `SELECT name FROM districts WHERE id = $1;`, item.DistrictID).Scan(&item.DistrictName)
	_ = r.SyncDeliveryZonesFromLocations(ctx, db)
	return &item, nil
}

// DeleteThana deletes a thana record.
func (r *SQLRepository) DeleteThana(ctx context.Context, db *sql.DB, id int) error {
	_, err := db.ExecContext(ctx, `DELETE FROM thanas WHERE id = $1;`, id)
	if err != nil {
		return fmt.Errorf("deleting thana %d: %w", id, err)
	}
	_ = r.SyncDeliveryZonesFromLocations(ctx, db)
	return nil
}

// SyncDeliveryZonesFromLocations automatically mirrors districts and thanas into delivery_zones
// so storefront checkout and existing checkout calculations immediately reflect rate changes.
func (r *SQLRepository) SyncDeliveryZonesFromLocations(ctx context.Context, db *sql.DB) error {
	query := `
		INSERT INTO delivery_zones (district, zone, shipping_fee, thanas)
		SELECT 
			d.name as district,
			d.division || ' Zone' as zone,
			COALESCE(AVG(t.shipping_cost), 120.00) as shipping_fee,
			COALESCE(ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[d.name]) as thanas
		FROM districts d
		LEFT JOIN thanas t ON t.district_id = d.id AND t.is_active = true
		WHERE d.is_active = true
		GROUP BY d.name, d.division
		ON CONFLICT (district, zone) DO UPDATE 
		SET shipping_fee = EXCLUDED.shipping_fee, thanas = EXCLUDED.thanas;
	`
	_, _ = db.ExecContext(ctx, query)
	return nil
}
