package catalog

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/storage"
)

var slugSanitizerRegex = regexp.MustCompile(`[^a-z0-9]+`)

// Service coordinates business logic for catalog and media operations.
type Service struct {
	repo    *Repository
	storage storage.ObjectStorage
}

// NewService instantiates the catalog service.
func NewService(repo *Repository, store storage.ObjectStorage) *Service {
	return &Service{
		repo:    repo,
		storage: store,
	}
}

// --- CATEGORY SERVICES ---

// CreateCategory sanitizes slugs and creates a category within the tenant's database.
func (s *Service) CreateCategory(ctx context.Context, req CreateCategoryRequest) (*storeModels.Category, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("category name cannot be empty")
	}

	slug := req.Slug
	if slug == "" {
		slug = GenerateSlug(name)
	} else {
		slug = GenerateSlug(slug)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	category := &storeModels.Category{
		ParentID:        req.ParentID,
		Name:            name,
		Slug:            slug,
		Description:     req.Description,
		ImageURL:        req.ImageURL,
		DisplayOrder:    req.DisplayOrder,
		IsActive:        isActive,
		MetaTitle:       strings.TrimSpace(req.MetaTitle),
		MetaDescription: strings.TrimSpace(req.MetaDescription),
		FocusKeyword:    strings.TrimSpace(req.FocusKeyword),
		CanonicalURL:    strings.TrimSpace(req.CanonicalURL),
		MetaRobots:      strings.TrimSpace(req.MetaRobots),
		OGImageURL:      strings.TrimSpace(req.OGImageURL),
	}

	if err := s.repo.CreateCategory(ctx, tenantDB, category); err != nil {
		return nil, err
	}

	return category, nil
}

// GetCategoryTree builds a nested category tree representation.
func (s *Service) GetCategoryTree(ctx context.Context) ([]CategoryTreeNode, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}

	categories, err := s.repo.ListCategories(ctx, tenantDB)
	if err != nil {
		return nil, err
	}

	return buildCategoryTree(categories, nil), nil
}

// UpdateCategory modifies an existing category node.
func (s *Service) UpdateCategory(ctx context.Context, id string, req UpdateCategoryRequest) (*storeModels.Category, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}

	existing, err := s.repo.GetCategoryByID(ctx, tenantDB, id)
	if err != nil {
		return nil, err
	}

	existing.Name = strings.TrimSpace(req.Name)
	if req.Slug != "" {
		existing.Slug = GenerateSlug(req.Slug)
	}
	existing.ParentID = req.ParentID
	existing.Description = req.Description
	existing.ImageURL = req.ImageURL
	existing.DisplayOrder = req.DisplayOrder
	existing.IsActive = req.IsActive
	if req.MetaTitle != "" {
		existing.MetaTitle = strings.TrimSpace(req.MetaTitle)
	}
	existing.MetaDescription = strings.TrimSpace(req.MetaDescription)
	existing.FocusKeyword = strings.TrimSpace(req.FocusKeyword)
	existing.CanonicalURL = strings.TrimSpace(req.CanonicalURL)
	if req.MetaRobots != "" {
		existing.MetaRobots = strings.TrimSpace(req.MetaRobots)
	}
	existing.OGImageURL = strings.TrimSpace(req.OGImageURL)

	if err := s.repo.UpdateCategory(ctx, tenantDB, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// DeleteCategory removes a category.
func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteCategory(ctx, tenantDB, id)
}

// --- PRODUCT SERVICES ---

