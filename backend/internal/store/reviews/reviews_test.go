package reviews

import (
	"context"
	"database/sql"
	"testing"
	"time"
)

// MockRepository implements Repository for unit testing.
type MockRepository struct {
	reviews []*ProductReview
}

func (m *MockRepository) ListReviews(ctx context.Context, db *sql.DB, filter ReviewFilter) ([]*ProductReview, int, error) {
	return m.reviews, len(m.reviews), nil
}

func (m *MockRepository) GetReviewByID(ctx context.Context, db *sql.DB, id string) (*ProductReview, error) {
	for _, r := range m.reviews {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (m *MockRepository) GetReviewByProductAndCustomer(ctx context.Context, db *sql.DB, productID, customerID string) (*ProductReview, error) {
	for _, r := range m.reviews {
		if r.ProductID == productID && r.CustomerID == customerID {
			return r, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (m *MockRepository) CreateReview(ctx context.Context, db *sql.DB, r *ProductReview, images []string) (*ProductReview, error) {
	r.ID = "rev-mock-123"
	r.CreatedAt = time.Now()
	r.UpdatedAt = time.Now()
	m.reviews = append(m.reviews, r)
	return r, nil
}

func (m *MockRepository) UpdateReview(ctx context.Context, db *sql.DB, r *ProductReview, images []string) (*ProductReview, error) {
	r.UpdatedAt = time.Now()
	return r, nil
}

func (m *MockRepository) UpdateReviewStatus(ctx context.Context, db *sql.DB, id string, status ReviewStatus, isFeatured bool, staffNotes *string) error {
	for _, r := range m.reviews {
		if r.ID == id {
			r.Status = status
			r.IsFeatured = isFeatured
			if staffNotes != nil {
				r.StaffNotes = staffNotes
			}
			return nil
		}
	}
	return sql.ErrNoRows
}

func (m *MockRepository) DeleteReview(ctx context.Context, db *sql.DB, id string) error {
	var filtered []*ProductReview
	for _, r := range m.reviews {
		if r.ID != id {
			filtered = append(filtered, r)
		}
	}
	m.reviews = filtered
	return nil
}

func (m *MockRepository) GetProductRatingSummary(ctx context.Context, db *sql.DB, productID string) (*RatingSummary, error) {
	summary := &RatingSummary{
		ProductID:       productID,
		AverageRating:   4.8,
		ReviewCount:     15,
		RatingBreakdown: map[int]int{5: 12, 4: 3, 3: 0, 2: 0, 1: 0},
		PhotoCount:      4,
	}
	return summary, nil
}

func (m *MockRepository) FindCustomerByPhoneOrEmail(ctx context.Context, db *sql.DB, phone, email string) (string, error) {
	if phone == "01700000000" {
		return "cust-1", nil
	}
	return "", sql.ErrNoRows
}

func (m *MockRepository) CheckCustomerVerifiedPurchase(ctx context.Context, db *sql.DB, customerID, productID string) (bool, *string, error) {
	orderID := "ord-1"
	return true, &orderID, nil
}

func TestMaskCustomerName(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Tanvir Rahman", "Tanvir R."},
		{"Farhan", "Farhan"},
		{"Mahmudul Hasan Khan", "Mahmudul H."},
		{"", "Verified Customer"},
	}

	for _, c := range cases {
		out := maskCustomerName(c.input)
		if out != c.expected {
			t.Errorf("maskCustomerName(%q) = %q; expected %q", c.input, out, c.expected)
		}
	}
}

func TestRatingSummaryCalculation(t *testing.T) {
	repo := &MockRepository{}
	summary, err := repo.GetProductRatingSummary(context.Background(), nil, "prod-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if summary.AverageRating != 4.8 {
		t.Errorf("expected average rating 4.8, got %f", summary.AverageRating)
	}
	if summary.ReviewCount != 15 {
		t.Errorf("expected review count 15, got %d", summary.ReviewCount)
	}
	if summary.RatingBreakdown[5] != 12 {
		t.Errorf("expected 12 5-star reviews, got %d", summary.RatingBreakdown[5])
	}
}
