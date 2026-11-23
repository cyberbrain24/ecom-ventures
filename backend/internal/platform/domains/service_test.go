package domains

import (
	"strings"
	"testing"
)

func TestDomainFormatValidation(t *testing.T) {
	valid := []string{"mior.com", "shop.branda.com", "sub.domain.co.uk", "brand-name.org"}
	for _, d := range valid {
		if !domainFormatRegex.MatchString(d) {
			t.Errorf("expected valid domain for %q, got invalid", d)
		}
	}

	invalid := []string{"http://mior.com", "mior..com", "-invalid.com", "mior.c", "no-tld"}
	for _, d := range invalid {
		if domainFormatRegex.MatchString(d) {
			t.Errorf("expected invalid domain for %q, got valid", d)
		}
	}
}

func TestGenerateVerificationToken(t *testing.T) {
	verifier := NewStandardDNSVerifier()
	tok1, err := verifier.GenerateVerificationToken()
	if err != nil {
		t.Fatalf("token generation failed: %v", err)
	}
	tok2, err := verifier.GenerateVerificationToken()
	if err != nil {
		t.Fatalf("token generation failed: %v", err)
	}

	if len(tok1) < 20 || !strings.HasPrefix(tok1, "ecom-verify-") {
		t.Errorf("invalid token format: %s", tok1)
	}

	if tok1 == tok2 {
		t.Errorf("consecutive verification tokens must not collide")
	}
}
