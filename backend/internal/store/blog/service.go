package blog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrTitleRequired = errors.New("blog: title is required")
)

// Service coordinates business logic, SEO validation, and repository persistence.
type Service struct {
	repo Repository
}

// NewService instantiates the Blog Service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListPosts handles administrative querying of blog posts with filters.
func (s *Service) ListPosts(ctx context.Context, db *sql.DB, filter PostFilter) ([]*BlogPost, int, error) {
	return s.repo.ListPosts(ctx, db, filter)
}

// GetPost retrieves a full blog post by ID for store operators.
func (s *Service) GetPost(ctx context.Context, db *sql.DB, id string) (*BlogPost, error) {
	return s.repo.GetPostByID(ctx, db, id)
}

// CreatePost prepares, calculates SEO metrics, and persists a new blog article.
func (s *Service) CreatePost(ctx context.Context, db *sql.DB, req *CreatePostRequest) (*BlogPost, error) {
	if strings.TrimSpace(req.Title) == "" {
		return nil, ErrTitleRequired
	}

	slug := req.Slug
	if strings.TrimSpace(slug) == "" {
		slug = Slugify(req.Title)
	} else {
		slug = Slugify(slug)
	}

	status := req.Status
	if status == "" {
		status = StatusDraft
	}

	var pubAt *time.Time
	if req.PublishedAt != nil {
		pubAt = req.PublishedAt
	} else if status == StatusPublished {
		now := time.Now().UTC()
		pubAt = &now
	}

	authorName := strings.TrimSpace(req.AuthorName)
	if authorName == "" {
		authorName = "Editorial Team"
	}

	post := &BlogPost{
		CategoryID:         req.CategoryID,
		Title:              strings.TrimSpace(req.Title),
		Slug:               slug,
		Excerpt:            strings.TrimSpace(req.Excerpt),
		Content:            req.Content,
		FeaturedImageURL:   strings.TrimSpace(req.FeaturedImageURL),
		FeaturedImageAlt:   strings.TrimSpace(req.FeaturedImageAlt),
		AuthorName:         authorName,
		AuthorAvatarURL:    strings.TrimSpace(req.AuthorAvatarURL),
		Status:             status,
		PublishedAt:        pubAt,
		Tags:               req.Tags,
		MetaTitle:          strings.TrimSpace(req.MetaTitle),
		MetaDescription:    strings.TrimSpace(req.MetaDescription),
		FocusKeyword:       strings.TrimSpace(req.FocusKeyword),
		SecondaryKeywords:  req.SecondaryKeywords,
		CanonicalURL:       strings.TrimSpace(req.CanonicalURL),
		MetaRobots:         strings.TrimSpace(req.MetaRobots),
		OGTitle:            strings.TrimSpace(req.OGTitle),
		OGDescription:      strings.TrimSpace(req.OGDescription),
		OGImageURL:         strings.TrimSpace(req.OGImageURL),
		TwitterTitle:       strings.TrimSpace(req.TwitterTitle),
		TwitterDescription: strings.TrimSpace(req.TwitterDescription),
		TwitterImageURL:    strings.TrimSpace(req.TwitterImageURL),
		SchemaType:         strings.TrimSpace(req.SchemaType),
	}

	s.applySEODefaults(post)

	// Run complete 100% SEO analysis
	analysis := CalculateSEOAnalysis(post)
	post.SEOAnalysis = analysis
	post.SEOScore = analysis.Score
	post.ReadingTimeMinutes = analysis.ReadingTime

	return s.repo.CreatePost(ctx, db, post, req.LinkedProductIDs)
}

