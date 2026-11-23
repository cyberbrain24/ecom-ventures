// Package settings provides domain logic, database operations, and HTTP APIs
// for managing store operational preferences, tax/currency rules, and staff RBAC.
package settings

import (
	"context"
	"errors"
	"fmt"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/hasher"
)

var (
	// ErrUnauthorizedRoleChange indicates lack of permission to alter staff tiers.
	ErrUnauthorizedRoleChange = errors.New("only STORE_OWNER can modify staff roles or delete members")
	// ErrCannotDemoteLastOwner prevents deactivating or demoting the last remaining STORE_OWNER.
	ErrCannotDemoteLastOwner = errors.New("cannot deactivate or demote the last remaining STORE_OWNER")
	// ErrInvalidCurrentPassword indicates the supplied current password failed verification.
	ErrInvalidCurrentPassword = errors.New("current password is incorrect")
)

// Service coordinates store settings updates and staff account administration.
type Service struct {
	repo   Repository
	hasher *hasher.Argon2idHasher
}

// NewService instantiates the settings and staff service.
func NewService(repo Repository, h *hasher.Argon2idHasher) *Service {
	return &Service{
		repo:   repo,
		hasher: h,
	}
}

// GetSettings retrieves store operational preferences.
func (s *Service) GetSettings(ctx context.Context) (*StoreSettingsDTO, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.repo.EnsureSettingsTable(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}
	return s.repo.GetSettings(ctx, stCtx.TenantDB)
}

// UpdateSettings updates mutable store operational rules.
func (s *Service) UpdateSettings(ctx context.Context, req *UpdateSettingsRequest) (*StoreSettingsDTO, error) {
	if req.TaxRatePercent < 0 || req.TaxRatePercent > 100 {
		return nil, errors.New("tax rate percent must be between 0 and 100")
	}

	if req.DefaultShippingFee < 0 {
		return nil, errors.New("default shipping fee must be non-negative")
	}

	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := s.repo.EnsureSettingsTable(ctx, stCtx.TenantDB); err != nil {
		return nil, err
	}

	current, err := s.repo.GetSettings(ctx, stCtx.TenantDB)
	if err != nil {
		return nil, err
	}

	current.LegalBusinessName = strings.TrimSpace(req.LegalBusinessName)
	current.ContactPhone = strings.TrimSpace(req.ContactPhone)
	current.SupportEmail = strings.TrimSpace(req.SupportEmail)
	current.OrderNumberPrefix = strings.TrimSpace(req.OrderNumberPrefix)
	current.TaxRatePercent = req.TaxRatePercent
	current.PricesIncludeTax = req.PricesIncludeTax
	current.DefaultShippingFee = req.DefaultShippingFee
	current.WhatsAppPhone = strings.TrimSpace(req.WhatsAppPhone)
	current.FacebookURL = strings.TrimSpace(req.FacebookURL)
	current.InstagramURL = strings.TrimSpace(req.InstagramURL)

	if req.MetaTitleTemplate != "" {
		current.MetaTitleTemplate = strings.TrimSpace(req.MetaTitleTemplate)
	}
	current.DefaultMetaTitle = strings.TrimSpace(req.DefaultMetaTitle)
	current.DefaultMetaDescription = strings.TrimSpace(req.DefaultMetaDescription)
	current.DefaultKeywords = strings.TrimSpace(req.DefaultKeywords)
	current.FaviconURL = strings.TrimSpace(req.FaviconURL)
	current.AppleTouchIconURL = strings.TrimSpace(req.AppleTouchIconURL)
	current.DefaultOGImageURL = strings.TrimSpace(req.DefaultOGImageURL)
	current.TwitterHandle = strings.TrimSpace(req.TwitterHandle)
	current.GoogleSiteVerification = strings.TrimSpace(req.GoogleSiteVerification)
	current.BingSiteVerification = strings.TrimSpace(req.BingSiteVerification)
	current.PinterestVerification = strings.TrimSpace(req.PinterestVerification)
	current.RobotsTxtCustom = strings.TrimSpace(req.RobotsTxtCustom)
	if req.SitemapEnabled != nil {
		current.SitemapEnabled = *req.SitemapEnabled
	}

	if req.LogoURL != "" {
		current.LogoURL = strings.TrimSpace(req.LogoURL)
	}
	if req.DesktopHeroBannerURL != "" {
		current.DesktopHeroBannerURL = strings.TrimSpace(req.DesktopHeroBannerURL)
	}
	if req.MobileHeroBannerURL != "" {
		current.MobileHeroBannerURL = strings.TrimSpace(req.MobileHeroBannerURL)
	}
	current.SiteDescription = strings.TrimSpace(req.SiteDescription)
	current.FooterContent = strings.TrimSpace(req.FooterContent)
	if req.PrimaryColor != "" {
		current.PrimaryColor = strings.TrimSpace(req.PrimaryColor)
	}
	if req.SecondaryColor != "" {
		current.SecondaryColor = strings.TrimSpace(req.SecondaryColor)
	}
	if req.FontHeading != "" {
		current.FontHeading = strings.TrimSpace(req.FontHeading)
	}
	if req.FontBody != "" {
		current.FontBody = strings.TrimSpace(req.FontBody)
	}

	if err := s.repo.UpdateSettings(ctx, stCtx.TenantDB, current); err != nil {
		return nil, fmt.Errorf("failed to persist store settings: %w", err)
	}

	return s.repo.GetSettings(ctx, stCtx.TenantDB)
}

