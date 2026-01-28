package relay

import (
	"sync"
	"testing"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
)

func TestSetOnStatusChange(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Initially nil
	if pool.onStatusChange != nil {
		t.Error("expected onStatusChange to be nil initially")
	}

	// Set a callback
	called := false
	pool.SetOnStatusChange(func(url string, connected bool, err string) {
		called = true
	})

	if pool.onStatusChange == nil {
		t.Error("expected onStatusChange to be set")
	}

	// Invoke it to verify it's working
	pool.notifyStatusChange("test", true, "")
	if !called {
		t.Error("expected callback to be called")
	}
}

func TestNotifyStatusChangeWithNilCallback(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Should not panic when callback is nil
	pool.notifyStatusChange("wss://test.relay.com", true, "")
}

func TestNotifyStatusChangeInvokesCallback(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	var receivedURL string
	var receivedConnected bool
	var receivedErr string
	var mu sync.Mutex

	pool.SetOnStatusChange(func(url string, connected bool, err string) {
		mu.Lock()
		defer mu.Unlock()
		receivedURL = url
		receivedConnected = connected
		receivedErr = err
	})

	// Test connected status
	pool.notifyStatusChange("wss://test.relay.com", true, "")

	mu.Lock()
	if receivedURL != "wss://test.relay.com" {
		t.Errorf("expected URL wss://test.relay.com, got %s", receivedURL)
	}
	if !receivedConnected {
		t.Error("expected connected to be true")
	}
	if receivedErr != "" {
		t.Errorf("expected empty error, got %s", receivedErr)
	}
	mu.Unlock()

	// Test disconnected status with error
	pool.notifyStatusChange("wss://other.relay.com", false, "connection refused")

	mu.Lock()
	if receivedURL != "wss://other.relay.com" {
		t.Errorf("expected URL wss://other.relay.com, got %s", receivedURL)
	}
	if receivedConnected {
		t.Error("expected connected to be false")
	}
	if receivedErr != "connection refused" {
		t.Errorf("expected error 'connection refused', got %s", receivedErr)
	}
	mu.Unlock()
}

func TestRemoveNotifiesStatusChange(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a connected relay
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
	}

	var receivedURL string
	var receivedConnected bool
	var receivedErr string
	notified := make(chan struct{}, 1)

	pool.SetOnStatusChange(func(url string, connected bool, err string) {
		receivedURL = url
		receivedConnected = connected
		receivedErr = err
		notified <- struct{}{}
	})

	// Remove the relay
	pool.Remove("wss://test.relay.com")

	// Wait for notification
	select {
	case <-notified:
		if receivedURL != "wss://test.relay.com" {
			t.Errorf("expected URL wss://test.relay.com, got %s", receivedURL)
		}
		if receivedConnected {
			t.Error("expected connected to be false after removal")
		}
		if receivedErr != "removed" {
			t.Errorf("expected error 'removed', got %s", receivedErr)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("expected notification after removing connected relay")
	}
}

func TestRemoveDoesNotNotifyForDisconnectedRelay(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a disconnected relay
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: false,
	}

	notified := false
	pool.SetOnStatusChange(func(url string, connected bool, err string) {
		notified = true
	})

	// Remove the relay
	pool.Remove("wss://test.relay.com")

	// Give some time for any potential notification
	time.Sleep(10 * time.Millisecond)

	if notified {
		t.Error("should not notify for already disconnected relay")
	}
}

func TestRemoveNonExistentRelay(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	notified := false
	pool.SetOnStatusChange(func(url string, connected bool, err string) {
		notified = true
	})

	// Remove non-existent relay should not panic or notify
	pool.Remove("wss://nonexistent.relay.com")

	time.Sleep(10 * time.Millisecond)

	if notified {
		t.Error("should not notify for non-existent relay")
	}
}

