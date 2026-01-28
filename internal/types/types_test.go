package types

import (
	"encoding/json"
	"testing"
)

func TestProfileJSONSerialization(t *testing.T) {
	profile := Profile{
		PubKey:      "abc123",
		Name:        "testuser",
		DisplayName: "Test User",
		About:       "A test profile",
		Picture:     "https://example.com/avatar.png",
		Banner:      "https://example.com/banner.png",
		Website:     "https://example.com",
		NIP05:       "test@example.com",
		NIP05Valid:  true,
		LUD16:       "test@getalby.com",
		CreatedAt:   1700000000,
		LastUpdated: 1700001000,
		FollowCount: 100,
	}

	data, err := json.Marshal(profile)
	if err != nil {
		t.Fatalf("failed to marshal Profile: %v", err)
	}

	var decoded Profile
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal Profile: %v", err)
	}

	if decoded.PubKey != profile.PubKey {
		t.Errorf("PubKey mismatch: got %s, want %s", decoded.PubKey, profile.PubKey)
	}
	if decoded.Name != profile.Name {
		t.Errorf("Name mismatch: got %s, want %s", decoded.Name, profile.Name)
	}
	if decoded.DisplayName != profile.DisplayName {
		t.Errorf("DisplayName mismatch: got %s, want %s", decoded.DisplayName, profile.DisplayName)
	}
	if decoded.NIP05Valid != profile.NIP05Valid {
		t.Errorf("NIP05Valid mismatch: got %v, want %v", decoded.NIP05Valid, profile.NIP05Valid)
	}
	if decoded.FollowCount != profile.FollowCount {
		t.Errorf("FollowCount mismatch: got %d, want %d", decoded.FollowCount, profile.FollowCount)
	}
}

func TestProfileOmitEmpty(t *testing.T) {
	profile := Profile{
		PubKey: "abc123",
	}

	data, err := json.Marshal(profile)
	if err != nil {
		t.Fatalf("failed to marshal Profile: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	if _, exists := m["name"]; exists {
		t.Error("empty name should be omitted")
	}
	if _, exists := m["display_name"]; exists {
		t.Error("empty display_name should be omitted")
	}
	if _, exists := m["nip05_valid"]; exists {
		t.Error("false nip05_valid should be omitted")
	}
}

func TestFollowListJSONSerialization(t *testing.T) {
	followList := FollowList{
		PubKey:    "user123",
		CreatedAt: 1700000000,
		EventID:   "event456",
		Follows: []FollowListEntry{
			{
				PubKey:  "follow1",
				Relay:   "wss://relay1.example.com",
				Petname: "Friend One",
			},
			{
				PubKey: "follow2",
				Relay:  "wss://relay2.example.com",
			},
		},
	}

	data, err := json.Marshal(followList)
	if err != nil {
		t.Fatalf("failed to marshal FollowList: %v", err)
	}

	var decoded FollowList
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal FollowList: %v", err)
	}

	if decoded.PubKey != followList.PubKey {
		t.Errorf("PubKey mismatch: got %s, want %s", decoded.PubKey, followList.PubKey)
	}
	if len(decoded.Follows) != len(followList.Follows) {
		t.Fatalf("Follows length mismatch: got %d, want %d", len(decoded.Follows), len(followList.Follows))
	}
	if decoded.Follows[0].Petname != "Friend One" {
		t.Errorf("Petname mismatch: got %s, want %s", decoded.Follows[0].Petname, "Friend One")
	}
	if decoded.Follows[1].Relay != "wss://relay2.example.com" {
		t.Errorf("Relay mismatch: got %s, want %s", decoded.Follows[1].Relay, "wss://relay2.example.com")
	}
}

