package relay

import (
	"sync"
	"testing"
	"time"
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
