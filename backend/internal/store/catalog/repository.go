package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrCategoryNotFound = errors.New("catalog: category not found")
	ErrProductNotFound  = errors.New("catalog: product not found")
	ErrSlugCollision    = errors.New("catalog: slug is already in use by another record")
	ErrImageNotFound    = errors.New("catalog: media image record not found")

	// ErrReorderUnknownID is returned when a reorder list names a record that does not exist (or, for the
	// featured list, is not featured). Nothing is changed in that case.
	ErrReorderUnknownID = errors.New("catalog: reorder list contains an id that does not exist")
)

// CatalogRepository defines data access capabilities for catalog products.
type CatalogRepository interface {
	GetProductByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Product, error)
}

// Repository encapsulates SQL data access operations on the store database.
type Repository struct{}

// NewRepository instantiates the catalog repository.
func NewRepository() *Repository {
	return &Repository{}
}

// NewSQLCatalogRepository provides an alias for NewRepository.
func NewSQLCatalogRepository() *Repository {
	return NewRepository()
}

// --- CATEGORY OPERATIONS ---

// CreateCategory inserts a new taxonomy node into the store's database.
func (r *Repository) CreateCategory(ctx context.Context, db *sql.DB, c *storeModels.Category) error {
	metaRobots := c.MetaRobots
	if metaRobots == "" {
		metaRobots = "index, follow"
	}
	query := `
		INSERT INTO categories (parent_id, name, slug, description, image_url, display_order, is_active,
		                       meta_title, meta_description, focus_keyword, canonical_url, meta_robots, og_image_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at;`

	err := db.QueryRowContext(ctx, query,
		c.ParentID, c.Name, c.Slug, c.Description, c.ImageURL, c.DisplayOrder, c.IsActive,
		c.MetaTitle, c.MetaDescription, c.FocusKeyword, c.CanonicalURL, metaRobots, c.OGImageURL,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "categories_slug_key") || strings.Contains(err.Error(), "unique") {
			return ErrSlugCollision
		}
		return fmt.Errorf("failed to insert category: %w", err)
	}
	return nil
}

// GetCategoryByID fetches a category by its UUID.
func (r *Repository) GetCategoryByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Category, error) {
	query := `
		SELECT id, parent_id, name, slug, COALESCE(description, ''), COALESCE(image_url, ''),
		       display_order, is_active,
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, ''),
		       created_at, updated_at
		FROM categories WHERE id = $1;`

	var c storeModels.Category
	err := db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Description, &c.ImageURL,
		&c.DisplayOrder, &c.IsActive,
		&c.MetaTitle, &c.MetaDescription, &c.FocusKeyword,
		&c.CanonicalURL, &c.MetaRobots, &c.OGImageURL,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrCategoryNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to query category by id: %w", err)
	}
	return &c, nil
}

// ListCategories returns all categories ordered by parent hierarchy and display order.
func (r *Repository) ListCategories(ctx context.Context, db *sql.DB) ([]storeModels.Category, error) {
	query := `
		SELECT id, parent_id, name, slug, COALESCE(description, ''), COALESCE(image_url, ''),
		       display_order, is_active,
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, ''),
		       created_at, updated_at
		FROM categories
		ORDER BY display_order ASC, name ASC;`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	var categories []storeModels.Category
	for rows.Next() {
		var c storeModels.Category
		if err := rows.Scan(
			&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Description, &c.ImageURL,
			&c.DisplayOrder, &c.IsActive,
			&c.MetaTitle, &c.MetaDescription, &c.FocusKeyword,
			&c.CanonicalURL, &c.MetaRobots, &c.OGImageURL,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, c)
	}
	return categories, nil
}

