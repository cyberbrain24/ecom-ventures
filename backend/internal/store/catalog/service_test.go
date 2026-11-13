package catalog

import (
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
)

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Mior Classic Leather Jacket", "mior-classic-leather-jacket"},
		{"Men's Fashion & Accessories!", "men-s-fashion-accessories"},
		{"   Multiple    Spaces   ", "multiple-spaces"},
		{"Perfume 50ml / 100ml", "perfume-50ml-100ml"},
	}

	for _, tt := range tests {
		got := GenerateSlug(tt.input)
		if got != tt.expected {
			t.Errorf("GenerateSlug(%q) = %q, expected %q", tt.input, got, tt.expected)
		}
	}
}

func TestBuildCategoryTree(t *testing.T) {
	parentID := "cat-root-1"
	childID := "cat-child-1"

	categories := []storeModels.Category{
		{ID: parentID, Name: "Apparel", ParentID: nil},
		{ID: childID, Name: "Shirts", ParentID: &parentID},
		{ID: "cat-grandchild-1", Name: "Formal Shirts", ParentID: &childID},
	}

	tree := buildCategoryTree(categories, nil)
	if len(tree) != 1 {
		t.Fatalf("expected 1 root node, got %d", len(tree))
	}

	root := tree[0]
	if root.Name != "Apparel" {
		t.Errorf("expected root name Apparel, got %s", root.Name)
	}

	if len(root.Children) != 1 {
		t.Fatalf("expected 1 child under Apparel, got %d", len(root.Children))
	}

	child := root.Children[0]
	if child.Name != "Shirts" {
		t.Errorf("expected child Shirts, got %s", child.Name)
	}

	if len(child.Children) != 1 {
		t.Fatalf("expected 1 grandchild under Shirts, got %d", len(child.Children))
	}
}
