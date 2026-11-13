package catalog

import (
	"context"
	"math"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

// Service coordinates public catalog discovery queries.
type Service struct {
	repo Repository
}

// NewService instantiates the public catalog service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListCategories returns the hierarchical category tree for the active tenant.
func (s *Service) ListCategories(ctx context.Context) ([]PublicCategoryNode, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListActiveCategories(ctx, stCtx.TenantDB)
}

// SearchProducts queries products based on filtering and sorting constraints.
func (s *Service) SearchProducts(ctx context.Context, filter *StorefrontFilterParams) (*StorefrontCatalogResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 24
	}
	filter.Search = strings.TrimSpace(filter.Search)
	filter.CategorySlug = strings.TrimSpace(filter.CategorySlug)

	products, total, minPrice, maxPrice, err := s.repo.ListPublicProducts(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}
	if products == nil {
		products = []PublicProductCard{}
	}

	totalPages := 0
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(filter.Limit)))
	}

	return &StorefrontCatalogResponse{
		Products:   products,
		Total:      total,
		Page:       filter.Page,
		Limit:      filter.Limit,
		TotalPages: totalPages,
		MinPrice:   minPrice,
		MaxPrice:   maxPrice,
	}, nil
}

// GetProductBySlug returns the detailed product snapshot with variants and live stock.
func (s *Service) GetProductBySlug(ctx context.Context, slug string) (*PublicProductDetail, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	slug = strings.TrimSpace(slug)
	return s.repo.GetPublicProductBySlug(ctx, stCtx.TenantDB, slug)
}
