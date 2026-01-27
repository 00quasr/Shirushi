// Package testing provides NIP-05 DNS Identity tests.
package testing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP05Test tests NIP-05 DNS Identity.
type NIP05Test struct {
	client *http.Client
}

// NewNIP05Test creates a new NIP-05 test.
func NewNIP05Test() *NIP05Test {
	return &NIP05Test{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ID returns the test ID.
func (t *NIP05Test) ID() string {
	return "nip05"
}

// Name returns the test name.
func (t *NIP05Test) Name() string {
	return "NIP-05: DNS Identity"
}

// Description returns the test description.
func (t *NIP05Test) Description() string {
	return "Verify a NIP-05 identifier (user@domain.com)"
}

// Run executes the NIP-05 test.
func (t *NIP05Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Get NIP-05 address
	address := ""
	if a, ok := params["address"].(string); ok && a != "" {
		address = a
	}

	if address == "" {
		// Use default test address
		address = "_@fiatjaf.com"
		steps = append(steps, makeStep("Using default address", true, address, ""))
	}

	// Step 1: Parse address
	parts := strings.Split(address, "@")
	if len(parts) != 2 {
		steps = append(steps, makeStep("Parse address", false, "", "Invalid NIP-05 format (expected user@domain)"))
		return makeResult(t.ID(), false, steps), nil
	}
	name := parts[0]
	domain := parts[1]
	steps = append(steps, makeStep("Parse address", true, fmt.Sprintf("Name: %s, Domain: %s", name, domain), ""))

	// Step 2: Fetch .well-known/nostr.json
	url := fmt.Sprintf("https://%s/.well-known/nostr.json?name=%s", domain, name)
	steps = append(steps, makeStep("Build URL", true, url, ""))

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		steps = append(steps, makeStep("Create request", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}

	resp, err := t.client.Do(req)
	if err != nil {
		steps = append(steps, makeStep("Fetch nostr.json", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		steps = append(steps, makeStep("Fetch nostr.json", false, "", fmt.Sprintf("HTTP %d", resp.StatusCode)))
		return makeResult(t.ID(), false, steps), nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		steps = append(steps, makeStep("Read response", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Fetch nostr.json", true, fmt.Sprintf("Received %d bytes", len(body)), ""))

	// Step 3: Parse JSON
	var nip05 struct {
		Names  map[string]string   `json:"names"`
		Relays map[string][]string `json:"relays,omitempty"`
	}
	if err := json.Unmarshal(body, &nip05); err != nil {
		steps = append(steps, makeStep("Parse JSON", false, "", err.Error()))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Parse JSON", true, "Valid JSON structure", ""))

	// Step 4: Find user
	pubkey, exists := nip05.Names[name]
	if !exists {
		steps = append(steps, makeStep("Find user", false, "", fmt.Sprintf("User '%s' not found", name)))
		return makeResult(t.ID(), false, steps), nil
	}
	steps = append(steps, makeStep("Find user", true, fmt.Sprintf("Pubkey: %s...", pubkey[:16]), ""))

	// Step 5: Check relays (optional)
	if relays, ok := nip05.Relays[pubkey]; ok && len(relays) > 0 {
		steps = append(steps, makeStep("Get relays", true, fmt.Sprintf("%d relays found", len(relays)), ""))
		for i, relay := range relays {
			if i >= 3 {
				break
			}
			steps = append(steps, makeStep(fmt.Sprintf("Relay #%d", i+1), true, relay, ""))
		}
	} else {
		steps = append(steps, makeStep("Get relays", true, "No relays specified", ""))
	}

	return makeResult(t.ID(), success, steps), nil
}
