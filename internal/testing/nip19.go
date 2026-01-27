// Package testing provides NIP-19 Bech32 Encoding tests.
package testing

import (
	"context"
	"fmt"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP19Test tests NIP-19 Bech32 Encoding.
type NIP19Test struct {
	nak *nak.Nak
}

// NewNIP19Test creates a new NIP-19 test.
func NewNIP19Test(nakClient *nak.Nak) *NIP19Test {
	return &NIP19Test{nak: nakClient}
}

// ID returns the test ID.
func (t *NIP19Test) ID() string {
	return "nip19"
}

// Name returns the test name.
func (t *NIP19Test) Name() string {
	return "NIP-19: Bech32 Encoding"
}

// Description returns the test description.
func (t *NIP19Test) Description() string {
	return "Test encode/decode roundtrip for npub, nsec, note"
}

// Run executes the NIP-19 test.
func (t *NIP19Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Check if nak is available
	if t.nak == nil {
		steps = append(steps, makeStep("Check nak CLI", false, "", "nak CLI not available - install from https://github.com/fiatjaf/nak"))
		return makeResult(t.ID(), false, steps), nil
	}

	// Test 1: Decode a known npub
	testNpub := "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m" // jack
	if input, ok := params["input"].(string); ok && input != "" {
		testNpub = input
	}

	decoded, err := t.nak.Decode(testNpub)
	if err != nil {
		steps = append(steps, makeStep("Decode npub", false, "", err.Error()))
		success = false
	} else {
		hexPreview := decoded.Hex
		if len(hexPreview) > 16 {
			hexPreview = hexPreview[:16]
		}
		steps = append(steps, makeStep("Decode npub", true, fmt.Sprintf("Type: %s, Hex: %s...", decoded.Type, hexPreview), ""))
	}

	// Test 2: Re-encode and verify roundtrip
	if decoded != nil && decoded.Type == "npub" {
		reencoded, err := t.nak.Encode("npub", decoded.Hex)
		if err != nil {
			steps = append(steps, makeStep("Re-encode npub", false, "", err.Error()))
			success = false
		} else if reencoded != testNpub {
			steps = append(steps, makeStep("Verify roundtrip", false, "", "Roundtrip mismatch"))
			success = false
		} else {
			steps = append(steps, makeStep("Verify roundtrip", true, "Input matches output", ""))
		}
	}

	// Test 3: Generate keypair and test nsec roundtrip
	keypair, err := t.nak.GenerateKey()
	if err != nil {
		steps = append(steps, makeStep("Generate keypair", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	nsecPreview := keypair.PrivateKey
	if len(nsecPreview) > 12 {
		nsecPreview = nsecPreview[:12]
	}
	steps = append(steps, makeStep("Generate keypair", true, fmt.Sprintf("nsec: %s...", nsecPreview), ""))

	// Test 4: Decode nsec
	decodedNsec, err := t.nak.Decode(keypair.PrivateKey)
	if err != nil {
		steps = append(steps, makeStep("Decode nsec", false, "", err.Error()))
		success = false
	} else {
		steps = append(steps, makeStep("Decode nsec", true, fmt.Sprintf("Type: %s", decodedNsec.Type), ""))
	}

	// Test 5: Re-encode nsec
	if decodedNsec != nil {
		reencodedNsec, err := t.nak.Encode("nsec", decodedNsec.Hex)
		if err != nil {
			steps = append(steps, makeStep("Re-encode nsec", false, "", err.Error()))
			success = false
		} else if reencodedNsec != keypair.PrivateKey {
			steps = append(steps, makeStep("Verify nsec roundtrip", false, "", "Roundtrip mismatch"))
			success = false
		} else {
			steps = append(steps, makeStep("Verify nsec roundtrip", true, "Input matches output", ""))
		}
	}

	// Test 6: Test nevent encoding (nak uses nevent for event IDs)
	testEventID := "5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"
	neventEncoded, err := t.nak.Encode("nevent", testEventID)
	if err != nil {
		steps = append(steps, makeStep("Encode nevent", false, "", err.Error()))
		success = false
	} else {
		neventPreview := neventEncoded
		if len(neventPreview) > 20 {
			neventPreview = neventPreview[:20]
		}
		steps = append(steps, makeStep("Encode nevent", true, fmt.Sprintf("nevent: %s...", neventPreview), ""))

		// Decode it back
		decodedEvent, err := t.nak.Decode(neventEncoded)
		if err != nil {
			steps = append(steps, makeStep("Decode nevent", false, "", err.Error()))
			success = false
		} else if decodedEvent.Hex != testEventID {
			steps = append(steps, makeStep("Verify nevent roundtrip", false, "", "Roundtrip mismatch"))
			success = false
		} else {
			steps = append(steps, makeStep("Verify nevent roundtrip", true, "Input matches output", ""))
		}
	}

	return makeResult(t.ID(), success, steps), nil
}