func TestFollowListEntryWithProfile(t *testing.T) {
	entry := FollowListEntry{
		PubKey:  "follow1",
		Relay:   "wss://relay.example.com",
		Petname: "My Friend",
		Profile: &Profile{
			PubKey:      "follow1",
			Name:        "friendname",
			DisplayName: "My Friend",
		},
	}

	data, err := json.Marshal(entry)
	if err != nil {
		t.Fatalf("failed to marshal FollowListEntry: %v", err)
	}

	var decoded FollowListEntry
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal FollowListEntry: %v", err)
	}

	if decoded.Profile == nil {
		t.Fatal("Profile should not be nil")
	}
	if decoded.Profile.Name != "friendname" {
		t.Errorf("Profile.Name mismatch: got %s, want %s", decoded.Profile.Name, "friendname")
	}
}

func TestZapStatsJSONSerialization(t *testing.T) {
	zapStats := ZapStats{
		PubKey:      "user123",
		TotalZaps:   50,
		TotalSats:   100000,
		AvgSats:     2000,
		TopZap:      21000,
		LastUpdated: 1700001000,
		RecentZaps: []ZapEvent{
			{
				EventID:   "zap1",
				Sender:    "sender1",
				Receiver:  "user123",
				Amount:    5000,
				Content:   "Great post!",
				CreatedAt: 1700000500,
			},
			{
				EventID:   "zap2",
				Sender:    "sender2",
				Receiver:  "user123",
				Amount:    1000,
				CreatedAt: 1700000600,
			},
		},
	}

	data, err := json.Marshal(zapStats)
	if err != nil {
		t.Fatalf("failed to marshal ZapStats: %v", err)
	}

	var decoded ZapStats
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal ZapStats: %v", err)
	}

	if decoded.PubKey != zapStats.PubKey {
		t.Errorf("PubKey mismatch: got %s, want %s", decoded.PubKey, zapStats.PubKey)
	}
	if decoded.TotalZaps != zapStats.TotalZaps {
		t.Errorf("TotalZaps mismatch: got %d, want %d", decoded.TotalZaps, zapStats.TotalZaps)
	}
	if decoded.TotalSats != zapStats.TotalSats {
		t.Errorf("TotalSats mismatch: got %d, want %d", decoded.TotalSats, zapStats.TotalSats)
	}
	if decoded.AvgSats != zapStats.AvgSats {
		t.Errorf("AvgSats mismatch: got %d, want %d", decoded.AvgSats, zapStats.AvgSats)
	}
	if decoded.TopZap != zapStats.TopZap {
		t.Errorf("TopZap mismatch: got %d, want %d", decoded.TopZap, zapStats.TopZap)
	}
	if len(decoded.RecentZaps) != len(zapStats.RecentZaps) {
		t.Fatalf("RecentZaps length mismatch: got %d, want %d", len(decoded.RecentZaps), len(zapStats.RecentZaps))
	}
	if decoded.RecentZaps[0].Amount != 5000 {
		t.Errorf("RecentZaps[0].Amount mismatch: got %d, want %d", decoded.RecentZaps[0].Amount, 5000)
	}
	if decoded.RecentZaps[0].Content != "Great post!" {
		t.Errorf("RecentZaps[0].Content mismatch: got %s, want %s", decoded.RecentZaps[0].Content, "Great post!")
	}
}