// CreateProduct creates a base product validating pricing and status.
func (s *Service) CreateProduct(ctx context.Context, req CreateProductRequest) (*storeModels.Product, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, fmt.Errorf("product title cannot be empty")
	}

	if req.BasePrice < 0 {
		return nil, fmt.Errorf("base price must be greater than or equal to zero")
	}

	status := storeModels.ProductStatus(strings.ToUpper(strings.TrimSpace(req.Status)))
	if status == "" {
		status = storeModels.ProductStatusDraft
	}

	slug := req.Slug
	if slug == "" {
		slug = GenerateSlug(title)
	} else {
		slug = GenerateSlug(slug)
	}

	product := &storeModels.Product{
		CategoryID:        req.CategoryID,
		Title:             title,
		Slug:              slug,
		Summary:           req.Summary,
		Description:       req.Description,
		Status:            status,
		FeaturedImageURL:  req.FeaturedImageURL,
		BasePrice:         req.BasePrice,
		CompareAtPrice:    req.CompareAtPrice,
		CostPrice:         req.CostPrice,
		SKU:               strings.ToUpper(strings.TrimSpace(req.SKU)),
		IsFeatured:        req.IsFeatured,
		BrandID:           req.BrandID,
		CareInstructionID: req.CareInstructionID,
		VideoURL:          strings.TrimSpace(req.VideoURL),
		VideoAutoplay:     req.VideoAutoplay,
		VideoMuted:        req.VideoMuted,
		OptionLayout:      req.OptionLayout,
		SizeGuideTemplate: req.SizeGuideTemplate,
		MetaTitle:         strings.TrimSpace(req.MetaTitle),
		MetaDescription:   strings.TrimSpace(req.MetaDescription),
		FocusKeyword:      strings.TrimSpace(req.FocusKeyword),
		CanonicalURL:      strings.TrimSpace(req.CanonicalURL),
		MetaRobots:        strings.TrimSpace(req.MetaRobots),
		OGImageURL:        strings.TrimSpace(req.OGImageURL),
	}

	if err := s.repo.CreateProduct(ctx, tenantDB, product); err != nil {
		return nil, err
	}

	// Handle media gallery filenames if provided (separated by commas)
	if strings.TrimSpace(req.GalleryFilenames) != "" {
		names := strings.Split(req.GalleryFilenames, ",")
		for i, name := range names {
			cleanName := strings.TrimSpace(name)
			if cleanName != "" {
				imgURL := cleanName
				if !strings.HasPrefix(cleanName, "http") && !strings.HasPrefix(cleanName, "/") {
					imgURL = "/media/" + cleanName
				}
				_ = s.repo.InsertProductImage(ctx, tenantDB, &storeModels.ProductImage{
					ProductID: product.ID,
					URL:       imgURL,
					AltText:   product.Title,
					SortOrder: i,
					IsPrimary: i == 0 && product.FeaturedImageURL == "",
				})
			}
		}
	}

	return product, nil
}

// GetProduct retrieves product details including images.
func (s *Service) GetProduct(ctx context.Context, id string) (*storeModels.Product, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetProductByID(ctx, tenantDB, id)
}

// ListProducts retrieves paginated and filtered product listings.
func (s *Service) ListProducts(ctx context.Context, params ProductFilterParams) ([]storeModels.Product, int, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.ListProducts(ctx, tenantDB, params)
}

