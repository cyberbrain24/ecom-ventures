// Package crypto provides authenticated symmetric encryption using AES-256-GCM.
// Used for encrypting tenant database passwords and sensitive third-party API credentials.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

var (
	ErrInvalidKeySize     = errors.New("crypto: encryption key must be exactly 32 bytes for AES-256")
	ErrCiphertextTooShort = errors.New("crypto: ciphertext payload is too short to contain a valid nonce")
	ErrDecryptionFailed   = errors.New("crypto: failed to decrypt and authenticate ciphertext")
)

// Encrypt encrypts plaintext using AES-256-GCM with a securely generated random nonce.
// Returns base64 standard encoded ciphertext containing both nonce and ciphertext tag.
func Encrypt(plaintext string, key []byte) (string, error) {
	if len(key) != 32 {
		return "", ErrInvalidKeySize
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("crypto: failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto: failed to instantiate GCM AEAD: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("crypto: failed to generate cryptographically secure nonce: %w", err)
	}

	// Seal encrypts and appends the authentication tag to the nonce and ciphertext
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decodes base64 ciphertext and authenticates and decrypts using AES-256-GCM.
func Decrypt(encodedCiphertext string, key []byte) (string, error) {
	if len(key) != 32 {
		return "", ErrInvalidKeySize
	}

	data, err := base64.StdEncoding.DecodeString(encodedCiphertext)
	if err != nil {
		return "", fmt.Errorf("crypto: failed to decode base64 ciphertext: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("crypto: failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto: failed to instantiate GCM AEAD: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrCiphertextTooShort
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	return string(plaintext), nil
}

// EncryptAESGCM encrypts plaintext using AES-256-GCM authenticated encryption.
func EncryptAESGCM(plaintext string, key []byte) (string, error) {
	return Encrypt(plaintext, key)
}

// DecryptAESGCM decodes and decrypts an AES-256-GCM ciphertext payload.
func DecryptAESGCM(encodedCiphertext string, key []byte) (string, error) {
	return Decrypt(encodedCiphertext, key)
}
