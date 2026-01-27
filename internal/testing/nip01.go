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

	// Check for user-provided signing mode
	signingMode := "generated" // default to generated keys
	if mode, ok := params["signingMode"].(string); ok {
		signingMode = mode
	}

	var privateKey string
	var publicKey string

	// Step 1: Get keypair based on signing mode
	switch signingMode {
	case "provided":
		// User provided their private key (nsec)
		nsec, ok := params["privateKey"].(string)
		if !ok || nsec == "" {
			steps = append(steps, makeStep("Get user keypair", false, "", "Private key (nsec) not provided"))
			return makeResult(t.ID(), false, steps), nil
		}
		privateKey = nsec

		// Derive public key from private key
		pubkey, err := t.nak.PublicKeyFromPrivate(nsec)
		if err != nil {
			steps = append(steps, makeStep("Get user keypair", false, "", "Failed to derive public key: "+err.Error()))
			return makeResult(t.ID(), false, steps), nil
		}
		publicKey = pubkey
		steps = append(steps, makeStep("Use provided keypair", true, fmt.Sprintf("npub: %s...", publicKey[:20]), ""))

	case "extension":
		// Event was signed client-side via NIP-07 extension
		signedEventJSON, ok := params["signedEvent"].(string)
		if !ok || signedEventJSON == "" {
			steps = append(steps, makeStep("Get signed event", false, "", "Pre-signed event not provided"))
			return makeResult(t.ID(), false, steps), nil
		}

		// Verify the pre-signed event
		valid, err := t.nak.Verify(signedEventJSON)
		if err != nil || !valid {
			errMsg := "signature invalid"
			if err != nil {
				errMsg = err.Error()
			}
			steps = append(steps, makeStep("Verify extension-signed event", false, "", errMsg))
			return makeResult(t.ID(), false, steps), nil
		}
		steps = append(steps, makeStep("Verify extension-signed event", true, "Signature valid", ""))

		// Publish the pre-signed event
		relays := t.relayPool.GetConnected()
		if len(relays) > 0 {
			err = t.nak.Publish(signedEventJSON, relays[0])
			if err != nil {
				steps = append(steps, makeStep("Publish extension-signed event", false, "", err.Error()))
			} else {
				steps = append(steps, makeStep("Publish extension-signed event", true, fmt.Sprintf("Published to %s", relays[0]), ""))
			}
		} else {
			steps = append(steps, makeStep("Publish extension-signed event", false, "", "No connected relays"))
		}

		return makeResult(t.ID(), success, steps), nil

	default: // "generated"
		// Generate a new keypair for testing
		keypair, err := t.nak.GenerateKey()
		if err != nil {
			steps = append(steps, makeStep("Generate keypair", false, "", err.Error()))
			return makeResult(t.ID(), false, steps), nil
		}
		privateKey = keypair.PrivateKey
		publicKey = keypair.PublicKey
		steps = append(steps, makeStep("Generate keypair", true, fmt.Sprintf("npub: %s...", publicKey[:20]), ""))
	}

	// Step 2: Create event
	content := "Shirushi NIP-01 test event"
	if c, ok := params["content"].(string); ok && c != "" {
		content = c
	}

	event, err := t.nak.CreateEvent(nak.CreateEventOptions{
		Kind:       1,
		Content:    content,
		PrivateKey: privateKey,
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
