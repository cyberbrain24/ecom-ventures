package blog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
)

var (
	ErrPostNotFound     = errors.New("blog: post not found")
	ErrCategoryNotFound = errors.New("blog: category not found")
)

// Repository defines data access operations for tenant-isolated blog management.
type Repository interface {
	ListPosts(ctx context.Context, db *sql.DB, filter PostFilter) ([]*BlogPost, int, error)
	GetPostByID(ctx context.Context, db *sql.DB, id string) (*BlogPost, error)
	GetPostBySlug(ctx context.Context, db *sql.DB, slug string) (*BlogPost, error)
	CreatePost(ctx context.Context, db *sql.DB, post *BlogPost, productIDs []string) (*BlogPost, error)
	UpdatePost(ctx context.Context, db *sql.DB, post *BlogPost, productIDs []string) (*BlogPost, error)
	UpdatePostStatus(ctx context.Context, db *sql.DB, id string, status PostStatus) error
	IncrementViewCount(ctx context.Context, db *sql.DB, id string) error
	DeletePost(ctx context.Context, db *sql.DB, id string) error

	ListCategories(ctx context.Context, db *sql.DB, activeOnly bool) ([]*BlogCategory, error)
	GetCategoryByID(ctx context.Context, db *sql.DB, id string) (*BlogCategory, error)
	GetCategoryBySlug(ctx context.Context, db *sql.DB, slug string) (*BlogCategory, error)
	CreateCategory(ctx context.Context, db *sql.DB, category *BlogCategory) (*BlogCategory, error)
	UpdateCategory(ctx context.Context, db *sql.DB, category *BlogCategory) (*BlogCategory, error)
	DeleteCategory(ctx context.Context, db *sql.DB, id string) error

	ListSitemapItems(ctx context.Context, db *sql.DB) ([]SitemapItem, error)
}

// PostgresRepository implements Repository for PostgreSQL tenant databases.
type PostgresRepository struct{}

// NewRepository creates an instance of PostgresRepository.
func NewRepository() *PostgresRepository {
	return &PostgresRepository{}
}

// ListPosts queries blog posts matching filter parameters with pagination.
func (r *PostgresRepository) ListPosts(ctx context.Context, db *sql.DB, filter PostFilter) ([]*BlogPost, int, error) {
	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if filter.Status != nil && *filter.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("bp.status = $%d", argIdx))
		args = append(args, string(*filter.Status))
		argIdx++
	}

	if filter.CategoryID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("bp.category_id = $%d", argIdx))
		args = append(args, filter.CategoryID)
		argIdx++
	}

	if filter.Tag != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("$%d = ANY(bp.tags)", argIdx))
		args = append(args, filter.Tag)
		argIdx++
	}

	if filter.Search != "" {
		pattern := "%" + strings.ToLower(filter.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(LOWER(bp.title) LIKE $%d OR LOWER(bp.excerpt) LIKE $%d OR LOWER(bp.focus_keyword) LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, pattern)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count total matching records
	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM blog_posts bp %s`, whereSQL)
	var totalCount int
	if err := db.QueryRowContext(ctx, countSQL, args...).Scan(&totalCount); err != nil {
		return nil, 0, fmt.Errorf("blog repo: failed to count posts: %w", err)
	}

	// Pagination limits
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 {
		filter.Limit = 10
	}
	offset := (filter.Page - 1) * filter.Limit

	querySQL := fmt.Sprintf(`
		SELECT bp.id, bp.category_id, bp.title, bp.slug, COALESCE(bp.excerpt, ''), bp.content,
		       COALESCE(bp.featured_image_url, ''), COALESCE(bp.featured_image_alt, ''),
		       bp.author_name, COALESCE(bp.author_avatar_url, ''), bp.status, bp.published_at,
		       bp.reading_time_minutes, bp.view_count, bp.tags,
		       COALESCE(bp.meta_title, ''), COALESCE(bp.meta_description, ''), COALESCE(bp.focus_keyword, ''),
		       bp.secondary_keywords, COALESCE(bp.canonical_url, ''), COALESCE(bp.meta_robots, 'index, follow'),
		       COALESCE(bp.og_title, ''), COALESCE(bp.og_description, ''), COALESCE(bp.og_image_url, ''),
		       COALESCE(bp.twitter_title, ''), COALESCE(bp.twitter_description, ''), COALESCE(bp.twitter_image_url, ''),
		       COALESCE(bp.schema_type, 'BlogPosting'), bp.seo_score, bp.seo_analysis,
		       bp.created_at, bp.updated_at,
		       COALESCE(bc.name, '') as category_name, COALESCE(bc.slug, '') as category_slug
		FROM blog_posts bp
		LEFT JOIN blog_categories bc ON bp.category_id = bc.id
		%s
		ORDER BY bp.published_at DESC NULLS LAST, bp.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, argIdx, argIdx+1)

	args = append(args, filter.Limit, offset)

	rows, err := db.QueryContext(ctx, querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("blog repo: failed to list posts: %w", err)
	}
	defer rows.Close()

	var posts []*BlogPost
	for rows.Next() {
		p, err := scanPost(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("blog repo: failed to scan post: %w", err)
		}
		posts = append(posts, p)
	}

	return posts, totalCount, nil
}