// UpdateCategory updates mutable category attributes.
func (r *Repository) UpdateCategory(ctx context.Context, db *sql.DB, c *storeModels.Category) error {
	metaRobots := c.MetaRobots
	if metaRobots == "" {
		metaRobots = "index, follow"
	}
	query := `
		UPDATE categories
		SET parent_id = $1, name = $2, slug = $3, description = $4, image_url = $5,
		    display_order = $6, is_active = $7,
		    meta_title = $8, meta_description = $9, focus_keyword = $10,
		    canonical_url = $11, meta_robots = $12, og_image_url = $13,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $14;`

	res, err := db.ExecContext(ctx, query,
		c.ParentID, c.Name, c.Slug, c.Description, c.ImageURL, c.DisplayOrder, c.IsActive,
		c.MetaTitle, c.MetaDescription, c.FocusKeyword, c.CanonicalURL, metaRobots, c.OGImageURL, c.ID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "categories_slug_key") || strings.Contains(err.Error(), "unique") {
			return ErrSlugCollision
		}
		return fmt.Errorf("failed to update category: %w", err)
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrCategoryNotFound
	}
	return nil
}

// DeleteCategory deletes a category node. Child categories have parent_id set to NULL automatically.
func (r *Repository) DeleteCategory(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, "DELETE FROM categories WHERE id = $1;", id)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrCategoryNotFound
	}
	return nil
}

// --- PRODUCT OPERATIONS ---

// CreateProduct inserts a base product record.
func (r *Repository) CreateProduct(ctx context.Context, db *sql.DB, p *storeModels.Product) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	metaRobots := p.MetaRobots
	if metaRobots == "" {
		metaRobots = "index, follow"
	}
	// A product created as featured goes to the end of the featured list.
	query := `
		INSERT INTO products (category_id, title, slug, summary, description, status, featured_image_url,
		                      base_price, compare_at_price, cost_price, sku, is_featured,
		                      brand_id, care_instruction_id, video_url, video_autoplay, video_muted,
		                      product_option_layout, size_guide_template,
		                      meta_title, meta_description, focus_keyword, canonical_url, meta_robots, og_image_url,
		                      featured_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::boolean, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
		        CASE WHEN $12::boolean THEN COALESCE((SELECT MAX(featured_order) FROM products WHERE is_featured), 0) + 1 ELSE 0 END)
		RETURNING id, sort_order, featured_order, created_at, updated_at;`

	err := db.QueryRowContext(ctx, query,
		p.CategoryID, p.Title, p.Slug, p.Summary, p.Description, p.Status,
		p.FeaturedImageURL, p.BasePrice, p.CompareAtPrice, p.CostPrice, p.SKU, p.IsFeatured,
		p.BrandID, p.CareInstructionID, p.VideoURL, p.VideoAutoplay, p.VideoMuted,
		p.OptionLayout, p.SizeGuideTemplate,
		p.MetaTitle, p.MetaDescription, p.FocusKeyword, p.CanonicalURL, metaRobots, p.OGImageURL,
	).Scan(&p.ID, &p.SortOrder, &p.FeaturedOrder, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "products_slug_key") || strings.Contains(err.Error(), "unique") {
			return ErrSlugCollision
		}
		return fmt.Errorf("failed to insert product: %w", err)
	}
	return nil
}

// GetProductByID retrieves a product record including gallery images.
func (r *Repository) GetProductByID(ctx context.Context, db *sql.DB, id string) (*storeModels.Product, error) {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return nil, err
	}
	query := `
		SELECT id, category_id, title, slug, COALESCE(summary, ''), COALESCE(description, ''),
		       status, COALESCE(featured_image_url, ''), base_price, compare_at_price, cost_price, COALESCE(sku, ''),
		       is_featured, sort_order, featured_order, brand_id, care_instruction_id,
		       COALESCE(video_url, ''), video_autoplay, video_muted,
		       COALESCE(product_option_layout, 'simple'), COALESCE(size_guide_template, ''),
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, ''),
		       created_at, updated_at
		FROM products WHERE id = $1;`

	var p storeModels.Product
	err := db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Summary, &p.Description,
		&p.Status, &p.FeaturedImageURL, &p.BasePrice, &p.CompareAtPrice, &p.CostPrice, &p.SKU,
		&p.IsFeatured, &p.SortOrder, &p.FeaturedOrder, &p.BrandID, &p.CareInstructionID,
		&p.VideoURL, &p.VideoAutoplay, &p.VideoMuted,
		&p.OptionLayout, &p.SizeGuideTemplate,
		&p.MetaTitle, &p.MetaDescription, &p.FocusKeyword,
		&p.CanonicalURL, &p.MetaRobots, &p.OGImageURL,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrProductNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to query product: %w", err)
	}

	// Fetch attached gallery images
	images, err := r.ListProductImages(ctx, db, p.ID)
	if err == nil {
		p.Images = images
	}

	return &p, nil
}