// ListStaff returns all registered store staff.
func (s *Service) ListStaff(ctx context.Context) ([]StaffMember, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListStaff(ctx, stCtx.TenantDB)
}

// CreateStaff creates a new staff account inside the store's database.
func (s *Service) CreateStaff(ctx context.Context, req *CreateStaffRequest) (*StaffMember, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	if cleanEmail == "" {
		return nil, errors.New("staff email is required")
	}

	if len(req.Password) < 8 {
		return nil, errors.New("staff password must be at least 8 characters long")
	}

	if req.Role != RoleStoreAdmin && req.Role != RoleStoreStaff && req.Role != RoleStoreOwner {
		req.Role = RoleStoreStaff
	}

	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	passwordHash, err := s.hasher.Hash(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash staff password: %w", err)
	}

	return s.repo.CreateStaff(ctx, stCtx.TenantDB, cleanEmail, passwordHash, strings.TrimSpace(req.FirstName), strings.TrimSpace(req.LastName), req.Role)
}

// UpdateStaff modifies a staff member's details or role.
func (s *Service) UpdateStaff(ctx context.Context, id string, req *UpdateStaffRequest) (*StaffMember, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	targetStaff, err := s.repo.GetStaffByID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return nil, err
	}

	// Guard against demoting the sole STORE_OWNER
	if targetStaff.Role == RoleStoreOwner && (req.Role != RoleStoreOwner || !req.IsActive) {
		ownerCount, err := s.repo.CountOwners(ctx, stCtx.TenantDB)
		if err != nil {
			return nil, err
		}
		if ownerCount <= 1 {
			return nil, ErrCannotDemoteLastOwner
		}
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)

	return s.repo.UpdateStaff(ctx, stCtx.TenantDB, id, req)
}

// DeleteStaff removes a staff member account.
func (s *Service) DeleteStaff(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	targetStaff, err := s.repo.GetStaffByID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return err
	}

	if targetStaff.Role == RoleStoreOwner {
		ownerCount, err := s.repo.CountOwners(ctx, stCtx.TenantDB)
		if err != nil {
			return err
		}
		if ownerCount <= 1 {
			return ErrCannotDemoteLastOwner
		}
	}

	return s.repo.DeleteStaff(ctx, stCtx.TenantDB, id)
}

// ChangePassword allows a logged-in staff member to update their password.
func (s *Service) ChangePassword(ctx context.Context, staffID string, req *ChangePasswordRequest) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	if len(req.NewPassword) < 8 {
		return errors.New("new password must be at least 8 characters long")
	}

	staff, err := s.repo.GetStaffByID(ctx, stCtx.TenantDB, staffID)
	if err != nil {
		return err
	}

	_, hash, err := s.repo.GetStaffByEmail(ctx, stCtx.TenantDB, staff.Email)
	if err != nil {
		return err
	}

	valid, err := s.hasher.Verify(req.CurrentPassword, hash)
	if err != nil || !valid {
		return ErrInvalidCurrentPassword
	}

	newHash, err := s.hasher.Hash(req.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	return s.repo.UpdateStaffPassword(ctx, stCtx.TenantDB, staffID, newHash)
}
