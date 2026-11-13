package reviews

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"github.com/redis/go-redis/v9"
)

// Service provides business orchestration for product reviews with tenant isolation and caching.
type Service struct {
	repo  Repository
	redis *redis.Client
}

// NewService instantiates the review service.
func NewService(repo Repository, rdb *redis.Client) *Service {
	return &Service{
		repo:  repo,
		redis: rdb,
	}
}

// ListReviews lists reviews according to the specified filter.
func (s *Service) ListReviews(ctx context.Context, filter ReviewFilter) ([]*ProductReview, int, error) {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.ListReviews(ctx, stCtx.TenantDB, filter)
}

// GetReview retrieves a single review by ID.
func (s *Service) GetReview(ctx context.Context, id string) (*ProductReview, error) {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetReviewByID(ctx, stCtx.TenantDB, id)
}

// CreateStaffReview handles Channel B staff-assisted review creation via CRM phone lookup.
func (s *Service) CreateStaffReview(ctx context.Context, req *CreateStaffReviewRequest, staffID string) (*ProductReview, error) {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.ProductID == "" {
		return nil, errors.New("product_id is required")
	}
	if req.Rating < 1 || req.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}
	if strings.TrimSpace(req.Comment) == "" {
		return nil, errors.New("review comment cannot be empty")
	}

	customerID := req.CustomerID
	if customerID == "" {
		if req.CustomerPhone != "" || req.CustomerEmail != "" {
			resolvedID, err := s.repo.FindCustomerByPhoneOrEmail(ctx, stCtx.TenantDB, req.CustomerPhone, req.CustomerEmail)
			if err == nil {
				customerID = resolvedID
			}
		}
	}

	// Auto-provision basic customer record if not found by phone/email
	if customerID == "" {
		if req.CustomerName == "" {
			req.CustomerName = "Verified Customer"
		}
		names := strings.SplitN(strings.TrimSpace(req.CustomerName), " ", 2)
		firstName := names[0]
		lastName := "Customer"
		if len(names) > 1 {
			lastName = names[1]
		}
		email := req.CustomerEmail
		if email == "" {
			cleanPhone := strings.ReplaceAll(req.CustomerPhone, "+", "")
			cleanPhone = strings.ReplaceAll(cleanPhone, " ", "")
			email = fmt.Sprintf("cust_%s@store.dropiobd.localhost", cleanPhone)
		}

		insertCustQuery := `
			INSERT INTO customers (first_name, last_name, email, phone)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone
			RETURNING id
		`
		var newID string
		if err := stCtx.TenantDB.QueryRowContext(ctx, insertCustQuery, firstName, lastName, email, req.CustomerPhone).Scan(&newID); err != nil {
			return nil, fmt.Errorf("failed to register customer record: %w", err)
		}
		customerID = newID
	}

	// Single-Review Check: If customer already reviewed this product, update instead of duplicating
	existing, _ := s.repo.GetReviewByProductAndCustomer(ctx, stCtx.TenantDB, req.ProductID, customerID)
	if existing != nil {
		existing.Rating = req.Rating
		existing.Title = req.Title
		existing.Comment = req.Comment
		existing.Status = StatusApproved
		if req.IsFeatured {
			existing.Status = StatusFeatured
			existing.IsFeatured = true
		}
		existing.DisplayOrder = req.DisplayOrder
		if req.StaffNotes != "" {
			existing.StaffNotes = &req.StaffNotes
		}
		updated, err := s.repo.UpdateReview(ctx, stCtx.TenantDB, existing, req.Images)
		if err != nil {
			return nil, err
		}
		s.invalidateProductCache(ctx, stCtx.Store.Slug, req.ProductID)
		return updated, nil
	}

	// Verify purchase linkage
	isVerified, orderID, _ := s.repo.CheckCustomerVerifiedPurchase(ctx, stCtx.TenantDB, customerID, req.ProductID)

	status := StatusApproved
	if req.IsFeatured {
		status = StatusFeatured
	}

	r := &ProductReview{
		ProductID:          req.ProductID,
		CustomerID:         customerID,
		OrderID:            orderID,
		CreatedByStaffID:   &staffID,
		Rating:             req.Rating,
		Title:              req.Title,
		Comment:            req.Comment,
		Status:             status,
		IsFeatured:         req.IsFeatured,
		IsVerifiedPurchase: isVerified,
		DisplayOrder:       req.DisplayOrder,
	}
	if req.StaffNotes != "" {
		r.StaffNotes = &req.StaffNotes
	}

	created, err := s.repo.CreateReview(ctx, stCtx.TenantDB, r, req.Images)
	if err != nil {
		return nil, err
	}

	s.invalidateProductCache(ctx, stCtx.Store.Slug, req.ProductID)
	return created, nil
}

