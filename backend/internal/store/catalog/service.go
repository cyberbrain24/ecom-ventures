package catalog

import (
	"context"
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
		CategoryID:       req.CategoryID,
		Title:            title,
		Slug:             slug,
		Summary:          req.Summary,
		Description:      req.Description,
		Status:           status,
		FeaturedImageURL: req.FeaturedImageURL,
		BasePrice:        req.BasePrice,
		CompareAtPrice:   req.CompareAtPrice,
		SKU:              strings.ToUpper(strings.TrimSpace(req.SKU)),
		IsFeatured:       req.IsFeatured,
		MetaTitle:        strings.TrimSpace(req.MetaTitle),
		MetaDescription:  strings.TrimSpace(req.MetaDescription),
		FocusKeyword:     strings.TrimSpace(req.FocusKeyword),
		CanonicalURL:     strings.TrimSpace(req.CanonicalURL),
		MetaRobots:       strings.TrimSpace(req.MetaRobots),
		OGImageURL:       strings.TrimSpace(req.OGImageURL),
	}

	if err := s.repo.CreateProduct(ctx, tenantDB, product); err != nil {
		return nil, err
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
	existing.SKU = strings.ToUpper(strings.TrimSpace(req.SKU))
	existing.IsFeatured = req.IsFeatured
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
