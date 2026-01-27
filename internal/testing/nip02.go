// Package testing provides NIP-02 Follow List tests.
package testing

import (
	"context"
	"fmt"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP02Test tests NIP-02 Follow List.
type NIP02Test struct {
	nak       *nak.Nak
	relayPool RelayPool
}

// NewNIP02Test creates a new NIP-02 test.
func NewNIP02Test(nakClient *nak.Nak, relayPool RelayPool) *NIP02Test {
	return &NIP02Test{
		nak:       nakClient,
		relayPool: relayPool,
	}
}

// ID returns the test ID.
func (t *NIP02Test) ID() string {
	return "nip02"
}

// Name returns the test name.
func (t *NIP02Test) Name() string {
	return "NIP-02: Follow List"
}

// Description returns the test description.
func (t *NIP02Test) Description() string {
	return "Fetch and parse contact list (kind 3) for a pubkey"
}

// Run executes the NIP-02 test.
func (t *NIP02Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Get pubkey to test
	pubkey := ""
	if p, ok := params["pubkey"].(string); ok && p != "" {
		pubkey = p
	}

	// If npub provided, decode it
	if len(pubkey) > 0 && pubkey[:4] == "npub" {
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

	// Use a known pubkey if none provided (fiatjaf)
	if pubkey == "" {
		pubkey = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"
		steps = append(steps, makeStep("Using default pubkey", true, "fiatjaf (for testing)", ""))
	}

	// Step 1: Query for kind 3 events
	relays := t.relayPool.GetConnected()
	if len(relays) == 0 {
		steps = append(steps, makeStep("Query contact list", false, "", "No connected relays"))
		return makeResult(t.ID(), false, steps), nil
	}

	events, err := t.relayPool.QueryEvents("3", pubkey, "1")
	if err != nil {
		steps = append(steps, makeStep("Query contact list", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}

	if len(events) == 0 {
		steps = append(steps, makeStep("Query contact list", false, "", "No contact list found"))
		return makeResult(t.ID(), false, steps), nil
	}

	event := events[0]
	steps = append(steps, makeStep("Query contact list", true, fmt.Sprintf("Found kind 3 event: %s...", event.ID[:16]), ""))

	// Step 2: Parse tags to extract follows
	follows := []string{}
	for _, tag := range event.Tags {
		if len(tag) >= 2 && tag[0] == "p" {
			follows = append(follows, tag[1])
		}
	}

	if len(follows) == 0 {
		steps = append(steps, makeStep("Parse follows", false, "", "No follows found in contact list"))
		success = false
	} else {
		steps = append(steps, makeStep("Parse follows", true, fmt.Sprintf("Found %d follows", len(follows)), ""))

		// Show first few follows
		displayCount := 3
		if len(follows) < displayCount {
			displayCount = len(follows)
		}
		for i := 0; i < displayCount; i++ {
			// Try to encode as npub if nak is available
			if t.nak != nil {
				npub, err := t.nak.Encode("npub", follows[i])
				if err == nil {
					steps = append(steps, makeStep(fmt.Sprintf("Follow #%d", i+1), true, npub, ""))
					continue
				}
			}
			steps = append(steps, makeStep(fmt.Sprintf("Follow #%d", i+1), true, follows[i][:16]+"...", ""))
		}
	}

	return makeResult(t.ID(), success, steps), nil
}