// GetPostByID retrieves a single article by its primary key ID.
func (r *PostgresRepository) GetPostByID(ctx context.Context, db *sql.DB, id string) (*BlogPost, error) {
	querySQL := `
		SELECT bp.id, bp.category_id, bp.title, bp.slug, COALESCE(bp.excerpt, ''), bp.content,
		       COALESCE(bp.featured_image_url, ''), COALESCE(bp.featured_image_alt, ''),
		       bp.author_name, COALESCE(bp.author_avatar_url, ''), bp.status, bp.published_at,
		       bp.reading_time_minutes, bp.view_count, bp.tags,
		       COALESCE(bp.meta_title, ''), COALESCE(bp.meta_description, ''), COALESCE(bp.focus_keyword, ''),
		       bp.secondary_keywords, COALESCE(bp.canonical_url, ''), COALESCE(bp.meta_robots, 'index, follow'),
		       COALESCE(bp.og_title, ''), COALESCE(bp.og_description, ''), COALESCE(bp.og_image_url, ''),
		       COALESCE(bp.twitter_title, ''), COALESCE(bp.twitter_description, ''), COALESCE(bp.twitter_image_url, ''),
		       COALESCE(bp.schema_type, 'BlogPosting'), bp.seo_score, bp.seo_analysis,
		       bp.created_at, bp.updated_at,
		       COALESCE(bc.name, '') as category_name, COALESCE(bc.slug, '') as category_slug
		FROM blog_posts bp
		LEFT JOIN blog_categories bc ON bp.category_id = bc.id
		WHERE bp.id = $1`

	row := db.QueryRowContext(ctx, querySQL, id)
	p, err := scanPost(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to get post by id: %w", err)
	}

	// Fetch linked products
	p.LinkedProductIDs, p.LinkedProducts, _ = r.getLinkedProducts(ctx, db, p.ID)

	return p, nil
}

// GetPostBySlug retrieves an article by its URL permalink slug.
func (r *PostgresRepository) GetPostBySlug(ctx context.Context, db *sql.DB, slug string) (*BlogPost, error) {
	querySQL := `
		SELECT bp.id, bp.category_id, bp.title, bp.slug, COALESCE(bp.excerpt, ''), bp.content,
		       COALESCE(bp.featured_image_url, ''), COALESCE(bp.featured_image_alt, ''),
		       bp.author_name, COALESCE(bp.author_avatar_url, ''), bp.status, bp.published_at,
		       bp.reading_time_minutes, bp.view_count, bp.tags,
		       COALESCE(bp.meta_title, ''), COALESCE(bp.meta_description, ''), COALESCE(bp.focus_keyword, ''),
		       bp.secondary_keywords, COALESCE(bp.canonical_url, ''), COALESCE(bp.meta_robots, 'index, follow'),
		       COALESCE(bp.og_title, ''), COALESCE(bp.og_description, ''), COALESCE(bp.og_image_url, ''),
		       COALESCE(bp.twitter_title, ''), COALESCE(bp.twitter_description, ''), COALESCE(bp.twitter_image_url, ''),
		       COALESCE(bp.schema_type, 'BlogPosting'), bp.seo_score, bp.seo_analysis,
		       bp.created_at, bp.updated_at,
		       COALESCE(bc.name, '') as category_name, COALESCE(bc.slug, '') as category_slug
		FROM blog_posts bp
		LEFT JOIN blog_categories bc ON bp.category_id = bc.id
		WHERE bp.slug = $1`

	row := db.QueryRowContext(ctx, querySQL, slug)
	p, err := scanPost(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to get post by slug: %w", err)
	}

	p.LinkedProductIDs, p.LinkedProducts, _ = r.getLinkedProducts(ctx, db, p.ID)
	p.RelatedPosts, _ = r.getRelatedPosts(ctx, db, p.ID, p.CategoryID)

	return p, nil
}

