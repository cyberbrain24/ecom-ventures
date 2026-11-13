package reviews

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// Repository defines data access operations for tenant-isolated product reviews.
type Repository interface {
	ListReviews(ctx context.Context, db *sql.DB, filter ReviewFilter) ([]*ProductReview, int, error)
	GetReviewByID(ctx context.Context, db *sql.DB, id string) (*ProductReview, error)
	GetReviewByProductAndCustomer(ctx context.Context, db *sql.DB, productID, customerID string) (*ProductReview, error)
	CreateReview(ctx context.Context, db *sql.DB, r *ProductReview, images []string) (*ProductReview, error)
	UpdateReview(ctx context.Context, db *sql.DB, r *ProductReview, images []string) (*ProductReview, error)
	UpdateReviewStatus(ctx context.Context, db *sql.DB, id string, status ReviewStatus, isFeatured bool, staffNotes *string) error
	DeleteReview(ctx context.Context, db *sql.DB, id string) error
	GetProductRatingSummary(ctx context.Context, db *sql.DB, productID string) (*RatingSummary, error)
	FindCustomerByPhoneOrEmail(ctx context.Context, db *sql.DB, phone, email string) (string, error)
	CheckCustomerVerifiedPurchase(ctx context.Context, db *sql.DB, customerID, productID string) (bool, *string, error)
}

// PostgresRepository implements Repository for PostgreSQL tenant databases.
type PostgresRepository struct{}

// NewRepository instantiates the PostgresRepository.
func NewRepository() *PostgresRepository {
	return &PostgresRepository{}
}