// ListProducts queries catalog products with filtering and pagination.
func (r *Repository) ListProducts(ctx context.Context, db *sql.DB, params ProductFilterParams) ([]storeModels.Product, int, error) {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return nil, 0, err
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 100 {
		params.Limit = 20
	}
	offset := (params.Page - 1) * params.Limit

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if params.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, params.Status)
		argIdx++
	}

	if params.CategoryID != nil && *params.CategoryID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("category_id = $%d", argIdx))
		args = append(args, *params.CategoryID)
		argIdx++
	}

	if params.Search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(title ILIKE $%d OR slug ILIKE $%d OR sku ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+params.Search+"%")
		argIdx++
	}

	if params.IsFeatured != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("is_featured = $%d", argIdx))
		args = append(args, *params.IsFeatured)
		argIdx++
	}

	if params.MinPrice != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("base_price >= $%d", argIdx))
		args = append(args, *params.MinPrice)
		argIdx++
	}

	if params.MaxPrice != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("base_price <= $%d", argIdx))
		args = append(args, *params.MaxPrice)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Total count query
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM products %s;", whereSQL)
	var total int
	if err := db.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	// Paginated rows query
	query := fmt.Sprintf(`
		SELECT id, category_id, title, slug, COALESCE(summary, ''), COALESCE(description, ''),
		       status, COALESCE(featured_image_url, ''), base_price, compare_at_price, COALESCE(sku, ''),
		       is_featured, sort_order, featured_order, brand_id, care_instruction_id,
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, ''),
		       created_at, updated_at
		FROM products
		%s
		ORDER BY %s
		LIMIT $%d OFFSET $%d;`, whereSQL, productOrderBy(params.IsFeatured != nil && *params.IsFeatured), argIdx, argIdx+1)

	args = append(args, params.Limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query products: %w", err)
	}
	defer rows.Close()

	var products []storeModels.Product
	for rows.Next() {
		var p storeModels.Product
		if err := rows.Scan(
			&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Summary, &p.Description,
			&p.Status, &p.FeaturedImageURL, &p.BasePrice, &p.CompareAtPrice, &p.SKU,
			&p.IsFeatured, &p.SortOrder, &p.FeaturedOrder, &p.BrandID, &p.CareInstructionID,
			&p.MetaTitle, &p.MetaDescription, &p.FocusKeyword,
			&p.CanonicalURL, &p.MetaRobots, &p.OGImageURL,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to read products: %w", err)
	}

	return products, total, nil
}

// productOrderBy returns the ORDER BY expression for the admin product list. The main list follows the
// merchant's sort_order; the featured list follows featured_order. Ties fall back to newest first, then id,
// so paging stays stable.
func productOrderBy(featuredOnly bool) string {
	if featuredOnly {
		return "featured_order ASC, sort_order ASC, created_at DESC, id ASC"
	}
	return "sort_order ASC, created_at DESC, id ASC"
}

