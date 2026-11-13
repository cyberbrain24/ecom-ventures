// Package blog implements the tenant-isolated 100% SEO-focused Blog & Editorial Content Subsystem.
package blog

import (
	"time"
)

// PostStatus represents the lifecycle state of a blog post.
type PostStatus string

const (
	StatusDraft     PostStatus = "DRAFT"
	StatusPublished PostStatus = "PUBLISHED"
	StatusScheduled PostStatus = "SCHEDULED"
	StatusArchived  PostStatus = "ARCHIVED"
)

// BlogCategory models a thematic taxonomy partition for blog posts.
type BlogCategory struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	Description     string    `json:"description"`
	MetaTitle       string    `json:"meta_title"`
	MetaDescription string    `json:"meta_description"`
	DisplayOrder    int       `json:"display_order"`
	IsActive        bool      `json:"is_active"`
	PostCount       int       `json:"post_count,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// BlogPost models a blog article with complete 100% SEO metadata in the dedicated tenant database.
type BlogPost struct {
	ID                 string     `json:"id"`
	CategoryID         *string    `json:"category_id,omitempty"`
	Title              string     `json:"title"`
	Slug               string     `json:"slug"`
	Excerpt            string     `json:"excerpt"`
	Content            string     `json:"content"`
	FeaturedImageURL   string     `json:"featured_image_url"`
	FeaturedImageAlt   string     `json:"featured_image_alt"`
	AuthorName         string     `json:"author_name"`
	AuthorAvatarURL    string     `json:"author_avatar_url"`
	Status             PostStatus `json:"status"`
	PublishedAt        *time.Time `json:"published_at,omitempty"`
	ReadingTimeMinutes int        `json:"reading_time_minutes"`
	ViewCount          int        `json:"view_count"`
	Tags               []string   `json:"tags"`

	// 100% SEO Engine Fields
	MetaTitle          string      `json:"meta_title"`
	MetaDescription    string      `json:"meta_description"`
	FocusKeyword       string      `json:"focus_keyword"`
	SecondaryKeywords  []string    `json:"secondary_keywords"`
	CanonicalURL       string      `json:"canonical_url"`
	MetaRobots         string      `json:"meta_robots"`
	OGTitle            string      `json:"og_title"`
	OGDescription      string      `json:"og_description"`
	OGImageURL         string      `json:"og_image_url"`
	TwitterTitle       string      `json:"twitter_title"`
	TwitterDescription string      `json:"twitter_description"`
	TwitterImageURL    string      `json:"twitter_image_url"`
	SchemaType         string      `json:"schema_type"`
	SEOScore           int         `json:"seo_score"`
	SEOAnalysis        SEOAnalysis `json:"seo_analysis"`

	// Joined Relations & Computed Metadata
	CategoryName      string                 `json:"category_name,omitempty"`
	CategorySlug      string                 `json:"category_slug,omitempty"`
	LinkedProductIDs  []string               `json:"linked_product_ids,omitempty"`
	LinkedProducts    []LinkedProductSummary `json:"linked_products,omitempty"`
	RelatedPosts      []RelatedPostSummary   `json:"related_posts,omitempty"`
	SchemaJSONLD      map[string]interface{} `json:"schema_json_ld,omitempty"`
	BreadcrumbsJSONLD map[string]interface{} `json:"breadcrumbs_json_ld,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SEOAnalysis captures real-time search engine optimization metrics and checks.
type SEOAnalysis struct {
	Score                 int      `json:"score"`
	TitleLength           int      `json:"title_length"`
	TitleStatus           string   `json:"title_status"` // "GOOD", "TOO_SHORT", "TOO_LONG"
	MetaDescriptionLength int      `json:"meta_description_length"`
	MetaDescStatus        string   `json:"meta_desc_status"` // "GOOD", "TOO_SHORT", "TOO_LONG"
	FocusKeywordInTitle   bool     `json:"focus_keyword_in_title"`
	FocusKeywordInMeta    bool     `json:"focus_keyword_in_meta"`
	FocusKeywordInSlug    bool     `json:"focus_keyword_in_slug"`
	FocusKeywordInContent bool     `json:"focus_keyword_in_content"`
	HasFeaturedImageAlt   bool     `json:"has_featured_image_alt"`
	WordCount             int      `json:"word_count"`
	ReadingTime           int      `json:"reading_time"`
	Recommendations       []string `json:"recommendations"`
}

// LinkedProductSummary models an e-commerce product linked inside an editorial article.
type LinkedProductSummary struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Slug          string  `json:"slug"`
	BasePrice     float64 `json:"base_price"`
	Currency      string  `json:"currency"`
	FeaturedImage string  `json:"featured_image"`
}

