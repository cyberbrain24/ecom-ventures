package shipping

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

// uuidPattern matches the canonical 8-4-4-4-12 hexadecimal UUID form.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Service implements delivery zone management and fee resolution for the active tenant.
type Service struct {
	repo Repository
	// schemaReady records tenant databases whose delivery_zones schema has been verified this process.
	schemaReady sync.Map
}

// NewService instantiates the delivery zone service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// tenantDB resolves the active store's database from the request context and makes sure the zone table exists.
func (s *Service) tenantDB(ctx context.Context) (*sql.DB, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("resolving store context: %w", err)
	}
	if stCtx.TenantDB == nil {
		return nil, fmt.Errorf("resolving store database: %w", storeCtx.ErrNilTenantDB)
	}
	if _, ready := s.schemaReady.Load(stCtx.TenantDB); !ready {
		if err := s.repo.EnsureSchema(ctx, stCtx.TenantDB); err != nil {
			return nil, err
		}
		s.schemaReady.Store(stCtx.TenantDB, struct{}{})
	}
	return stCtx.TenantDB, nil
}

// ListZones returns every delivery zone of the active store, including IDs.
func (s *Service) ListZones(ctx context.Context) ([]Zone, error) {
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListZones(ctx, db)
}

// ListPublicZones returns the storefront view of the store's zones.
// It returns ErrNoZonesConfigured when the store has no zones, so the storefront can block ordering.
func (s *Service) ListPublicZones(ctx context.Context) ([]PublicZone, error) {
	zones, err := s.ListZones(ctx)
	if err != nil {
		return nil, err
	}
	if len(zones) == 0 {
		return nil, ErrNoZonesConfigured
	}
	out := make([]PublicZone, 0, len(zones))
	for _, z := range zones {
		out = append(out, z.ToPublic())
	}
	return out, nil
}

// CreateZone validates the request and stores a new delivery zone.
func (s *Service) CreateZone(ctx context.Context, req ZoneRequest) (*Zone, error) {
	clean, err := req.Validate()
	if err != nil {
		return nil, err
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	z := &Zone{
		District:    clean.District,
		Zone:        clean.Zone,
		ShippingFee: clean.ShippingFee,
		Thanas:      clean.Thanas,
	}
	if err := s.repo.CreateZone(ctx, db, z); err != nil {
		return nil, fmt.Errorf("creating delivery zone: %w", err)
	}
	return z, nil
}

// UpdateZone validates the request and replaces the zone with the given ID.
// It returns ErrZoneNotFound for an unknown or malformed ID.
func (s *Service) UpdateZone(ctx context.Context, id string, req ZoneRequest) (*Zone, error) {
	if !uuidPattern.MatchString(id) {
		return nil, ErrZoneNotFound
	}
	clean, err := req.Validate()
	if err != nil {
		return nil, err
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	z := &Zone{
		ID:          id,
		District:    clean.District,
		Zone:        clean.Zone,
		ShippingFee: clean.ShippingFee,
		Thanas:      clean.Thanas,
	}
	if err := s.repo.UpdateZone(ctx, db, z); err != nil {
		return nil, fmt.Errorf("updating delivery zone: %w", err)
	}
	return z, nil
}

// DeleteZone removes the zone with the given ID.
// It returns ErrZoneNotFound for an unknown or malformed ID.
func (s *Service) DeleteZone(ctx context.Context, id string) error {
	if !uuidPattern.MatchString(id) {
		return ErrZoneNotFound
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteZone(ctx, db, id); err != nil {
		return fmt.Errorf("deleting delivery zone: %w", err)
	}
	return nil
}

// FindZone returns the delivery zone that covers the given district (state_province) and city (thana).
// It returns ErrZoneNotFound when no zone matches. It never falls back to a default fee.
func (s *Service) FindZone(ctx context.Context, district, city string) (*Zone, error) {
	if strings.TrimSpace(district) == "" || strings.TrimSpace(city) == "" {
		return nil, ErrZoneNotFound
	}
	zones, err := s.ListZones(ctx)
	if err != nil {
		return nil, err
	}
	zone := FindZoneFor(zones, district, city)
	if zone == nil {
		return nil, ErrZoneNotFound
	}
	return zone, nil
}

// ListDistricts retrieves all districts with search query support.
func (s *Service) ListDistricts(ctx context.Context, search string) ([]DistrictEntity, error) {
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListDistricts(ctx, db, search)
}

// CreateDistrict creates a new district.
func (s *Service) CreateDistrict(ctx context.Context, req DistrictRequest) (*DistrictEntity, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("district name is required")
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateDistrict(ctx, db, req)
}

// UpdateDistrict updates an existing district.
func (s *Service) UpdateDistrict(ctx context.Context, id int, req DistrictRequest) (*DistrictEntity, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("district name is required")
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateDistrict(ctx, db, id, req)
}

// DeleteDistrict deletes a district.
func (s *Service) DeleteDistrict(ctx context.Context, id int) error {
	db, err := s.tenantDB(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteDistrict(ctx, db, id)
}

// ListThanas retrieves thanas by district ID and/or search query.
func (s *Service) ListThanas(ctx context.Context, districtID int, search string) ([]ThanaEntity, error) {
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListThanas(ctx, db, districtID, search)
}

// CreateThana creates a new thana with specific shipping cost.
func (s *Service) CreateThana(ctx context.Context, req ThanaRequest) (*ThanaEntity, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("thana name is required")
	}
	if req.DistrictID <= 0 {
		return nil, errors.New("parent district is required")
	}
	if req.ShippingCost < 0 {
		return nil, errors.New("shipping cost must be 0 or greater")
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateThana(ctx, db, req)
}

// UpdateThana updates an existing thana.
func (s *Service) UpdateThana(ctx context.Context, id int, req ThanaRequest) (*ThanaEntity, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("thana name is required")
	}
	if req.DistrictID <= 0 {
		return nil, errors.New("parent district is required")
	}
	if req.ShippingCost < 0 {
		return nil, errors.New("shipping cost must be 0 or greater")
	}
	db, err := s.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateThana(ctx, db, id, req)
}

// DeleteThana deletes a thana.
func (s *Service) DeleteThana(ctx context.Context, id int) error {
	db, err := s.tenantDB(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteThana(ctx, db, id)
}
