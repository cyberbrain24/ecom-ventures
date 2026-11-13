package catalog

import (
	"testing"
)

func TestBuildCategoryTreeRecursion(t *testing.T) {
	parentID := "cat-1"
	flatNodes := []PublicCategoryNode{
		{ID: "cat-1", Name: "Apparel", Slug: "apparel", ParentID: nil},
		{ID: "cat-2", Name: "Shirts", Slug: "shirts", ParentID: &parentID},
		{ID: "cat-3", Name: "T-Shirts", Slug: "t-shirts", ParentID: &parentID},
		{ID: "cat-4", Name: "Jewelry", Slug: "jewelry", ParentID: nil},
	}

	tree := buildCategoryTree(flatNodes, nil)
	if len(tree) != 2 {
		t.Fatalf("expected 2 root categories, got %d", len(tree))
	}

	if tree[0].Name != "Apparel" {
		t.Errorf("expected first root to be Apparel, got %s", tree[0].Name)
	}

	if len(tree[0].Children) != 2 {
		t.Fatalf("expected Apparel to have 2 children, got %d", len(tree[0].Children))
	}

	if tree[0].Children[0].Name != "Shirts" {
		t.Errorf("expected child to be Shirts, got %s", tree[0].Children[0].Name)
	}
}

func TestDiscountCalculation(t *testing.T) {
	basePrice := 800.00
	compareAt := 1000.00

	discountPercent := int(((compareAt - basePrice) / compareAt) * 100)
	if discountPercent != 20 {
		t.Errorf("expected 20%% discount, got %d%%", discountPercent)
	}
}