// RelatedPostSummary models a lightweight preview of related articles.
type RelatedPostSummary struct {
	ID                 string     `json:"id"`
	Title              string     `json:"title"`
	Slug               string     `json:"slug"`
	Excerpt            string     `json:"excerpt"`
	FeaturedImageURL   string     `json:"featured_image_url"`
	FeaturedImageAlt   string     `json:"featured_image_alt"`
	CategoryName       string     `json:"category_name"`
	ReadingTimeMinutes int        `json:"reading_time_minutes"`
	PublishedAt        *time.Time `json:"published_at,omitempty"`
}

// SitemapItem models a URL entry for search engine discovery and sitemaps.
type SitemapItem struct {
	Loc        string    `json:"loc"`
	LastMod    time.Time `json:"lastmod"`
	ChangeFreq string    `json:"changefreq"`
	Priority   float64   `json:"priority"`
}

// PostFilter encapsulates search, taxonomy, and pagination parameters.
type PostFilter struct {
	Search     string
	CategoryID string
	Status     *PostStatus
	Tag        string
	Page       int
	Limit      int
}

// CreatePostRequest encapsulates the input payload to author a new article.
type CreatePostRequest struct {
	CategoryID         *string    `json:"category_id"`
	Title              string     `json:"title"`
	Slug               string     `json:"slug"`
	Excerpt            string     `json:"excerpt"`
	Content            string     `json:"content"`
	FeaturedImageURL   string     `json:"featured_image_url"`
	FeaturedImageAlt   string     `json:"featured_image_alt"`
	AuthorName         string     `json:"author_name"`
	AuthorAvatarURL    string     `json:"author_avatar_url"`
	Status             PostStatus `json:"status"`
	PublishedAt        *time.Time `json:"published_at"`
	Tags               []string   `json:"tags"`
	MetaTitle          string     `json:"meta_title"`
	MetaDescription    string     `json:"meta_description"`
	FocusKeyword       string     `json:"focus_keyword"`
	SecondaryKeywords  []string   `json:"secondary_keywords"`
	CanonicalURL       string     `json:"canonical_url"`
	MetaRobots         string     `json:"meta_robots"`
	OGTitle            string     `json:"og_title"`
	OGDescription      string     `json:"og_description"`
	OGImageURL         string     `json:"og_image_url"`
	TwitterTitle       string     `json:"twitter_title"`
	TwitterDescription string     `json:"twitter_description"`
	TwitterImageURL    string     `json:"twitter_image_url"`
	SchemaType         string     `json:"schema_type"`
	LinkedProductIDs   []string   `json:"linked_product_ids"`
}

// UpdatePostRequest encapsulates the input payload to update an existing article.
type UpdatePostRequest struct {
	CategoryID         *string    `json:"category_id"`
	Title              string     `json:"title"`
	Slug               string     `json:"slug"`
	Excerpt            string     `json:"excerpt"`
	Content            string     `json:"content"`
	FeaturedImageURL   string     `json:"featured_image_url"`
	FeaturedImageAlt   string     `json:"featured_image_alt"`
	AuthorName         string     `json:"author_name"`
	AuthorAvatarURL    string     `json:"author_avatar_url"`
	Status             PostStatus `json:"status"`
	PublishedAt        *time.Time `json:"published_at"`
	Tags               []string   `json:"tags"`
	MetaTitle          string     `json:"meta_title"`
	MetaDescription    string     `json:"meta_description"`
	FocusKeyword       string     `json:"focus_keyword"`
	SecondaryKeywords  []string   `json:"secondary_keywords"`
	CanonicalURL       string     `json:"canonical_url"`
	MetaRobots         string     `json:"meta_robots"`
	OGTitle            string     `json:"og_title"`
	OGDescription      string     `json:"og_description"`
	OGImageURL         string     `json:"og_image_url"`
	TwitterTitle       string     `json:"twitter_title"`
	TwitterDescription string     `json:"twitter_description"`
	TwitterImageURL    string     `json:"twitter_image_url"`
	SchemaType         string     `json:"schema_type"`
	LinkedProductIDs   []string   `json:"linked_product_ids"`
}

// CreateCategoryRequest models input to register a blog taxonomy partition.
type CreateCategoryRequest struct {
	Name            string `json:"name"`
	Slug            string `json:"slug"`
	Description     string `json:"description"`
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
	DisplayOrder    int    `json:"display_order"`
	IsActive        bool   `json:"is_active"`
}

// UpdateCategoryRequest models input to update an existing category.
type UpdateCategoryRequest struct {
	Name            string `json:"name"`
	Slug            string `json:"slug"`
	Description     string `json:"description"`
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
	DisplayOrder    int    `json:"display_order"`
	IsActive        bool   `json:"is_active"`
}
