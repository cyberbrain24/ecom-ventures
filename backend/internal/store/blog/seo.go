package blog

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

var (
	blockTagRegex   = regexp.MustCompile(`(?i)</?(?:p|div|h[1-6]|li|blockquote|br|hr)[^>]*>`)
	inlineTagRegex  = regexp.MustCompile(`(?i)</?[a-z0-9]+[^>]*>`)
	wordRegex       = regexp.MustCompile(`\b\w+\b`)
	nonAlphanumeric = regexp.MustCompile(`[^a-z0-9]+`)
)

// CalculateSEOAnalysis performs a comprehensive 10-point audit on an article's SEO viability.
func CalculateSEOAnalysis(post *BlogPost) SEOAnalysis {
	cleanContent := StripHTML(post.Content)
	words := wordRegex.FindAllString(cleanContent, -1)
	wordCount := len(words)

	// Reading time calculation: standard 200 words per minute, minimum 1 min
	readingTime := int(math.Ceil(float64(wordCount) / 200.0))
	if readingTime < 1 {
		readingTime = 1
	}

	analysis := SEOAnalysis{
		TitleLength:           len([]rune(post.MetaTitle)),
		MetaDescriptionLength: len([]rune(post.MetaDescription)),
		WordCount:             wordCount,
		ReadingTime:           readingTime,
		Recommendations:       []string{},
	}

	if analysis.TitleLength == 0 {
		analysis.TitleLength = len([]rune(post.Title))
	}

	// 1. Meta Title length evaluation (Optimal: 40 - 70 characters)
	if analysis.TitleLength >= 40 && analysis.TitleLength <= 70 {
		analysis.TitleStatus = "GOOD"
	} else if analysis.TitleLength < 40 {
		analysis.TitleStatus = "TOO_SHORT"
		analysis.Recommendations = append(analysis.Recommendations, "Meta title is under 40 characters. Expand to 50-60 characters for optimal Google CTR.")
	} else {
		analysis.TitleStatus = "TOO_LONG"
		analysis.Recommendations = append(analysis.Recommendations, "Meta title exceeds 70 characters and may be truncated on Google Search results.")
	}

	// 2. Meta Description length evaluation (Optimal: 120 - 160 characters)
	if analysis.MetaDescriptionLength >= 120 && analysis.MetaDescriptionLength <= 165 {
		analysis.MetaDescStatus = "GOOD"
	} else if analysis.MetaDescriptionLength < 120 {
		analysis.MetaDescStatus = "TOO_SHORT"
		analysis.Recommendations = append(analysis.Recommendations, "Meta description is under 120 characters. Add more context to improve search snippet engagement.")
	} else {
		analysis.MetaDescStatus = "TOO_LONG"
		analysis.Recommendations = append(analysis.Recommendations, "Meta description exceeds 165 characters and will be clipped by search engines.")
	}

	// 3. Focus keyword analysis
	fk := strings.ToLower(strings.TrimSpace(post.FocusKeyword))
	if fk != "" {
		lowerTitle := strings.ToLower(post.Title)
		lowerMetaTitle := strings.ToLower(post.MetaTitle)
		analysis.FocusKeywordInTitle = strings.Contains(lowerTitle, fk) || strings.Contains(lowerMetaTitle, fk)
		if !analysis.FocusKeywordInTitle {
			analysis.Recommendations = append(analysis.Recommendations, fmt.Sprintf("Include focus keyword '%s' inside the post title or meta title.", post.FocusKeyword))
		}

		lowerMetaDesc := strings.ToLower(post.MetaDescription)
		analysis.FocusKeywordInMeta = strings.Contains(lowerMetaDesc, fk)
		if !analysis.FocusKeywordInMeta {
			analysis.Recommendations = append(analysis.Recommendations, fmt.Sprintf("Add focus keyword '%s' to the meta description snippet.", post.FocusKeyword))
		}

		lowerSlug := strings.ToLower(post.Slug)
		fkSlug := Slugify(fk)
		analysis.FocusKeywordInSlug = strings.Contains(lowerSlug, fkSlug)
		if !analysis.FocusKeywordInSlug {
			analysis.Recommendations = append(analysis.Recommendations, fmt.Sprintf("Incorporate target keyword '%s' into the permalink URL slug.", post.FocusKeyword))
		}

		lowerContent := strings.ToLower(cleanContent)
		analysis.FocusKeywordInContent = strings.Contains(lowerContent, fk)
		if !analysis.FocusKeywordInContent {
			analysis.Recommendations = append(analysis.Recommendations, fmt.Sprintf("Mention focus keyword '%s' naturally throughout the article body.", post.FocusKeyword))
		}
	} else {
		analysis.Recommendations = append(analysis.Recommendations, "Define a primary focus keyword to target specific consumer search queries.")
	}

	// 4. Featured Image Alt Text (Crucial for Google Image Search & Accessibility)
	analysis.HasFeaturedImageAlt = strings.TrimSpace(post.FeaturedImageAlt) != ""
	if !analysis.HasFeaturedImageAlt {
		analysis.Recommendations = append(analysis.Recommendations, "Provide descriptive Image Alt Text for the featured image to capture Google Images traffic.")
	}

	// 5. Content depth check
	if wordCount < 300 {
		analysis.Recommendations = append(analysis.Recommendations, "Content has fewer than 300 words. Search engines reward comprehensive, in-depth articles.")
	}

	// Calculate Aggregate SEO Score (0 - 100)
	score := 0
	if analysis.TitleStatus == "GOOD" {
		score += 15
	} else if analysis.TitleLength > 0 {
		score += 5
	}

	if analysis.MetaDescStatus == "GOOD" {
		score += 15
	} else if analysis.MetaDescriptionLength > 0 {
		score += 5
	}

	if analysis.FocusKeywordInTitle {
		score += 15
	}
	if analysis.FocusKeywordInMeta {
		score += 15
	}
	if analysis.FocusKeywordInSlug {
		score += 10
	}
	if analysis.FocusKeywordInContent {
		score += 10
	}
	if analysis.HasFeaturedImageAlt {
		score += 10
	}

	if wordCount >= 300 {
		score += 10
	} else if wordCount >= 150 {
		score += 5
	}

	if score > 100 {
		score = 100
	}
	analysis.Score = score

	return analysis
}

