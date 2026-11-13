// Package settings provides domain logic, database operations, and HTTP APIs
// for managing store operational preferences, tax/currency rules, and staff RBAC.
package settings

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrStaffNotFound indicates the staff member could not be located by ID or email.
	ErrStaffNotFound = errors.New("staff member not found")
	// ErrStaffConflict indicates a staff account with the specified email already exists in this store.
	ErrStaffConflict = errors.New("a staff member with this email already exists in this store")
)

// Repository specifies database interactions for store settings and staff RBAC.
type Repository interface {
	EnsureSettingsTable(ctx context.Context, db *sql.DB) error
	GetSettings(ctx context.Context, db *sql.DB) (*StoreSettingsDTO, error)
	UpdateSettings(ctx context.Context, db *sql.DB, s *StoreSettingsDTO) error

	// Staff Management
	CreateStaff(ctx context.Context, db *sql.DB, email, passwordHash, firstName, lastName string, role StoreRole) (*StaffMember, error)
	GetStaffByID(ctx context.Context, db *sql.DB, id string) (*StaffMember, error)
	GetStaffByEmail(ctx context.Context, db *sql.DB, email string) (*StaffMember, string, error) // Returns member & password hash
	ListStaff(ctx context.Context, db *sql.DB) ([]StaffMember, error)
	UpdateStaff(ctx context.Context, db *sql.DB, id string, req *UpdateStaffRequest) (*StaffMember, error)
	UpdateStaffPassword(ctx context.Context, db *sql.DB, id, passwordHash string) error
	DeleteStaff(ctx context.Context, db *sql.DB, id string) error
	CountOwners(ctx context.Context, db *sql.DB) (int, error)
}

// SQLRepository implements Repository using PostgreSQL.
type SQLRepository struct{}

