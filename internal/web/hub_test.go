package web

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Fatal("expected NewHub to return non-nil hub")
	}

	if hub.clients == nil {
		t.Error("expected clients map to be initialized")
	}

	if hub.broadcast == nil {
		t.Error("expected broadcast channel to be initialized")
	}

	if hub.register == nil {
		t.Error("expected register channel to be initialized")
	}

	if hub.unregister == nil {
		t.Error("expected unregister channel to be initialized")
	}
}

func TestHub_ClientCount(t *testing.T) {
	hub := NewHub()

	if hub.ClientCount() != 0 {
		t.Errorf("expected client count 0, got %d", hub.ClientCount())
	}
}

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()

	// Start the hub in a goroutine
	go hub.Run()

	msg := Message{
		Type: "test",
		Data: map[string]string{"key": "value"},
	}

	// Broadcast should not block even with no clients
	hub.Broadcast(msg)

	// Give a moment for the goroutine to process
	time.Sleep(10 * time.Millisecond)
}

func TestHub_BroadcastEvent(t *testing.T) {
	hub := NewHub()

	// Start the hub in a goroutine
	go hub.Run()

	event := types.Event{
		ID:        "test123",
		Kind:      1,
		PubKey:    "abc123",
		Content:   "test content",
		CreatedAt: 1700000000,
	}

	// Should not block
	hub.BroadcastEvent(event)

	time.Sleep(10 * time.Millisecond)
}

func TestHub_BroadcastRelayStatus(t *testing.T) {
	hub := NewHub()

	go hub.Run()

	status := types.RelayStatus{
		URL:       "wss://relay.example.com",
		Connected: true,
		Latency:   100,
		EventsPS:  2.5,
	}

	hub.BroadcastRelayStatus(status)

	time.Sleep(10 * time.Millisecond)
}

func TestHub_BroadcastTestResult(t *testing.T) {
	hub := NewHub()

	go hub.Run()

	result := types.TestResult{
		NIPID:   "nip01",
		Success: true,
		Message: "All tests passed",
		Steps: []types.TestStep{
			{Name: "Step 1", Success: true, Output: "OK"},
		},
	}

	hub.BroadcastTestResult(result)

	time.Sleep(10 * time.Millisecond)
}

func TestHub_BroadcastMonitoringUpdate(t *testing.T) {
	hub := NewHub()

	go hub.Run()

	data := types.MonitoringData{
		Relays: []types.RelayHealth{
			{
				URL:          "wss://relay.example.com",
				Connected:    true,
				Latency:      150,
				EventsPerSec: 2.5,
				Uptime:       99.5,
				HealthScore:  85.0,
				LastSeen:     1700000000,
				ErrorCount:   0,
				LatencyHistory: []types.TimeSeriesPoint{
					{Timestamp: 1699999900, Value: 140},
					{Timestamp: 1700000000, Value: 150},
				},
				EventRateHistory: []types.TimeSeriesPoint{
					{Timestamp: 1699999900, Value: 2.0},
					{Timestamp: 1700000000, Value: 2.5},
				},
			},
		},
		TotalEvents:    1000,
		EventsPerSec:   2.5,
		ConnectedCount: 1,
		TotalCount:     1,
		Timestamp:      1700000000,
	}

	hub.BroadcastMonitoringUpdate(data)

	time.Sleep(10 * time.Millisecond)
}

func TestHub_BroadcastMonitoringUpdate_MessageFormat(t *testing.T) {
	_ = NewHub() // Hub not needed for this message format test

	data := types.MonitoringData{
		Relays: []types.RelayHealth{
			{
				URL:          "wss://relay.example.com",
				Connected:    true,
				Latency:      150,
				EventsPerSec: 2.5,
				Uptime:       99.5,
				HealthScore:  85.0,
				LastSeen:     1700000000,
				ErrorCount:   0,
			},
		},
		TotalEvents:    1000,
		EventsPerSec:   2.5,
		ConnectedCount: 1,
		TotalCount:     1,
		Timestamp:      1700000000,
	}

	// Create the expected message structure
	msg := Message{
		Type: "monitoring_update",
		Data: data,
	}

	// Marshal and verify the message structure
	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal message: %v", err)
	}

	// Parse to verify structure
	var parsed struct {
		Type string               `json:"type"`
		Data types.MonitoringData `json:"data"`
	}

	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}

	if parsed.Type != "monitoring_update" {
		t.Errorf("expected type 'monitoring_update', got '%s'", parsed.Type)
	}

	if parsed.Data.TotalEvents != 1000 {
		t.Errorf("expected total_events 1000, got %d", parsed.Data.TotalEvents)
	}

	if parsed.Data.EventsPerSec != 2.5 {
		t.Errorf("expected events_per_sec 2.5, got %f", parsed.Data.EventsPerSec)
	}

	if parsed.Data.ConnectedCount != 1 {
		t.Errorf("expected connected_count 1, got %d", parsed.Data.ConnectedCount)
	}

	if len(parsed.Data.Relays) != 1 {
		t.Errorf("expected 1 relay, got %d", len(parsed.Data.Relays))
	}

	relay := parsed.Data.Relays[0]
	if relay.URL != "wss://relay.example.com" {
		t.Errorf("expected relay URL 'wss://relay.example.com', got '%s'", relay.URL)
	}

	if !relay.Connected {
		t.Error("expected relay to be connected")
	}

	if relay.HealthScore != 85.0 {
		t.Errorf("expected health_score 85.0, got %f", relay.HealthScore)
	}
}