// StripHTML removes tags from an HTML string for plain text analysis.
func StripHTML(input string) string {
	res := blockTagRegex.ReplaceAllString(input, " ")
	res = inlineTagRegex.ReplaceAllString(res, "")
	return strings.Join(strings.Fields(res), " ")
}

// Slugify generates a clean, URL-safe lowercase kebab-case slug.
func Slugify(input string) string {
	clean := strings.ToLower(strings.TrimSpace(input))
	clean = nonAlphanumeric.ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-")
	if clean == "" {
		return fmt.Sprintf("post-%d", time.Now().Unix())
	}
	return clean
}

// GenerateSchemaOrgJSONLD produces Google Search-compliant Schema.org Article / BlogPosting metadata.
func GenerateSchemaOrgJSONLD(post *BlogPost, storeName, siteURL string) map[string]interface{} {
	articleURL := fmt.Sprintf("%s/blog/%s", strings.TrimRight(siteURL, "/"), post.Slug)
	if post.CanonicalURL != "" {
		articleURL = post.CanonicalURL
	}

	schemaType := post.SchemaType
	if schemaType == "" {
		schemaType = "BlogPosting"
	}

	pubDate := post.CreatedAt.Format(time.RFC3339)
	if post.PublishedAt != nil {
		pubDate = post.PublishedAt.Format(time.RFC3339)
	}

	schema := map[string]interface{}{
		"@context":    "https://schema.org",
		"@type":       schemaType,
		"headline":    post.Title,
		"description": post.Excerpt,
		"mainEntityOfPage": map[string]interface{}{
			"@type": "@id",
			"@id":   articleURL,
		},
		"datePublished": pubDate,
		"dateModified":  post.UpdatedAt.Format(time.RFC3339),
		"wordCount":     post.SEOAnalysis.WordCount,
		"inLanguage":    "en",
		"author": map[string]interface{}{
			"@type": "Person",
			"name":  post.AuthorName,
		},
		"publisher": map[string]interface{}{
			"@type": "Organization",
			"name":  storeName,
			"url":   siteURL,
		},
	}

	if post.FeaturedImageURL != "" {
		schema["image"] = map[string]interface{}{
			"@type":   "ImageObject",
			"url":     post.FeaturedImageURL,
			"caption": post.FeaturedImageAlt,
		}
	}

	if post.CategoryName != "" {
		schema["articleSection"] = post.CategoryName
	}

	if len(post.Tags) > 0 {
		schema["keywords"] = strings.Join(post.Tags, ", ")
	}

	return schema
}

// GenerateBreadcrumbsJSONLD produces Schema.org BreadcrumbList structured data for search rich snippets.
func GenerateBreadcrumbsJSONLD(post *BlogPost, storeName, siteURL string) map[string]interface{} {
	cleanSiteURL := strings.TrimRight(siteURL, "/")

	itemList := []map[string]interface{}{
		{
			"@type":    "ListItem",
			"position": 1,
			"name":     "Home",
			"item":     cleanSiteURL,
		},
		{
			"@type":    "ListItem",
			"position": 2,
			"name":     "Blog",
			"item":     fmt.Sprintf("%s/blog", cleanSiteURL),
		},
	}

	if post.CategoryName != "" && post.CategorySlug != "" {
		itemList = append(itemList, map[string]interface{}{
			"@type":    "ListItem",
			"position": 3,
			"name":     post.CategoryName,
			"item":     fmt.Sprintf("%s/blog?category=%s", cleanSiteURL, post.CategorySlug),
		})

		itemList = append(itemList, map[string]interface{}{
			"@type":    "ListItem",
			"position": 4,
			"name":     post.Title,
			"item":     fmt.Sprintf("%s/blog/%s", cleanSiteURL, post.Slug),
		})
	} else {
		itemList = append(itemList, map[string]interface{}{
			"@type":    "ListItem",
			"position": 3,
			"name":     post.Title,
			"item":     fmt.Sprintf("%s/blog/%s", cleanSiteURL, post.Slug),
		})
	}

	return map[string]interface{}{
		"@context":        "https://schema.org",
		"@type":           "BreadcrumbList",
		"itemListElement": itemList,
	}
}