// NewSQLRepository instantiates the settings and staff SQL repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// EnsureSettingsTable idempotently verifies that the store_settings table and required columns exist.
func (r *SQLRepository) EnsureSettingsTable(ctx context.Context, db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS store_settings (
			id SERIAL PRIMARY KEY,
			store_name VARCHAR(255) NOT NULL DEFAULT '',
			legal_business_name VARCHAR(255) NOT NULL DEFAULT '',
			contact_email VARCHAR(255) NOT NULL DEFAULT '',
			contact_phone VARCHAR(50) NOT NULL DEFAULT '',
			support_email VARCHAR(255) NOT NULL DEFAULT '',
			currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
			timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
			order_number_prefix VARCHAR(20) NOT NULL DEFAULT 'ORD-',
			tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE,
			default_shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 60.00,
			whatsapp_phone VARCHAR(50) DEFAULT '',
			facebook_url VARCHAR(255) DEFAULT '',
			instagram_url VARCHAR(255) DEFAULT '',
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS legal_business_name VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'BDT';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS order_number_prefix VARCHAR(20) NOT NULL DEFAULT 'ORD-';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00;
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE;
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 60.00;
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(50) DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(255) DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255) DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS meta_title_template VARCHAR(255) NOT NULL DEFAULT '%s | {store_name}';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_meta_title VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_meta_description TEXT NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_keywords TEXT NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS apple_touch_icon_url TEXT NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_og_image_url TEXT NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_site_verification VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS bing_site_verification VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pinterest_verification VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS robots_txt_custom TEXT NOT NULL DEFAULT '';
		ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS sitemap_enabled BOOLEAN NOT NULL DEFAULT TRUE;
	`
	_, err := db.ExecContext(ctx, query)
	return err
}

// GetSettings retrieves the store settings record.
func (r *SQLRepository) GetSettings(ctx context.Context, db *sql.DB) (*StoreSettingsDTO, error) {
	query := `
		SELECT store_name, legal_business_name, contact_email, contact_phone, support_email,
		       currency, timezone, order_number_prefix, tax_rate_percent, prices_include_tax,
		       default_shipping_fee, COALESCE(whatsapp_phone, ''), COALESCE(facebook_url, ''),
		       COALESCE(instagram_url, ''),
		       COALESCE(meta_title_template, '%s | {store_name}'),
		       COALESCE(default_meta_title, ''),
		       COALESCE(default_meta_description, ''),
		       COALESCE(default_keywords, ''),
		       COALESCE(favicon_url, ''),
		       COALESCE(apple_touch_icon_url, ''),
		       COALESCE(default_og_image_url, ''),
		       COALESCE(twitter_handle, ''),
		       COALESCE(google_site_verification, ''),
		       COALESCE(bing_site_verification, ''),
		       COALESCE(pinterest_verification, ''),
		       COALESCE(robots_txt_custom, ''),
		       COALESCE(sitemap_enabled, true),
		       updated_at
		FROM store_settings
		ORDER BY updated_at DESC
		LIMIT 1
	`
	s := &StoreSettingsDTO{}
	err := db.QueryRowContext(ctx, query).Scan(
		&s.StoreName, &s.LegalBusinessName, &s.ContactEmail, &s.ContactPhone, &s.SupportEmail,
		&s.Currency, &s.Timezone, &s.OrderNumberPrefix, &s.TaxRatePercent, &s.PricesIncludeTax,
		&s.DefaultShippingFee, &s.WhatsAppPhone, &s.FacebookURL, &s.InstagramURL,
		&s.MetaTitleTemplate, &s.DefaultMetaTitle, &s.DefaultMetaDescription, &s.DefaultKeywords,
		&s.FaviconURL, &s.AppleTouchIconURL, &s.DefaultOGImageURL, &s.TwitterHandle,
		&s.GoogleSiteVerification, &s.BingSiteVerification, &s.PinterestVerification,
		&s.RobotsTxtCustom, &s.SitemapEnabled,
		&s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Initialize default settings row if missing
			initQuery := `
				INSERT INTO store_settings (store_name, updated_at)
				VALUES ('My Store', NOW())
			`
			_, _ = db.ExecContext(ctx, initQuery)
			return r.GetSettings(ctx, db)
		}
		return nil, fmt.Errorf("failed to query store settings: %w", err)
	}
	return s, nil
}

// UpdateSettings updates mutable preferences on the store settings record.
func (r *SQLRepository) UpdateSettings(ctx context.Context, db *sql.DB, s *StoreSettingsDTO) error {
	updateQuery := `
		UPDATE store_settings
		SET legal_business_name = $1,
		    contact_phone = $2,
		    support_email = $3,
		    order_number_prefix = $4,
		    tax_rate_percent = $5,
		    prices_include_tax = $6,
		    default_shipping_fee = $7,
		    whatsapp_phone = $8,
		    facebook_url = $9,
		    instagram_url = $10,
		    meta_title_template = $11,
		    default_meta_title = $12,
		    default_meta_description = $13,
		    default_keywords = $14,
		    favicon_url = $15,
		    apple_touch_icon_url = $16,
		    default_og_image_url = $17,
		    twitter_handle = $18,
		    google_site_verification = $19,
		    bing_site_verification = $20,
		    pinterest_verification = $21,
		    robots_txt_custom = $22,
		    sitemap_enabled = $23,
		    updated_at = NOW()
		WHERE id = (SELECT id FROM store_settings ORDER BY updated_at DESC LIMIT 1)
	`
	res, err := db.ExecContext(ctx, updateQuery,
		s.LegalBusinessName, s.ContactPhone, s.SupportEmail, s.OrderNumberPrefix,
		s.TaxRatePercent, s.PricesIncludeTax, s.DefaultShippingFee, s.WhatsAppPhone,
		s.FacebookURL, s.InstagramURL,
		s.MetaTitleTemplate, s.DefaultMetaTitle, s.DefaultMetaDescription, s.DefaultKeywords,
		s.FaviconURL, s.AppleTouchIconURL, s.DefaultOGImageURL, s.TwitterHandle,
		s.GoogleSiteVerification, s.BingSiteVerification, s.PinterestVerification,
		s.RobotsTxtCustom, s.SitemapEnabled,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		insertQuery := `
			INSERT INTO store_settings (
				store_name, legal_business_name, contact_phone, support_email, order_number_prefix,
				tax_rate_percent, prices_include_tax, default_shipping_fee, whatsapp_phone,
				facebook_url, instagram_url,
				meta_title_template, default_meta_title, default_meta_description, default_keywords,
				favicon_url, apple_touch_icon_url, default_og_image_url, twitter_handle,
				google_site_verification, bing_site_verification, pinterest_verification,
				robots_txt_custom, sitemap_enabled, updated_at
			) VALUES (
				'My Store', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
				$11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW()
			)
		`
		_, err = db.ExecContext(ctx, insertQuery,
			s.LegalBusinessName, s.ContactPhone, s.SupportEmail, s.OrderNumberPrefix,
			s.TaxRatePercent, s.PricesIncludeTax, s.DefaultShippingFee, s.WhatsAppPhone,
			s.FacebookURL, s.InstagramURL,
			s.MetaTitleTemplate, s.DefaultMetaTitle, s.DefaultMetaDescription, s.DefaultKeywords,
			s.FaviconURL, s.AppleTouchIconURL, s.DefaultOGImageURL, s.TwitterHandle,
			s.GoogleSiteVerification, s.BingSiteVerification, s.PinterestVerification,
			s.RobotsTxtCustom, s.SitemapEnabled,
		)
		return err
	}
	return nil
}

// CreateStaff creates a new staff account inside the store's database.
func (r *SQLRepository) CreateStaff(ctx context.Context, db *sql.DB, email, passwordHash, firstName, lastName string, role StoreRole) (*StaffMember, error) {
	query := `
		INSERT INTO store_staff (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
		RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at
	`
	m := &StaffMember{}
	err := db.QueryRowContext(ctx, query, email, passwordHash, firstName, lastName, role).Scan(
		&m.ID, &m.Email, &m.FirstName, &m.LastName, &m.Role, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "store_staff_email_key") || strings.Contains(err.Error(), "unique") {
			return nil, ErrStaffConflict
		}
		return nil, fmt.Errorf("failed to create staff: %w", err)
	}
	return m, nil
}

// GetStaffByID retrieves a staff member by ID.
func (r *SQLRepository) GetStaffByID(ctx context.Context, db *sql.DB, id string) (*StaffMember, error) {
	query := `
		SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
		FROM store_staff
		WHERE id = $1
	`
	m := &StaffMember{}
	err := db.QueryRowContext(ctx, query, id).Scan(
		&m.ID, &m.Email, &m.FirstName, &m.LastName, &m.Role, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrStaffNotFound
		}
		return nil, err
	}
	return m, nil
}

// GetStaffByEmail retrieves a staff member and their password hash by email.
func (r *SQLRepository) GetStaffByEmail(ctx context.Context, db *sql.DB, email string) (*StaffMember, string, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
		FROM store_staff
		WHERE email = $1
	`
	m := &StaffMember{}
	var passwordHash string
	err := db.QueryRowContext(ctx, query, email).Scan(
		&m.ID, &m.Email, &passwordHash, &m.FirstName, &m.LastName, &m.Role, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", ErrStaffNotFound
		}
		return nil, "", err
	}
	return m, passwordHash, nil
}