// UpdateProduct updates base product attributes.
func (s *Service) UpdateProduct(ctx context.Context, id string, req UpdateProductRequest) (*storeModels.Product, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}

	existing, err := s.repo.GetProductByID(ctx, tenantDB, id)
	if err != nil {
		return nil, err
	}

	existing.Title = strings.TrimSpace(req.Title)
	if req.Slug != "" {
		existing.Slug = GenerateSlug(req.Slug)
	}
	existing.CategoryID = req.CategoryID
	existing.Summary = req.Summary
	existing.Description = req.Description
	existing.Status = storeModels.ProductStatus(strings.ToUpper(strings.TrimSpace(req.Status)))
	existing.FeaturedImageURL = req.FeaturedImageURL
	existing.BasePrice = req.BasePrice
	existing.CompareAtPrice = req.CompareAtPrice
	if req.CostPrice != nil {
		existing.CostPrice = req.CostPrice
	}
	existing.SKU = strings.ToUpper(strings.TrimSpace(req.SKU))
	existing.IsFeatured = req.IsFeatured
	if req.BrandID != nil {
		existing.BrandID = req.BrandID
	}
	if req.CareInstructionID != nil {
		existing.CareInstructionID = req.CareInstructionID
	}
	if req.VideoURL != "" {
		existing.VideoURL = strings.TrimSpace(req.VideoURL)
	}
	existing.VideoAutoplay = req.VideoAutoplay
	existing.VideoMuted = req.VideoMuted
	if req.OptionLayout != "" {
		existing.OptionLayout = req.OptionLayout
	}
	if req.SizeGuideTemplate != "" {
		existing.SizeGuideTemplate = req.SizeGuideTemplate
	}
	if req.MetaTitle != "" {
		existing.MetaTitle = strings.TrimSpace(req.MetaTitle)
	}
	existing.MetaDescription = strings.TrimSpace(req.MetaDescription)
	existing.FocusKeyword = strings.TrimSpace(req.FocusKeyword)
	existing.CanonicalURL = strings.TrimSpace(req.CanonicalURL)
	if req.MetaRobots != "" {
		existing.MetaRobots = strings.TrimSpace(req.MetaRobots)
	}
	existing.OGImageURL = strings.TrimSpace(req.OGImageURL)

	if err := s.repo.UpdateProduct(ctx, tenantDB, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// DeleteProduct removes a product from the database.
func (s *Service) DeleteProduct(ctx context.Context, id string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteProduct(ctx, tenantDB, id)
}

// --- ORDERING AND FEATURED SERVICES ---

// maxReorderIDs bounds a reorder request so one call cannot lock an unreasonable number of rows.
const maxReorderIDs = 5000

// ErrInvalidReorder is returned when a reorder or featured request is malformed.
var ErrInvalidReorder = errors.New("catalog: invalid reorder request")

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ValidateOrderedIDs checks that ids is a non-empty list of unique UUIDs of reasonable size.
// The returned error wraps ErrInvalidReorder and says what is wrong.
func ValidateOrderedIDs(ids []string) error {
	if len(ids) == 0 {
		return fmt.Errorf("%w: ids must not be empty", ErrInvalidReorder)
	}
	if len(ids) > maxReorderIDs {
		return fmt.Errorf("%w: at most %d ids can be reordered at once", ErrInvalidReorder, maxReorderIDs)
	}
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if !uuidPattern.MatchString(id) {
			return fmt.Errorf("%w: %q is not a valid id", ErrInvalidReorder, id)
		}
		key := strings.ToLower(id)
		if _, dup := seen[key]; dup {
			return fmt.Errorf("%w: id %s appears more than once", ErrInvalidReorder, id)
		}
		seen[key] = struct{}{}
	}
	return nil
}

// validateFeaturedRequest checks the product id and that the featured flag was actually sent.
func validateFeaturedRequest(id string, featured *bool) error {
	if !uuidPattern.MatchString(id) {
		return fmt.Errorf("%w: %q is not a valid product id", ErrInvalidReorder, id)
	}
	if featured == nil {
		return fmt.Errorf("%w: is_featured is required", ErrInvalidReorder)
	}
	return nil
}

// SetProductFeatured marks or unmarks a product as featured and returns the updated product.
func (s *Service) SetProductFeatured(ctx context.Context, id string, featured *bool) (*storeModels.Product, error) {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	if err := validateFeaturedRequest(id, featured); err != nil {
		return nil, err
	}
	if err := s.repo.SetProductFeatured(ctx, tenantDB, id, *featured); err != nil {
		return nil, err
	}
	return s.repo.GetProductByID(ctx, tenantDB, id)
}

// ProductLinksRequest sets which brand and care instruction a product uses. A null or missing value clears
// that link. Both fields are always replaced, so a client must send the current value of the one it does not change.
type ProductLinksRequest struct {
	BrandID           *string `json:"brand_id"`
	CareInstructionID *string `json:"care_instruction_id"`
}