// UpdatePost modifies and recalculates SEO scores for an existing blog article.
func (s *Service) UpdatePost(ctx context.Context, db *sql.DB, id string, req *UpdatePostRequest) (*BlogPost, error) {
	if strings.TrimSpace(req.Title) == "" {
		return nil, ErrTitleRequired
	}

	existing, err := s.repo.GetPostByID(ctx, db, id)
	if err != nil {
		return nil, err
	}

	slug := req.Slug
	if strings.TrimSpace(slug) == "" {
		slug = existing.Slug
	} else {
		slug = Slugify(slug)
	}

	status := req.Status
	if status == "" {
		status = existing.Status
	}

	var pubAt = req.PublishedAt
	if pubAt == nil && existing.PublishedAt != nil {
		pubAt = existing.PublishedAt
	} else if pubAt == nil && status == StatusPublished {
		now := time.Now().UTC()
		pubAt = &now
	}

	authorName := strings.TrimSpace(req.AuthorName)
	if authorName == "" {
		authorName = existing.AuthorName
	}

	existing.CategoryID = req.CategoryID
	existing.Title = strings.TrimSpace(req.Title)
	existing.Slug = slug
	existing.Excerpt = strings.TrimSpace(req.Excerpt)
	existing.Content = req.Content
	existing.FeaturedImageURL = strings.TrimSpace(req.FeaturedImageURL)
	existing.FeaturedImageAlt = strings.TrimSpace(req.FeaturedImageAlt)
	existing.AuthorName = authorName
	existing.AuthorAvatarURL = strings.TrimSpace(req.AuthorAvatarURL)
	existing.Status = status
	existing.PublishedAt = pubAt
	existing.Tags = req.Tags
	existing.MetaTitle = strings.TrimSpace(req.MetaTitle)
	existing.MetaDescription = strings.TrimSpace(req.MetaDescription)
	existing.FocusKeyword = strings.TrimSpace(req.FocusKeyword)
	existing.SecondaryKeywords = req.SecondaryKeywords
	existing.CanonicalURL = strings.TrimSpace(req.CanonicalURL)
	existing.MetaRobots = strings.TrimSpace(req.MetaRobots)
	existing.OGTitle = strings.TrimSpace(req.OGTitle)
	existing.OGDescription = strings.TrimSpace(req.OGDescription)
	existing.OGImageURL = strings.TrimSpace(req.OGImageURL)
	existing.TwitterTitle = strings.TrimSpace(req.TwitterTitle)
	existing.TwitterDescription = strings.TrimSpace(req.TwitterDescription)
	existing.TwitterImageURL = strings.TrimSpace(req.TwitterImageURL)
	existing.SchemaType = strings.TrimSpace(req.SchemaType)

	s.applySEODefaults(existing)

	analysis := CalculateSEOAnalysis(existing)
	existing.SEOAnalysis = analysis
	existing.SEOScore = analysis.Score
	existing.ReadingTimeMinutes = analysis.ReadingTime

	return s.repo.UpdatePost(ctx, db, existing, req.LinkedProductIDs)
}

// UpdatePostStatus quickly updates status (e.g. Publish / Draft).
func (s *Service) UpdatePostStatus(ctx context.Context, db *sql.DB, id string, status PostStatus) error {
	return s.repo.UpdatePostStatus(ctx, db, id, status)
}

// DeletePost removes an article by ID.
func (s *Service) DeletePost(ctx context.Context, db *sql.DB, id string) error {
	return s.repo.DeletePost(ctx, db, id)
}

// ======================== CATEGORY OPERATIONS ========================

// ListCategories returns all categories.
func (s *Service) ListCategories(ctx context.Context, db *sql.DB, activeOnly bool) ([]*BlogCategory, error) {
	return s.repo.ListCategories(ctx, db, activeOnly)
}

// GetCategory retrieves a category by ID.
func (s *Service) GetCategory(ctx context.Context, db *sql.DB, id string) (*BlogCategory, error) {
	return s.repo.GetCategoryByID(ctx, db, id)
}

// CreateCategory adds a category with slug sanitation.
func (s *Service) CreateCategory(ctx context.Context, db *sql.DB, req *CreateCategoryRequest) (*BlogCategory, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("blog: category name is required")
	}

	slug := req.Slug
	if strings.TrimSpace(slug) == "" {
		slug = Slugify(name)
	} else {
		slug = Slugify(slug)
	}

	cat := &BlogCategory{
		Name:            name,
		Slug:            slug,
		Description:     strings.TrimSpace(req.Description),
		MetaTitle:       strings.TrimSpace(req.MetaTitle),
		MetaDescription: strings.TrimSpace(req.MetaDescription),
		DisplayOrder:    req.DisplayOrder,
		IsActive:        req.IsActive,
	}

	if cat.MetaTitle == "" {
		cat.MetaTitle = fmt.Sprintf("%s | Blog Category", cat.Name)
	}
	if cat.MetaDescription == "" && cat.Description != "" {
		cat.MetaDescription = cat.Description
	}

	return s.repo.CreateCategory(ctx, db, cat)
}

