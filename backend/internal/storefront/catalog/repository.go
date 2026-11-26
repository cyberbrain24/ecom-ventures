package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/lib/pq"

	storeCatalog "ecom-ventures/backend/internal/store/catalog"
	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrProductNotFound = errors.New("product not found or not active")
)

// Repository specifies transactional database interactions for public storefront catalog browsing.
type Repository interface {
	ListActiveCategories(ctx context.Context, db *sql.DB) ([]PublicCategoryNode, error)
	ListPublicProducts(ctx context.Context, db *sql.DB, filter *StorefrontFilterParams) ([]PublicProductCard, int, float64, float64, error)
	GetPublicProductBySlug(ctx context.Context, db *sql.DB, slug string) (*PublicProductDetail, error)
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the repository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// ListActiveCategories queries all active categories from the tenant database and structures them hierarchically.
func (r *SQLRepository) ListActiveCategories(ctx context.Context, db *sql.DB) ([]PublicCategoryNode, error) {
	query := `
		SELECT id, parent_id, name, slug, COALESCE(description, ''), COALESCE(image_url, ''), display_order,
		       COALESCE(meta_title, ''), COALESCE(meta_description, ''), COALESCE(focus_keyword, ''),
		       COALESCE(canonical_url, ''), COALESCE(meta_robots, 'index, follow'), COALESCE(og_image_url, '')
		FROM categories
		WHERE is_active = TRUE
		ORDER BY display_order ASC, name ASC;
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query storefront categories: %w", err)
	}
	defer rows.Close()

	var allCategories []PublicCategoryNode
	for rows.Next() {
		var c PublicCategoryNode
		var parentID sql.NullString
		if err := rows.Scan(
			&c.ID, &parentID, &c.Name, &c.Slug, &c.Description, &c.ImageURL, &c.DisplayOrder,
			&c.MetaTitle, &c.MetaDescription, &c.FocusKeyword, &c.CanonicalURL, &c.MetaRobots, &c.OGImageURL,
		); err != nil {
			return nil, err
		}
		if parentID.Valid {
			pID := parentID.String
			c.ParentID = &pID
		}
		c.Children = []PublicCategoryNode{}
		allCategories = append(allCategories, c)
	}

	return buildCategoryTree(allCategories, nil), nil
}

// ListPublicProducts queries active products with full-text search, recursive category trees, price range filtering, and variant inventory.
func (r *SQLRepository) ListPublicProducts(ctx context.Context, db *sql.DB, filter *StorefrontFilterParams) ([]PublicProductCard, int, float64, float64, error) {
	if err := storeCatalog.EnsureOrderingSchema(ctx, db); err != nil {
		return nil, 0, 0, 0, err
	}

	where := []string{"p.status = 'ACTIVE'"}
	args := []interface{}{}
	argIdx := 1

	if filter.FeaturedOnly {
		where = append(where, "p.is_featured = TRUE")
	}

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(p.title ILIKE $%d OR p.summary ILIKE $%d OR p.sku ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	if filter.CategorySlug != "" {
		where = append(where, fmt.Sprintf(`
			p.category_id IN (
				WITH RECURSIVE cat_tree AS (
					SELECT id FROM categories WHERE slug = $%d AND is_active = TRUE
					UNION ALL
					SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id WHERE c.is_active = TRUE
				)
				SELECT id FROM cat_tree
			)
		`, argIdx))
		args = append(args, filter.CategorySlug)
		argIdx++
	}

	if filter.MinPrice != nil && *filter.MinPrice > 0 {
		where = append(where, fmt.Sprintf("p.base_price >= $%d", argIdx))
		args = append(args, *filter.MinPrice)
		argIdx++
	}

	if filter.MaxPrice != nil && *filter.MaxPrice > 0 {
		where = append(where, fmt.Sprintf("p.base_price <= $%d", argIdx))
		args = append(args, *filter.MaxPrice)
		argIdx++
	}

	if filter.InStockOnly {
		where = append(where, `
			EXISTS (
				SELECT 1 FROM product_variants pv
				JOIN variant_inventory vi ON vi.variant_id = pv.id
				WHERE pv.product_id = p.id AND pv.is_active = TRUE AND (vi.quantity_available - vi.quantity_reserved) > 0
			)
		`)
	}

	whereClause := strings.Join(where, " AND ")

	// 1. Compute aggregate statistics (Total count, Global Min Price, Global Max Price)
	statQuery := fmt.Sprintf(`
		SELECT COUNT(*), COALESCE(MIN(p.base_price), 0.00), COALESCE(MAX(p.base_price), 0.00)
		FROM products p
		WHERE %s;
	`, whereClause)

	var total int
	var globalMin, globalMax float64
	if err := db.QueryRowContext(ctx, statQuery, args...).Scan(&total, &globalMin, &globalMax); err != nil {
		return nil, 0, 0, 0, fmt.Errorf("failed to count storefront products: %w", err)
	}

	// 2. Sorting clause
	orderBy := storefrontOrderBy(filter)

	limit := filter.Limit
	if limit <= 0 {
		limit = 24
	}
	offset := (filter.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT
			p.id, p.title, p.slug, COALESCE(p.summary, ''), COALESCE(p.featured_image_url, ''),
			p.base_price, p.compare_at_price, p.created_at, p.is_featured,
			c.slug AS category_slug, c.name AS category_name,
			b.name AS brand_name,
			COUNT(pv.id) AS total_variants,
			COALESCE(BOOL_OR((vi.quantity_available - vi.quantity_reserved) > 0), FALSE) AS in_stock
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN brands b ON b.id = p.brand_id AND b.is_active = TRUE
		LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
		LEFT JOIN variant_inventory vi ON vi.variant_id = pv.id
		WHERE %s
		GROUP BY p.id, c.slug, c.name, b.name
		ORDER BY %s
		LIMIT $%d OFFSET $%d;
	`, whereClause, orderBy, argIdx, argIdx+1)

	queryArgs := append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, 0, 0, fmt.Errorf("failed to query storefront products: %w", err)
	}
	defer rows.Close()

	var products []PublicProductCard
	for rows.Next() {
		var p PublicProductCard
		var catSlug, catName, brandName sql.NullString
		var compareAt sql.NullFloat64

		if err := rows.Scan(
			&p.ID, &p.Title, &p.Slug, &p.Summary, &p.FeaturedImageURL,
			&p.BasePrice, &compareAt, &p.CreatedAt, &p.IsFeatured,
			&catSlug, &catName, &brandName, &p.TotalVariants, &p.InStock,
		); err != nil {
			return nil, 0, 0, 0, err
		}
		if brandName.Valid {
			bn := brandName.String
			p.BrandName = &bn
		}

		if compareAt.Valid && compareAt.Float64 > p.BasePrice {
			compVal := compareAt.Float64
			p.CompareAtPrice = &compVal
			p.HasDiscount = true
			p.DiscountPercent = int(math.Round(((compVal - p.BasePrice) / compVal) * 100))
		}

		if catSlug.Valid {
			slugVal := catSlug.String
			p.CategorySlug = &slugVal
		}
		if catName.Valid {
			nameVal := catName.String
			p.CategoryName = &nameVal
		}

		products = append(products, p)
	}

	if products == nil {
		products = []PublicProductCard{}
	}

	return products, total, globalMin, globalMax, rows.Err()
}

