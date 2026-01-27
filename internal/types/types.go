// Package types provides shared types used across packages.
package types

// Event represents a Nostr event for the UI.
type Event struct {
	ID        string     `json:"id"`
	Kind      int        `json:"kind"`
	PubKey    string     `json:"pubkey"`
	Content   string     `json:"content"`
	CreatedAt int64      `json:"created_at"`
	Tags      [][]string `json:"tags"`
	Relay     string     `json:"relay,omitempty"`
}

// RelayStatus represents the status of a relay.
type RelayStatus struct {
	URL       string  `json:"url"`
	Connected bool    `json:"connected"`
	Latency   int64   `json:"latency_ms"`
	EventsPS  float64 `json:"events_per_sec"`
	Error     string  `json:"error,omitempty"`
}

// RelayStats represents statistics for a relay.
type RelayStats struct {
	URL          string  `json:"url"`
	Latency      int64   `json:"latency_ms"`
	EventsPerSec float64 `json:"events_per_sec"`
	TotalEvents  int64   `json:"total_events"`
}

// TestResult represents the result of a NIP test.
type TestResult struct {
	NIPID   string     `json:"nip_id"`
	Success bool       `json:"success"`
	Message string     `json:"message"`
	Steps   []TestStep `json:"steps"`
}

// TestStep represents a single step in a test.
type TestStep struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
}

// NIPInfo describes a NIP for the testing UI.
type NIPInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`
	SpecURL     string `json:"specUrl"`
	HasTest     bool   `json:"hasTest"`
}
