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
