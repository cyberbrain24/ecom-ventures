package blog

import (
	"testing"
	"time"
)

func TestCalculateSEOAnalysis_PerfectScore(t *testing.T) {
	now := time.Now()
	// Build realistic 300+ word content to test complete SEO checklist scoring
	body := "<p>Sustainable fashion is reshaping how we view personal style and environmental responsibility. By investing in sustainable fashion, conscious consumers actively reduce waste while cultivating timeless style. In this comprehensive guide to sustainable fashion, we unpack organic fabrics, ethical manufacturing, and durability.</p>" +
		"<p>Textile longevity requires mindful curation and responsible garment care. Natural fibers like organic linen, mulberry silk, and cruelty-free wool age gracefully over years of wear, developing character rather than deteriorating. When consumers prioritize quality over fast-fashion consumption cycles, planetary resource depletion declines significantly.</p>" +
		"<p>Every conscious wardrobe begins with versatile foundation layers. Tailored trousers in neutral palettes, crisp unbleached cotton shirts, and handcrafted leather footwear form an adaptable capsule capable of dozens of elegant permutations. Choose ethical production partners that transparently audit labor standards and avoid harmful petroleum dyes.</p>" +
		"<p>Preserving fine garments requires proper washing rituals. Avoid abrasive chemical dry cleaning in favor of delicate cold-water hand washes and horizontal flat drying. Protecting your garments extends their lifespan by decades.</p>"

	post := &BlogPost{
		Title:              "Complete Guide to Sustainable Fashion: How to Build an Eco Wardrobe",
		Slug:               "guide-to-sustainable-fashion-eco-wardrobe",
		Excerpt:            "Learn how sustainable fashion transforms your daily wardrobe with organic textiles and ethical tailoring practices.",
		Content:            body,
		FeaturedImageURL:   "https://example.com/sustainable-fashion.jpg",
		FeaturedImageAlt:   "Sustainable fashion garments crafted from organic linen and recycled cotton",
		FocusKeyword:       "sustainable fashion",
		MetaTitle:          "Guide to Sustainable Fashion: How to Build an Eco Wardrobe | Store",
		MetaDescription:    "Discover how sustainable fashion empowers conscious styling with organic fabrics, timeless wardrobe essentials, and ethical care practices.",
		Status:             StatusPublished,
		PublishedAt:        &now,
		ReadingTimeMinutes: 3,
	}

	analysis := CalculateSEOAnalysis(post)

	if analysis.Score < 85 {
		t.Errorf("expected high SEO score for fully optimized post, got %d", analysis.Score)
	}

	if !analysis.FocusKeywordInTitle {
		t.Errorf("expected focus keyword in title to be true")
	}

	if !analysis.FocusKeywordInMeta {
		t.Errorf("expected focus keyword in meta description to be true")
	}

	if !analysis.FocusKeywordInSlug {
		t.Errorf("expected focus keyword in slug to be true")
	}

	if !analysis.FocusKeywordInContent {
		t.Errorf("expected focus keyword in content to be true")
	}

	if !analysis.HasFeaturedImageAlt {
		t.Errorf("expected has featured image alt to be true")
	}
}

func TestCalculateSEOAnalysis_Deficiencies(t *testing.T) {
	post := &BlogPost{
		Title:            "Short",
		Slug:             "short",
		Content:          "Hello world",
		FocusKeyword:     "luxury silk",
		MetaTitle:        "Short",
		MetaDescription:  "Too brief",
		FeaturedImageAlt: "",
	}

	analysis := CalculateSEOAnalysis(post)

	if analysis.Score > 50 {
		t.Errorf("expected low SEO score for deficient post, got %d", analysis.Score)
	}

	if analysis.TitleStatus != "TOO_SHORT" {
		t.Errorf("expected title status TOO_SHORT, got %s", analysis.TitleStatus)
	}

	if analysis.MetaDescStatus != "TOO_SHORT" {
		t.Errorf("expected meta desc status TOO_SHORT, got %s", analysis.MetaDescStatus)
	}

	if analysis.HasFeaturedImageAlt {
		t.Errorf("expected HasFeaturedImageAlt to be false")
	}

	if len(analysis.Recommendations) == 0 {
		t.Errorf("expected actionable recommendations for deficient post")
	}
}

