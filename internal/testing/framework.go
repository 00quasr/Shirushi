// Package testing provides a framework for testing NIP implementations.
package testing

import (
	"context"
	"fmt"

	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// RelayPool defines the interface for relay operations used by tests.
type RelayPool interface {
	GetConnected() []string
	QueryEvents(kindStr, author, limitStr string) ([]types.Event, error)
}

// NIPTest defines the interface for NIP tests.
type NIPTest interface {
	ID() string
	Name() string
	Description() string
	Run(ctx context.Context, params map[string]interface{}) (*types.TestResult, error)
}

// Runner executes NIP tests.
type Runner struct {
	nak       *nak.Nak
	relayPool RelayPool
	tests     map[string]NIPTest
}

// NewRunner creates a new test runner.
func NewRunner(nakClient *nak.Nak, relayPool RelayPool) *Runner {
	r := &Runner{
		nak:       nakClient,
		relayPool: relayPool,
		tests:     make(map[string]NIPTest),
	}

	// Register all NIP tests
	r.Register(NewNIP01Test(nakClient, relayPool))
	r.Register(NewNIP02Test(nakClient, relayPool))
	r.Register(NewNIP05Test())
	r.Register(NewNIP19Test(nakClient))
	r.Register(NewNIP44Test(nakClient))
	r.Register(NewNIP57Test(nakClient, relayPool))
	r.Register(NewNIP90Test(nakClient, relayPool))

	return r
}

// Register adds a NIP test to the runner.
func (r *Runner) Register(test NIPTest) {
	r.tests[test.ID()] = test
}

// RunTest executes a specific NIP test.
func (r *Runner) RunTest(ctx context.Context, nipID string, params map[string]interface{}) (*types.TestResult, error) {
	test, exists := r.tests[nipID]
	if !exists {
		return nil, fmt.Errorf("unknown NIP test: %s", nipID)
	}

	return test.Run(ctx, params)
}

// ListTests returns all available tests.
func (r *Runner) ListTests() []NIPTestInfo {
	var tests []NIPTestInfo
	for _, test := range r.tests {
		tests = append(tests, NIPTestInfo{
			ID:          test.ID(),
			Name:        test.Name(),
			Description: test.Description(),
		})
	}
	return tests
}

// NIPTestInfo provides information about a NIP test.
type NIPTestInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// makeResult creates a test result.
func makeResult(nipID string, success bool, steps []types.TestStep) *types.TestResult {
	message := "Test passed"
	if !success {
		message = "Test failed"
		for _, step := range steps {
			if !step.Success && step.Error != "" {
				message = step.Error
				break
			}
		}
	}
	return &types.TestResult{
		NIPID:   nipID,
		Success: success,
		Message: message,
		Steps:   steps,
	}
}

// makeStep creates a test step.
func makeStep(name string, success bool, output, errMsg string) types.TestStep {
	return types.TestStep{
		Name:    name,
		Success: success,
		Output:  output,
		Error:   errMsg,
	}
}
