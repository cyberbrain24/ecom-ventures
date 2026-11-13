package catalog

import (
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
)

func TestCartesianMatrixGenerator(t *testing.T) {
	generator := NewCartesianGenerator()

	colors := []storeModels.AttributeValue{
		{ID: "col-1", Value: "Red", DisplayValue: "Ruby Red"},
		{ID: "col-2", Value: "Blue", DisplayValue: "Navy Blue"},
	}

	sizes := []storeModels.AttributeValue{
		{ID: "siz-1", Value: "S", DisplayValue: "Small"},
		{ID: "siz-2", Value: "M", DisplayValue: "Medium"},
		{ID: "siz-3", Value: "L", DisplayValue: "Large"},
	}

	groups := [][]storeModels.AttributeValue{colors, sizes}
	combinations := generator.GenerateCombinations(groups)

	// Expect 2 colors x 3 sizes = 6 permutations
	expectedPermutations := 6
	if len(combinations) != expectedPermutations {
		t.Fatalf("expected %d combinations, got %d", expectedPermutations, len(combinations))
	}

	// Verify SKU and Title proposals
	proposals := generator.BuildVariantProposals("Mior Luxury Silk Shirt", "MIOR-SHIRT", 2500.00, combinations)
	if len(proposals) != expectedPermutations {
		t.Fatalf("expected %d proposals, got %d", expectedPermutations, len(proposals))
	}

	first := proposals[0]
	if first.Title != "Mior Luxury Silk Shirt - Ruby Red / Small" {
		t.Errorf("unexpected first title: %s", first.Title)
	}

	if first.SKU != "MIOR-SHIRT-RED-S" {
		t.Errorf("unexpected first SKU: %s", first.SKU)
	}

	if first.Price != 2500.00 {
		t.Errorf("expected price 2500.00, got %f", first.Price)
	}

	if len(first.AttributeValueIDs) != 2 {
		t.Errorf("expected 2 mapped attribute value IDs, got %d", len(first.AttributeValueIDs))
	}
}

func TestCartesianMatrixGeneratorEmptyInput(t *testing.T) {
	generator := NewCartesianGenerator()

	empty := generator.GenerateCombinations(nil)
	if empty != nil {
		t.Errorf("expected nil result for nil groups")
	}

	emptyGroups := [][]storeModels.AttributeValue{{}}
	res := generator.GenerateCombinations(emptyGroups)
	if res != nil {
		t.Errorf("expected nil result for empty sub-group")
	}
}
