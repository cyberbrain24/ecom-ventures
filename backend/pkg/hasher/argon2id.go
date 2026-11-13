// Package hasher provides cryptographic password hashing using the Argon2id algorithm.
// Implements secure salt generation, constant-time comparison, and standardized encoding.
package hasher

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

var (
	ErrInvalidHash         = errors.New("hasher: hash is not in the correct format")
	ErrIncompatibleVersion = errors.New("hasher: incompatible version of argon2")
)

// Params defines the configuration parameters for the Argon2id algorithm.
type Params struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

// DefaultParams provides sensible production defaults: 64MB memory, 3 iterations, 4 threads.
var DefaultParams = &Params{
	Memory:      64 * 1024,
	Iterations:  3,
	Parallelism: 4,
	SaltLength:  16,
	KeyLength:   32,
}

// Argon2idHasher provides an object-oriented wrapper for Argon2id hashing.
type Argon2idHasher struct {
	params *Params
}

// NewArgon2idHasher instantiates a new Argon2id hasher using DefaultParams.
func NewArgon2idHasher() *Argon2idHasher {
	return &Argon2idHasher{params: DefaultParams}
}

// Hash generates an Argon2id hash for the given password.
func (h *Argon2idHasher) Hash(password string) (string, error) {
	return HashPasswordCustom(password, h.params)
}

// Compare verifies a plaintext password against an encoded hash.
func (h *Argon2idHasher) Compare(password, encodedHash string) (bool, error) {
	return ComparePassword(password, encodedHash)
}

// Verify verifies a plaintext password against an encoded hash (alias for Compare).
func (h *Argon2idHasher) Verify(password, encodedHash string) (bool, error) {
	return ComparePassword(password, encodedHash)
}

// HashPassword generates an Argon2id hash string from plaintext password using DefaultParams.
// Output format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
func HashPassword(password string) (string, error) {
	return HashPasswordCustom(password, DefaultParams)
}

// HashPasswordCustom generates an Argon2id hash using specified custom parameters.
func HashPasswordCustom(password string, p *Params) (string, error) {
	salt := make([]byte, p.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("hasher: failed to generate secure salt: %w", err)
	}

	hash := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, p.KeyLength)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, p.Memory, p.Iterations, p.Parallelism, b64Salt, b64Hash)

	return encoded, nil
}

// ComparePassword verifies a plaintext password against an encoded Argon2id hash string.
// Performs constant-time memory comparisons to prevent timing attacks.
func ComparePassword(password, encodedHash string) (bool, error) {
	p, salt, hash, err := decodeHash(encodedHash)
	if err != nil {
		return false, err
	}

	otherHash := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, p.KeyLength)

	if subtle.ConstantTimeCompare(hash, otherHash) == 1 {
		return true, nil
	}
	return false, nil
}

func decodeHash(encodedHash string) (*Params, []byte, []byte, error) {
	vals := strings.Split(encodedHash, "$")
	if len(vals) != 6 {
		return nil, nil, nil, ErrInvalidHash
	}

	if vals[1] != "argon2id" {
		return nil, nil, nil, ErrInvalidHash
	}

	var version int
	if _, err := fmt.Sscanf(vals[2], "v=%d", &version); err != nil {
		return nil, nil, nil, err
	}
	if version != argon2.Version {
		return nil, nil, nil, ErrIncompatibleVersion
	}

	p := &Params{}
	if _, err := fmt.Sscanf(vals[3], "m=%d,t=%d,p=%d", &p.Memory, &p.Iterations, &p.Parallelism); err != nil {
		return nil, nil, nil, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(vals[4])
	if err != nil {
		return nil, nil, nil, err
	}
	p.SaltLength = uint32(len(salt))

	hash, err := base64.RawStdEncoding.DecodeString(vals[5])
	if err != nil {
		return nil, nil, nil, err
	}
	p.KeyLength = uint32(len(hash))

	return p, salt, hash, nil
}
