package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrCategoryNotFound = errors.New("catalog: category not found")
	ErrProductNotFound  = errors.New("catalog: product not found")
	ErrSlugCollision    = errors.New("catalog: slug is already in use by another record")
	ErrImageNotFound    = errors.New("catalog: media image record not found")
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
		                       meta_title, meta_description, focus_keyword, canonical_url, meta_robots)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at;`

	err := db.QueryRowContext(ctx, query,
		c.ParentID, c.Name, c.Slug, c.Description, c.ImageURL, c.DisplayOrder, c.IsActive,
		c.MetaTitle, c.MetaDescription, c.FocusKeyword, c.CanonicalURL, metaRobots,
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
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'),
		       created_at, updated_at
		FROM categories WHERE id = $1;`

	var c storeModels.Category
	err := db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Description, &c.ImageURL,
		&c.DisplayOrder, &c.IsActive,
		&c.MetaTitle, &c.MetaDescription, &c.FocusKeyword,
		&c.CanonicalURL, &c.MetaRobots,
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
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'),
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
			&c.CanonicalURL, &c.MetaRobots,
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
		    canonical_url = $11, meta_robots = $12,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $13;`

	res, err := db.ExecContext(ctx, query,
		c.ParentID, c.Name, c.Slug, c.Description, c.ImageURL, c.DisplayOrder, c.IsActive,
		c.MetaTitle, c.MetaDescription, c.FocusKeyword, c.CanonicalURL, metaRobots, c.ID,
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
	metaRobots := p.MetaRobots
	if metaRobots == "" {
		metaRobots = "index, follow"
	}
	query := `
		INSERT INTO products (category_id, title, slug, summary, description, status, featured_image_url,
		                      base_price, compare_at_price, sku, is_featured,
		                      meta_title, meta_description, focus_keyword, canonical_url, meta_robots, og_image_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at;`

	err := db.QueryRowContext(ctx, query,
		p.CategoryID, p.Title, p.Slug, p.Summary, p.Description, p.Status,
		p.FeaturedImageURL, p.BasePrice, p.CompareAtPrice, p.SKU, p.IsFeatured,
		p.MetaTitle, p.MetaDescription, p.FocusKeyword, p.CanonicalURL, metaRobots, p.OGImageURL,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)

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
	query := `
		SELECT id, category_id, title, slug, COALESCE(summary, ''), COALESCE(description, ''),
		       status, COALESCE(featured_image_url, ''), base_price, compare_at_price, COALESCE(sku, ''),
		       is_featured,
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, ''),
		       created_at, updated_at
		FROM products WHERE id = $1;`

	var p storeModels.Product
	err := db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Summary, &p.Description,
		&p.Status, &p.FeaturedImageURL, &p.BasePrice, &p.CompareAtPrice, &p.SKU,
		&p.IsFeatured,
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
		       is_featured,
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, ''),
		       created_at, updated_at
		FROM products
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d;`, whereSQL, argIdx, argIdx+1)

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
			&p.IsFeatured,
			&p.MetaTitle, &p.MetaDescription, &p.FocusKeyword,
			&p.CanonicalURL, &p.MetaRobots, &p.OGImageURL,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, p)
	}

	return products, total, nil
}

// UpdateProduct updates base product fields.
func (r *Repository) UpdateProduct(ctx context.Context, db *sql.DB, p *storeModels.Product) error {
	metaRobots := p.MetaRobots
	if metaRobots == "" {
		metaRobots = "index, follow"
	}
	query := `
		UPDATE products
		SET category_id = $1, title = $2, slug = $3, summary = $4, description = $5,
		    status = $6, featured_image_url = $7, base_price = $8, compare_at_price = $9,
		    sku = $10, is_featured = $11,
		    meta_title = $12, meta_description = $13, focus_keyword = $14,
		    canonical_url = $15, meta_robots = $16, og_image_url = $17,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $18;`

	res, err := db.ExecContext(ctx, query,
		p.CategoryID, p.Title, p.Slug, p.Summary, p.Description,
		p.Status, p.FeaturedImageURL, p.BasePrice, p.CompareAtPrice,
		p.SKU, p.IsFeatured,
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
