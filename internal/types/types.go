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
	Sig       string     `json:"sig,omitempty"`
	Relay     string     `json:"relay,omitempty"`
}

// RelayStatus represents the status of a relay.
type RelayStatus struct {
	URL           string     `json:"url"`
	Connected     bool       `json:"connected"`
	Latency       int64      `json:"latency_ms"`
	EventsPS      float64    `json:"events_per_sec"`
	Error         string     `json:"error,omitempty"`
	SupportedNIPs []int      `json:"supported_nips,omitempty"`
	RelayInfo     *RelayInfo `json:"relay_info,omitempty"`
}

// RelayInfo represents NIP-11 relay information document.
type RelayInfo struct {
	Name          string           `json:"name,omitempty"`
	Description   string           `json:"description,omitempty"`
	PubKey        string           `json:"pubkey,omitempty"`
	Contact       string           `json:"contact,omitempty"`
	SupportedNIPs []int            `json:"supported_nips,omitempty"`
	Software      string           `json:"software,omitempty"`
	Version       string           `json:"version,omitempty"`
	Icon          string           `json:"icon,omitempty"`
	Limitation    *RelayLimitation `json:"limitation,omitempty"`
}

// RelayLimitation represents the limitation section of NIP-11.
type RelayLimitation struct {
	MaxMessageLength int  `json:"max_message_length,omitempty"`
	MaxSubscriptions int  `json:"max_subscriptions,omitempty"`
	MaxLimit         int  `json:"max_limit,omitempty"`
	MaxEventTags     int  `json:"max_event_tags,omitempty"`
	MaxContentLength int  `json:"max_content_length,omitempty"`
	MinPOWDifficulty int  `json:"min_pow_difficulty,omitempty"`
	AuthRequired     bool `json:"auth_required,omitempty"`
	PaymentRequired  bool `json:"payment_required,omitempty"`
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

// TestHistoryEntry represents a test result with timestamp for history tracking.
type TestHistoryEntry struct {
	ID        string     `json:"id"`
	Timestamp int64      `json:"timestamp"`
	Result    TestResult `json:"result"`
}

// TestStep represents a single step in a test.
type TestStep struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
}

// ExampleEvent represents an example Nostr event for documentation purposes.
type ExampleEvent struct {
	Description string `json:"description"`
	JSON        string `json:"json"`
}

// NIPInfo describes a NIP for the testing UI.
type NIPInfo struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Title         string         `json:"title"`
	Description   string         `json:"description"`
	Category      string         `json:"category"`
	RelatedNIPs   []string       `json:"relatedNIPs,omitempty"`
	EventKinds    []int          `json:"eventKinds,omitempty"`
	ExampleEvents []ExampleEvent `json:"exampleEvents,omitempty"`
	SpecURL       string         `json:"specUrl"`
	HasTest       bool           `json:"hasTest"`
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

// TimeSeriesPoint represents a single data point in a time series.
type TimeSeriesPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}

// RelayHealth represents the health status of a relay over time.
type RelayHealth struct {
	URL              string            `json:"url"`
	Connected        bool              `json:"connected"`
	Latency          int64             `json:"latency_ms"`
	LatencyHistory   []TimeSeriesPoint `json:"latency_history,omitempty"`
	EventsPerSec     float64           `json:"events_per_sec"`
	EventRateHistory []TimeSeriesPoint `json:"event_rate_history,omitempty"`
	Uptime           float64           `json:"uptime_percent"`
	HealthScore      float64           `json:"health_score"`
	LastSeen         int64             `json:"last_seen"`
	ErrorCount       int               `json:"error_count"`
	LastError        string            `json:"last_error,omitempty"`
}

// MonitoringData represents aggregated monitoring data for all relays.
type MonitoringData struct {
	Relays           []RelayHealth     `json:"relays"`
	TotalEvents      int64             `json:"total_events"`
	EventsPerSec     float64           `json:"events_per_sec"`
	EventRateHistory []TimeSeriesPoint `json:"event_rate_history,omitempty"`
	ConnectedCount   int               `json:"connected_count"`
	TotalCount       int               `json:"total_count"`
	Timestamp        int64             `json:"timestamp"`
}

// RelayHealthSummary represents a lightweight health summary for a relay
// without time-series history data.
type RelayHealthSummary struct {
	URL          string  `json:"url"`
	Connected    bool    `json:"connected"`
	Latency      int64   `json:"latency_ms"`
	EventsPerSec float64 `json:"events_per_sec"`
	Uptime       float64 `json:"uptime_percent"`
	HealthScore  float64 `json:"health_score"`
	LastSeen     int64   `json:"last_seen"`
	ErrorCount   int     `json:"error_count"`
	LastError    string  `json:"last_error,omitempty"`
}

// HealthSummary represents a lightweight health summary for all relays.
type HealthSummary struct {
	Relays         []RelayHealthSummary `json:"relays"`
	TotalEvents    int64                `json:"total_events"`
	EventsPerSec   float64              `json:"events_per_sec"`
	ConnectedCount int                  `json:"connected_count"`
	TotalCount     int                  `json:"total_count"`
	Timestamp      int64                `json:"timestamp"`
}

// ThreadEvent represents an event in a thread with its position/depth info.
type ThreadEvent struct {
	Event
	Depth      int    `json:"depth"`
	IsRoot     bool   `json:"is_root"`
	ParentID   string `json:"parent_id,omitempty"`
	RootID     string `json:"root_id,omitempty"`
	ReplyCount int    `json:"reply_count"`
}

// Thread represents a complete thread of events (NIP-10).
type Thread struct {
	RootEvent *ThreadEvent  `json:"root_event,omitempty"`
	Events    []ThreadEvent `json:"events"`
	TotalSize int           `json:"total_size"`
	MaxDepth  int           `json:"max_depth"`
	TargetID  string        `json:"target_id"`
}

// PublishResult represents the result of publishing an event to a relay.
type PublishResult struct {
	URL     string `json:"url"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// PublishResponse represents the response from publishing an event.
type PublishResponse struct {
	EventID string          `json:"event_id"`
	Results []PublishResult `json:"results"`
}