// ListReviews queries reviews matching the filter criteria with pagination.
func (repo *PostgresRepository) ListReviews(ctx context.Context, db *sql.DB, filter ReviewFilter) ([]*ProductReview, int, error) {
	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if filter.Status != nil && *filter.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("pr.status = $%d", argIdx))
		args = append(args, string(*filter.Status))
		argIdx++
	}

	if filter.ProductID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("pr.product_id = $%d", argIdx))
		args = append(args, filter.ProductID)
		argIdx++
	}

	if filter.CustomerID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("pr.customer_id = $%d", argIdx))
		args = append(args, filter.CustomerID)
		argIdx++
	}

	if filter.Rating > 0 {
		whereClauses = append(whereClauses, fmt.Sprintf("pr.rating = $%d", argIdx))
		args = append(args, filter.Rating)
		argIdx++
	}

	if filter.IsFeatured != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("pr.is_featured = $%d", argIdx))
		args = append(args, *filter.IsFeatured)
		argIdx++
	}

	if filter.Search != "" {
		likeTerm := "%" + strings.ToLower(filter.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(LOWER(pr.comment) LIKE $%d OR LOWER(pr.title) LIKE $%d OR LOWER(c.first_name || ' ' || c.last_name) LIKE $%d OR LOWER(p.title) LIKE $%d OR c.phone LIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, likeTerm)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// 1. Count Total
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM product_reviews pr
		JOIN customers c ON pr.customer_id = c.id
		JOIN products p ON pr.product_id = p.id
		%s
	`, whereSQL)

	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count reviews: %w", err)
	}

	// 2. Fetch Page
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := (filter.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	selectQuery := fmt.Sprintf(`
		SELECT 
			pr.id, pr.product_id, pr.customer_id, pr.order_id, pr.created_by_staff_id,
			pr.rating, pr.title, pr.comment, pr.status, pr.is_featured, pr.is_verified_purchase,
			pr.display_order, pr.staff_notes, pr.created_at, pr.updated_at,
			c.first_name || ' ' || c.last_name AS customer_name,
			c.email AS customer_email,
			COALESCE(c.phone, '') AS customer_phone,
			p.title AS product_title,
			p.slug AS product_slug,
			COALESCE(p.featured_image_url, '') AS product_featured_image
		FROM product_reviews pr
		JOIN customers c ON pr.customer_id = c.id
		JOIN products p ON pr.product_id = p.id
		%s
		ORDER BY pr.display_order ASC, pr.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	queryArgs := append(args, limit, offset)
	rows, err := db.QueryContext(ctx, selectQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query reviews: %w", err)
	}
	defer rows.Close()

	var reviewList []*ProductReview
	for rows.Next() {
		r := &ProductReview{}
		var orderID, staffID, staffNotes sql.NullString

		if err := rows.Scan(
			&r.ID, &r.ProductID, &r.CustomerID, &orderID, &staffID,
			&r.Rating, &r.Title, &r.Comment, &r.Status, &r.IsFeatured, &r.IsVerifiedPurchase,
			&r.DisplayOrder, &staffNotes, &r.CreatedAt, &r.UpdatedAt,
			&r.CustomerName, &r.CustomerEmail, &r.CustomerPhone,
			&r.ProductTitle, &r.ProductSlug, &r.ProductFeaturedImg,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan review: %w", err)
		}

		if orderID.Valid {
			r.OrderID = &orderID.String
		}
		if staffID.Valid {
			r.CreatedByStaffID = &staffID.String
		}
		if staffNotes.Valid {
			r.StaffNotes = &staffNotes.String
		}
		r.Images = []ReviewImage{}
		reviewList = append(reviewList, r)
	}

	// 3. Attach Review Images
	for _, r := range reviewList {
		images, err := repo.fetchImagesForReview(ctx, db, r.ID)
		if err == nil {
			r.Images = images
		}
	}

	return reviewList, total, nil
}

// GetReviewByID fetches a review by primary key ID.
func (repo *PostgresRepository) GetReviewByID(ctx context.Context, db *sql.DB, id string) (*ProductReview, error) {
	query := `
		SELECT 
			pr.id, pr.product_id, pr.customer_id, pr.order_id, pr.created_by_staff_id,
			pr.rating, pr.title, pr.comment, pr.status, pr.is_featured, pr.is_verified_purchase,
			pr.display_order, pr.staff_notes, pr.created_at, pr.updated_at,
			c.first_name || ' ' || c.last_name AS customer_name,
			c.email AS customer_email,
			COALESCE(c.phone, '') AS customer_phone,
			p.title AS product_title,
			p.slug AS product_slug,
			COALESCE(p.featured_image_url, '') AS product_featured_image
		FROM product_reviews pr
		JOIN customers c ON pr.customer_id = c.id
		JOIN products p ON pr.product_id = p.id
		WHERE pr.id = $1
	`
	r := &ProductReview{}
	var orderID, staffID, staffNotes sql.NullString

	err := db.QueryRowContext(ctx, query, id).Scan(
		&r.ID, &r.ProductID, &r.CustomerID, &orderID, &staffID,
		&r.Rating, &r.Title, &r.Comment, &r.Status, &r.IsFeatured, &r.IsVerifiedPurchase,
		&r.DisplayOrder, &staffNotes, &r.CreatedAt, &r.UpdatedAt,
		&r.CustomerName, &r.CustomerEmail, &r.CustomerPhone,
		&r.ProductTitle, &r.ProductSlug, &r.ProductFeaturedImg,
	)
	if err != nil {
		return nil, err
	}

	if orderID.Valid {
		r.OrderID = &orderID.String
	}
	if staffID.Valid {
		r.CreatedByStaffID = &staffID.String
	}
	if staffNotes.Valid {
		r.StaffNotes = &staffNotes.String
	}

	images, _ := repo.fetchImagesForReview(ctx, db, r.ID)
	r.Images = images

	return r, nil
}

// GetReviewByProductAndCustomer checks existing reviews by a given customer on a product (Single-Review Constraint).
func (repo *PostgresRepository) GetReviewByProductAndCustomer(ctx context.Context, db *sql.DB, productID, customerID string) (*ProductReview, error) {
	query := `
		SELECT 
			pr.id, pr.product_id, pr.customer_id, pr.order_id, pr.created_by_staff_id,
			pr.rating, pr.title, pr.comment, pr.status, pr.is_featured, pr.is_verified_purchase,
			pr.display_order, pr.staff_notes, pr.created_at, pr.updated_at
		FROM product_reviews pr
		WHERE pr.product_id = $1 AND pr.customer_id = $2
	`
	r := &ProductReview{}
	var orderID, staffID, staffNotes sql.NullString

	err := db.QueryRowContext(ctx, query, productID, customerID).Scan(
		&r.ID, &r.ProductID, &r.CustomerID, &orderID, &staffID,
		&r.Rating, &r.Title, &r.Comment, &r.Status, &r.IsFeatured, &r.IsVerifiedPurchase,
		&r.DisplayOrder, &staffNotes, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if orderID.Valid {
		r.OrderID = &orderID.String
	}
	if staffID.Valid {
		r.CreatedByStaffID = &staffID.String
	}
	if staffNotes.Valid {
		r.StaffNotes = &staffNotes.String
	}

	images, _ := repo.fetchImagesForReview(ctx, db, r.ID)
	r.Images = images

	return r, nil
}

// CreateReview creates a new review inside a transaction and persists attached images.
func (repo *PostgresRepository) CreateReview(ctx context.Context, db *sql.DB, r *ProductReview, images []string) (*ProductReview, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO product_reviews (
			product_id, customer_id, order_id, created_by_staff_id,
			rating, title, comment, status, is_featured, is_verified_purchase,
			display_order, staff_notes
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRowContext(ctx, query,
		r.ProductID, r.CustomerID, r.OrderID, r.CreatedByStaffID,
		r.Rating, r.Title, r.Comment, r.Status, r.IsFeatured, r.IsVerifiedPurchase,
		r.DisplayOrder, r.StaffNotes,
	).Scan(&r.ID, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert review: %w", err)
	}

	r.Images = []ReviewImage{}
	for idx, imgURL := range images {
		cleanURL := strings.TrimSpace(imgURL)
		if cleanURL == "" {
			continue
		}
		var imgID string
		imgQuery := `
			INSERT INTO review_images (review_id, image_url, display_order)
			VALUES ($1, $2, $3)
			RETURNING id
		`
		if err := tx.QueryRowContext(ctx, imgQuery, r.ID, cleanURL, idx).Scan(&imgID); err != nil {
			return nil, fmt.Errorf("failed to insert review image: %w", err)
		}
		r.Images = append(r.Images, ReviewImage{
			ID:           imgID,
			ReviewID:     r.ID,
			ImageURL:     cleanURL,
			DisplayOrder: idx,
		})
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r, nil
}

// UpdateReview updates an existing review and replaces attached images if provided.
func (repo *PostgresRepository) UpdateReview(ctx context.Context, db *sql.DB, r *ProductReview, images []string) (*ProductReview, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		UPDATE product_reviews SET
			rating = $1,
			title = $2,
			comment = $3,
			status = $4,
			is_featured = $5,
			display_order = $6,
			staff_notes = $7,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $8
		RETURNING updated_at
	`
	if err := tx.QueryRowContext(ctx, query,
		r.Rating, r.Title, r.Comment, r.Status, r.IsFeatured, r.DisplayOrder, r.StaffNotes, r.ID,
	).Scan(&r.UpdatedAt); err != nil {
		return nil, fmt.Errorf("failed to update review: %w", err)
	}

	if images != nil {
		if _, err := tx.ExecContext(ctx, "DELETE FROM review_images WHERE review_id = $1", r.ID); err != nil {
			return nil, fmt.Errorf("failed to remove existing review images: %w", err)
		}

		r.Images = []ReviewImage{}
		for idx, imgURL := range images {
			cleanURL := strings.TrimSpace(imgURL)
			if cleanURL == "" {
				continue
			}
			var imgID string
			imgQuery := `
				INSERT INTO review_images (review_id, image_url, display_order)
				VALUES ($1, $2, $3)
				RETURNING id
			`
			if err := tx.QueryRowContext(ctx, imgQuery, r.ID, cleanURL, idx).Scan(&imgID); err != nil {
				return nil, fmt.Errorf("failed to insert review image: %w", err)
			}
			r.Images = append(r.Images, ReviewImage{
				ID:           imgID,
				ReviewID:     r.ID,
				ImageURL:     cleanURL,
				DisplayOrder: idx,
			})
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r, nil
}

// UpdateReviewStatus applies one-click status transitions and optional staff notes.
func (repo *PostgresRepository) UpdateReviewStatus(ctx context.Context, db *sql.DB, id string, status ReviewStatus, isFeatured bool, staffNotes *string) error {
	query := `
		UPDATE product_reviews SET
			status = $1,
			is_featured = $2,
			staff_notes = COALESCE($3, staff_notes),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`
	_, err := db.ExecContext(ctx, query, status, isFeatured, staffNotes, id)
	return err
}

// DeleteReview permanently deletes a review (attached images cascade delete).
func (repo *PostgresRepository) DeleteReview(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, "DELETE FROM product_reviews WHERE id = $1", id)
	return err
}

// GetProductRatingSummary calculates live mathematical rating statistics for approved reviews.
func (repo *PostgresRepository) GetProductRatingSummary(ctx context.Context, db *sql.DB, productID string) (*RatingSummary, error) {
	summary := &RatingSummary{
		ProductID:       productID,
		AverageRating:   0.0,
		ReviewCount:     0,
		RatingBreakdown: map[int]int{5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
	}

	query := `
		SELECT 
			rating,
			COUNT(*) as count
		FROM product_reviews
		WHERE product_id = $1 AND status IN ('APPROVED', 'FEATURED')
		GROUP BY rating
	`
	rows, err := db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, fmt.Errorf("failed to query rating breakdown: %w", err)
	}
	defer rows.Close()

	totalWeightedRating := 0
	totalCount := 0

	for rows.Next() {
		var star, count int
		if err := rows.Scan(&star, &count); err != nil {
			return nil, fmt.Errorf("failed to scan rating row: %w", err)
		}
		if star >= 1 && star <= 5 {
			summary.RatingBreakdown[star] = count
			totalWeightedRating += star * count
			totalCount += count
		}
	}

	summary.ReviewCount = totalCount
	if totalCount > 0 {
		avg := float64(totalWeightedRating) / float64(totalCount)
		summary.AverageRating = float64(int(avg*10+0.5)) / 10.0 // Round to 1 decimal place
	}

	// Count photo reviews
	photoQuery := `
		SELECT COUNT(DISTINCT ri.id)
		FROM review_images ri
		JOIN product_reviews pr ON ri.review_id = pr.id
		WHERE pr.product_id = $1 AND pr.status IN ('APPROVED', 'FEATURED')
	`
	var photoCount int
	if err := db.QueryRowContext(ctx, photoQuery, productID).Scan(&photoCount); err == nil {
		summary.PhotoCount = photoCount
	}

	// Count verified buyers
	verifiedQuery := `
		SELECT COUNT(*)
		FROM product_reviews
		WHERE product_id = $1 AND status IN ('APPROVED', 'FEATURED') AND is_verified_purchase = true
	`
	var verifiedCount int
	if err := db.QueryRowContext(ctx, verifiedQuery, productID).Scan(&verifiedCount); err == nil {
		summary.VerifiedBuyerCount = verifiedCount
	}

	return summary, nil
}

// FindCustomerByPhoneOrEmail resolves a customer record ID by phone or email.
func (repo *PostgresRepository) FindCustomerByPhoneOrEmail(ctx context.Context, db *sql.DB, phone, email string) (string, error) {
	if phone != "" {
		var id string
		err := db.QueryRowContext(ctx, "SELECT id FROM customers WHERE phone = $1 LIMIT 1", phone).Scan(&id)
		if err == nil {
			return id, nil
		}
	}
	if email != "" {
		var id string
		err := db.QueryRowContext(ctx, "SELECT id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1", email).Scan(&id)
		if err == nil {
			return id, nil
		}
	}
	return "", fmt.Errorf("customer not found by phone or email")
}

// CheckCustomerVerifiedPurchase checks if the customer has an order containing this product.
func (repo *PostgresRepository) CheckCustomerVerifiedPurchase(ctx context.Context, db *sql.DB, customerID, productID string) (bool, *string, error) {
	query := `
		SELECT o.id
		FROM orders o
		JOIN order_items oi ON o.id = oi.order_id
		WHERE o.customer_id = $1 AND oi.product_id = $2
		ORDER BY o.created_at DESC
		LIMIT 1
	`
	var orderID string
	err := db.QueryRowContext(ctx, query, customerID, productID).Scan(&orderID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil, nil
		}
		return false, nil, err
	}
	return true, &orderID, nil
}

// Helper to fetch images for a specific review.
func (repo *PostgresRepository) fetchImagesForReview(ctx context.Context, db *sql.DB, reviewID string) ([]ReviewImage, error) {
	query := `
		SELECT id, review_id, image_url, thumbnail_url, display_order, created_at
		FROM review_images
		WHERE review_id = $1
		ORDER BY display_order ASC
	`
	rows, err := db.QueryContext(ctx, query, reviewID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []ReviewImage
	for rows.Next() {
		var img ReviewImage
		var thumb sql.NullString
		if err := rows.Scan(&img.ID, &img.ReviewID, &img.ImageURL, &thumb, &img.DisplayOrder, &img.CreatedAt); err != nil {
			return nil, err
		}
		if thumb.Valid {
			img.ThumbnailURL = &thumb.String
		}
		images = append(images, img)
	}
	return images, nil
}
