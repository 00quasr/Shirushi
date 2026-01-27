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
