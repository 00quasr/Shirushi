// Package dvm implements NIP-90 Data Vending Machine protocol types.
package dvm

// NIP-90 Kind constants for DVM job requests and results.
// Request kinds are 5xxx, result kinds are 6xxx (request + 1000).
const (
	// Job Request Kinds (5xxx)
	KindJobRequestCoordinator = 5001 // Coordinator: task decomposition & routing
	KindJobRequestWriter      = 5050 // Writer: content generation
	KindJobRequestCritic      = 5051 // Critic: quality review
	KindJobRequestResearcher  = 5300 // Researcher: information gathering

	// Job Result Kinds (6xxx) - request kind + 1000
	KindJobResultCoordinator = 6001
	KindJobResultWriter      = 6050
	KindJobResultCritic      = 6051
	KindJobResultResearcher  = 6300

	// Job Feedback Kind (for status updates)
	KindJobFeedback = 7000
)

// Status represents the current state of a DVM job.
type Status string

const (
	StatusPaymentRequired Status = "payment-required"
	StatusProcessing      Status = "processing"
	StatusError           Status = "error"
	StatusSuccess         Status = "success"
	StatusPartial         Status = "partial"
)

// AgentKind maps agent names to their DVM kinds.
var AgentKind = map[string]int{
	"coordinator": KindJobRequestCoordinator,
	"researcher":  KindJobRequestResearcher,
	"writer":      KindJobRequestWriter,
	"critic":      KindJobRequestCritic,
}

// ResultKindFor returns the result kind for a given request kind.
func ResultKindFor(requestKind int) int {
	return requestKind + 1000
}