func TestSetStatusCallback(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Initially nil
	if pool.onStatusChange != nil {
		t.Error("expected onStatusChange to be nil initially")
	}

	// Set a callback using SetStatusCallback
	var receivedURL string
	var receivedConnected bool
	var receivedErr string

	pool.SetStatusCallback(func(url string, connected bool, err string) {
		receivedURL = url
		receivedConnected = connected
		receivedErr = err
	})

	if pool.onStatusChange == nil {
		t.Error("expected onStatusChange to be set via SetStatusCallback")
	}

	// Invoke notification to verify it's working
	pool.notifyStatusChange("wss://test.relay.com", true, "")

	if receivedURL != "wss://test.relay.com" {
		t.Errorf("expected URL wss://test.relay.com, got %s", receivedURL)
	}
	if !receivedConnected {
		t.Error("expected connected to be true")
	}
	if receivedErr != "" {
		t.Errorf("expected empty error, got %s", receivedErr)
	}

	// Test with disconnection error
	pool.notifyStatusChange("wss://other.relay.com", false, "timeout")

	if receivedURL != "wss://other.relay.com" {
		t.Errorf("expected URL wss://other.relay.com, got %s", receivedURL)
	}
	if receivedConnected {
		t.Error("expected connected to be false")
	}
	if receivedErr != "timeout" {
		t.Errorf("expected error 'timeout', got %s", receivedErr)
	}
}

func TestStatusChangeCallbackIsConcurrencySafe(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	var count int
	var mu sync.Mutex

	pool.SetOnStatusChange(func(url string, connected bool, err string) {
		mu.Lock()
		count++
		mu.Unlock()
	})

	// Fire many notifications concurrently
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			pool.notifyStatusChange("wss://test.relay.com", i%2 == 0, "")
		}(i)
	}
	wg.Wait()

	mu.Lock()
	if count != 100 {
		t.Errorf("expected 100 notifications, got %d", count)
	}
	mu.Unlock()
}

func TestPublishEventNoConnectedRelays(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	results := pool.PublishEvent(nil, nil)

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Success {
		t.Error("expected success to be false when no connected relays")
	}
	if results[0].Error != "no connected relays" {
		t.Errorf("expected error 'no connected relays', got '%s'", results[0].Error)
	}
}

func TestPublishEventRelayNotInPool(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a different relay to the pool
	pool.relays["wss://other.relay.com"] = &RelayConn{
		URL:       "wss://other.relay.com",
		Connected: true,
	}

	// Try to publish to a relay that's not in the pool
	results := pool.PublishEvent(nil, []string{"wss://nonexistent.relay.com"})

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Success {
		t.Error("expected success to be false for relay not in pool")
	}
	if results[0].URL != "wss://nonexistent.relay.com" {
		t.Errorf("expected URL 'wss://nonexistent.relay.com', got '%s'", results[0].URL)
	}
	if results[0].Error != "relay not in pool" {
		t.Errorf("expected error 'relay not in pool', got '%s'", results[0].Error)
	}
}

func TestPublishEventRelayNotConnected(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a disconnected relay
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: false,
	}

	results := pool.PublishEvent(nil, []string{"wss://test.relay.com"})

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Success {
		t.Error("expected success to be false for disconnected relay")
	}
	if results[0].URL != "wss://test.relay.com" {
		t.Errorf("expected URL 'wss://test.relay.com', got '%s'", results[0].URL)
	}
	if results[0].Error != "relay not connected" {
		t.Errorf("expected error 'relay not connected', got '%s'", results[0].Error)
	}
}

func TestPublishEventRelayNilConnection(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a relay marked as connected but with nil Relay object
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
		Relay:     nil,
	}

	results := pool.PublishEvent(nil, []string{"wss://test.relay.com"})

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Success {
		t.Error("expected success to be false when Relay object is nil")
	}
	if results[0].Error != "relay not connected" {
		t.Errorf("expected error 'relay not connected', got '%s'", results[0].Error)
	}
}

