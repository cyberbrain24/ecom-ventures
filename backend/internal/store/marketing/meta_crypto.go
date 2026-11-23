package marketing

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

// DeriveFernetKey deterministically creates a 32-byte AES key from META_ENCRYPTION_KEY and SECRET_KEY
// matching the specification: Base64Url(SHA-256(META_ENCRYPTION_KEY || SECRET_KEY))
func DeriveFernetKey() []byte {
	encKey := os.Getenv("META_ENCRYPTION_KEY")
	if encKey == "" {
		encKey = "poshplex_meta_graph_api_secret_master_key_2026"
	}
	secKey := os.Getenv("SECRET_KEY")
	if secKey == "" {
		secKey = "platform_secure_password_2026"
	}

	combined := encKey + "||" + secKey
	hash := sha256.Sum256([]byte(combined))
	return hash[:]
}

// EncryptToken encrypts plaintext tokens (EAAB...) with AES-256-GCM authenticated cipher.
func EncryptToken(plaintext string) (string, error) {
	if plaintext == "" {
		return "", errors.New("cannot encrypt empty token")
	}

	key := DeriveFernetKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("creating aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("reading nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.URLEncoding.EncodeToString(ciphertext), nil
}

// DecryptToken safely decrypts token in-memory only for background sync and graph explorer execution.
func DecryptToken(encrypted string) (string, error) {
	if encrypted == "" {
		return "", errors.New("cannot decrypt empty token")
	}

	data, err := base64.URLEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("decoding base64 ciphertext: %w", err)
	}

	key := DeriveFernetKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("creating aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypting token: %w", err)
	}

	return string(plaintext), nil
}