// CreateCustomerReview handles Channel A online customer submission from the storefront.
func (s *Service) CreateCustomerReview(ctx context.Context, customerID string, req *CreateCustomerReviewRequest) (*ProductReview, error) {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.ProductID == "" {
		return nil, errors.New("product_id is required")
	}
	if req.Rating < 1 || req.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}
	if strings.TrimSpace(req.Comment) == "" {
		return nil, errors.New("review comment cannot be empty")
	}

	// 1. Single-Review Constraint: Check if customer already submitted a review
	existing, _ := s.repo.GetReviewByProductAndCustomer(ctx, stCtx.TenantDB, req.ProductID, customerID)
	if existing != nil {
		// Approval Reset Trigger: Any edit demotes back to PENDING
		existing.Rating = req.Rating
		existing.Title = req.Title
		existing.Comment = req.Comment
		existing.Status = StatusPending
		existing.IsFeatured = false

		updated, err := s.repo.UpdateReview(ctx, stCtx.TenantDB, existing, req.Images)
		if err != nil {
			return nil, err
		}
		s.invalidateProductCache(ctx, stCtx.Store.Slug, req.ProductID)
		return updated, nil
	}

	// 2. Check Verified Purchase Status
	isVerified, orderID, _ := s.repo.CheckCustomerVerifiedPurchase(ctx, stCtx.TenantDB, customerID, req.ProductID)
	if req.OrderID != nil && *req.OrderID != "" {
		orderID = req.OrderID
		isVerified = true
	}

	r := &ProductReview{
		ProductID:          req.ProductID,
		CustomerID:         customerID,
		OrderID:            orderID,
		Rating:             req.Rating,
		Title:              req.Title,
		Comment:            req.Comment,
		Status:             StatusPending, // Gate: Moderation required before public display
		IsFeatured:         false,
		IsVerifiedPurchase: isVerified,
		DisplayOrder:       0,
	}

	created, err := s.repo.CreateReview(ctx, stCtx.TenantDB, r, req.Images)
	if err != nil {
		return nil, err
	}

	s.invalidateProductCache(ctx, stCtx.Store.Slug, req.ProductID)
	return created, nil
}

// UpdateReview updates an existing review (CRM admin editing).
func (s *Service) UpdateReview(ctx context.Context, id string, req *UpdateReviewRequest) (*ProductReview, error) {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	existing, err := s.repo.GetReviewByID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return nil, err
	}

	existing.Rating = req.Rating
	existing.Title = req.Title
	existing.Comment = req.Comment
	existing.Status = req.Status
	existing.IsFeatured = req.IsFeatured
	existing.DisplayOrder = req.DisplayOrder
	if req.StaffNotes != "" {
		existing.StaffNotes = &req.StaffNotes
	}

	updated, err := s.repo.UpdateReview(ctx, stCtx.TenantDB, existing, req.Images)
	if err != nil {
		return nil, err
	}

	s.invalidateProductCache(ctx, stCtx.Store.Slug, existing.ProductID)
	return updated, nil
}

// QuickModerate toggles review status (Approve, Feature, Demote, Archive).
func (s *Service) QuickModerate(ctx context.Context, id string, req *QuickModerateRequest) error {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return err
	}

	existing, err := s.repo.GetReviewByID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return err
	}

	isFeatured := existing.IsFeatured
	if req.IsFeatured != nil {
		isFeatured = *req.IsFeatured
	}
	if req.Status == StatusFeatured {
		isFeatured = true
	} else if req.Status == StatusApproved && req.IsFeatured == nil {
		// keep existing isFeatured unless demoted
	} else if req.Status == StatusPending || req.Status == StatusArchived {
		isFeatured = false
	}

	if err := s.repo.UpdateReviewStatus(ctx, stCtx.TenantDB, id, req.Status, isFeatured, req.StaffNotes); err != nil {
		return err
	}

	s.invalidateProductCache(ctx, stCtx.Store.Slug, existing.ProductID)
	return nil
}