func TestPublishEventMultipleRelaysMixedResults(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a connected relay (but nil Relay, so will fail)
	pool.relays["wss://connected.relay.com"] = &RelayConn{
		URL:       "wss://connected.relay.com",
		Connected: true,
		Relay:     nil,
	}

	// Add a disconnected relay
	pool.relays["wss://disconnected.relay.com"] = &RelayConn{
		URL:       "wss://disconnected.relay.com",
		Connected: false,
	}

	results := pool.PublishEvent(nil, []string{"wss://connected.relay.com", "wss://disconnected.relay.com", "wss://notinpool.relay.com"})

	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	// Check results (order may vary due to concurrent execution)
	resultMap := make(map[string]types.PublishResult)
	for _, r := range results {
		resultMap[r.URL] = r
	}

	// Check connected relay result (should fail because Relay is nil)
	if r, ok := resultMap["wss://connected.relay.com"]; ok {
		if r.Success {
			t.Error("expected success to be false for relay with nil connection")
		}
		if r.Error != "relay not connected" {
			t.Errorf("expected error 'relay not connected', got '%s'", r.Error)
		}
	} else {
		t.Error("missing result for wss://connected.relay.com")
	}

	// Check disconnected relay result
	if r, ok := resultMap["wss://disconnected.relay.com"]; ok {
		if r.Success {
			t.Error("expected success to be false for disconnected relay")
		}
		if r.Error != "relay not connected" {
			t.Errorf("expected error 'relay not connected', got '%s'", r.Error)
		}
	} else {
		t.Error("missing result for wss://disconnected.relay.com")
	}

	// Check not-in-pool relay result
	if r, ok := resultMap["wss://notinpool.relay.com"]; ok {
		if r.Success {
			t.Error("expected success to be false for relay not in pool")
		}
		if r.Error != "relay not in pool" {
			t.Errorf("expected error 'relay not in pool', got '%s'", r.Error)
		}
	} else {
		t.Error("missing result for wss://notinpool.relay.com")
	}
}

func TestPublishEventUsesAllConnectedRelaysWhenNoURLsProvided(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add connected relays (with nil Relay, so they'll fail but we can test selection logic)
	pool.relays["wss://relay1.com"] = &RelayConn{
		URL:       "wss://relay1.com",
		Connected: true,
		Relay:     nil,
	}
	pool.relays["wss://relay2.com"] = &RelayConn{
		URL:       "wss://relay2.com",
		Connected: true,
		Relay:     nil,
	}
	// Add a disconnected relay that should NOT be included
	pool.relays["wss://disconnected.com"] = &RelayConn{
		URL:       "wss://disconnected.com",
		Connected: false,
	}

	results := pool.PublishEvent(nil, nil) // Pass nil to use all connected relays

	// Should only get results for connected relays
	if len(results) != 2 {
		t.Fatalf("expected 2 results (only connected relays), got %d", len(results))
	}

	// Verify we got results for the connected relays
	urls := make(map[string]bool)
	for _, r := range results {
		urls[r.URL] = true
	}

	if !urls["wss://relay1.com"] {
		t.Error("expected result for wss://relay1.com")
	}
	if !urls["wss://relay2.com"] {
		t.Error("expected result for wss://relay2.com")
	}
	if urls["wss://disconnected.com"] {
		t.Error("should not have result for disconnected relay")
	}
}

func TestPublishEventEmptyRelayURLsSlice(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add a connected relay
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
		Relay:     nil,
	}

	// Pass empty slice (should use all connected relays)
	results := pool.PublishEvent(nil, []string{})

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].URL != "wss://test.relay.com" {
		t.Errorf("expected URL 'wss://test.relay.com', got '%s'", results[0].URL)
	}
}

func TestPublishResultFields(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: false,
	}

	results := pool.PublishEvent(nil, []string{"wss://test.relay.com"})

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	result := results[0]

	// Verify all fields are set correctly
	if result.URL != "wss://test.relay.com" {
		t.Errorf("expected URL 'wss://test.relay.com', got '%s'", result.URL)
	}
	if result.Success != false {
		t.Error("expected Success to be false")
	}
	if result.Error == "" {
		t.Error("expected Error to be non-empty")
	}
}

