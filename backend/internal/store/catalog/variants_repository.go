package catalog

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/lib/pq"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// VariantsRepository defines transactional database queries executed against the tenant database.
type VariantsRepository interface {
	// Attributes & Values
	CreateAttribute(ctx context.Context, db *sql.DB, attr *storeModels.Attribute) error
	GetAttributeByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Attribute, error)
	GetAttributeByCode(ctx context.Context, db *sql.DB, code string) (*storeModels.Attribute, error)
	ListAttributes(ctx context.Context, db *sql.DB) ([]AttributeDetailResponse, error)
	UpdateAttribute(ctx context.Context, db *sql.DB, id, name, dataType, displayType string) error
	DeleteAttribute(ctx context.Context, db *sql.DB, id string) error
	ReorderAttributes(ctx context.Context, db *sql.DB, ids []string) error

	CreateAttributeValue(ctx context.Context, db *sql.DB, val *storeModels.AttributeValue) error
	GetAttributeValuesByIDs(ctx context.Context, db *sql.DB, ids []string) ([]storeModels.AttributeValue, error)
	GetAttributeValuesByAttributeID(ctx context.Context, db *sql.DB, attributeID string) ([]storeModels.AttributeValue, error)
	DeleteAttributeValue(ctx context.Context, db *sql.DB, id string) error

	// Product Variants & Matrix
	CreateVariantTx(ctx context.Context, tx *sql.Tx, v *storeModels.ProductVariant, attrValIDs, imageIDs []string) error
	GetVariantByID(ctx context.Context, db *sql.DB, id string) (*VariantDetailResponse, error)
	ListVariantsByProductID(ctx context.Context, db *sql.DB, productID string) ([]VariantDetailResponse, error)
	UpdateVariant(ctx context.Context, db *sql.DB, id string, req *UpdateVariantRequest) error
	DeleteVariant(ctx context.Context, db *sql.DB, id string) error

	BatchUpdateVariants(ctx context.Context, db *sql.DB, req *BatchUpdateVariantsRequest) (int64, error)
	BindVariantImages(ctx context.Context, db *sql.DB, variantID string, imageIDs []string) error
}

// SQLVariantsRepository implements VariantsRepository.
type SQLVariantsRepository struct{}

// NewSQLVariantsRepository initializes the SQL repository.
func NewSQLVariantsRepository() *SQLVariantsRepository {
	return &SQLVariantsRepository{}
}

func (r *SQLVariantsRepository) CreateAttribute(ctx context.Context, db *sql.DB, attr *storeModels.Attribute) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	if attr.DataType == "" {
		attr.DataType = "select"
	}
	// A new attribute goes to the end of the attribute list.
	query := `
		INSERT INTO attributes (name, code, data_type, display_type, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM attributes), NOW(), NOW())
		RETURNING id, sort_order, created_at, updated_at
	`
	return db.QueryRowContext(ctx, query, attr.Name, attr.Code, attr.DataType, attr.DisplayType).
		Scan(&attr.ID, &attr.SortOrder, &attr.CreatedAt, &attr.UpdatedAt)
}

// ReorderAttributes stores the position of each attribute in the attribute list.
func (r *SQLVariantsRepository) ReorderAttributes(ctx context.Context, db *sql.DB, ids []string) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	return reorderByIDs(ctx, db, "attributes", "sort_order", "", ids)
}

