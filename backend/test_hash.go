package main
import (
    "fmt"
    "ecom-ventures/backend/pkg/hasher"
)
func main() {
    passwords := []string{"admin123", "PlatformSecurePassword2026!", "PoshplexSecure2026!", "Admin123!", "admin", "password"}
    hash1 := "=19=65536,t=3,p=4/dpuyUtjbJNClfVNqhEYQ+N1ecDNyk0vPxjmjWeS9/yr58q+XQrZ+Aqxxjx950Y"
    hash2 := "=19=65536,t=3,p=4+xo3/IIDwpBwVOd2dOn4Rc"

    for _, p := range passwords {
        m1, _ := hasher.ComparePassword(p, hash1)
        m2, _ := hasher.ComparePassword(p, hash2)
        if m1 { fmt.Printf("hash1 matches: %s\n", p) }
        if m2 { fmt.Printf("hash2 matches: %s\n", p) }
    }
    
    newHash, _ := hasher.HashPassword("Admin123!")
    fmt.Println("Hash of Admin123!:", newHash)
}