func TestHub_BroadcastMonitoringUpdate_EmptyRelays(t *testing.T) {
	hub := NewHub()

	go hub.Run()

	data := types.MonitoringData{
		Relays:         []types.RelayHealth{},
		TotalEvents:    0,
		EventsPerSec:   0,
		ConnectedCount: 0,
		TotalCount:     0,
		Timestamp:      1700000000,
	}

	// Should not panic with empty relays
	hub.BroadcastMonitoringUpdate(data)

	time.Sleep(10 * time.Millisecond)
}

func TestHub_BroadcastMonitoringUpdate_WithHistory(t *testing.T) {
	hub := NewHub()

	go hub.Run()

	// Create monitoring data with time-series history
	data := types.MonitoringData{
		Relays: []types.RelayHealth{
			{
				URL:          "wss://relay.example.com",
				Connected:    true,
				Latency:      150,
				EventsPerSec: 2.5,
				Uptime:       99.5,
				HealthScore:  85.0,
				LastSeen:     1700000000,
				ErrorCount:   0,
				LatencyHistory: []types.TimeSeriesPoint{
					{Timestamp: 1699999800, Value: 130},
					{Timestamp: 1699999900, Value: 140},
					{Timestamp: 1700000000, Value: 150},
				},
				EventRateHistory: []types.TimeSeriesPoint{
					{Timestamp: 1699999800, Value: 1.5},
					{Timestamp: 1699999900, Value: 2.0},
					{Timestamp: 1700000000, Value: 2.5},
				},
			},
		},
		TotalEvents:    1000,
		EventsPerSec:   2.5,
		ConnectedCount: 1,
		TotalCount:     1,
		Timestamp:      1700000000,
		EventRateHistory: []types.TimeSeriesPoint{
			{Timestamp: 1699999800, Value: 1.5},
			{Timestamp: 1699999900, Value: 2.0},
			{Timestamp: 1700000000, Value: 2.5},
		},
	}

	// Should handle history data without issues
	hub.BroadcastMonitoringUpdate(data)

	// Verify the message marshals correctly with history
	msg := Message{
		Type: "monitoring_update",
		Data: data,
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal message with history: %v", err)
	}

	var parsed struct {
		Type string               `json:"type"`
		Data types.MonitoringData `json:"data"`
	}

	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}

	if len(parsed.Data.Relays[0].LatencyHistory) != 3 {
		t.Errorf("expected 3 latency history points, got %d", len(parsed.Data.Relays[0].LatencyHistory))
	}

	if len(parsed.Data.Relays[0].EventRateHistory) != 3 {
		t.Errorf("expected 3 event rate history points, got %d", len(parsed.Data.Relays[0].EventRateHistory))
	}

	if len(parsed.Data.EventRateHistory) != 3 {
		t.Errorf("expected 3 aggregate event rate history points, got %d", len(parsed.Data.EventRateHistory))
	}

	time.Sleep(10 * time.Millisecond)
}

func TestGetNIPList(t *testing.T) {
	nips := GetNIPList()

	if len(nips) == 0 {
		t.Fatal("expected GetNIPList to return non-empty list")
	}

	// Check that NIP-01 exists
	found := false
	for _, nip := range nips {
		if nip.ID == "nip01" {
			found = true
			if nip.Name != "NIP-01" {
				t.Errorf("expected NIP-01 name 'NIP-01', got '%s'", nip.Name)
			}
			if nip.Title != "Basic Protocol" {
				t.Errorf("expected NIP-01 title 'Basic Protocol', got '%s'", nip.Title)
			}
			if nip.Category != "core" {
				t.Errorf("expected NIP-01 category 'core', got '%s'", nip.Category)
			}
			if !nip.HasTest {
				t.Error("expected NIP-01 to have test")
			}
			break
		}
	}

	if !found {
		t.Error("expected to find NIP-01 in list")
	}
}