func TestZapEventJSONSerialization(t *testing.T) {
	zapEvent := ZapEvent{
		EventID:   "zap123",
		Sender:    "sender456",
		Receiver:  "receiver789",
		Amount:    21000,
		Content:   "Nice work!",
		CreatedAt: 1700000000,
	}

	data, err := json.Marshal(zapEvent)
	if err != nil {
		t.Fatalf("failed to marshal ZapEvent: %v", err)
	}

	var decoded ZapEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal ZapEvent: %v", err)
	}

	if decoded.EventID != zapEvent.EventID {
		t.Errorf("EventID mismatch: got %s, want %s", decoded.EventID, zapEvent.EventID)
	}
	if decoded.Sender != zapEvent.Sender {
		t.Errorf("Sender mismatch: got %s, want %s", decoded.Sender, zapEvent.Sender)
	}
	if decoded.Receiver != zapEvent.Receiver {
		t.Errorf("Receiver mismatch: got %s, want %s", decoded.Receiver, zapEvent.Receiver)
	}
	if decoded.Amount != zapEvent.Amount {
		t.Errorf("Amount mismatch: got %d, want %d", decoded.Amount, zapEvent.Amount)
	}
	if decoded.Content != zapEvent.Content {
		t.Errorf("Content mismatch: got %s, want %s", decoded.Content, zapEvent.Content)
	}
	if decoded.CreatedAt != zapEvent.CreatedAt {
		t.Errorf("CreatedAt mismatch: got %d, want %d", decoded.CreatedAt, zapEvent.CreatedAt)
	}
}

func TestZapStatsEmptyRecentZaps(t *testing.T) {
	zapStats := ZapStats{
		PubKey:    "user123",
		TotalZaps: 0,
		TotalSats: 0,
	}

	data, err := json.Marshal(zapStats)
	if err != nil {
		t.Fatalf("failed to marshal ZapStats: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	if _, exists := m["recent_zaps"]; exists {
		t.Error("empty recent_zaps should be omitted")
	}
}

func TestTimeSeriesPointJSONSerialization(t *testing.T) {
	point := TimeSeriesPoint{
		Timestamp: 1700000000,
		Value:     42.5,
	}

	data, err := json.Marshal(point)
	if err != nil {
		t.Fatalf("failed to marshal TimeSeriesPoint: %v", err)
	}

	var decoded TimeSeriesPoint
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal TimeSeriesPoint: %v", err)
	}

	if decoded.Timestamp != point.Timestamp {
		t.Errorf("Timestamp mismatch: got %d, want %d", decoded.Timestamp, point.Timestamp)
	}
	if decoded.Value != point.Value {
		t.Errorf("Value mismatch: got %f, want %f", decoded.Value, point.Value)
	}
}

func TestRelayHealthJSONSerialization(t *testing.T) {
	health := RelayHealth{
		URL:          "wss://relay.example.com",
		Connected:    true,
		Latency:      150,
		EventsPerSec: 25.5,
		Uptime:       99.5,
		LastSeen:     1700001000,
		ErrorCount:   2,
		LastError:    "temporary disconnect",
		LatencyHistory: []TimeSeriesPoint{
			{Timestamp: 1700000000, Value: 120.0},
			{Timestamp: 1700000060, Value: 150.0},
		},
		EventRateHistory: []TimeSeriesPoint{
			{Timestamp: 1700000000, Value: 20.0},
			{Timestamp: 1700000060, Value: 25.5},
		},
	}

	data, err := json.Marshal(health)
	if err != nil {
		t.Fatalf("failed to marshal RelayHealth: %v", err)
	}

	var decoded RelayHealth
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal RelayHealth: %v", err)
	}

	if decoded.URL != health.URL {
		t.Errorf("URL mismatch: got %s, want %s", decoded.URL, health.URL)
	}
	if decoded.Connected != health.Connected {
		t.Errorf("Connected mismatch: got %v, want %v", decoded.Connected, health.Connected)
	}
	if decoded.Latency != health.Latency {
		t.Errorf("Latency mismatch: got %d, want %d", decoded.Latency, health.Latency)
	}
	if decoded.EventsPerSec != health.EventsPerSec {
		t.Errorf("EventsPerSec mismatch: got %f, want %f", decoded.EventsPerSec, health.EventsPerSec)
	}
	if decoded.Uptime != health.Uptime {
		t.Errorf("Uptime mismatch: got %f, want %f", decoded.Uptime, health.Uptime)
	}
	if decoded.LastSeen != health.LastSeen {
		t.Errorf("LastSeen mismatch: got %d, want %d", decoded.LastSeen, health.LastSeen)
	}
	if decoded.ErrorCount != health.ErrorCount {
		t.Errorf("ErrorCount mismatch: got %d, want %d", decoded.ErrorCount, health.ErrorCount)
	}
	if decoded.LastError != health.LastError {
		t.Errorf("LastError mismatch: got %s, want %s", decoded.LastError, health.LastError)
	}
	if len(decoded.LatencyHistory) != len(health.LatencyHistory) {
		t.Fatalf("LatencyHistory length mismatch: got %d, want %d", len(decoded.LatencyHistory), len(health.LatencyHistory))
	}
	if decoded.LatencyHistory[1].Value != 150.0 {
		t.Errorf("LatencyHistory[1].Value mismatch: got %f, want %f", decoded.LatencyHistory[1].Value, 150.0)
	}
	if len(decoded.EventRateHistory) != len(health.EventRateHistory) {
		t.Fatalf("EventRateHistory length mismatch: got %d, want %d", len(decoded.EventRateHistory), len(health.EventRateHistory))
	}
}