func TestSlugify(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Hello World!", "hello-world"},
		{"The 10 Best Leather Bags for 2026", "the-10-best-leather-bags-for-2026"},
		{"   Spaces & Special Characters %$#@!   ", "spaces-special-characters"},
		{"Multiple---Dashes--Here", "multiple-dashes-here"},
	}

	for _, tc := range cases {
		got := Slugify(tc.input)
		if got != tc.expected {
			t.Errorf("Slugify(%q) = %q; expected %q", tc.input, got, tc.expected)
		}
	}
}

func TestGenerateSchemaOrgJSONLD(t *testing.T) {
	now := time.Now()
	post := &BlogPost{
		Title:            "Spring Linen Styling Tips",
		Slug:             "spring-linen-styling-tips",
		Excerpt:          "Essential linen styling advice for warm seasons.",
		Content:          "Linen is the ideal warm-weather fabric.",
		AuthorName:       "Amina Khan",
		FeaturedImageURL: "https://example.com/linen.jpg",
		FeaturedImageAlt: "Model in relaxed pure linen apparel",
		CategoryName:     "Style & Guides",
		Tags:             []string{"Linen", "Spring", "Style"},
		PublishedAt:      &now,
		SEOAnalysis: SEOAnalysis{
			WordCount: 250,
		},
	}

	jsonLD := GenerateSchemaOrgJSONLD(post, "Mior Fashion", "https://mior.localhost")

	if jsonLD["@context"] != "https://schema.org" {
		t.Errorf("expected context https://schema.org, got %v", jsonLD["@context"])
	}

	if jsonLD["@type"] != "BlogPosting" {
		t.Errorf("expected type BlogPosting, got %v", jsonLD["@type"])
	}

	if jsonLD["headline"] != "Spring Linen Styling Tips" {
		t.Errorf("expected headline Spring Linen Styling Tips, got %v", jsonLD["headline"])
	}

	author, ok := jsonLD["author"].(map[string]interface{})
	if !ok || author["name"] != "Amina Khan" {
		t.Errorf("expected author Amina Khan, got %v", jsonLD["author"])
	}

	publisher, ok := jsonLD["publisher"].(map[string]interface{})
	if !ok || publisher["name"] != "Mior Fashion" {
		t.Errorf("expected publisher Mior Fashion, got %v", jsonLD["publisher"])
	}
}

func TestGenerateBreadcrumbsJSONLD(t *testing.T) {
	post := &BlogPost{
		Title:        "Spring Linen Styling Tips",
		Slug:         "spring-linen-styling-tips",
		CategoryName: "Style & Guides",
		CategorySlug: "style-guides",
	}

	breadcrumbs := GenerateBreadcrumbsJSONLD(post, "Mior Fashion", "https://mior.localhost")

	if breadcrumbs["@type"] != "BreadcrumbList" {
		t.Errorf("expected @type BreadcrumbList, got %v", breadcrumbs["@type"])
	}

	items, ok := breadcrumbs["itemListElement"].([]map[string]interface{})
	if !ok || len(items) != 4 {
		t.Fatalf("expected 4 breadcrumb items, got %d", len(items))
	}

	if items[0]["name"] != "Home" || items[1]["name"] != "Blog" || items[2]["name"] != "Style & Guides" || items[3]["name"] != "Spring Linen Styling Tips" {
		t.Errorf("breadcrumb hierarchy mismatch: %v", items)
	}
}

func TestStripHTML(t *testing.T) {
	html := `<h1>Article Title</h1><p>This is a <strong>bold</strong> paragraph with <a href="#">a link</a>.</p>`
	clean := StripHTML(html)
	expected := "Article Title This is a bold paragraph with a link."
	if clean != expected {
		t.Errorf("StripHTML() = %q; expected %q", clean, expected)
	}
}
