package store_mgmt

import (
	"regexp"
	"testing"
)

// TestRandomHexPasswordFormat checks that generated tenant passwords are 32 lowercase hex
// characters, the only format the provisioner accepts before inlining it into CREATE ROLE.
func TestRandomHexPasswordFormat(t *testing.T) {
	pattern := regexp.MustCompile(`^[0-9a-f]{32}$`)
	first, err := randomHex(16)
	if err != nil {
		t.Fatalf("randomHex returned error: %v", err)
	}
	second, err := randomHex(16)
	if err != nil {
		t.Fatalf("randomHex returned error: %v", err)
	}
	for _, pw := range []string{first, second} {
		if !pattern.MatchString(pw) {
			t.Errorf("generated password %q is not 32 lowercase hex characters", pw)
		}
	}
	if first == second {
		t.Error("two generated passwords were identical")
	}
}