func TestRelayHealthOmitEmpty(t *testing.T) {
	health := RelayHealth{
		URL:       "wss://relay.example.com",
		Connected: true,
		Latency:   100,
	}

	data, err := json.Marshal(health)
	if err != nil {
		t.Fatalf("failed to marshal RelayHealth: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	if _, exists := m["latency_history"]; exists {
		t.Error("empty latency_history should be omitted")
	}
	if _, exists := m["event_rate_history"]; exists {
		t.Error("empty event_rate_history should be omitted")
	}
	if _, exists := m["last_error"]; exists {
		t.Error("empty last_error should be omitted")
	}
}

func TestMonitoringDataJSONSerialization(t *testing.T) {
	monitoring := MonitoringData{
		Relays: []RelayHealth{
			{
				URL:          "wss://relay1.example.com",
				Connected:    true,
				Latency:      100,
				EventsPerSec: 15.0,
				Uptime:       99.9,
				LastSeen:     1700001000,
			},
			{
				URL:          "wss://relay2.example.com",
				Connected:    false,
				Latency:      0,
				EventsPerSec: 0,
				Uptime:       85.0,
				LastSeen:     1700000500,
				ErrorCount:   5,
				LastError:    "connection refused",
			},
		},
		TotalEvents:    5000,
		EventsPerSec:   15.0,
		ConnectedCount: 1,
		TotalCount:     2,
		Timestamp:      1700001000,
		EventRateHistory: []TimeSeriesPoint{
			{Timestamp: 1700000000, Value: 10.0},
			{Timestamp: 1700000060, Value: 15.0},
		},
	}

	data, err := json.Marshal(monitoring)
	if err != nil {
		t.Fatalf("failed to marshal MonitoringData: %v", err)
	}

	var decoded MonitoringData
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal MonitoringData: %v", err)
	}

	if decoded.TotalEvents != monitoring.TotalEvents {
		t.Errorf("TotalEvents mismatch: got %d, want %d", decoded.TotalEvents, monitoring.TotalEvents)
	}
	if decoded.EventsPerSec != monitoring.EventsPerSec {
		t.Errorf("EventsPerSec mismatch: got %f, want %f", decoded.EventsPerSec, monitoring.EventsPerSec)
	}
	if decoded.ConnectedCount != monitoring.ConnectedCount {
		t.Errorf("ConnectedCount mismatch: got %d, want %d", decoded.ConnectedCount, monitoring.ConnectedCount)
	}
	if decoded.TotalCount != monitoring.TotalCount {
		t.Errorf("TotalCount mismatch: got %d, want %d", decoded.TotalCount, monitoring.TotalCount)
	}
	if decoded.Timestamp != monitoring.Timestamp {
		t.Errorf("Timestamp mismatch: got %d, want %d", decoded.Timestamp, monitoring.Timestamp)
	}
	if len(decoded.Relays) != len(monitoring.Relays) {
		t.Fatalf("Relays length mismatch: got %d, want %d", len(decoded.Relays), len(monitoring.Relays))
	}
	if decoded.Relays[0].URL != "wss://relay1.example.com" {
		t.Errorf("Relays[0].URL mismatch: got %s, want %s", decoded.Relays[0].URL, "wss://relay1.example.com")
	}
	if decoded.Relays[1].LastError != "connection refused" {
		t.Errorf("Relays[1].LastError mismatch: got %s, want %s", decoded.Relays[1].LastError, "connection refused")
	}
	if len(decoded.EventRateHistory) != len(monitoring.EventRateHistory) {
		t.Fatalf("EventRateHistory length mismatch: got %d, want %d", len(decoded.EventRateHistory), len(monitoring.EventRateHistory))
	}
}