// ListStaff returns all registered store staff members.
func (r *SQLRepository) ListStaff(ctx context.Context, db *sql.DB) ([]StaffMember, error) {
	query := `
		SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
		FROM store_staff
		ORDER BY role ASC, created_at ASC
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list staff: %w", err)
	}
	defer rows.Close()

	list := make([]StaffMember, 0)
	for rows.Next() {
		var m StaffMember
		if err := rows.Scan(
			&m.ID, &m.Email, &m.FirstName, &m.LastName, &m.Role, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, rows.Err()
}

// UpdateStaff modifies a staff member's mutable profile details or role.
func (r *SQLRepository) UpdateStaff(ctx context.Context, db *sql.DB, id string, req *UpdateStaffRequest) (*StaffMember, error) {
	query := `
		UPDATE store_staff
		SET first_name = $1, last_name = $2, role = $3, is_active = $4, updated_at = NOW()
		WHERE id = $5
		RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at
	`
	m := &StaffMember{}
	err := db.QueryRowContext(ctx, query, req.FirstName, req.LastName, req.Role, req.IsActive, id).Scan(
		&m.ID, &m.Email, &m.FirstName, &m.LastName, &m.Role, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrStaffNotFound
		}
		return nil, err
	}
	return m, nil
}

// UpdateStaffPassword updates the password hash for a staff member.
func (r *SQLRepository) UpdateStaffPassword(ctx context.Context, db *sql.DB, id, passwordHash string) error {
	query := `UPDATE store_staff SET password_hash = $1, updated_at = NOW() WHERE id = $2`
	res, err := db.ExecContext(ctx, query, passwordHash, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrStaffNotFound
	}
	return nil
}

// DeleteStaff removes a staff member from the store database.
func (r *SQLRepository) DeleteStaff(ctx context.Context, db *sql.DB, id string) error {
	query := `DELETE FROM store_staff WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrStaffNotFound
	}
	return nil
}

// CountOwners returns the count of active STORE_OWNER staff members in the store.
func (r *SQLRepository) CountOwners(ctx context.Context, db *sql.DB) (int, error) {
	query := `SELECT COUNT(*) FROM store_staff WHERE role = 'STORE_OWNER' AND is_active = TRUE`
	var count int
	err := db.QueryRowContext(ctx, query).Scan(&count)
	return count, err
}