// UpdateCategory modifies an existing category.
func (s *Service) UpdateCategory(ctx context.Context, db *sql.DB, id string, req *UpdateCategoryRequest) (*BlogCategory, error) {
	cat, err := s.repo.GetCategoryByID(ctx, db, id)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("blog: category name is required")
	}

	slug := req.Slug
	if strings.TrimSpace(slug) == "" {
		slug = cat.Slug
	} else {
		slug = Slugify(slug)
	}

	cat.Name = name
	cat.Slug = slug
	cat.Description = strings.TrimSpace(req.Description)
	cat.MetaTitle = strings.TrimSpace(req.MetaTitle)
	cat.MetaDescription = strings.TrimSpace(req.MetaDescription)
	cat.DisplayOrder = req.DisplayOrder
	cat.IsActive = req.IsActive

	if cat.MetaTitle == "" {
		cat.MetaTitle = fmt.Sprintf("%s | Blog Category", cat.Name)
	}
	if cat.MetaDescription == "" && cat.Description != "" {
		cat.MetaDescription = cat.Description
	}

	return s.repo.UpdateCategory(ctx, db, cat)
}

// DeleteCategory removes a category.
func (s *Service) DeleteCategory(ctx context.Context, db *sql.DB, id string) error {
	return s.repo.DeleteCategory(ctx, db, id)
}

// ======================== PUBLIC STOREFRONT OPERATIONS ========================

// StorefrontListPosts returns paginated published articles.
func (s *Service) StorefrontListPosts(ctx context.Context, db *sql.DB, categorySlug, tag, search string, page, limit int) ([]*BlogPost, int, error) {
	st := StatusPublished
	filter := PostFilter{
		Status: &st,
		Tag:    tag,
		Search: search,
		Page:   page,
		Limit:  limit,
	}

	if categorySlug != "" {
		cat, err := s.repo.GetCategoryBySlug(ctx, db, categorySlug)
		if err == nil && cat != nil {
			filter.CategoryID = cat.ID
		}
	}

	return s.repo.ListPosts(ctx, db, filter)
}

// StorefrontGetPostBySlug retrieves a published article, attaches Schema.org JSON-LD and Breadcrumbs, and increments view count.
func (s *Service) StorefrontGetPostBySlug(ctx context.Context, db *sql.DB, slug, storeName, siteURL string) (*BlogPost, error) {
	post, err := s.repo.GetPostBySlug(ctx, db, slug)
	if err != nil {
		return nil, err
	}

	if post.Status != StatusPublished {
		return nil, ErrPostNotFound
	}

	// Generate 100% SEO Rich Snippets
	post.SchemaJSONLD = GenerateSchemaOrgJSONLD(post, storeName, siteURL)
	post.BreadcrumbsJSONLD = GenerateBreadcrumbsJSONLD(post, storeName, siteURL)

	// Asynchronously increment views
	go func(postID string) {
		_ = s.repo.IncrementViewCount(context.Background(), db, postID)
	}(post.ID)

	return post, nil
}

// StorefrontSitemap returns all published blog items for XML sitemaps.
func (s *Service) StorefrontSitemap(ctx context.Context, db *sql.DB) ([]SitemapItem, error) {
	return s.repo.ListSitemapItems(ctx, db)
}

// LiveAnalyzeSEO evaluates draft text for instant feedback in the admin UI without saving.
func (s *Service) LiveAnalyzeSEO(req *CreatePostRequest) SEOAnalysis {
	post := &BlogPost{
		Title:            req.Title,
		Slug:             req.Slug,
		Content:          req.Content,
		MetaTitle:        req.MetaTitle,
		MetaDescription:  req.MetaDescription,
		FocusKeyword:     req.FocusKeyword,
		FeaturedImageAlt: req.FeaturedImageAlt,
	}
	s.applySEODefaults(post)
	return CalculateSEOAnalysis(post)
}

func (s *Service) applySEODefaults(post *BlogPost) {
	if post.MetaTitle == "" {
		post.MetaTitle = post.Title
	}
	if post.MetaDescription == "" && post.Excerpt != "" {
		post.MetaDescription = post.Excerpt
	}
	if post.MetaRobots == "" {
		post.MetaRobots = "index, follow"
	}
	if post.OGTitle == "" {
		post.OGTitle = post.MetaTitle
	}
	if post.OGDescription == "" {
		post.OGDescription = post.MetaDescription
	}
	if post.OGImageURL == "" && post.FeaturedImageURL != "" {
		post.OGImageURL = post.FeaturedImageURL
	}
	if post.TwitterTitle == "" {
		post.TwitterTitle = post.OGTitle
	}
	if post.TwitterDescription == "" {
		post.TwitterDescription = post.OGDescription
	}
	if post.TwitterImageURL == "" {
		post.TwitterImageURL = post.OGImageURL
	}
	if post.SchemaType == "" {
		post.SchemaType = "BlogPosting"
	}
}