// storefrontOrderBy returns the ORDER BY expression for a storefront product query. Without an explicit
// sort the merchant's own order is used (the order set in the store admin product list); the featured list
// follows the merchant's featured order. Ties fall back to newest first, then id, so paging stays stable.
func storefrontOrderBy(filter *StorefrontFilterParams) string {
	if filter.FeaturedOnly {
		return "p.featured_order ASC, p.sort_order ASC, p.created_at DESC, p.id ASC"
	}
	switch filter.Sort {
	case "price_asc":
		return "p.base_price ASC, p.id ASC"
	case "price_desc":
		return "p.base_price DESC, p.id ASC"
	case "newest":
		return "p.created_at DESC, p.id ASC"
	case "featured":
		return "p.is_featured DESC, p.featured_order ASC, p.sort_order ASC, p.created_at DESC, p.id ASC"
	}
	return "p.sort_order ASC, p.created_at DESC, p.id ASC"
}

// buildCategoryTree recursively constructs a parent-child category tree.
func buildCategoryTree(nodes []PublicCategoryNode, parentID *string) []PublicCategoryNode {
	var tree []PublicCategoryNode
	for _, n := range nodes {
		if (parentID == nil && n.ParentID == nil) || (parentID != nil && n.ParentID != nil && *n.ParentID == *parentID) {
			currID := n.ID
			childTree := buildCategoryTree(nodes, &currID)
			n.Children = childTree
			tree = append(tree, n)
		}
	}
	if tree == nil {
		tree = []PublicCategoryNode{}
	}
	return tree
}

