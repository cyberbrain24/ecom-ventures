package catalog

import (
	"fmt"
	"strings"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// CartesianGenerator computes combinatorial variant configurations.
type CartesianGenerator struct{}

// NewCartesianGenerator instantiates the combinatorial generator.
func NewCartesianGenerator() *CartesianGenerator {
	return &CartesianGenerator{}
}

// GenerateCombinations calculates the Cartesian product across multiple attribute value sets.
// Example: [[Red, Blue], [S, M]] -> [[Red, S], [Red, M], [Blue, S], [Blue, M]]
func (g *CartesianGenerator) GenerateCombinations(valueGroups [][]storeModels.AttributeValue) [][]storeModels.AttributeValue {
	if len(valueGroups) == 0 {
		return nil
	}

	for _, group := range valueGroups {
		if len(group) == 0 {
			return nil
		}
	}

	result := [][]storeModels.AttributeValue{{}}

	for _, group := range valueGroups {
		var next [][]storeModels.AttributeValue
		for _, currentCombination := range result {
			for _, item := range group {
				comb := make([]storeModels.AttributeValue, len(currentCombination)+1)
				copy(comb, currentCombination)
				comb[len(currentCombination)] = item
				next = append(next, comb)
			}
		}
		result = next
	}

	return result
}

// BuildVariantProposals generates structured SKU proposals from combinatorial sets.
func (g *CartesianGenerator) BuildVariantProposals(
	productTitle string,
	baseSKU string,
	basePrice float64,
	combinations [][]storeModels.AttributeValue,
) []GeneratedVariantProposal {
	var proposals []GeneratedVariantProposal

	cleanBaseSKU := strings.ToUpper(strings.TrimSpace(baseSKU))
	if cleanBaseSKU == "" {
		cleanBaseSKU = strings.ToUpper(GenerateSlug(productTitle))
	}

	for _, combo := range combinations {
		var titleParts []string
		var skuParts []string
		var ids []string

		for _, attrVal := range combo {
			titleParts = append(titleParts, attrVal.DisplayValue)
			// Abbreviate SKU code from value
			code := strings.ToUpper(GenerateSlug(attrVal.Value))
			if len(code) > 4 {
				code = code[:4]
			}
			skuParts = append(skuParts, code)
			ids = append(ids, attrVal.ID)
		}

		fullTitle := fmt.Sprintf("%s - %s", productTitle, strings.Join(titleParts, " / "))
		fullSKU := fmt.Sprintf("%s-%s", cleanBaseSKU, strings.Join(skuParts, "-"))

		proposals = append(proposals, GeneratedVariantProposal{
			Title:             fullTitle,
			SKU:               fullSKU,
			Price:             basePrice,
			AttributeValueIDs: ids,
		})
	}

	return proposals
}