// CreatePost creates a new blog post and binds any associated product references.
func (r *PostgresRepository) CreatePost(ctx context.Context, db *sql.DB, post *BlogPost, productIDs []string) (*BlogPost, error) {
	analysisJSON, err := json.Marshal(post.SEOAnalysis)
	if err != nil {
		analysisJSON = []byte("{}")
	}

	querySQL := `
		INSERT INTO blog_posts (
			category_id, title, slug, excerpt, content,
			featured_image_url, featured_image_alt, author_name, author_avatar_url,
			status, published_at, reading_time_minutes, view_count, tags,
			meta_title, meta_description, focus_keyword, secondary_keywords,
			canonical_url, meta_robots, og_title, og_description, og_image_url,
			twitter_title, twitter_description, twitter_image_url, schema_type,
			seo_score, seo_analysis
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13, $14,
			$15, $16, $17, $18,
			$19, $20, $21, $22, $23,
			$24, $25, $26, $27,
			$28, $29
		)
		RETURNING id, created_at, updated_at`

	err = db.QueryRowContext(ctx, querySQL,
		post.CategoryID, post.Title, post.Slug, post.Excerpt, post.Content,
		post.FeaturedImageURL, post.FeaturedImageAlt, post.AuthorName, post.AuthorAvatarURL,
		post.Status, post.PublishedAt, post.ReadingTimeMinutes, post.ViewCount, pq.Array(post.Tags),
		post.MetaTitle, post.MetaDescription, post.FocusKeyword, pq.Array(post.SecondaryKeywords),
		post.CanonicalURL, post.MetaRobots, post.OGTitle, post.OGDescription, post.OGImageURL,
		post.TwitterTitle, post.TwitterDescription, post.TwitterImageURL, post.SchemaType,
		post.SEOScore, analysisJSON,
	).Scan(&post.ID, &post.CreatedAt, &post.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to create post: %w", err)
	}

	// Link products if provided
	if len(productIDs) > 0 {
		_ = r.syncLinkedProducts(ctx, db, post.ID, productIDs)
		post.LinkedProductIDs = productIDs
	}

	return post, nil
}

// UpdatePost updates all attributes of an existing blog post and synchronizes product links.
func (r *PostgresRepository) UpdatePost(ctx context.Context, db *sql.DB, post *BlogPost, productIDs []string) (*BlogPost, error) {
	analysisJSON, err := json.Marshal(post.SEOAnalysis)
	if err != nil {
		analysisJSON = []byte("{}")
	}

	querySQL := `
		UPDATE blog_posts SET
			category_id = $1, title = $2, slug = $3, excerpt = $4, content = $5,
			featured_image_url = $6, featured_image_alt = $7, author_name = $8, author_avatar_url = $9,
			status = $10, published_at = $11, reading_time_minutes = $12, tags = $13,
			meta_title = $14, meta_description = $15, focus_keyword = $16, secondary_keywords = $17,
			canonical_url = $18, meta_robots = $19, og_title = $20, og_description = $21, og_image_url = $22,
			twitter_title = $23, twitter_description = $24, twitter_image_url = $25, schema_type = $26,
			seo_score = $27, seo_analysis = $28, updated_at = CURRENT_TIMESTAMP
		WHERE id = $29
		RETURNING updated_at`

	err = db.QueryRowContext(ctx, querySQL,
		post.CategoryID, post.Title, post.Slug, post.Excerpt, post.Content,
		post.FeaturedImageURL, post.FeaturedImageAlt, post.AuthorName, post.AuthorAvatarURL,
		post.Status, post.PublishedAt, post.ReadingTimeMinutes, pq.Array(post.Tags),
		post.MetaTitle, post.MetaDescription, post.FocusKeyword, pq.Array(post.SecondaryKeywords),
		post.CanonicalURL, post.MetaRobots, post.OGTitle, post.OGDescription, post.OGImageURL,
		post.TwitterTitle, post.TwitterDescription, post.TwitterImageURL, post.SchemaType,
		post.SEOScore, analysisJSON, post.ID,
	).Scan(&post.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to update post: %w", err)
	}

	_ = r.syncLinkedProducts(ctx, db, post.ID, productIDs)
	post.LinkedProductIDs = productIDs

	return post, nil
}