// GetPublicProductBySlug returns the full active product details with variant matrices and stock.
func (r *SQLRepository) GetPublicProductBySlug(ctx context.Context, db *sql.DB, slug string) (*PublicProductDetail, error) {
	if err := storeCatalog.EnsureOrderingSchema(ctx, db); err != nil {
		return nil, err
	}
	// Only active brands and care instructions are shown; an inactive one is hidden from shoppers.
	queryProduct := `
		SELECT
			p.id, p.title, p.slug, COALESCE(p.sku, ''), COALESCE(p.summary, ''), COALESCE(p.description, ''),
			p.base_price, p.compare_at_price, COALESCE(p.featured_image_url, ''), p.created_at,
			c.slug AS category_slug, c.name AS category_name,
			COALESCE(p.meta_title, ''), COALESCE(p.meta_description, ''), COALESCE(p.focus_keyword, ''),
			COALESCE(p.canonical_url, ''), COALESCE(p.meta_robots, 'index, follow'), COALESCE(p.og_image_url, ''),
			b.name, COALESCE(b.logo_url, ''), COALESCE(b.origin, ''),
			ci.title, ci.instructions
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN brands b ON b.id = p.brand_id AND b.is_active = TRUE
		LEFT JOIN care_instructions ci ON ci.id = p.care_instruction_id AND ci.is_active = TRUE
		WHERE p.slug = $1 AND p.status = 'ACTIVE';
	`
	detail := &PublicProductDetail{}
	var catSlug, catName, brandName, careTitle sql.NullString
	var compareAt sql.NullFloat64

	err := db.QueryRowContext(ctx, queryProduct, slug).Scan(
		&detail.ID, &detail.Title, &detail.Slug, &detail.SKU, &detail.Summary, &detail.Description,
		&detail.BasePrice, &compareAt, &detail.FeaturedImageURL, &detail.CreatedAt,
		&catSlug, &catName,
		&detail.MetaTitle, &detail.MetaDescription, &detail.FocusKeyword,
		&detail.CanonicalURL, &detail.MetaRobots, &detail.OGImageURL,
		&brandName, &detail.BrandLogoURL, &detail.BrandOrigin,
		&careTitle, pq.Array(&detail.CareInstructions),
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		return nil, fmt.Errorf("failed to query product by slug: %w", err)
	}

	// A product without an active care instruction scans as NULL; the API always returns a list.
	if detail.CareInstructions == nil {
		detail.CareInstructions = []string{}
	}
	if brandName.Valid {
		detail.BrandName = brandName.String
	}
	if careTitle.Valid {
		detail.CareInstructionTitle = careTitle.String
	}
	if compareAt.Valid {
		cVal := compareAt.Float64
		detail.CompareAtPrice = &cVal
	}
	if catSlug.Valid {
		csVal := catSlug.String
		detail.CategorySlug = &csVal
	}
	if catName.Valid {
		cnVal := catName.String
		detail.CategoryName = &cnVal
	}

	// 1. Fetch gallery images
	queryImages := `
		SELECT id, product_id, url, COALESCE(alt_text, ''), sort_order, is_primary, created_at, updated_at
		FROM product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC, created_at ASC;
	`
	imgRows, err := db.QueryContext(ctx, queryImages, detail.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to query product images: %w", err)
	}
	defer imgRows.Close()

	for imgRows.Next() {
		var img storeModels.ProductImage
		if err := imgRows.Scan(&img.ID, &img.ProductID, &img.URL, &img.AltText, &img.SortOrder, &img.IsPrimary, &img.CreatedAt, &img.UpdatedAt); err == nil {
			detail.Images = append(detail.Images, img)
		}
	}
	if detail.Images == nil {
		detail.Images = []storeModels.ProductImage{}
	}

	// 2. Fetch active variants with live inventory levels
	queryVariants := `
		SELECT
			pv.id, pv.sku, pv.title, pv.price, pv.compare_at_price, pv.weight_grams,
			COALESCE(vi.quantity_available - vi.quantity_reserved, 0) AS available_quantity
		FROM product_variants pv
		LEFT JOIN variant_inventory vi ON vi.variant_id = pv.id
		WHERE pv.product_id = $1 AND pv.is_active = TRUE
		ORDER BY pv.created_at ASC;
	`
	vRows, err := db.QueryContext(ctx, queryVariants, detail.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to query product variants: %w", err)
	}
	defer vRows.Close()

	for vRows.Next() {
		var v PublicVariantDetail
		var vCompareAt sql.NullFloat64
		if err := vRows.Scan(&v.ID, &v.SKU, &v.Title, &v.Price, &vCompareAt, &v.WeightGrams, &v.AvailableQuantity); err == nil {
			if vCompareAt.Valid {
				vcVal := vCompareAt.Float64
				v.CompareAtPrice = &vcVal
			}
			v.InStock = v.AvailableQuantity > 0

			// Fetch bound attribute values
			attrValQuery := `SELECT attribute_value_id FROM variant_attribute_values WHERE variant_id = $1`
			avRows, _ := db.QueryContext(ctx, attrValQuery, v.ID)
			if avRows != nil {
				for avRows.Next() {
					var avID string
					if avRows.Scan(&avID) == nil {
						v.AttributeValueIDs = append(v.AttributeValueIDs, avID)
					}
				}
				avRows.Close()
			}

			// Fetch bound images (IDs + primary variant image URL)
			imgQuery := `
				SELECT pi.id, pi.url
				FROM product_images pi
				JOIN variant_images vi ON vi.image_id = pi.id
				WHERE vi.variant_id = $1
				ORDER BY pi.sort_order ASC, pi.created_at ASC
			`
			viRows, _ := db.QueryContext(ctx, imgQuery, v.ID)
			if viRows != nil {
				for viRows.Next() {
					var iID, iURL string
					if viRows.Scan(&iID, &iURL) == nil {
						v.ImageIDs = append(v.ImageIDs, iID)
						if v.ImageURL == "" {
							v.ImageURL = iURL
						}
					}
				}
				viRows.Close()
			}

			if v.AttributeValueIDs == nil {
				v.AttributeValueIDs = []string{}
			}
			if v.ImageIDs == nil {
				v.ImageIDs = []string{}
			}

			detail.Variants = append(detail.Variants, v)
		}
	}
	if detail.Variants == nil {
		detail.Variants = []PublicVariantDetail{}
	}

	// 3. Fetch variation attributes applicable to this product
	queryAttrs := `
		SELECT DISTINCT a.id, a.name, a.code, a.display_type
		FROM attributes a
		JOIN attribute_values av ON av.attribute_id = a.id
		JOIN variant_attribute_values vav ON vav.attribute_value_id = av.id
		JOIN product_variants pv ON pv.id = vav.variant_id
		WHERE pv.product_id = $1 AND pv.is_active = TRUE
		ORDER BY a.name ASC;
	`
	aRows, err := db.QueryContext(ctx, queryAttrs, detail.ID)
	if err == nil && aRows != nil {
		defer aRows.Close()
		for aRows.Next() {
			var opt PublicAttributeOption
			if err := aRows.Scan(&opt.ID, &opt.Name, &opt.Code, &opt.DisplayType); err == nil {
				// Fetch applicable values
				valQuery := `
					SELECT DISTINCT av.id, av.attribute_id, av.value, av.display_value, av.color_hex, av.sort_order, av.created_at, av.updated_at
					FROM attribute_values av
					JOIN variant_attribute_values vav ON vav.attribute_value_id = av.id
					JOIN product_variants pv ON pv.id = vav.variant_id
					WHERE pv.product_id = $1 AND av.attribute_id = $2 AND pv.is_active = TRUE
					ORDER BY av.sort_order ASC, av.value ASC;
				`
				valRows, _ := db.QueryContext(ctx, valQuery, detail.ID, opt.ID)
				if valRows != nil {
					for valRows.Next() {
						var val storeModels.AttributeValue
						if valRows.Scan(&val.ID, &val.AttributeID, &val.Value, &val.DisplayValue, &val.ColorHex, &val.SortOrder, &val.CreatedAt, &val.UpdatedAt) == nil {
							opt.Values = append(opt.Values, val)
						}
					}
					valRows.Close()
				}
				if opt.Values == nil {
					opt.Values = []storeModels.AttributeValue{}
				}
				detail.Attributes = append(detail.Attributes, opt)
			}
		}
	}
	if detail.Attributes == nil {
		detail.Attributes = []PublicAttributeOption{}
	}

	return detail, nil
}
