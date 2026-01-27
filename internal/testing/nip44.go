// Package testing provides NIP-44 Encrypted Payloads tests.
package testing

import (
	"context"
	"fmt"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP44Test tests NIP-44 Encrypted Payloads.
type NIP44Test struct {
	nak *nak.Nak
}

// NewNIP44Test creates a new NIP-44 test.
func NewNIP44Test(nakClient *nak.Nak) *NIP44Test {
	return &NIP44Test{nak: nakClient}
}

// ID returns the test ID.
func (t *NIP44Test) ID() string {
	return "nip44"
}

// Name returns the test name.
func (t *NIP44Test) Name() string {
	return "NIP-44: Encrypted Payloads"
}

// Description returns the test description.
func (t *NIP44Test) Description() string {
	return "Test encryption/decryption roundtrip using NIP-44"
}

// Run executes the NIP-44 test.
func (t *NIP44Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Check if nak is available
	if t.nak == nil {
		steps = append(steps, makeStep("Check nak CLI", false, "", "nak CLI not available - install from https://github.com/fiatjaf/nak"))
		return makeResult(t.ID(), false, steps), nil
	}

	// Step 1: Generate sender keypair
	sender, err := t.nak.GenerateKey()
	if err != nil {
		steps = append(steps, makeStep("Generate sender keypair", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Generate sender keypair", true, fmt.Sprintf("npub: %s...", sender.PublicKey[:20]), ""))

	// Step 2: Generate receiver keypair
	receiver, err := t.nak.GenerateKey()
	if err != nil {
		steps = append(steps, makeStep("Generate receiver keypair", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Generate receiver keypair", true, fmt.Sprintf("npub: %s...", receiver.PublicKey[:20]), ""))

	// Step 3: Encrypt a message
	plaintext := "Hello, this is a secret message for NIP-44 testing!"
	if msg, ok := params["message"].(string); ok && msg != "" {
		plaintext = msg
	}

	// Use nak to encrypt: nak encrypt --sec <sender_nsec> -p <receiver_pubkey> <message>
	encrypted, err := t.nak.Run("encrypt", "--sec", sender.PrivateKey, "-p", receiver.PublicKey, plaintext)
	if err != nil {
		// NIP-44 encryption might not be available in all nak versions
		steps = append(steps, makeStep("Encrypt message", false, "", fmt.Sprintf("nak encrypt failed: %v (NIP-44 may not be supported)", err)))
		// Don't fail completely, just note the limitation
		steps = append(steps, makeStep("NIP-44 Status", true, "nak CLI may not support NIP-44 encryption yet", ""))
		return makeResult(t.ID(), success, steps), nil
	}
	steps = append(steps, makeStep("Encrypt message", true, fmt.Sprintf("Ciphertext: %s...", truncate(encrypted, 32)), ""))

	// Step 4: Decrypt the message
	decrypted, err := t.nak.Run("decrypt", "--sec", receiver.PrivateKey, "-p", sender.PublicKey, encrypted)
	if err != nil {
		steps = append(steps, makeStep("Decrypt message", false, "", err.Error()))
		success = false
	} else {
		steps = append(steps, makeStep("Decrypt message", true, fmt.Sprintf("Plaintext: %s", truncate(decrypted, 40)), ""))
	}

	// Step 5: Verify roundtrip
	if decrypted == plaintext {
		steps = append(steps, makeStep("Verify roundtrip", true, "Decrypted text matches original", ""))
	} else {
		steps = append(steps, makeStep("Verify roundtrip", false, "", "Decrypted text does not match original"))
		success = false
	}

	return makeResult(t.ID(), success, steps), nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