func TestGetNIPList_RelatedNIPs(t *testing.T) {
	nips := GetNIPList()

	// Build a map for easy lookup
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	// Test NIP-01 has related NIPs
	nip01, ok := nipMap["nip01"]
	if !ok {
		t.Fatal("expected to find NIP-01")
	}
	if len(nip01.RelatedNIPs) == 0 {
		t.Error("expected NIP-01 to have related NIPs")
	}
	// Check that related NIPs reference valid NIPs
	for _, related := range nip01.RelatedNIPs {
		if _, exists := nipMap[related]; !exists {
			t.Errorf("NIP-01 references unknown related NIP: %s", related)
		}
	}

	// Test NIP-02 has related NIPs
	nip02, ok := nipMap["nip02"]
	if !ok {
		t.Fatal("expected to find NIP-02")
	}
	if len(nip02.RelatedNIPs) == 0 {
		t.Error("expected NIP-02 to have related NIPs")
	}
	// NIP-02 should reference NIP-01
	foundNIP01 := false
	for _, related := range nip02.RelatedNIPs {
		if related == "nip01" {
			foundNIP01 = true
			break
		}
	}
	if !foundNIP01 {
		t.Error("expected NIP-02 to reference NIP-01 as related")
	}
}

func TestGetNIPList_EventKinds(t *testing.T) {
	nips := GetNIPList()

	// Build a map for easy lookup
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	// Test NIP-01 has event kinds 0 and 1
	nip01 := nipMap["nip01"]
	if len(nip01.EventKinds) == 0 {
		t.Error("expected NIP-01 to have event kinds")
	}
	hasKind0, hasKind1 := false, false
	for _, kind := range nip01.EventKinds {
		if kind == 0 {
			hasKind0 = true
		}
		if kind == 1 {
			hasKind1 = true
		}
	}
	if !hasKind0 {
		t.Error("expected NIP-01 to include kind 0 (metadata)")
	}
	if !hasKind1 {
		t.Error("expected NIP-01 to include kind 1 (text note)")
	}

	// Test NIP-02 has event kind 3
	nip02 := nipMap["nip02"]
	if len(nip02.EventKinds) == 0 {
		t.Error("expected NIP-02 to have event kinds")
	}
	hasKind3 := false
	for _, kind := range nip02.EventKinds {
		if kind == 3 {
			hasKind3 = true
			break
		}
	}
	if !hasKind3 {
		t.Error("expected NIP-02 to include kind 3 (contact list)")
	}

	// Test NIP-57 has zap event kinds
	nip57 := nipMap["nip57"]
	if len(nip57.EventKinds) == 0 {
		t.Error("expected NIP-57 to have event kinds")
	}
	hasKind9734, hasKind9735 := false, false
	for _, kind := range nip57.EventKinds {
		if kind == 9734 {
			hasKind9734 = true
		}
		if kind == 9735 {
			hasKind9735 = true
		}
	}
	if !hasKind9734 {
		t.Error("expected NIP-57 to include kind 9734 (zap request)")
	}
	if !hasKind9735 {
		t.Error("expected NIP-57 to include kind 9735 (zap receipt)")
	}

	// Test NIP-19 has no event kinds (it's an encoding standard)
	nip19 := nipMap["nip19"]
	if len(nip19.EventKinds) != 0 {
		t.Error("expected NIP-19 to have no event kinds (it's an encoding standard)")
	}

	// Test NIP-90 has DVM event kinds
	nip90 := nipMap["nip90"]
	if len(nip90.EventKinds) == 0 {
		t.Error("expected NIP-90 to have event kinds")
	}
	hasKind5000, hasKind6000, hasKind7000 := false, false, false
	for _, kind := range nip90.EventKinds {
		if kind == 5000 {
			hasKind5000 = true
		}
		if kind == 6000 {
			hasKind6000 = true
		}
		if kind == 7000 {
			hasKind7000 = true
		}
	}
	if !hasKind5000 {
		t.Error("expected NIP-90 to include kind 5000 (DVM job request)")
	}
	if !hasKind6000 {
		t.Error("expected NIP-90 to include kind 6000 (DVM job result)")
	}
	if !hasKind7000 {
		t.Error("expected NIP-90 to include kind 7000 (DVM feedback)")
	}
}

func TestGetNIPList_AllNIPsHaveCategory(t *testing.T) {
	nips := GetNIPList()

	for _, nip := range nips {
		if nip.Category == "" {
			t.Errorf("NIP %s is missing category", nip.ID)
		}
	}
}