// DeleteReview permanently deletes a review and cascades attached image records.
func (s *Service) DeleteReview(ctx context.Context, id string) error {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return err
	}

	existing, err := s.repo.GetReviewByID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return err
	}

	if err := s.repo.DeleteReview(ctx, stCtx.TenantDB, id); err != nil {
		return err
	}

	s.invalidateProductCache(ctx, stCtx.Store.Slug, existing.ProductID)
	return nil
}

// StorefrontReviewsResponse models public storefront consumption.
type StorefrontReviewsResponse struct {
	Summary   *RatingSummary   `json:"summary"`
	Reviews   []*ProductReview `json:"reviews"`
	PhotoUrls []string         `json:"photo_urls"`
}

// GetProductReviewsStorefront returns verified public reviews with customer privacy masking.
func (s *Service) GetProductReviewsStorefront(ctx context.Context, productID string, page, limit int) (*StorefrontReviewsResponse, error) {
	stCtx, err := storeCtx.GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	cacheKey := fmt.Sprintf("store:%s:product:%s:reviews_summary", stCtx.Store.Slug, productID)

	// 1. Check Redis Cache for page 1
	if s.redis != nil && page <= 1 {
		val, err := s.redis.Get(ctx, cacheKey).Result()
		if err == nil && val != "" {
			var cached StorefrontReviewsResponse
			if jsonErr := json.Unmarshal([]byte(val), &cached); jsonErr == nil {
				return &cached, nil
			}
		}
	}

	// 2. Fetch Mathematical Summary
	summary, err := s.repo.GetProductRatingSummary(ctx, stCtx.TenantDB, productID)
	if err != nil {
		return nil, fmt.Errorf("failed to compute rating summary: %w", err)
	}

	// 3. Fetch Approved & Featured Reviews Only
	filter := ReviewFilter{
		ProductID: productID,
		Page:      page,
		Limit:     limit,
	}
	allReviews, _, err := s.repo.ListReviews(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}

	var publicReviews []*ProductReview
	var photoURLs []string

	for _, r := range allReviews {
		if r.Status != StatusApproved && r.Status != StatusFeatured {
			continue // Strict Moderation Gate
		}

		// Privacy Masking: Show First Name + Initial (e.g. "Tanvir R.")
		r.CustomerName = maskCustomerName(r.CustomerName)
		r.CustomerEmail = "" // Strip private email
		r.CustomerPhone = "" // Strip private telephone number
		r.StaffNotes = nil   // Strip internal staff notes

		publicReviews = append(publicReviews, r)

		for _, img := range r.Images {
			photoURLs = append(photoURLs, img.ImageURL)
		}
	}

	resp := &StorefrontReviewsResponse{
		Summary:   summary,
		Reviews:   publicReviews,
		PhotoUrls: photoURLs,
	}

	// 4. Cache response in Redis for 1 hour
	if s.redis != nil && page <= 1 {
		if bytes, err := json.Marshal(resp); err == nil {
			s.redis.Set(ctx, cacheKey, string(bytes), 1*time.Hour)
		}
	}

	return resp, nil
}

// InvalidateProductCache wipes cached review summaries and catalog caches for the product.
func (s *Service) invalidateProductCache(ctx context.Context, storeSlug, productID string) {
	if s.redis == nil {
		return
	}
	cacheKey := fmt.Sprintf("store:%s:product:%s:reviews_summary", storeSlug, productID)
	s.redis.Del(ctx, cacheKey)
	s.redis.Del(ctx, fmt.Sprintf("store:%s:catalog:products", storeSlug))
}

// Helper: Mask customer name for public storefront privacy (e.g. "Tanvir Rahman" -> "Tanvir R.")
func maskCustomerName(fullName string) string {
	parts := strings.Fields(strings.TrimSpace(fullName))
	if len(parts) == 0 {
		return "Verified Customer"
	}
	if len(parts) == 1 {
		return parts[0]
	}
	lastNameRune := []rune(parts[1])
	if len(lastNameRune) > 0 {
		return fmt.Sprintf("%s %c.", parts[0], lastNameRune[0])
	}
	return parts[0]
}