// SetProductLinks validates the ids and updates the product's brand and care instruction.
func (s *Service) SetProductLinks(ctx context.Context, id string, req ProductLinksRequest) (*storeModels.Product, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	if !uuidPattern.MatchString(id) {
		return nil, fmt.Errorf("%w: %q is not a valid product id", ErrInvalidReorder, id)
	}
	brandID, err := normalizeOptionalID("brand_id", req.BrandID)
	if err != nil {
		return nil, err
	}
	careID, err := normalizeOptionalID("care_instruction_id", req.CareInstructionID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.SetProductLinks(ctx, db, id, brandID, careID); err != nil {
		return nil, err
	}
	return s.repo.GetProductByID(ctx, db, id)
}

// normalizeOptionalID returns nil for a missing or blank id, and otherwise a validated UUID.
func normalizeOptionalID(field string, value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	v := strings.TrimSpace(*value)
	if v == "" {
		return nil, nil
	}
	if !uuidPattern.MatchString(v) {
		return nil, fmt.Errorf("%w: %s is not a valid id", ErrInvalidReorder, field)
	}
	return &v, nil
}

// ReorderProducts saves the order of the main product list.
func (s *Service) ReorderProducts(ctx context.Context, ids []string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if err := ValidateOrderedIDs(ids); err != nil {
		return err
	}
	return s.repo.ReorderProducts(ctx, tenantDB, ids)
}

// ReorderFeaturedProducts saves the order of the featured list shown on the storefront home page.
func (s *Service) ReorderFeaturedProducts(ctx context.Context, ids []string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if err := ValidateOrderedIDs(ids); err != nil {
		return err
	}
	return s.repo.ReorderFeaturedProducts(ctx, tenantDB, ids)
}

// ReorderCategories saves the order of one sibling group of categories.
func (s *Service) ReorderCategories(ctx context.Context, ids []string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if err := ValidateOrderedIDs(ids); err != nil {
		return err
	}
	return s.repo.ReorderCategories(ctx, tenantDB, ids)
}

// --- MEDIA SERVICES ---

// UploadProductMedia handles binary payload streaming to storage and records metadata.
func (s *Service) UploadProductMedia(ctx context.Context, productID string, filename string, contentType string, reader io.Reader, size int64, isPrimary bool) (*storeModels.ProductImage, error) {
	sc, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	// Verify product exists in this store
	product, err := s.repo.GetProductByID(ctx, sc.TenantDB, productID)
	if err != nil {
		return nil, err
	}

	// Partition storage folder by store slug: "stores/{store_slug}/products/{product_id}"
	folder := fmt.Sprintf("stores/%s/products/%s", sc.Store.Slug, productID)

	uploadRes, err := s.storage.Save(ctx, folder, filename, contentType, reader, size)
	if err != nil {
		return nil, fmt.Errorf("failed to save asset to storage: %w", err)
	}

	// Calculate display order
	images, _ := s.repo.ListProductImages(ctx, sc.TenantDB, productID)
	nextOrder := len(images)

	// If first image or marked as primary, set isPrimary = true
	if len(images) == 0 {
		isPrimary = true
	}

	img := &storeModels.ProductImage{
		ProductID: productID,
		URL:       uploadRes.URL,
		AltText:   product.Title,
		SortOrder: nextOrder,
		IsPrimary: isPrimary,
	}

	if err := s.repo.InsertProductImage(ctx, sc.TenantDB, img); err != nil {
		_ = s.storage.Delete(ctx, uploadRes.Key)
		return nil, fmt.Errorf("failed to record product image metadata: %w", err)
	}

	if isPrimary {
		_ = s.repo.SetPrimaryImage(ctx, sc.TenantDB, productID, img.ID)
	}

	return img, nil
}

// SetPrimaryImage designates the main display asset for a product.
func (s *Service) SetPrimaryImage(ctx context.Context, productID, imageID string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	return s.repo.SetPrimaryImage(ctx, tenantDB, productID, imageID)
}

// DeleteProductImage removes an asset record and cleans up storage.
func (s *Service) DeleteProductImage(ctx context.Context, imageID string) error {
	tenantDB, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}

	deletedImg, err := s.repo.DeleteProductImage(ctx, tenantDB, imageID)
	if err != nil {
		return err
	}

	// Best-effort cleanup of binary object from storage
	_ = s.storage.Delete(ctx, deletedImg.URL)
	return nil
}

// GenerateSlug normalizes strings into clean lowercase alphanumeric slugs.
func GenerateSlug(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	s = slugSanitizerRegex.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// buildCategoryTree recursively constructs hierarchical category trees.
func buildCategoryTree(categories []storeModels.Category, parentID *string) []CategoryTreeNode {
	var nodes []CategoryTreeNode
	for _, c := range categories {
		if (c.ParentID == nil && parentID == nil) || (c.ParentID != nil && parentID != nil && *c.ParentID == *parentID) {
			childID := c.ID
			children := buildCategoryTree(categories, &childID)
			nodes = append(nodes, CategoryTreeNode{
				Category: c,
				Children: children,
			})
		}
	}
	return nodes
}
