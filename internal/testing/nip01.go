// Package testing provides NIP-01 Basic Protocol tests.
package testing

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP01Test tests NIP-01 Basic Protocol.
type NIP01Test struct {
	nak       *nak.Nak
	relayPool RelayPool
}

// NewNIP01Test creates a new NIP-01 test.
func NewNIP01Test(nakClient *nak.Nak, relayPool RelayPool) *NIP01Test {
	return &NIP01Test{
		nak:       nakClient,
		relayPool: relayPool,
	}
}

// ID returns the test ID.
func (t *NIP01Test) ID() string {
	return "nip01"
}

// Name returns the test name.
func (t *NIP01Test) Name() string {
	return "NIP-01: Basic Protocol"
}

// Description returns the test description.
func (t *NIP01Test) Description() string {
	return "Test basic protocol: create event, sign, publish, query, verify"
}

// Run executes the NIP-01 test.
func (t *NIP01Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Check if nak is available
	if t.nak == nil {
		steps = append(steps, makeStep("Check nak CLI", false, "", "nak CLI not available - install from https://github.com/fiatjaf/nak"))
		return makeResult(t.ID(), false, steps), nil
	}

	// Step 1: Generate keypair
	keypair, err := t.nak.GenerateKey()
	if err != nil {
		steps = append(steps, makeStep("Generate keypair", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Generate keypair", true, fmt.Sprintf("npub: %s...", keypair.PublicKey[:20]), ""))

	// Step 2: Create event
	content := "Shirushi NIP-01 test event"
	if c, ok := params["content"].(string); ok && c != "" {
		content = c
	}

	event, err := t.nak.CreateEvent(nak.CreateEventOptions{
		Kind:       1,
		Content:    content,
		PrivateKey: keypair.PrivateKey,
	})
	if err != nil {
		steps = append(steps, makeStep("Create event", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Create event", true, fmt.Sprintf("ID: %s...", event.ID[:16]), ""))

	// Step 3: Verify signature
	eventJSON, _ := json.Marshal(event)
	valid, err := t.nak.Verify(string(eventJSON))
	if err != nil || !valid {
		errMsg := "signature invalid"
		if err != nil {
			errMsg = err.Error()
		}
		steps = append(steps, makeStep("Verify signature", false, "", errMsg))
		success = false
	} else {
		steps = append(steps, makeStep("Verify signature", true, "Signature valid", ""))
	}

	// Step 4: Publish to relay (optional)
	relays := t.relayPool.GetConnected()
	if len(relays) > 0 {
		targetRelay := relays[0]
		err = t.nak.Publish(string(eventJSON), targetRelay)
		if err != nil {
			steps = append(steps, makeStep("Publish to relay", false, "", err.Error()))
			// Don't fail the whole test if publish fails
		} else {
			steps = append(steps, makeStep("Publish to relay", true, fmt.Sprintf("Published to %s", targetRelay), ""))

			// Step 5: Query back
			events, err := t.relayPool.QueryEvents(fmt.Sprintf("%d", event.Kind), event.PubKey, "1")
			if err != nil {
				steps = append(steps, makeStep("Query event back", false, "", err.Error()))
			} else if len(events) == 0 {
				steps = append(steps, makeStep("Query event back", false, "", "Event not found"))
			} else {
				steps = append(steps, makeStep("Query event back", true, fmt.Sprintf("Found %d events", len(events)), ""))
			}
		}
	} else {
		steps = append(steps, makeStep("Publish to relay", false, "", "No connected relays"))
	}

	return makeResult(t.ID(), success, steps), nil
}