func TestHub_HandleClientMessage_UnknownType(t *testing.T) {
	hub := NewHub()

	// Test with unknown message type - should not panic
	data := []byte(`{"type":"unknown","data":{}}`)
	hub.HandleClientMessage(data)
}

func TestHub_HandleClientMessage_InvalidJSON(t *testing.T) {
	hub := NewHub()

	// Test with invalid JSON - should not panic
	data := []byte(`invalid json`)
	hub.HandleClientMessage(data)
}

func TestHub_HandleClientMessage_SubscribeEvents(t *testing.T) {
	hub := NewHub()

	// Test subscribe_events message type
	data := []byte(`{"type":"subscribe_events","data":{"kinds":[1]}}`)
	hub.HandleClientMessage(data)
}

func TestHub_HandleClientMessage_Ping(t *testing.T) {
	hub := NewHub()

	// Test ping message type
	data := []byte(`{"type":"ping","data":{}}`)
	hub.HandleClientMessage(data)
}

func TestGetNIPList_ValidCategories(t *testing.T) {
	nips := GetNIPList()

	// Valid categories that the frontend expects
	validCategories := map[string]bool{
		"core":       true,
		"identity":   true,
		"encoding":   true,
		"encryption": true,
		"payments":   true,
		"dvms":       true,
		"social":     true,
	}

	for _, nip := range nips {
		if !validCategories[nip.Category] {
			t.Errorf("NIP %s has invalid category '%s', expected one of: core, identity, encoding, encryption, payments, dvms, social", nip.ID, nip.Category)
		}
	}
}

func TestGetNIPList_CategoryDistribution(t *testing.T) {
	nips := GetNIPList()

	// Count NIPs per category to verify distribution
	categoryCounts := make(map[string]int)
	for _, nip := range nips {
		categoryCounts[nip.Category]++
	}

	// Verify we have at least one category assigned
	if len(categoryCounts) == 0 {
		t.Error("expected at least one category in use")
	}

	// Verify core category has NIPs (it should have NIP-01 and NIP-02)
	if categoryCounts["core"] < 1 {
		t.Error("expected at least one NIP in 'core' category")
	}
}

func TestGetNIPList_ExampleEvents(t *testing.T) {
	nips := GetNIPList()

	// Build a map for easy lookup
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	// Test NIP-01 has example events
	nip01 := nipMap["nip01"]
	if len(nip01.ExampleEvents) == 0 {
		t.Error("expected NIP-01 to have example events")
	}

	// Check that example events have description and JSON
	for i, example := range nip01.ExampleEvents {
		if example.Description == "" {
			t.Errorf("NIP-01 example %d has empty description", i)
		}
		if example.JSON == "" {
			t.Errorf("NIP-01 example %d has empty JSON", i)
		}
	}
}

func TestGetNIPList_ExampleEventsForAllNIPs(t *testing.T) {
	nips := GetNIPList()

	for _, nip := range nips {
		if len(nip.ExampleEvents) == 0 {
			t.Errorf("NIP %s is missing example events", nip.ID)
		}
	}
}

func TestGetNIPList_ExampleEventsNIP01(t *testing.T) {
	nips := GetNIPList()
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	nip01 := nipMap["nip01"]

	// NIP-01 should have at least 2 examples (Kind 0 metadata and Kind 1 text note)
	if len(nip01.ExampleEvents) < 2 {
		t.Errorf("expected NIP-01 to have at least 2 example events, got %d", len(nip01.ExampleEvents))
	}

	// Check for Kind 0 metadata example
	foundKind0 := false
	foundKind1 := false
	for _, example := range nip01.ExampleEvents {
		if example.Description == "User Metadata (Kind 0)" {
			foundKind0 = true
		}
		if example.Description == "Text Note (Kind 1)" {
			foundKind1 = true
		}
	}
	if !foundKind0 {
		t.Error("expected NIP-01 to have User Metadata (Kind 0) example")
	}
	if !foundKind1 {
		t.Error("expected NIP-01 to have Text Note (Kind 1) example")
	}
}

func TestGetNIPList_ExampleEventsNIP02(t *testing.T) {
	nips := GetNIPList()
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	nip02 := nipMap["nip02"]

	// NIP-02 should have at least 1 example (Follow List Kind 3)
	if len(nip02.ExampleEvents) < 1 {
		t.Errorf("expected NIP-02 to have at least 1 example event, got %d", len(nip02.ExampleEvents))
	}

	// Check for Follow List example
	foundFollowList := false
	for _, example := range nip02.ExampleEvents {
		if example.Description == "Follow List (Kind 3)" {
			foundFollowList = true
			break
		}
	}
	if !foundFollowList {
		t.Error("expected NIP-02 to have Follow List (Kind 3) example")
	}
}

