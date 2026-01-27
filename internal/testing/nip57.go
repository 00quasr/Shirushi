// Package testing provides NIP-57 Lightning Zaps tests.
package testing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP57Test tests NIP-57 Lightning Zaps.
type NIP57Test struct {
	nak       *nak.Nak
	relayPool RelayPool
	client    *http.Client
}

// NewNIP57Test creates a new NIP-57 test.
func NewNIP57Test(nakClient *nak.Nak, relayPool RelayPool) *NIP57Test {
	return &NIP57Test{
		nak:       nakClient,
		relayPool: relayPool,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

// ID returns the test ID.
func (t *NIP57Test) ID() string {
	return "nip57"
}

// Name returns the test name.
func (t *NIP57Test) Name() string {
	return "NIP-57: Lightning Zaps"
}

// Description returns the test description.
func (t *NIP57Test) Description() string {
	return "Parse zap receipts and verify LNURL payment endpoints"
}

// Run executes the NIP-57 test.
func (t *NIP57Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Get pubkey to test zaps for
	pubkey := ""
	if p, ok := params["pubkey"].(string); ok && p != "" {
		pubkey = p
	}

	// Decode npub if provided
	if len(pubkey) > 0 && strings.HasPrefix(pubkey, "npub") {
		if t.nak == nil {
			steps = append(steps, makeStep("Decode npub", false, "", "nak CLI not available - provide hex pubkey instead"))
			return makeResult(t.ID(), false, steps), nil
		}
		decoded, err := t.nak.Decode(pubkey)
		if err != nil {
			steps = append(steps, makeStep("Decode npub", false, "", err.Error()))
			return makeResult(t.ID(), false, steps), nil
		}
		pubkey = decoded.Hex
		steps = append(steps, makeStep("Decode npub", true, fmt.Sprintf("Hex: %s...", pubkey[:16]), ""))
	}

	// Use a known pubkey if none provided (jack)
	if pubkey == "" {
		pubkey = "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"
		steps = append(steps, makeStep("Using default pubkey", true, "jack (for testing)", ""))
	}

	// Step 1: Query for zap receipts (kind 9735)
	relays := t.relayPool.GetConnected()
	if len(relays) == 0 {
		steps = append(steps, makeStep("Query zap receipts", false, "", "No connected relays"))
		return makeResult(t.ID(), false, steps), nil
	}

	// Query for zaps where this pubkey is tagged
	events, err := t.relayPool.QueryEvents("9735", "", "10")
	if err != nil {
		steps = append(steps, makeStep("Query zap receipts", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}

	if len(events) == 0 {
		steps = append(steps, makeStep("Query zap receipts", true, "No zap receipts found (this is OK)", ""))
	} else {
		steps = append(steps, makeStep("Query zap receipts", true, fmt.Sprintf("Found %d zap receipts", len(events)), ""))

		// Parse first zap receipt
		zap := events[0]
		steps = append(steps, makeStep("Sample zap", true, fmt.Sprintf("ID: %s...", zap.ID[:16]), ""))

		// Look for bolt11 tag
		var bolt11 string
		var zapRequest string
		for _, tag := range zap.Tags {
			if len(tag) >= 2 {
				if tag[0] == "bolt11" {
					bolt11 = tag[1]
				} else if tag[0] == "description" {
					zapRequest = tag[1]
				}
			}
		}

		if bolt11 != "" {
			steps = append(steps, makeStep("Extract bolt11", true, fmt.Sprintf("Invoice: %s...", truncate(bolt11, 30)), ""))
		}

		if zapRequest != "" {
			steps = append(steps, makeStep("Extract zap request", true, "Found embedded zap request", ""))
		}
	}

	// Step 2: Query for profile with LNURL (kind 0)
	profiles, err := t.relayPool.QueryEvents("0", pubkey, "1")
	if err != nil {
		steps = append(steps, makeStep("Query profile", false, "", err.Error()))
	} else if len(profiles) == 0 {
		steps = append(steps, makeStep("Query profile", true, "No profile found", ""))
	} else {
		profile := profiles[0]
		steps = append(steps, makeStep("Query profile", true, "Found profile", ""))

		// Parse profile content for lud16 or lud06
		var metadata map[string]interface{}
		if err := json.Unmarshal([]byte(profile.Content), &metadata); err == nil {
			if lud16, ok := metadata["lud16"].(string); ok && lud16 != "" {
				steps = append(steps, makeStep("Found lud16", true, lud16, ""))

				// Try to verify LNURL endpoint
				parts := strings.Split(lud16, "@")
				if len(parts) == 2 {
					lnurlURL := fmt.Sprintf("https://%s/.well-known/lnurlp/%s", parts[1], parts[0])
					resp, err := t.client.Get(lnurlURL)
					if err != nil {
						steps = append(steps, makeStep("Verify LNURL", false, "", err.Error()))
					} else {
						defer resp.Body.Close()
						if resp.StatusCode == http.StatusOK {
							body, _ := io.ReadAll(resp.Body)
							var lnurl map[string]interface{}
							if json.Unmarshal(body, &lnurl) == nil {
								if callback, ok := lnurl["callback"].(string); ok {
									steps = append(steps, makeStep("Verify LNURL", true, fmt.Sprintf("Callback: %s", truncate(callback, 40)), ""))
								}
							}
						} else {
							steps = append(steps, makeStep("Verify LNURL", false, "", fmt.Sprintf("HTTP %d", resp.StatusCode)))
						}
					}
				}
			} else if lud06, ok := metadata["lud06"].(string); ok && lud06 != "" {
				steps = append(steps, makeStep("Found lud06", true, truncate(lud06, 40), ""))
			} else {
				steps = append(steps, makeStep("Lightning address", true, "No lightning address in profile", ""))
			}
		}
	}

	return makeResult(t.ID(), success, steps), nil
}
