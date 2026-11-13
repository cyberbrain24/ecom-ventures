// Package domains manages custom domain registrations, DNS TXT verification,
// and SSL certificate provisioning across the Ecom Ventures platform.
package domains

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"time"
)

// DNSVerifier executes DNS queries to verify domain ownership.
type DNSVerifier interface {
	VerifyTXTRecord(ctx context.Context, domain, expectedToken string) (bool, error)
	GenerateVerificationToken() string
}

// StandardDNSVerifier implements DNS verification using Go's net.Resolver.
type StandardDNSVerifier struct {
	resolver *net.Resolver
}

// NewStandardDNSVerifier constructs a DNS verifier configured with custom timeouts.
func NewStandardDNSVerifier() *StandardDNSVerifier {
	return &StandardDNSVerifier{
		resolver: &net.Resolver{
			PreferGo: true,
		},
	}
}

// GenerateVerificationToken creates a cryptographically secure 16-byte hex token.
func (v *StandardDNSVerifier) GenerateVerificationToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("ecom-verify-%s", hex.EncodeToString(b))
}

// VerifyTXTRecord queries DNS TXT records for _ecom-challenge.<domain> and <domain>.
// Returns true if the expected token is found in any returned record.
func (v *StandardDNSVerifier) VerifyTXTRecord(ctx context.Context, domain, expectedToken string) (bool, error) {
	cleanDomain := strings.ToLower(strings.TrimSpace(domain))
	targetHost := fmt.Sprintf("_ecom-challenge.%s", cleanDomain)

	// Query with timeout
	lookupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	records, err := v.resolver.LookupTXT(lookupCtx, targetHost)
	if err != nil {
		// Fallback: check apex domain directly if subdomain lookup failed
		records, err = v.resolver.LookupTXT(lookupCtx, cleanDomain)
		if err != nil {
			return false, fmt.Errorf("dns lookup failed: %w", err)
		}
	}

	for _, record := range records {
		if strings.TrimSpace(record) == expectedToken {
			return true, nil
		}
	}

	return false, nil
}
