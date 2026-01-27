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
