package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrAttributeNotFound = errors.New("attribute not found")
	ErrVariantNotFound   = errors.New("variant not found")
	ErrSKUAlreadyExists  = errors.New("variant SKU already exists in store")
	ErrInvalidPricing    = errors.New("variant price must be non-negative")
)

// VariantsService coordinates dynamic attributes and Cartesian variant matrices.
type VariantsService struct {
	repo            VariantsRepository
	catalogRepo     CatalogRepository
	matrixGenerator *CartesianGenerator
}

// NewVariantsService constructs the variants domain service.
func NewVariantsService(repo VariantsRepository, catalogRepo CatalogRepository) *VariantsService {
	return &VariantsService{
		repo:            repo,
		catalogRepo:     catalogRepo,
		matrixGenerator: NewCartesianGenerator(),
	}
}

// CreateAttribute registers a new store-level variation dimension.
func (s *VariantsService) CreateAttribute(ctx context.Context, req *CreateAttributeRequest) (*AttributeDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanCode := strings.ToLower(strings.TrimSpace(req.Code))
	if cleanCode == "" {
		cleanCode = GenerateSlug(req.Name)
	}

	attr := &storeModels.Attribute{
		Name:        strings.TrimSpace(req.Name),
		Code:        cleanCode,
		DataType:    strings.ToLower(strings.TrimSpace(req.DataType)),
		DisplayType: strings.ToLower(strings.TrimSpace(req.DisplayType)),
	}
	if attr.DataType == "" {
		attr.DataType = "select"
	}
	if attr.DisplayType == "" {
		attr.DisplayType = "text"
	}

	if err := s.repo.CreateAttribute(ctx, stCtx.TenantDB, attr); err != nil {
		return nil, fmt.Errorf("failed to create attribute: %w", err)
	}

	var values []storeModels.AttributeValue
	for idx, valReq := range req.Values {
		val := &storeModels.AttributeValue{
			AttributeID:  attr.ID,
			Value:        strings.TrimSpace(valReq.Value),
			DisplayValue: strings.TrimSpace(valReq.DisplayValue),
			ColorHex:     valReq.ColorHex,
			ImageURL:     strings.TrimSpace(valReq.ImageURL),
			SortOrder:    idx,
		}
		if val.DisplayValue == "" {
			val.DisplayValue = val.Value
		}
		if err := s.repo.CreateAttributeValue(ctx, stCtx.TenantDB, val); err != nil {
			return nil, fmt.Errorf("failed to seed initial attribute value: %w", err)
		}
		values = append(values, *val)
	}

	return &AttributeDetailResponse{
		Attribute: *attr,
		Values:    values,
	}, nil
}

// ListAttributes retrieves all registered store attributes.
func (s *VariantsService) ListAttributes(ctx context.Context) ([]AttributeDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListAttributes(ctx, stCtx.TenantDB)
}

// ReorderAttributes saves the order of the attribute list.
func (s *VariantsService) ReorderAttributes(ctx context.Context, ids []string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	if err := ValidateOrderedIDs(ids); err != nil {
		return err
	}
	return s.repo.ReorderAttributes(ctx, stCtx.TenantDB, ids)
}

// AddAttributeValue adds an option value to an existing attribute.
func (s *VariantsService) AddAttributeValue(ctx context.Context, attributeID string, req *CreateAttributeValueRequest) (*storeModels.AttributeValue, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	val := &storeModels.AttributeValue{
		AttributeID:  attributeID,
		Value:        strings.TrimSpace(req.Value),
		DisplayValue: strings.TrimSpace(req.DisplayValue),
		ColorHex:     req.ColorHex,
		ImageURL:     strings.TrimSpace(req.ImageURL),
		SortOrder:    req.SortOrder,
	}
	if val.DisplayValue == "" {
		val.DisplayValue = val.Value
	}

	if err := s.repo.CreateAttributeValue(ctx, stCtx.TenantDB, val); err != nil {
		return nil, fmt.Errorf("failed to insert attribute value: %w", err)
	}
	return val, nil
}

// UpdateAttribute modifies an attribute's name, data type, and display type.
func (s *VariantsService) UpdateAttribute(ctx context.Context, id string, name, dataType, displayType string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	cleanData := strings.ToLower(strings.TrimSpace(dataType))
	if cleanData == "" {
		cleanData = "select"
	}
	cleanDisplay := strings.ToLower(strings.TrimSpace(displayType))
	if cleanDisplay == "" {
		cleanDisplay = "text"
	}
	return s.repo.UpdateAttribute(ctx, stCtx.TenantDB, id, strings.TrimSpace(name), cleanData, cleanDisplay)
}

// DeleteAttribute removes an attribute from the store database.
func (s *VariantsService) DeleteAttribute(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteAttribute(ctx, stCtx.TenantDB, id)
}

// DeleteAttributeValue removes a single attribute option value.
func (s *VariantsService) DeleteAttributeValue(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteAttributeValue(ctx, stCtx.TenantDB, id)
}

