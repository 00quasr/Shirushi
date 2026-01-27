// Package nak provides key generation and management via nak CLI.
package nak

import (
	"strings"
)

// Keypair represents a Nostr keypair.
type Keypair struct {
	PrivateKey string `json:"private_key"` // nsec format
	PublicKey  string `json:"public_key"`  // npub format
	HexPubKey  string `json:"hex_pubkey"`  // hex format
}

// GenerateKey generates a new Nostr keypair.
func (n *Nak) GenerateKey() (*Keypair, error) {
	// nak key generate outputs hex private key
	hexPrivKey, err := n.Run("key", "generate")
	if err != nil {
		return nil, err
	}
	hexPrivKey = strings.TrimSpace(hexPrivKey)

	// Encode to nsec
	nsec, err := n.Run("encode", "nsec", hexPrivKey)
	if err != nil {
		return nil, err
	}

	// Get public key (hex) from private key
	hexPubKey, err := n.Run("key", "public", hexPrivKey)
	if err != nil {
		return nil, err
	}
	hexPubKey = strings.TrimSpace(hexPubKey)

	// Encode to npub
	npub, err := n.Run("encode", "npub", hexPubKey)
	if err != nil {
		return nil, err
	}

	return &Keypair{
		PrivateKey: strings.TrimSpace(nsec),
		PublicKey:  strings.TrimSpace(npub),
		HexPubKey:  hexPubKey,
	}, nil
}

// PublicKeyFromPrivate derives the public key (npub format) from a private key.
func (n *Nak) PublicKeyFromPrivate(nsec string) (string, error) {
	// Get hex public key from private key
	hexPubKey, err := n.Run("key", "public", nsec)
	if err != nil {
		return "", err
	}

	// Encode to npub
	npub, err := n.Run("encode", "npub", strings.TrimSpace(hexPubKey))
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(npub), nil
}

// ConvertKey converts a key between formats.
func (n *Nak) ConvertKey(key string, toFormat string) (string, error) {
	switch toFormat {
	case "hex":
		return n.Run("decode", key)
	case "npub", "nsec":
		// Need to know if it's a public or private key
		decoded, err := n.Decode(key)
		if err != nil {
			// Assume it's hex and try to encode
			return n.Encode(toFormat, key)
		}
		if toFormat == "npub" && decoded.Type == "nsec" {
			// Convert nsec to npub via public key derivation
			return n.PublicKeyFromPrivate(key)
		}
		return key, nil
	default:
		return "", ErrInvalidFormat
	}
}

// ErrInvalidFormat indicates an invalid key format was requested.
var ErrInvalidFormat = &nakError{"invalid format"}

type nakError struct {
	msg string
}

func (e *nakError) Error() string {
	return e.msg
}