func TestMonitoringDataOmitEmpty(t *testing.T) {
	monitoring := MonitoringData{
		Relays:         []RelayHealth{},
		TotalEvents:    0,
		ConnectedCount: 0,
		TotalCount:     0,
		Timestamp:      1700000000,
	}

	data, err := json.Marshal(monitoring)
	if err != nil {
		t.Fatalf("failed to marshal MonitoringData: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	if _, exists := m["event_rate_history"]; exists {
		t.Error("empty event_rate_history should be omitted")
	}
}

func TestNIPInfoJSONSerialization(t *testing.T) {
	nip := NIPInfo{
		ID:          "nip01",
		Name:        "NIP-01",
		Title:       "Basic Protocol",
		Description: "Core protocol: events, signatures, subscriptions",
		Category:    "core",
		RelatedNIPs: []string{"nip02", "nip05", "nip19"},
		EventKinds:  []int{0, 1},
		SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/01.md",
		HasTest:     true,
	}

	data, err := json.Marshal(nip)
	if err != nil {
		t.Fatalf("failed to marshal NIPInfo: %v", err)
	}

	var decoded NIPInfo
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal NIPInfo: %v", err)
	}

	if decoded.ID != nip.ID {
		t.Errorf("ID mismatch: got %s, want %s", decoded.ID, nip.ID)
	}
	if decoded.Name != nip.Name {
		t.Errorf("Name mismatch: got %s, want %s", decoded.Name, nip.Name)
	}
	if decoded.Title != nip.Title {
		t.Errorf("Title mismatch: got %s, want %s", decoded.Title, nip.Title)
	}
	if decoded.Description != nip.Description {
		t.Errorf("Description mismatch: got %s, want %s", decoded.Description, nip.Description)
	}
	if decoded.Category != nip.Category {
		t.Errorf("Category mismatch: got %s, want %s", decoded.Category, nip.Category)
	}
	if len(decoded.RelatedNIPs) != len(nip.RelatedNIPs) {
		t.Fatalf("RelatedNIPs length mismatch: got %d, want %d", len(decoded.RelatedNIPs), len(nip.RelatedNIPs))
	}
	for i, related := range decoded.RelatedNIPs {
		if related != nip.RelatedNIPs[i] {
			t.Errorf("RelatedNIPs[%d] mismatch: got %s, want %s", i, related, nip.RelatedNIPs[i])
		}
	}
	if len(decoded.EventKinds) != len(nip.EventKinds) {
		t.Fatalf("EventKinds length mismatch: got %d, want %d", len(decoded.EventKinds), len(nip.EventKinds))
	}
	for i, kind := range decoded.EventKinds {
		if kind != nip.EventKinds[i] {
			t.Errorf("EventKinds[%d] mismatch: got %d, want %d", i, kind, nip.EventKinds[i])
		}
	}
	if decoded.SpecURL != nip.SpecURL {
		t.Errorf("SpecURL mismatch: got %s, want %s", decoded.SpecURL, nip.SpecURL)
	}
	if decoded.HasTest != nip.HasTest {
		t.Errorf("HasTest mismatch: got %v, want %v", decoded.HasTest, nip.HasTest)
	}
}