func (r *SQLVariantsRepository) GetAttributeByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Attribute, error) {
	query := `
		SELECT id, name, code, display_type, created_at, updated_at
		FROM attributes
		WHERE id = $1
	`
	attr := &storeModels.Attribute{}
	err := db.QueryRowContext(ctx, query, id).Scan(
		&attr.ID, &attr.Name, &attr.Code, &attr.DisplayType, &attr.CreatedAt, &attr.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return attr, nil
}

func (r *SQLVariantsRepository) GetAttributeByCode(ctx context.Context, db *sql.DB, code string) (*storeModels.Attribute, error) {
	query := `
		SELECT id, name, code, display_type, created_at, updated_at
		FROM attributes
		WHERE code = $1
	`
	attr := &storeModels.Attribute{}
	err := db.QueryRowContext(ctx, query, code).Scan(
		&attr.ID, &attr.Name, &attr.Code, &attr.DisplayType, &attr.CreatedAt, &attr.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return attr, nil
}

func (r *SQLVariantsRepository) ListAttributes(ctx context.Context, db *sql.DB) ([]AttributeDetailResponse, error) {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return nil, err
	}
	query := `
		SELECT id, name, code, data_type, display_type, sort_order, created_at, updated_at
		FROM attributes
		ORDER BY sort_order ASC, created_at ASC, id ASC
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query attributes: %w", err)
	}
	defer rows.Close()

	details := make([]AttributeDetailResponse, 0)
	for rows.Next() {
		var a storeModels.Attribute
		if err := rows.Scan(&a.ID, &a.Name, &a.Code, &a.DataType, &a.DisplayType, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}

		vals, err := r.GetAttributeValuesByAttributeID(ctx, db, a.ID)
		if err != nil {
			return nil, err
		}
		if vals == nil {
			vals = []storeModels.AttributeValue{}
		}

		details = append(details, AttributeDetailResponse{
			Attribute: a,
			Values:    vals,
		})
	}
	return details, rows.Err()
}

func (r *SQLVariantsRepository) UpdateAttribute(ctx context.Context, db *sql.DB, id, name, dataType, displayType string) error {
	if dataType == "" {
		dataType = "select"
	}
	query := `
		UPDATE attributes
		SET name = $1, data_type = $2, display_type = $3, updated_at = NOW()
		WHERE id = $4
	`
	res, err := db.ExecContext(ctx, query, name, dataType, displayType, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *SQLVariantsRepository) DeleteAttribute(ctx context.Context, db *sql.DB, id string) error {
	query := `DELETE FROM attributes WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *SQLVariantsRepository) CreateAttributeValue(ctx context.Context, db *sql.DB, val *storeModels.AttributeValue) error {
	query := `
		INSERT INTO attribute_values (attribute_id, value, display_value, color_hex, image_url, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	return db.QueryRowContext(ctx, query, val.AttributeID, val.Value, val.DisplayValue, val.ColorHex, val.ImageURL, val.SortOrder).
		Scan(&val.ID, &val.CreatedAt, &val.UpdatedAt)
}

func (r *SQLVariantsRepository) GetAttributeValuesByIDs(ctx context.Context, db *sql.DB, ids []string) ([]storeModels.AttributeValue, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query := `
		SELECT id, attribute_id, value, display_value, color_hex, image_url, sort_order, created_at, updated_at
		FROM attribute_values
		WHERE id = ANY($1)
		ORDER BY sort_order ASC
	`
	rows, err := db.QueryContext(ctx, query, pq.Array(ids))
	if err != nil {
		return nil, fmt.Errorf("failed to query attribute values by IDs: %w", err)
	}
	defer rows.Close()

	var list []storeModels.AttributeValue
	for rows.Next() {
		var v storeModels.AttributeValue
		if err := rows.Scan(&v.ID, &v.AttributeID, &v.Value, &v.DisplayValue, &v.ColorHex, &v.ImageURL, &v.SortOrder, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, rows.Err()
}

func (r *SQLVariantsRepository) GetAttributeValuesByAttributeID(ctx context.Context, db *sql.DB, attributeID string) ([]storeModels.AttributeValue, error) {
	query := `
		SELECT id, attribute_id, value, display_value, color_hex, image_url, sort_order, created_at, updated_at
		FROM attribute_values
		WHERE attribute_id = $1
		ORDER BY sort_order ASC, value ASC
	`
	rows, err := db.QueryContext(ctx, query, attributeID)
	if err != nil {
		return nil, fmt.Errorf("failed to query attribute values by attribute ID: %w", err)
	}
	defer rows.Close()

	var list []storeModels.AttributeValue
	for rows.Next() {
		var v storeModels.AttributeValue
		if err := rows.Scan(&v.ID, &v.AttributeID, &v.Value, &v.DisplayValue, &v.ColorHex, &v.ImageURL, &v.SortOrder, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, rows.Err()
}

func (r *SQLVariantsRepository) DeleteAttributeValue(ctx context.Context, db *sql.DB, id string) error {
	query := `DELETE FROM attribute_values WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *SQLVariantsRepository) CreateVariantTx(ctx context.Context, tx *sql.Tx, v *storeModels.ProductVariant, attrValIDs, imageIDs []string) error {
	// 1. Insert product_variant
	queryVariant := `
		INSERT INTO product_variants (
			product_id, sku, barcode, title, price, compare_at_price, cost_price, weight_grams, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	err := tx.QueryRowContext(ctx, queryVariant,
		v.ProductID, v.SKU, v.Barcode, v.Title, v.Price, v.CompareAtPrice, v.CostPrice, v.WeightGrams, v.IsActive,
	).Scan(&v.ID, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert variant: %w", err)
	}

	// 2. Insert variant_attribute_values bridge
	for _, attrValID := range attrValIDs {
		queryBridge := `
			INSERT INTO variant_attribute_values (variant_id, attribute_value_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`
		if _, err := tx.ExecContext(ctx, queryBridge, v.ID, attrValID); err != nil {
			return fmt.Errorf("failed to bind attribute value %s: %w", attrValID, err)
		}
	}

	// 3. Insert variant_images bridge
	for _, imgID := range imageIDs {
		queryImg := `
			INSERT INTO variant_images (variant_id, image_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`
		if _, err := tx.ExecContext(ctx, queryImg, v.ID, imgID); err != nil {
			return fmt.Errorf("failed to bind image %s: %w", imgID, err)
		}
	}

	// 4. Initialize baseline variant_inventory record atomically
	queryInventory := `
		INSERT INTO variant_inventory (variant_id, quantity_available, quantity_reserved, low_stock_threshold, updated_at)
		VALUES ($1, 0, 0, 5, NOW())
		ON CONFLICT (variant_id) DO NOTHING
	`
	if _, err := tx.ExecContext(ctx, queryInventory, v.ID); err != nil {
		return fmt.Errorf("failed to initialize variant inventory baseline: %w", err)
	}

	return nil
}

func (r *SQLVariantsRepository) GetVariantByID(ctx context.Context, db *sql.DB, id string) (*VariantDetailResponse, error) {
	queryVariant := `
		SELECT id, product_id, sku, barcode, title, price, compare_at_price, cost_price, weight_grams, is_active, created_at, updated_at
		FROM product_variants
		WHERE id = $1
	`
	resp := &VariantDetailResponse{}
	err := db.QueryRowContext(ctx, queryVariant, id).Scan(
		&resp.ID, &resp.ProductID, &resp.SKU, &resp.Barcode, &resp.Title,
		&resp.Price, &resp.CompareAtPrice, &resp.CostPrice, &resp.WeightGrams,
		&resp.IsActive, &resp.CreatedAt, &resp.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Fetch bound attributes
	queryAttrs := `
		SELECT av.id, av.attribute_id, av.value, av.display_value, av.color_hex, av.sort_order, av.created_at, av.updated_at
		FROM attribute_values av
		JOIN variant_attribute_values vav ON vav.attribute_value_id = av.id
		WHERE vav.variant_id = $1
		ORDER BY av.sort_order ASC
	`
	attrRows, err := db.QueryContext(ctx, queryAttrs, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query variant attributes: %w", err)
	}
	defer attrRows.Close()

	for attrRows.Next() {
		var av storeModels.AttributeValue
		if err := attrRows.Scan(&av.ID, &av.AttributeID, &av.Value, &av.DisplayValue, &av.ColorHex, &av.SortOrder, &av.CreatedAt, &av.UpdatedAt); err != nil {
			return nil, err
		}
		resp.Attributes = append(resp.Attributes, av)
	}
	if resp.Attributes == nil {
		resp.Attributes = []storeModels.AttributeValue{}
	}

	// Fetch bound images
	queryImgs := `
		SELECT pi.id, pi.product_id, pi.url, pi.alt_text, pi.sort_order, pi.is_primary, pi.created_at, pi.updated_at
		FROM product_images pi
		JOIN variant_images vi ON vi.image_id = pi.id
		WHERE vi.variant_id = $1
		ORDER BY pi.sort_order ASC
	`
	imgRows, err := db.QueryContext(ctx, queryImgs, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query variant images: %w", err)
	}
	defer imgRows.Close()

	for imgRows.Next() {
		var pi storeModels.ProductImage
		if err := imgRows.Scan(&pi.ID, &pi.ProductID, &pi.URL, &pi.AltText, &pi.SortOrder, &pi.IsPrimary, &pi.CreatedAt, &pi.UpdatedAt); err != nil {
			return nil, err
		}
		resp.Images = append(resp.Images, pi)
	}
	if resp.Images == nil {
		resp.Images = []storeModels.ProductImage{}
	}

	return resp, nil
}

func (r *SQLVariantsRepository) ListVariantsByProductID(ctx context.Context, db *sql.DB, productID string) ([]VariantDetailResponse, error) {
	query := `
		SELECT id FROM product_variants
		WHERE product_id = $1
		ORDER BY created_at ASC
	`
	rows, err := db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, fmt.Errorf("failed to list variants: %w", err)
	}
	defer rows.Close()

	var list []VariantDetailResponse
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		detail, err := r.GetVariantByID(ctx, db, id)
		if err != nil {
			return nil, err
		}
		list = append(list, *detail)
	}
	return list, rows.Err()
}

func (r *SQLVariantsRepository) UpdateVariant(ctx context.Context, db *sql.DB, id string, req *UpdateVariantRequest) error {
	query := `
		UPDATE product_variants
		SET sku = $1, barcode = $2, title = $3, price = $4, compare_at_price = $5,
		    cost_price = $6, weight_grams = $7, is_active = $8, updated_at = NOW()
		WHERE id = $9
	`
	res, err := db.ExecContext(ctx, query,
		req.SKU, req.Barcode, req.Title, req.Price, req.CompareAtPrice,
		req.CostPrice, req.WeightGrams, req.IsActive, id,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *SQLVariantsRepository) DeleteVariant(ctx context.Context, db *sql.DB, id string) error {
	query := `DELETE FROM product_variants WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *SQLVariantsRepository) BatchUpdateVariants(ctx context.Context, db *sql.DB, req *BatchUpdateVariantsRequest) (int64, error) {
	if len(req.VariantIDs) == 0 {
		return 0, nil
	}

	var sets []string
	var args []interface{}
	argIdx := 1

	if req.Price != nil {
		sets = append(sets, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *req.Price)
		argIdx++
	}
	if req.CompareAtPrice != nil {
		sets = append(sets, fmt.Sprintf("compare_at_price = $%d", argIdx))
		args = append(args, *req.CompareAtPrice)
		argIdx++
	}
	if req.IsActive != nil {
		sets = append(sets, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}

	if len(sets) == 0 {
		return 0, nil
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, pq.Array(req.VariantIDs))

	query := fmt.Sprintf(`
		UPDATE product_variants
		SET %s
		WHERE id = ANY($%d)
	`, strings.Join(sets, ", "), argIdx)

	res, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to batch update variants: %w", err)
	}
	return res.RowsAffected()
}

func (r *SQLVariantsRepository) BindVariantImages(ctx context.Context, db *sql.DB, variantID string, imageIDs []string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Clear previous image associations
	if _, err := tx.ExecContext(ctx, `DELETE FROM variant_images WHERE variant_id = $1`, variantID); err != nil {
		return fmt.Errorf("failed to clear variant images: %w", err)
	}

	for _, imgID := range imageIDs {
		query := `
			INSERT INTO variant_images (variant_id, image_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`
		if _, err := tx.ExecContext(ctx, query, variantID, imgID); err != nil {
			return fmt.Errorf("failed to map image %s to variant %s: %w", imgID, variantID, err)
		}
	}

	return tx.Commit()
}