// Tests for PublishEventJSON

func TestPublishEventJSON_InvalidJSON(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
	}

	eventID, results := pool.PublishEventJSON([]byte(`{invalid json`), []string{"wss://test.relay.com"})

	if eventID != "" {
		t.Errorf("expected empty event ID for invalid JSON, got '%s'", eventID)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].Success {
		t.Error("expected success to be false for invalid JSON")
	}

	if results[0].Error == "" {
		t.Error("expected error message for invalid JSON")
	}
}

func TestPublishEventJSON_ExtractsEventID(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Relay with nil connection (will fail to publish but we can still test ID extraction)
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
		Relay:     nil,
	}

	eventJSON := `{"id":"abc123def456","pubkey":"testpubkey","kind":1,"content":"hello"}`
	eventID, results := pool.PublishEventJSON([]byte(eventJSON), []string{"wss://test.relay.com"})

	if eventID != "abc123def456" {
		t.Errorf("expected event ID 'abc123def456', got '%s'", eventID)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].URL != "wss://test.relay.com" {
		t.Errorf("expected relay URL 'wss://test.relay.com', got '%s'", results[0].URL)
	}
}

func TestPublishEventJSON_NoConnectedRelays(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	eventJSON := `{"id":"test123","pubkey":"testpubkey","kind":1,"content":"hello"}`
	eventID, results := pool.PublishEventJSON([]byte(eventJSON), nil)

	if eventID != "test123" {
		t.Errorf("expected event ID 'test123', got '%s'", eventID)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].Success {
		t.Error("expected success to be false when no connected relays")
	}

	if results[0].Error != "no connected relays" {
		t.Errorf("expected error 'no connected relays', got '%s'", results[0].Error)
	}
}