// PreviewMatrix computes the Cartesian product proposal without writing to the database.
func (s *VariantsService) PreviewMatrix(ctx context.Context, productID string, req *GenerateMatrixRequest) ([]GeneratedVariantProposal, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	prod, err := s.catalogRepo.GetProductByID(ctx, stCtx.TenantDB, productID)
	if err != nil {
		return nil, fmt.Errorf("failed to get parent product: %w", err)
	}

	basePrice := prod.BasePrice
	if req.BasePrice != nil {
		basePrice = *req.BasePrice
	}

	baseSKU := prod.SKU
	if req.SKUPrefix != nil && *req.SKUPrefix != "" {
		baseSKU = *req.SKUPrefix
	}

	var valueGroups [][]storeModels.AttributeValue
	for _, attrSel := range req.Attributes {
		vals, err := s.repo.GetAttributeValuesByIDs(ctx, stCtx.TenantDB, attrSel.ValueIDs)
		if err != nil {
			return nil, err
		}
		if len(vals) > 0 {
			valueGroups = append(valueGroups, vals)
		}
	}

	combinations := s.matrixGenerator.GenerateCombinations(valueGroups)
	proposals := s.matrixGenerator.BuildVariantProposals(prod.Title, baseSKU, basePrice, combinations)

	return proposals, nil
}

// GenerateAndPersistMatrix computes and commits the variant matrix atomically in a transaction.
func (s *VariantsService) GenerateAndPersistMatrix(ctx context.Context, productID string, req *GenerateMatrixRequest) ([]VariantDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	proposals, err := s.PreviewMatrix(ctx, productID, req)
	if err != nil {
		return nil, err
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, prop := range proposals {
		variant := &storeModels.ProductVariant{
			ProductID:      productID,
			SKU:            prop.SKU,
			Title:          prop.Title,
			Price:          prop.Price,
			CompareAtPrice: prop.CompareAtPrice,
			CostPrice:      prop.CostPrice,
			WeightGrams:    prop.WeightGrams,
			IsActive:       true,
		}

		if err := s.repo.CreateVariantTx(ctx, tx, variant, prop.AttributeValueIDs, nil); err != nil {
			return nil, fmt.Errorf("failed to persist generated variant %s: %w", prop.SKU, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit variant matrix transaction: %w", err)
	}

	return s.repo.ListVariantsByProductID(ctx, stCtx.TenantDB, productID)
}

// CreateVariant manually creates a single variant SKU with bound values and images.
func (s *VariantsService) CreateVariant(ctx context.Context, productID string, req *CreateVariantRequest) (*VariantDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.Price < 0 {
		return nil, ErrInvalidPricing
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	v := &storeModels.ProductVariant{
		ProductID:      productID,
		SKU:            strings.ToUpper(strings.TrimSpace(req.SKU)),
		Barcode:        req.Barcode,
		Title:          strings.TrimSpace(req.Title),
		Price:          req.Price,
		CompareAtPrice: req.CompareAtPrice,
		CostPrice:      req.CostPrice,
		WeightGrams:    req.WeightGrams,
		IsActive:       req.IsActive,
	}

	if err := s.repo.CreateVariantTx(ctx, tx, v, req.AttributeValueIDs, req.ImageIDs); err != nil {
		return nil, fmt.Errorf("failed to insert variant: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit variant creation: %w", err)
	}

	return s.repo.GetVariantByID(ctx, stCtx.TenantDB, v.ID)
}

// ListVariantsByProductID returns all variants belonging to a specific base product.
func (s *VariantsService) ListVariantsByProductID(ctx context.Context, productID string) ([]VariantDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListVariantsByProductID(ctx, stCtx.TenantDB, productID)
}

// UpdateVariant modifies SKU, title, pricing, or availability.
func (s *VariantsService) UpdateVariant(ctx context.Context, id string, req *UpdateVariantRequest) (*VariantDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.Price < 0 {
		return nil, ErrInvalidPricing
	}

	req.SKU = strings.ToUpper(strings.TrimSpace(req.SKU))
	req.Title = strings.TrimSpace(req.Title)

	if err := s.repo.UpdateVariant(ctx, stCtx.TenantDB, id, req); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVariantNotFound
		}
		return nil, fmt.Errorf("failed to update variant: %w", err)
	}

	return s.repo.GetVariantByID(ctx, stCtx.TenantDB, id)
}

// DeleteVariant removes a variant SKU from the catalog.
func (s *VariantsService) DeleteVariant(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteVariant(ctx, stCtx.TenantDB, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrVariantNotFound
		}
		return fmt.Errorf("failed to delete variant: %w", err)
	}
	return nil
}

// BatchUpdateVariants bulk modifies pricing or active status across multiple variants.
func (s *VariantsService) BatchUpdateVariants(ctx context.Context, req *BatchUpdateVariantsRequest) (int64, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return 0, err
	}
	if req.Price != nil && *req.Price < 0 {
		return 0, ErrInvalidPricing
	}
	return s.repo.BatchUpdateVariants(ctx, stCtx.TenantDB, req)
}

// BindVariantImages sets the gallery images for a variant.
func (s *VariantsService) BindVariantImages(ctx context.Context, variantID string, imageIDs []string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.BindVariantImages(ctx, stCtx.TenantDB, variantID, imageIDs)
}