func TestNIPInfoOmitEmpty(t *testing.T) {
	nip := NIPInfo{
		ID:       "nip19",
		Name:     "NIP-19",
		Title:    "Bech32 Encoding",
		Category: "encoding",
		SpecURL:  "https://github.com/nostr-protocol/nips/blob/master/19.md",
		HasTest:  true,
	}

	data, err := json.Marshal(nip)
	if err != nil {
		t.Fatalf("failed to marshal NIPInfo: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	if _, exists := m["relatedNIPs"]; exists {
		t.Error("empty relatedNIPs should be omitted")
	}
	if _, exists := m["eventKinds"]; exists {
		t.Error("empty eventKinds should be omitted")
	}
}

func TestNIPInfoJSONFieldNames(t *testing.T) {
	nip := NIPInfo{
		ID:          "nip01",
		Name:        "NIP-01",
		Title:       "Basic Protocol",
		Description: "Test description",
		Category:    "core",
		RelatedNIPs: []string{"nip02"},
		EventKinds:  []int{0, 1},
		SpecURL:     "https://example.com",
		HasTest:     true,
	}

	data, err := json.Marshal(nip)
	if err != nil {
		t.Fatalf("failed to marshal NIPInfo: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	expectedFields := []string{"id", "name", "title", "description", "category", "relatedNIPs", "eventKinds", "specUrl", "hasTest"}
	for _, field := range expectedFields {
		if _, exists := m[field]; !exists {
			t.Errorf("expected field %s to exist in JSON output", field)
		}
	}
}

func TestRelayLimitationJSONSerialization(t *testing.T) {
	limitation := RelayLimitation{
		MaxMessageLength: 131072,
		MaxSubscriptions: 20,
		MaxLimit:         500,
		MaxEventTags:     100,
		MaxContentLength: 65536,
		MinPOWDifficulty: 16,
		AuthRequired:     true,
		PaymentRequired:  false,
	}

	data, err := json.Marshal(limitation)
	if err != nil {
		t.Fatalf("failed to marshal RelayLimitation: %v", err)
	}

	var decoded RelayLimitation
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal RelayLimitation: %v", err)
	}

	if decoded.MaxMessageLength != limitation.MaxMessageLength {
		t.Errorf("MaxMessageLength mismatch: got %d, want %d", decoded.MaxMessageLength, limitation.MaxMessageLength)
	}
	if decoded.MaxSubscriptions != limitation.MaxSubscriptions {
		t.Errorf("MaxSubscriptions mismatch: got %d, want %d", decoded.MaxSubscriptions, limitation.MaxSubscriptions)
	}
	if decoded.MaxLimit != limitation.MaxLimit {
		t.Errorf("MaxLimit mismatch: got %d, want %d", decoded.MaxLimit, limitation.MaxLimit)
	}
	if decoded.MaxEventTags != limitation.MaxEventTags {
		t.Errorf("MaxEventTags mismatch: got %d, want %d", decoded.MaxEventTags, limitation.MaxEventTags)
	}
	if decoded.MaxContentLength != limitation.MaxContentLength {
		t.Errorf("MaxContentLength mismatch: got %d, want %d", decoded.MaxContentLength, limitation.MaxContentLength)
	}
	if decoded.MinPOWDifficulty != limitation.MinPOWDifficulty {
		t.Errorf("MinPOWDifficulty mismatch: got %d, want %d", decoded.MinPOWDifficulty, limitation.MinPOWDifficulty)
	}
	if decoded.AuthRequired != limitation.AuthRequired {
		t.Errorf("AuthRequired mismatch: got %v, want %v", decoded.AuthRequired, limitation.AuthRequired)
	}
	if decoded.PaymentRequired != limitation.PaymentRequired {
		t.Errorf("PaymentRequired mismatch: got %v, want %v", decoded.PaymentRequired, limitation.PaymentRequired)
	}
}

func TestRelayLimitationOmitEmpty(t *testing.T) {
	// Test that zero values are omitted from JSON
	limitation := RelayLimitation{
		MaxMessageLength: 131072,
		MaxSubscriptions: 20,
	}

	data, err := json.Marshal(limitation)
	if err != nil {
		t.Fatalf("failed to marshal RelayLimitation: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	// These should be omitted (zero values)
	if _, exists := m["max_limit"]; exists {
		t.Error("zero max_limit should be omitted")
	}
	if _, exists := m["max_event_tags"]; exists {
		t.Error("zero max_event_tags should be omitted")
	}
	if _, exists := m["max_content_length"]; exists {
		t.Error("zero max_content_length should be omitted")
	}
	if _, exists := m["min_pow_difficulty"]; exists {
		t.Error("zero min_pow_difficulty should be omitted")
	}
	if _, exists := m["auth_required"]; exists {
		t.Error("false auth_required should be omitted")
	}
	if _, exists := m["payment_required"]; exists {
		t.Error("false payment_required should be omitted")
	}

	// These should be present
	if _, exists := m["max_message_length"]; !exists {
		t.Error("max_message_length should be present")
	}
	if _, exists := m["max_subscriptions"]; !exists {
		t.Error("max_subscriptions should be present")
	}
}

func TestRelayInfoWithLimitation(t *testing.T) {
	relayInfo := RelayInfo{
		Name:          "Test Relay",
		Description:   "A test relay for unit tests",
		PubKey:        "abcdef1234567890",
		Contact:       "admin@relay.test",
		SupportedNIPs: []int{1, 2, 4, 9, 11, 22, 28},
		Software:      "https://github.com/test/relay",
		Version:       "1.0.0",
		Icon:          "https://relay.test/icon.png",
		Limitation: &RelayLimitation{
			MaxMessageLength: 262144,
			MaxSubscriptions: 50,
			MaxLimit:         1000,
			MaxEventTags:     200,
			MaxContentLength: 131072,
			MinPOWDifficulty: 8,
			AuthRequired:     false,
			PaymentRequired:  true,
		},
	}

	data, err := json.Marshal(relayInfo)
	if err != nil {
		t.Fatalf("failed to marshal RelayInfo: %v", err)
	}

	var decoded RelayInfo
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal RelayInfo: %v", err)
	}

	if decoded.Name != relayInfo.Name {
		t.Errorf("Name mismatch: got %s, want %s", decoded.Name, relayInfo.Name)
	}
	if decoded.Description != relayInfo.Description {
		t.Errorf("Description mismatch: got %s, want %s", decoded.Description, relayInfo.Description)
	}
	if decoded.PubKey != relayInfo.PubKey {
		t.Errorf("PubKey mismatch: got %s, want %s", decoded.PubKey, relayInfo.PubKey)
	}
	if decoded.Contact != relayInfo.Contact {
		t.Errorf("Contact mismatch: got %s, want %s", decoded.Contact, relayInfo.Contact)
	}
	if len(decoded.SupportedNIPs) != len(relayInfo.SupportedNIPs) {
		t.Errorf("SupportedNIPs length mismatch: got %d, want %d", len(decoded.SupportedNIPs), len(relayInfo.SupportedNIPs))
	}
	if decoded.Software != relayInfo.Software {
		t.Errorf("Software mismatch: got %s, want %s", decoded.Software, relayInfo.Software)
	}
	if decoded.Version != relayInfo.Version {
		t.Errorf("Version mismatch: got %s, want %s", decoded.Version, relayInfo.Version)
	}
	if decoded.Icon != relayInfo.Icon {
		t.Errorf("Icon mismatch: got %s, want %s", decoded.Icon, relayInfo.Icon)
	}

	if decoded.Limitation == nil {
		t.Fatal("Limitation should not be nil")
	}
	if decoded.Limitation.MaxMessageLength != 262144 {
		t.Errorf("Limitation.MaxMessageLength mismatch: got %d, want %d", decoded.Limitation.MaxMessageLength, 262144)
	}
	if decoded.Limitation.MaxSubscriptions != 50 {
		t.Errorf("Limitation.MaxSubscriptions mismatch: got %d, want %d", decoded.Limitation.MaxSubscriptions, 50)
	}
	if decoded.Limitation.MaxLimit != 1000 {
		t.Errorf("Limitation.MaxLimit mismatch: got %d, want %d", decoded.Limitation.MaxLimit, 1000)
	}
	if decoded.Limitation.MaxEventTags != 200 {
		t.Errorf("Limitation.MaxEventTags mismatch: got %d, want %d", decoded.Limitation.MaxEventTags, 200)
	}
	if decoded.Limitation.MaxContentLength != 131072 {
		t.Errorf("Limitation.MaxContentLength mismatch: got %d, want %d", decoded.Limitation.MaxContentLength, 131072)
	}
	if decoded.Limitation.MinPOWDifficulty != 8 {
		t.Errorf("Limitation.MinPOWDifficulty mismatch: got %d, want %d", decoded.Limitation.MinPOWDifficulty, 8)
	}
	if decoded.Limitation.PaymentRequired != true {
		t.Errorf("Limitation.PaymentRequired mismatch: got %v, want %v", decoded.Limitation.PaymentRequired, true)
	}
}

func TestRelayInfoWithoutLimitation(t *testing.T) {
	relayInfo := RelayInfo{
		Name:          "Minimal Relay",
		SupportedNIPs: []int{1},
	}

	data, err := json.Marshal(relayInfo)
	if err != nil {
		t.Fatalf("failed to marshal RelayInfo: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal to map: %v", err)
	}

	if _, exists := m["limitation"]; exists {
		t.Error("nil limitation should be omitted from JSON")
	}
}

func TestRelayStatusWithLimitations(t *testing.T) {
	status := RelayStatus{
		URL:           "wss://relay.example.com",
		Connected:     true,
		Latency:       150,
		EventsPS:      25.5,
		SupportedNIPs: []int{1, 2, 4, 11},
		RelayInfo: &RelayInfo{
			Name:        "Example Relay",
			Description: "An example relay",
			Limitation: &RelayLimitation{
				MaxMessageLength: 131072,
				MaxSubscriptions: 20,
				AuthRequired:     true,
			},
		},
	}

	data, err := json.Marshal(status)
	if err != nil {
		t.Fatalf("failed to marshal RelayStatus: %v", err)
	}

	var decoded RelayStatus
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal RelayStatus: %v", err)
	}

	if decoded.URL != status.URL {
		t.Errorf("URL mismatch: got %s, want %s", decoded.URL, status.URL)
	}
	if decoded.Connected != status.Connected {
		t.Errorf("Connected mismatch: got %v, want %v", decoded.Connected, status.Connected)
	}
	if decoded.RelayInfo == nil {
		t.Fatal("RelayInfo should not be nil")
	}
	if decoded.RelayInfo.Limitation == nil {
		t.Fatal("RelayInfo.Limitation should not be nil")
	}
	if decoded.RelayInfo.Limitation.MaxMessageLength != 131072 {
		t.Errorf("Limitation.MaxMessageLength mismatch: got %d, want %d", decoded.RelayInfo.Limitation.MaxMessageLength, 131072)
	}
	if decoded.RelayInfo.Limitation.MaxSubscriptions != 20 {
		t.Errorf("Limitation.MaxSubscriptions mismatch: got %d, want %d", decoded.RelayInfo.Limitation.MaxSubscriptions, 20)
	}
	if decoded.RelayInfo.Limitation.AuthRequired != true {
		t.Errorf("Limitation.AuthRequired mismatch: got %v, want %v", decoded.RelayInfo.Limitation.AuthRequired, true)
	}
}