func TestPublishEventJSON_MultipleRelays(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Add relays with nil connections (will fail to publish)
	pool.relays["wss://relay1.com"] = &RelayConn{
		URL:       "wss://relay1.com",
		Connected: true,
		Relay:     nil,
	}
	pool.relays["wss://relay2.com"] = &RelayConn{
		URL:       "wss://relay2.com",
		Connected: false, // Not connected
	}

	eventJSON := `{"id":"multirelay123","pubkey":"testpubkey","kind":1,"content":"hello"}`
	eventID, results := pool.PublishEventJSON([]byte(eventJSON), []string{"wss://relay1.com", "wss://relay2.com"})

	if eventID != "multirelay123" {
		t.Errorf("expected event ID 'multirelay123', got '%s'", eventID)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// Check results for each relay
	urlResults := make(map[string]types.PublishResult)
	for _, r := range results {
		urlResults[r.URL] = r
	}

	// relay1 should have an error (nil Relay connection)
	if r, ok := urlResults["wss://relay1.com"]; ok {
		if r.Success {
			t.Error("expected success to be false for relay with nil connection")
		}
	} else {
		t.Error("missing result for wss://relay1.com")
	}

	// relay2 should have an error (not connected)
	if r, ok := urlResults["wss://relay2.com"]; ok {
		if r.Success {
			t.Error("expected success to be false for disconnected relay")
		}
		if r.Error != "relay not connected" {
			t.Errorf("expected error 'relay not connected', got '%s'", r.Error)
		}
	} else {
		t.Error("missing result for wss://relay2.com")
	}
}

// Tests for NIP-11 relay info callback

func TestSetOnRelayInfo(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Initially nil
	if pool.onRelayInfo != nil {
		t.Error("expected onRelayInfo to be nil initially")
	}

	// Set a callback
	called := false
	pool.SetOnRelayInfo(func(url string, info *types.RelayInfo) {
		called = true
	})

	if pool.onRelayInfo == nil {
		t.Error("expected onRelayInfo to be set")
	}

	// Invoke it to verify it's working
	pool.notifyRelayInfo("wss://test.relay.com", &types.RelayInfo{Name: "Test"})
	if !called {
		t.Error("expected callback to be called")
	}
}

func TestNotifyRelayInfoWithNilCallback(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Should not panic when callback is nil
	pool.notifyRelayInfo("wss://test.relay.com", &types.RelayInfo{Name: "Test"})
}

func TestNotifyRelayInfoInvokesCallback(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	var receivedURL string
	var receivedInfo *types.RelayInfo
	var mu sync.Mutex

	pool.SetOnRelayInfo(func(url string, info *types.RelayInfo) {
		mu.Lock()
		defer mu.Unlock()
		receivedURL = url
		receivedInfo = info
	})

	testInfo := &types.RelayInfo{
		Name:          "Test Relay",
		Description:   "A test relay",
		SupportedNIPs: []int{1, 2, 5, 11},
		Software:      "test-relay",
		Version:       "1.0.0",
	}

	pool.notifyRelayInfo("wss://test.relay.com", testInfo)

	mu.Lock()
	if receivedURL != "wss://test.relay.com" {
		t.Errorf("expected URL wss://test.relay.com, got %s", receivedURL)
	}
	if receivedInfo == nil {
		t.Fatal("expected receivedInfo to be non-nil")
	}
	if receivedInfo.Name != "Test Relay" {
		t.Errorf("expected Name 'Test Relay', got %s", receivedInfo.Name)
	}
	if receivedInfo.Description != "A test relay" {
		t.Errorf("expected Description 'A test relay', got %s", receivedInfo.Description)
	}
	if len(receivedInfo.SupportedNIPs) != 4 {
		t.Errorf("expected 4 supported NIPs, got %d", len(receivedInfo.SupportedNIPs))
	}
	mu.Unlock()
}

func TestRelayInfoCallbackIsConcurrencySafe(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	var count int
	var mu sync.Mutex

	pool.SetOnRelayInfo(func(url string, info *types.RelayInfo) {
		mu.Lock()
		count++
		mu.Unlock()
	})

	// Fire many notifications concurrently
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			pool.notifyRelayInfo("wss://test.relay.com", &types.RelayInfo{Name: "Test"})
		}(i)
	}
	wg.Wait()

	mu.Lock()
	if count != 100 {
		t.Errorf("expected 100 notifications, got %d", count)
	}
	mu.Unlock()
}

func TestNotifyRelayInfoWithLimitation(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	var receivedInfo *types.RelayInfo
	var mu sync.Mutex

	pool.SetOnRelayInfo(func(url string, info *types.RelayInfo) {
		mu.Lock()
		defer mu.Unlock()
		receivedInfo = info
	})

	testInfo := &types.RelayInfo{
		Name: "Test Relay",
		Limitation: &types.RelayLimitation{
			MaxMessageLength: 65536,
			MaxSubscriptions: 20,
			AuthRequired:     true,
			PaymentRequired:  false,
		},
	}

	pool.notifyRelayInfo("wss://test.relay.com", testInfo)

	mu.Lock()
	if receivedInfo == nil {
		t.Fatal("expected receivedInfo to be non-nil")
	}
	if receivedInfo.Limitation == nil {
		t.Fatal("expected Limitation to be non-nil")
	}
	if receivedInfo.Limitation.MaxMessageLength != 65536 {
		t.Errorf("expected MaxMessageLength 65536, got %d", receivedInfo.Limitation.MaxMessageLength)
	}
	if receivedInfo.Limitation.MaxSubscriptions != 20 {
		t.Errorf("expected MaxSubscriptions 20, got %d", receivedInfo.Limitation.MaxSubscriptions)
	}
	if !receivedInfo.Limitation.AuthRequired {
		t.Error("expected AuthRequired to be true")
	}
	if receivedInfo.Limitation.PaymentRequired {
		t.Error("expected PaymentRequired to be false")
	}
	mu.Unlock()
}
