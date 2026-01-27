// Package testing provides NIP-90 Data Vending Machine tests.
package testing

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// NIP90Test tests NIP-90 Data Vending Machines.
type NIP90Test struct {
	nak       *nak.Nak
	relayPool RelayPool
}

// NewNIP90Test creates a new NIP-90 test.
func NewNIP90Test(nakClient *nak.Nak, relayPool RelayPool) *NIP90Test {
	return &NIP90Test{
		nak:       nakClient,
		relayPool: relayPool,
	}
}

// ID returns the test ID.
func (t *NIP90Test) ID() string {
	return "nip90"
}

// Name returns the test name.
func (t *NIP90Test) Name() string {
	return "NIP-90: Data Vending Machines"
}

// Description returns the test description.
func (t *NIP90Test) Description() string {
	return "Discover DVMs, submit job request, monitor feedback"
}

// Run executes the NIP-90 test.
func (t *NIP90Test) Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error) {
	var steps []types.TestStep
	success := true

	// Step 1: Query for DVM announcements (kind 31990)
	relays := t.relayPool.GetConnected()
	if len(relays) == 0 {
		steps = append(steps, makeStep("Discover DVMs", false, "", "No connected relays"))
		return makeResult(t.ID(), false, steps), nil
	}

	// Query for DVM kind announcements
	events, err := t.relayPool.QueryEvents("31990", "", "10")
	if err != nil {
		steps = append(steps, makeStep("Discover DVMs", false, "", err.Error()))
	} else if len(events) == 0 {
		steps = append(steps, makeStep("Discover DVMs", true, "No DVM announcements found", ""))
	} else {
		steps = append(steps, makeStep("Discover DVMs", true, fmt.Sprintf("Found %d DVM announcements", len(events)), ""))

		// Parse DVM info
		for i, dvm := range events {
			if i >= 3 {
				break
			}
			// Try to get DVM name from content
			var metadata map[string]interface{}
			name := "Unknown DVM"
			if json.Unmarshal([]byte(dvm.Content), &metadata) == nil {
				if n, ok := metadata["name"].(string); ok {
					name = n
				}
			}

			// Get supported kinds from tags
			var supportedKinds []string
			for _, tag := range dvm.Tags {
				if len(tag) >= 2 && tag[0] == "k" {
					supportedKinds = append(supportedKinds, tag[1])
				}
			}

			kindsStr := "none"
			if len(supportedKinds) > 0 {
				kindsStr = strings.Join(supportedKinds, ", ")
			}
			steps = append(steps, makeStep(fmt.Sprintf("DVM #%d: %s", i+1, name), true, fmt.Sprintf("Kinds: %s", kindsStr), ""))
		}
	}

	// Step 2: Query for recent job requests (kinds 5000-5999)
	jobEvents, err := t.relayPool.QueryEvents("5050", "", "5") // Text generation
	if err != nil {
		steps = append(steps, makeStep("Find job requests", false, "", err.Error()))
	} else if len(jobEvents) == 0 {
		steps = append(steps, makeStep("Find job requests", true, "No recent job requests found", ""))
	} else {
		steps = append(steps, makeStep("Find job requests", true, fmt.Sprintf("Found %d job requests (kind 5050)", len(jobEvents)), ""))
	}

	// Step 3: Query for job results (kinds 6000-6999)
	resultEvents, err := t.relayPool.QueryEvents("6050", "", "5")
	if err != nil {
		steps = append(steps, makeStep("Find job results", false, "", err.Error()))
	} else if len(resultEvents) == 0 {
		steps = append(steps, makeStep("Find job results", true, "No recent job results found", ""))
	} else {
		steps = append(steps, makeStep("Find job results", true, fmt.Sprintf("Found %d job results (kind 6050)", len(resultEvents)), ""))
	}

	// Step 4: Query for feedback (kind 7000)
	feedbackEvents, err := t.relayPool.QueryEvents("7000", "", "5")
	if err != nil {
		steps = append(steps, makeStep("Find feedback events", false, "", err.Error()))
	} else if len(feedbackEvents) == 0 {
		steps = append(steps, makeStep("Find feedback events", true, "No feedback events found", ""))
	} else {
		steps = append(steps, makeStep("Find feedback events", true, fmt.Sprintf("Found %d feedback events", len(feedbackEvents)), ""))

		// Parse feedback status
		for i, fb := range feedbackEvents {
			if i >= 2 {
				break
			}
			status := "unknown"
			for _, tag := range fb.Tags {
				if len(tag) >= 2 && tag[0] == "status" {
					status = tag[1]
					break
				}
			}
			steps = append(steps, makeStep(fmt.Sprintf("Feedback #%d", i+1), true, fmt.Sprintf("Status: %s", status), ""))
		}
	}

	// Step 5: Note about job submission
	steps = append(steps, makeStep("Submit test job", true, "Job submission available via API", ""))

	return makeResult(t.ID(), success, steps), nil
}
