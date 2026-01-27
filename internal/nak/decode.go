// Package nak provides NIP-19 encoding/decoding via nak CLI.
package nak

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Decoded represents a decoded NIP-19 entity.
type Decoded struct {
	Type   string   `json:"type"`   // npub, nsec, note, nevent, nprofile, naddr
	Hex    string   `json:"hex"`    // hex-encoded data (for npub, nsec, note)
	ID     string   `json:"id"`     // event id (for nevent)
	Pubkey string   `json:"pubkey"` // pubkey (for nprofile)
	Relays []string `json:"relays"` // for nevent/nprofile
	Author string   `json:"author"` // for nevent
	Kind   int      `json:"kind"`   // for naddr
}

// Decode decodes a NIP-19 encoded string.
func (n *Nak) Decode(input string) (*Decoded, error) {
	output, err := n.Run("decode", input)
	if err != nil {
		return nil, err
	}

	decoded := &Decoded{}

	// Determine type from prefix
	input = strings.TrimSpace(input)
	switch {
	case strings.HasPrefix(input, "npub"):
		decoded.Type = "npub"
	case strings.HasPrefix(input, "nsec"):
		decoded.Type = "nsec"
	case strings.HasPrefix(input, "note"):
		decoded.Type = "note"
	case strings.HasPrefix(input, "nevent"):
		decoded.Type = "nevent"
	case strings.HasPrefix(input, "nprofile"):
		decoded.Type = "nprofile"
	case strings.HasPrefix(input, "naddr"):
		decoded.Type = "naddr"
	default:
		// Try to parse as JSON for complex types
		if err := json.Unmarshal([]byte(output), decoded); err == nil {
			return decoded, nil
		}
		decoded.Type = "unknown"
	}

	// Parse based on type
	if decoded.Type == "nevent" || decoded.Type == "nprofile" || decoded.Type == "naddr" {
		// nak decode for these types outputs JSON
		json.Unmarshal([]byte(output), decoded)
		// For nevent, the event ID is in "id" field - copy to Hex for compatibility
		if decoded.ID != "" {
			decoded.Hex = decoded.ID
		}
		// For nprofile, the pubkey is in "pubkey" field - copy to Hex
		if decoded.Pubkey != "" && decoded.Hex == "" {
			decoded.Hex = decoded.Pubkey
		}
	} else {
		// For simple types (npub, nsec, note), output is just the hex
		decoded.Hex = strings.TrimSpace(output)
	}

	return decoded, nil
}

// Encode encodes data to NIP-19 format.
func (n *Nak) Encode(typ string, hex string) (string, error) {
	args := []string{"encode", typ, hex}
	return n.Run(args...)
}

// EncodeEvent encodes an event ID to note or nevent format.
func (n *Nak) EncodeEvent(eventID string, relays ...string) (string, error) {
	args := []string{"encode", "nevent", eventID}
	for _, r := range relays {
		args = append(args, "--relay", r)
	}
	return n.Run(args...)
}

// EncodeProfile encodes a pubkey to npub or nprofile format.
func (n *Nak) EncodeProfile(pubkey string, relays ...string) (string, error) {
	if len(relays) == 0 {
		return n.Run("encode", "npub", pubkey)
	}
	args := []string{"encode", "nprofile", pubkey}
	for _, r := range relays {
		args = append(args, "--relay", r)
	}
	return n.Run(args...)
}

// DecodeAndValidate decodes and validates a NIP-19 string.
func (n *Nak) DecodeAndValidate(input string) (*Decoded, error) {
	decoded, err := n.Decode(input)
	if err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	// Validate hex length based on type
	switch decoded.Type {
	case "npub", "nsec":
		if len(decoded.Hex) != 64 {
			return nil, fmt.Errorf("invalid key length")
		}
	case "note":
		if len(decoded.Hex) != 64 {
			return nil, fmt.Errorf("invalid event ID length")
		}
	}

	return decoded, nil
}