// UpdatePostStatus executes a fast state transition (e.g. DRAFT -> PUBLISHED).
func (r *PostgresRepository) UpdatePostStatus(ctx context.Context, db *sql.DB, id string, status PostStatus) error {
	var pubSQL string
	if status == StatusPublished {
		pubSQL = ", published_at = COALESCE(published_at, CURRENT_TIMESTAMP)"
	}

	querySQL := fmt.Sprintf(`
		UPDATE blog_posts
		SET status = $1, updated_at = CURRENT_TIMESTAMP %s
		WHERE id = $2`, pubSQL)

	res, err := db.ExecContext(ctx, querySQL, string(status), id)
	if err != nil {
		return fmt.Errorf("blog repo: failed to update post status: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrPostNotFound
	}
	return nil
}

// IncrementViewCount increments the view count for an article.
func (r *PostgresRepository) IncrementViewCount(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`, id)
	return err
}

// DeletePost removes an article and associated references.
func (r *PostgresRepository) DeletePost(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM blog_posts WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("blog repo: failed to delete post: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrPostNotFound
	}
	return nil
}

// ======================== CATEGORY CRUD ========================

// ListCategories returns all categories, optionally filtered to active only, with article counts.
func (r *PostgresRepository) ListCategories(ctx context.Context, db *sql.DB, activeOnly bool) ([]*BlogCategory, error) {
	whereSQL := ""
	if activeOnly {
		whereSQL = "WHERE bc.is_active = TRUE"
	}

	querySQL := fmt.Sprintf(`
		SELECT bc.id, bc.name, bc.slug, COALESCE(bc.description, ''),
		       COALESCE(bc.meta_title, ''), COALESCE(bc.meta_description, ''),
		       bc.display_order, bc.is_active, bc.created_at, bc.updated_at,
		       (SELECT COUNT(*) FROM blog_posts bp WHERE bp.category_id = bc.id AND bp.status = 'PUBLISHED') as post_count
		FROM blog_categories bc
		%s
		ORDER BY bc.display_order ASC, bc.name ASC`, whereSQL)

	rows, err := db.QueryContext(ctx, querySQL)
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to list categories: %w", err)
	}
	defer rows.Close()

	var categories []*BlogCategory
	for rows.Next() {
		c := &BlogCategory{}
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.Description,
			&c.MetaTitle, &c.MetaDescription, &c.DisplayOrder, &c.IsActive,
			&c.CreatedAt, &c.UpdatedAt, &c.PostCount,
		); err != nil {
			return nil, fmt.Errorf("blog repo: failed to scan category: %w", err)
		}
		categories = append(categories, c)
	}

	return categories, nil
}

// GetCategoryByID retrieves a category by ID.
func (r *PostgresRepository) GetCategoryByID(ctx context.Context, db *sql.DB, id string) (*BlogCategory, error) {
	querySQL := `
		SELECT bc.id, bc.name, bc.slug, COALESCE(bc.description, ''),
		       COALESCE(bc.meta_title, ''), COALESCE(bc.meta_description, ''),
		       bc.display_order, bc.is_active, bc.created_at, bc.updated_at,
		       (SELECT COUNT(*) FROM blog_posts bp WHERE bp.category_id = bc.id AND bp.status = 'PUBLISHED') as post_count
		FROM blog_categories bc
		WHERE bc.id = $1`

	c := &BlogCategory{}
	err := db.QueryRowContext(ctx, querySQL, id).Scan(
		&c.ID, &c.Name, &c.Slug, &c.Description,
		&c.MetaTitle, &c.MetaDescription, &c.DisplayOrder, &c.IsActive,
		&c.CreatedAt, &c.UpdatedAt, &c.PostCount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCategoryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to get category: %w", err)
	}
	return c, nil
}

// GetCategoryBySlug retrieves a category by its slug.
func (r *PostgresRepository) GetCategoryBySlug(ctx context.Context, db *sql.DB, slug string) (*BlogCategory, error) {
	querySQL := `
		SELECT bc.id, bc.name, bc.slug, COALESCE(bc.description, ''),
		       COALESCE(bc.meta_title, ''), COALESCE(bc.meta_description, ''),
		       bc.display_order, bc.is_active, bc.created_at, bc.updated_at,
		       (SELECT COUNT(*) FROM blog_posts bp WHERE bp.category_id = bc.id AND bp.status = 'PUBLISHED') as post_count
		FROM blog_categories bc
		WHERE bc.slug = $1`

	c := &BlogCategory{}
	err := db.QueryRowContext(ctx, querySQL, slug).Scan(
		&c.ID, &c.Name, &c.Slug, &c.Description,
		&c.MetaTitle, &c.MetaDescription, &c.DisplayOrder, &c.IsActive,
		&c.CreatedAt, &c.UpdatedAt, &c.PostCount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCategoryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to get category by slug: %w", err)
	}
	return c, nil
}

// CreateCategory adds a new blog taxonomy category.
func (r *PostgresRepository) CreateCategory(ctx context.Context, db *sql.DB, category *BlogCategory) (*BlogCategory, error) {
	querySQL := `
		INSERT INTO blog_categories (name, slug, description, meta_title, meta_description, display_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	err := db.QueryRowContext(ctx, querySQL,
		category.Name, category.Slug, category.Description,
		category.MetaTitle, category.MetaDescription, category.DisplayOrder, category.IsActive,
	).Scan(&category.ID, &category.CreatedAt, &category.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to create category: %w", err)
	}
	return category, nil
}

// UpdateCategory updates an existing blog category.
func (r *PostgresRepository) UpdateCategory(ctx context.Context, db *sql.DB, category *BlogCategory) (*BlogCategory, error) {
	querySQL := `
		UPDATE blog_categories
		SET name = $1, slug = $2, description = $3, meta_title = $4, meta_description = $5,
		    display_order = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
		WHERE id = $8
		RETURNING updated_at`

	err := db.QueryRowContext(ctx, querySQL,
		category.Name, category.Slug, category.Description, category.MetaTitle, category.MetaDescription,
		category.DisplayOrder, category.IsActive, category.ID,
	).Scan(&category.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCategoryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to update category: %w", err)
	}
	return category, nil
}

// DeleteCategory deletes a category.
func (r *PostgresRepository) DeleteCategory(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM blog_categories WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("blog repo: failed to delete category: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrCategoryNotFound
	}
	return nil
}

// ListSitemapItems retrieves all published article slugs and modification timestamps.
func (r *PostgresRepository) ListSitemapItems(ctx context.Context, db *sql.DB) ([]SitemapItem, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT slug, updated_at
		FROM blog_posts
		WHERE status = 'PUBLISHED'
		ORDER BY updated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("blog repo: failed to list sitemap items: %w", err)
	}
	defer rows.Close()

	var items []SitemapItem
	for rows.Next() {
		var slug string
		var updated time.Time
		if err := rows.Scan(&slug, &updated); err != nil {
			continue
		}
		items = append(items, SitemapItem{
			Loc:        "/blog/" + slug,
			LastMod:    updated,
			ChangeFreq: "weekly",
			Priority:   0.8,
		})
	}
	return items, nil
}

// ======================== HELPERS ========================

type scannable interface {
	Scan(dest ...interface{}) error
}

func scanPost(s scannable) (*BlogPost, error) {
	p := &BlogPost{}
	var analysisRaw []byte
	var tags pq.StringArray
	var secKeywords pq.StringArray

	err := s.Scan(
		&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Excerpt, &p.Content,
		&p.FeaturedImageURL, &p.FeaturedImageAlt, &p.AuthorName, &p.AuthorAvatarURL,
		&p.Status, &p.PublishedAt, &p.ReadingTimeMinutes, &p.ViewCount, &tags,
		&p.MetaTitle, &p.MetaDescription, &p.FocusKeyword, &secKeywords,
		&p.CanonicalURL, &p.MetaRobots, &p.OGTitle, &p.OGDescription, &p.OGImageURL,
		&p.TwitterTitle, &p.TwitterDescription, &p.TwitterImageURL, &p.SchemaType,
		&p.SEOScore, &analysisRaw, &p.CreatedAt, &p.UpdatedAt,
		&p.CategoryName, &p.CategorySlug,
	)
	if err != nil {
		return nil, err
	}

	p.Tags = []string(tags)
	p.SecondaryKeywords = []string(secKeywords)
	if len(analysisRaw) > 0 {
		_ = json.Unmarshal(analysisRaw, &p.SEOAnalysis)
	}

	return p, nil
}

func (r *PostgresRepository) getLinkedProducts(ctx context.Context, db *sql.DB, postID string) ([]string, []LinkedProductSummary, error) {
	querySQL := `
		SELECT p.id, p.title, p.slug, p.base_price,
		       COALESCE((SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1), '') as image
		FROM blog_post_products bpp
		JOIN products p ON bpp.product_id = p.id
		WHERE bpp.post_id = $1
		ORDER BY bpp.display_order ASC`

	rows, err := db.QueryContext(ctx, querySQL, postID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var ids []string
	var summaries []LinkedProductSummary
	for rows.Next() {
		var s LinkedProductSummary
		if err := rows.Scan(&s.ID, &s.Title, &s.Slug, &s.BasePrice, &s.FeaturedImage); err == nil {
			s.Currency = "BDT"
			ids = append(ids, s.ID)
			summaries = append(summaries, s)
		}
	}
	return ids, summaries, nil
}

func (r *PostgresRepository) syncLinkedProducts(ctx context.Context, db *sql.DB, postID string, productIDs []string) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM blog_post_products WHERE post_id = $1`, postID)
	if len(productIDs) == 0 {
		return nil
	}

	stmt, err := db.PrepareContext(ctx, `
		INSERT INTO blog_post_products (post_id, product_id, display_order)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for idx, prodID := range productIDs {
		_, _ = stmt.ExecContext(ctx, postID, prodID, idx+1)
	}
	return nil
}

func (r *PostgresRepository) getRelatedPosts(ctx context.Context, db *sql.DB, excludeID string, categoryID *string) ([]RelatedPostSummary, error) {
	querySQL := `
		SELECT bp.id, bp.title, bp.slug, COALESCE(bp.excerpt, ''),
		       COALESCE(bp.featured_image_url, ''), COALESCE(bp.featured_image_alt, ''),
		       COALESCE(bc.name, ''), bp.reading_time_minutes, bp.published_at
		FROM blog_posts bp
		LEFT JOIN blog_categories bc ON bp.category_id = bc.id
		WHERE bp.status = 'PUBLISHED' AND bp.id != $1
		ORDER BY (CASE WHEN bp.category_id = $2 THEN 0 ELSE 1 END), bp.published_at DESC
		LIMIT 3`

	var catArg interface{}
	if categoryID != nil {
		catArg = *categoryID
	}

	rows, err := db.QueryContext(ctx, querySQL, excludeID, catArg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var related []RelatedPostSummary
	for rows.Next() {
		var s RelatedPostSummary
		if err := rows.Scan(
			&s.ID, &s.Title, &s.Slug, &s.Excerpt,
			&s.FeaturedImageURL, &s.FeaturedImageAlt,
			&s.CategoryName, &s.ReadingTimeMinutes, &s.PublishedAt,
		); err == nil {
			related = append(related, s)
		}
	}
	return related, nil
}
