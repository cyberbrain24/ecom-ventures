package middleware

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/cors"
)

// BrandDomainPattern matches localhost brand subdomains and apex custom domains.
var localhostBrandPattern = regexp.MustCompile(`^http://[a-zA-Z0-9_-]+\.localhost(:[0-9]+)?$`)

// CORSConfig initializes cross-origin resource sharing allowing administrative
// portals and multi-tenant storefront domains while enforcing origin validation.
func CORSConfig(masterDomain, storeDomain string) func(http.Handler) http.Handler {
	allowed := map[string]bool{
		"http://" + masterDomain:  true,
		"https://" + masterDomain: true,
		"http://" + storeDomain:   true,
		"https://" + storeDomain:  true,
	}

	return cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://" + masterDomain,
			"https://" + masterDomain,
			"http://" + storeDomain,
			"https://" + storeDomain,
		},
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			if allowed[origin] {
				return true
			}
			// Allow local storefront subdomains (e.g., mior.localhost:3000)
			if localhostBrandPattern.MatchString(origin) {
				return true
			}
			// Allow standard local Next.js frontend
			if strings.HasPrefix(origin, "http://localhost:") {
				return true
			}
			return false
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID", "X-Store-Slug"},
		ExposedHeaders:   []string{"Link", "X-Request-ID", "Content-Length"},
		AllowCredentials: true,
		MaxAge:           300, // 5 minutes pre-flight cache
	})
}
