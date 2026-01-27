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

// Profile represents a Nostr user profile (NIP-01 kind 0 metadata).
type Profile struct {
	PubKey       string `json:"pubkey"`
	Name         string `json:"name,omitempty"`
	DisplayName  string `json:"display_name,omitempty"`
	About        string `json:"about,omitempty"`
	Picture      string `json:"picture,omitempty"`
	Banner       string `json:"banner,omitempty"`
	Website      string `json:"website,omitempty"`
	NIP05        string `json:"nip05,omitempty"`
	NIP05Valid   bool   `json:"nip05_valid,omitempty"`
	LUD16        string `json:"lud16,omitempty"`
	CreatedAt    int64  `json:"created_at,omitempty"`
	LastUpdated  int64  `json:"last_updated,omitempty"`
	FollowCount  int    `json:"follow_count,omitempty"`
	FollowerHint int    `json:"follower_hint,omitempty"`
}

// FollowListEntry represents a single entry in a follow list.
type FollowListEntry struct {
	PubKey  string   `json:"pubkey"`
	Relay   string   `json:"relay,omitempty"`
	Petname string   `json:"petname,omitempty"`
	Profile *Profile `json:"profile,omitempty"`
}

// FollowList represents a Nostr contact list (NIP-02 kind 3).
type FollowList struct {
	PubKey    string            `json:"pubkey"`
	Follows   []FollowListEntry `json:"follows"`
	CreatedAt int64             `json:"created_at"`
	EventID   string            `json:"event_id,omitempty"`
}

// ZapStats represents aggregated zap statistics for a user (NIP-57).
type ZapStats struct {
	PubKey      string     `json:"pubkey"`
	TotalZaps   int        `json:"total_zaps"`
	TotalSats   int64      `json:"total_sats"`
	AvgSats     int64      `json:"avg_sats"`
	TopZap      int64      `json:"top_zap"`
	RecentZaps  []ZapEvent `json:"recent_zaps,omitempty"`
	LastUpdated int64      `json:"last_updated,omitempty"`
}

// ZapEvent represents a single zap receipt.
type ZapEvent struct {
	EventID   string `json:"event_id"`
	Sender    string `json:"sender"`
	Receiver  string `json:"receiver"`
	Amount    int64  `json:"amount"`
	Content   string `json:"content,omitempty"`
	CreatedAt int64  `json:"created_at"`
}