// UpdateProduct updates base product fields.
func (r *Repository) UpdateProduct(ctx context.Context, db *sql.DB, p *storeModels.Product) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	metaRobots := p.MetaRobots
	if metaRobots == "" {
		metaRobots = "index, follow"
	}
	// SET expressions read the old row, so "NOT is_featured" below means "was not featured before".
	// A product that becomes featured goes to the end of the featured list; one that stays featured keeps its place.
	query := `
		UPDATE products
		SET category_id = $1, title = $2, slug = $3, summary = $4, description = $5,
		    status = $6, featured_image_url = $7, base_price = $8, compare_at_price = $9,
		    cost_price = $10, sku = $11,
		    brand_id = $12, care_instruction_id = $13, video_url = $14, video_autoplay = $15, video_muted = $16,
		    product_option_layout = $17, size_guide_template = $18,
		    featured_order = CASE WHEN $19::boolean AND NOT is_featured
		                          THEN COALESCE((SELECT MAX(featured_order) FROM products WHERE is_featured), 0) + 1
		                          ELSE featured_order END,
		    is_featured = $19::boolean,
		    meta_title = $20, meta_description = $21, focus_keyword = $22,
		    canonical_url = $23, meta_robots = $24, og_image_url = $25,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $26;`

	res, err := db.ExecContext(ctx, query,
		p.CategoryID, p.Title, p.Slug, p.Summary, p.Description,
		p.Status, p.FeaturedImageURL, p.BasePrice, p.CompareAtPrice,
		p.CostPrice, p.SKU,
		p.BrandID, p.CareInstructionID, p.VideoURL, p.VideoAutoplay, p.VideoMuted,
		p.OptionLayout, p.SizeGuideTemplate,
		p.IsFeatured,
		p.MetaTitle, p.MetaDescription, p.FocusKeyword,
		p.CanonicalURL, metaRobots, p.OGImageURL,
		p.ID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "products_slug_key") || strings.Contains(err.Error(), "unique") {
			return ErrSlugCollision
		}
		return fmt.Errorf("failed to update product: %w", err)
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrProductNotFound
	}
	return nil
}

// DeleteProduct removes a product from the database.
func (r *Repository) DeleteProduct(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, "DELETE FROM products WHERE id = $1;", id)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrProductNotFound
	}
	return nil
}

// ErrLinkTargetNotFound is returned when a product is linked to a brand or care instruction that does not exist.
var ErrLinkTargetNotFound = errors.New("catalog: linked brand or care instruction not found")