func TestGetNIPList_ExampleEventsNIP19(t *testing.T) {
	nips := GetNIPList()
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	nip19 := nipMap["nip19"]

	// NIP-19 should have encoding examples (npub, note, nprofile, nevent)
	if len(nip19.ExampleEvents) < 2 {
		t.Errorf("expected NIP-19 to have at least 2 example events, got %d", len(nip19.ExampleEvents))
	}

	// Check for npub example
	foundNpub := false
	for _, example := range nip19.ExampleEvents {
		if example.Description == "npub (public key)" {
			foundNpub = true
			break
		}
	}
	if !foundNpub {
		t.Error("expected NIP-19 to have npub (public key) example")
	}
}

func TestGetNIPList_ExampleEventsNIP57(t *testing.T) {
	nips := GetNIPList()
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	nip57 := nipMap["nip57"]

	// NIP-57 should have zap examples (Zap Request and Zap Receipt)
	if len(nip57.ExampleEvents) < 2 {
		t.Errorf("expected NIP-57 to have at least 2 example events, got %d", len(nip57.ExampleEvents))
	}

	// Check for zap request and receipt examples
	foundZapRequest := false
	foundZapReceipt := false
	for _, example := range nip57.ExampleEvents {
		if example.Description == "Zap Request (Kind 9734)" {
			foundZapRequest = true
		}
		if example.Description == "Zap Receipt (Kind 9735)" {
			foundZapReceipt = true
		}
	}
	if !foundZapRequest {
		t.Error("expected NIP-57 to have Zap Request (Kind 9734) example")
	}
	if !foundZapReceipt {
		t.Error("expected NIP-57 to have Zap Receipt (Kind 9735) example")
	}
}

func TestGetNIPList_ExampleEventsNIP90(t *testing.T) {
	nips := GetNIPList()
	nipMap := make(map[string]types.NIPInfo)
	for _, nip := range nips {
		nipMap[nip.ID] = nip
	}

	nip90 := nipMap["nip90"]

	// NIP-90 should have DVM examples (Job Request, Job Result, Job Feedback)
	if len(nip90.ExampleEvents) < 3 {
		t.Errorf("expected NIP-90 to have at least 3 example events, got %d", len(nip90.ExampleEvents))
	}

	// Check for DVM examples
	foundJobRequest := false
	foundJobResult := false
	foundJobFeedback := false
	for _, example := range nip90.ExampleEvents {
		if example.Description == "Job Request - Text Extraction (Kind 5000)" {
			foundJobRequest = true
		}
		if example.Description == "Job Result (Kind 6000)" {
			foundJobResult = true
		}
		if example.Description == "Job Feedback (Kind 7000)" {
			foundJobFeedback = true
		}
	}
	if !foundJobRequest {
		t.Error("expected NIP-90 to have Job Request example")
	}
	if !foundJobResult {
		t.Error("expected NIP-90 to have Job Result example")
	}
	if !foundJobFeedback {
		t.Error("expected NIP-90 to have Job Feedback example")
	}
}

func TestGetNIPList_ExampleEventsJSONSerialization(t *testing.T) {
	nips := GetNIPList()

	// Test that NIPInfo with ExampleEvents serializes correctly to JSON
	msg := Message{
		Type: "init",
		Data: InitData{
			NIPs: nips,
		},
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal message with example events: %v", err)
	}

	// Parse to verify structure
	var parsed struct {
		Type string `json:"type"`
		Data struct {
			NIPs []struct {
				ID            string `json:"id"`
				ExampleEvents []struct {
					Description string `json:"description"`
					JSON        string `json:"json"`
				} `json:"exampleEvents"`
			} `json:"nips"`
		} `json:"data"`
	}

	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}

	if parsed.Type != "init" {
		t.Errorf("expected type 'init', got '%s'", parsed.Type)
	}

	if len(parsed.Data.NIPs) == 0 {
		t.Error("expected non-empty NIPs in parsed data")
	}

	// Find NIP-01 and verify it has example events
	for _, nip := range parsed.Data.NIPs {
		if nip.ID == "nip01" {
			if len(nip.ExampleEvents) == 0 {
				t.Error("expected NIP-01 to have example events in serialized form")
			}
			for i, example := range nip.ExampleEvents {
				if example.Description == "" {
					t.Errorf("NIP-01 serialized example %d has empty description", i)
				}
				if example.JSON == "" {
					t.Errorf("NIP-01 serialized example %d has empty JSON", i)
				}
			}
			break
		}
	}
}