// SetProductLinks sets the brand and care instruction of one product. A nil value clears the link.
// Only these two columns change. A missing target id is reported as ErrLinkTargetNotFound.
func (r *Repository) SetProductLinks(ctx context.Context, db *sql.DB, id string, brandID, careInstructionID *string) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	res, err := db.ExecContext(ctx,
		`UPDATE products SET brand_id = $2, care_instruction_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		id, brandID, careInstructionID)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23503" {
			return ErrLinkTargetNotFound
		}
		return fmt.Errorf("updating product links: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("reading product link update result: %w", err)
	}
	if n == 0 {
		return ErrProductNotFound
	}
	return nil
}

// --- ORDERING AND FEATURED OPERATIONS ---

// SetProductFeatured marks a product as featured or removes it from the featured list. A product that
// becomes featured goes to the end of the featured list; marking an already featured product again keeps its
// place, so repeating the call changes nothing.
func (r *Repository) SetProductFeatured(ctx context.Context, db *sql.DB, id string, featured bool) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	query := `
		UPDATE products
		SET featured_order = CASE WHEN $2::boolean AND NOT is_featured
		                          THEN COALESCE((SELECT MAX(featured_order) FROM products WHERE is_featured), 0) + 1
		                          ELSE featured_order END,
		    is_featured = $2::boolean,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1;`

	res, err := db.ExecContext(ctx, query, id, featured)
	if err != nil {
		return fmt.Errorf("failed to update featured flag: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to read featured update result: %w", err)
	}
	if rows == 0 {
		return ErrProductNotFound
	}
	return nil
}

// ReorderProducts stores the position of each product in the main product list: ids[0] becomes 1, ids[1]
// becomes 2, and so on. Every id must exist. Repeating the same call leaves the same result.
func (r *Repository) ReorderProducts(ctx context.Context, db *sql.DB, ids []string) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	return reorderByIDs(ctx, db, "products", "sort_order", "", ids)
}

// ReorderFeaturedProducts stores the position of each product in the featured list. Every id must be an
// existing product that is currently featured.
func (r *Repository) ReorderFeaturedProducts(ctx context.Context, db *sql.DB, ids []string) error {
	if err := EnsureOrderingSchema(ctx, db); err != nil {
		return err
	}
	return reorderByIDs(ctx, db, "products", "featured_order", "AND t.is_featured", ids)
}

// ReorderCategories stores display_order for the given categories. Pass the ids of one sibling group (all
// root categories, or all children of one parent) in the wanted order.
func (r *Repository) ReorderCategories(ctx context.Context, db *sql.DB, ids []string) error {
	return reorderByIDs(ctx, db, "categories", "display_order", "", ids)
}

// reorderByIDs sets column to the 1-based position of each id, inside one transaction. table, column and
// extraWhere are fixed strings chosen by the callers above and never come from a request.
func reorderByIDs(ctx context.Context, db *sql.DB, table, column, extraWhere string, ids []string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("starting %s reorder: %w", table, err)
	}
	defer func() { _ = tx.Rollback() }()

	query := fmt.Sprintf(`
		UPDATE %s AS t
		SET %s = v.pos, updated_at = CURRENT_TIMESTAMP
		FROM unnest($1::uuid[]) WITH ORDINALITY AS v(id, pos)
		WHERE t.id = v.id %s;`, table, column, extraWhere)

	res, err := tx.ExecContext(ctx, query, pq.Array(ids))
	if err != nil {
		return fmt.Errorf("reordering %s: %w", table, err)
	}
	updated, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("reading %s reorder result: %w", table, err)
	}
	if int(updated) != len(ids) {
		return ErrReorderUnknownID
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing %s reorder: %w", table, err)
	}
	return nil
}

// --- PRODUCT IMAGES OPERATIONS ---

// InsertProductImage records an uploaded asset to a product gallery.
func (r *Repository) InsertProductImage(ctx context.Context, db *sql.DB, img *storeModels.ProductImage) error {
	query := `
		INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at;`

	return db.QueryRowContext(ctx, query,
		img.ProductID, img.URL, img.AltText, img.SortOrder, img.IsPrimary,
	).Scan(&img.ID, &img.CreatedAt, &img.UpdatedAt)
}

// ListProductImages retrieves all gallery images for a product.
func (r *Repository) ListProductImages(ctx context.Context, db *sql.DB, productID string) ([]storeModels.ProductImage, error) {
	query := `
		SELECT id, product_id, url, COALESCE(alt_text, ''), sort_order, is_primary, created_at, updated_at
		FROM product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC, created_at ASC;`

	rows, err := db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []storeModels.ProductImage
	for rows.Next() {
		var img storeModels.ProductImage
		if err := rows.Scan(
			&img.ID, &img.ProductID, &img.URL, &img.AltText, &img.SortOrder,
			&img.IsPrimary, &img.CreatedAt, &img.UpdatedAt,
		); err == nil {
			images = append(images, img)
		}
	}
	return images, nil
}

// SetPrimaryImage marks one image as primary and updates the product's featured_image_url.
func (r *Repository) SetPrimaryImage(ctx context.Context, db *sql.DB, productID, imageID string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// 1. Demote existing primary images
	_, err = tx.ExecContext(ctx, "UPDATE product_images SET is_primary = FALSE WHERE product_id = $1;", productID)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	// 2. Promote target image and retrieve URL
	var imageURL string
	query := `
		UPDATE product_images
		SET is_primary = TRUE, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND product_id = $2
		RETURNING url;`

	err = tx.QueryRowContext(ctx, query, imageID, productID).Scan(&imageURL)
	if err == sql.ErrNoRows {
		_ = tx.Rollback()
		return ErrImageNotFound
	} else if err != nil {
		_ = tx.Rollback()
		return err
	}

	// 3. Update featured_image_url on the product
	_, err = tx.ExecContext(ctx, "UPDATE products SET featured_image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;", imageURL, productID)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}

// DeleteProductImage removes an image record.
func (r *Repository) DeleteProductImage(ctx context.Context, db *sql.DB, imageID string) (*storeModels.ProductImage, error) {
	query := `
		DELETE FROM product_images
		WHERE id = $1
		RETURNING id, product_id, url, COALESCE(alt_text, ''), sort_order, is_primary, created_at, updated_at;`

	var img storeModels.ProductImage
	err := db.QueryRowContext(ctx, query, imageID).Scan(
		&img.ID, &img.ProductID, &img.URL, &img.AltText, &img.SortOrder,
		&img.IsPrimary, &img.CreatedAt, &img.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrImageNotFound
	} else if err != nil {
		return nil, err
	}
	return &img, nil
}
