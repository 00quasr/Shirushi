package web

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/keanuklestil/shirushi/internal/config"
	"github.com/keanuklestil/shirushi/internal/types"
)

func TestNewServer_WiresUpStatusCallback(t *testing.T) {
	pool := &mockRelayPool{}
	cfg := &config.Config{}
	api := NewAPI(cfg, nil, pool, nil)

	_ = NewServer(":0", nil, api)

	// Verify that the callback was set
	if pool.statusCallback == nil {
		t.Error("expected SetStatusCallback to be called during NewServer")
	}
}

func TestNewServer_StatusCallbackBroadcastsRelayStatus(t *testing.T) {
	pool := &mockRelayPool{}
	cfg := &config.Config{}
	api := NewAPI(cfg, nil, pool, nil)

	server := NewServer(":0", nil, api)

	// Start the hub to receive broadcasts
	go server.hub.Run()

	// Give the hub time to start
	time.Sleep(10 * time.Millisecond)

	// Verify callback was set
	if pool.statusCallback == nil {
		t.Fatal("expected SetStatusCallback to be called")
	}

	// Create a channel to receive the broadcast message
	var receivedStatus types.RelayStatus
	var mu sync.Mutex

	// Add a test client to the hub
	testClient := &Client{
		hub:  server.hub,
		send: make(chan []byte, 10),
	}
	server.hub.register <- testClient

	// Give time for registration and drain the initial "init" message
	time.Sleep(20 * time.Millisecond)

	// Drain the initial "init" message sent on client connection
	select {
	case <-testClient.send:
		// Discarded init message
	case <-time.After(100 * time.Millisecond):
		// No init message, that's fine
	}

	// Invoke the callback
	pool.statusCallback("wss://test.relay", true, "")

	// Wait for the relay_status message to be broadcast
	select {
	case msg := <-testClient.send:
		mu.Lock()
		// Parse the message
		var wsMsg struct {
			Type string            `json:"type"`
			Data types.RelayStatus `json:"data"`
		}
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			t.Errorf("failed to parse broadcast message: %v", err)
		}
		if wsMsg.Type != "relay_status" {
			t.Errorf("expected message type 'relay_status', got '%s'", wsMsg.Type)
		}
		receivedStatus = wsMsg.Data
		mu.Unlock()
	case <-time.After(500 * time.Millisecond):
		t.Error("timed out waiting for broadcast message")
		return
	}

	mu.Lock()
	defer mu.Unlock()

	if receivedStatus.URL != "wss://test.relay" {
		t.Errorf("expected URL 'wss://test.relay', got '%s'", receivedStatus.URL)
	}
	if !receivedStatus.Connected {
		t.Error("expected Connected to be true")
	}
	if receivedStatus.Error != "" {
		t.Errorf("expected empty Error, got '%s'", receivedStatus.Error)
	}
}

func TestNewServer_StatusCallbackWithError(t *testing.T) {
	pool := &mockRelayPool{}
	cfg := &config.Config{}
	api := NewAPI(cfg, nil, pool, nil)

	server := NewServer(":0", nil, api)

	// Start the hub
	go server.hub.Run()
	time.Sleep(10 * time.Millisecond)

	// Verify callback was set
	if pool.statusCallback == nil {
		t.Fatal("expected SetStatusCallback to be called")
	}

	// Add a test client
	testClient := &Client{
		hub:  server.hub,
		send: make(chan []byte, 10),
	}
	server.hub.register <- testClient
	time.Sleep(20 * time.Millisecond)

	// Drain the initial "init" message
	select {
	case <-testClient.send:
		// Discarded init message
	case <-time.After(100 * time.Millisecond):
		// No init message, that's fine
	}

	// Invoke the callback with an error
	pool.statusCallback("wss://failed.relay", false, "connection refused")

	select {
	case msg := <-testClient.send:
		var wsMsg struct {
			Type string            `json:"type"`
			Data types.RelayStatus `json:"data"`
		}
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			t.Errorf("failed to parse broadcast message: %v", err)
		}
		if wsMsg.Type != "relay_status" {
			t.Errorf("expected message type 'relay_status', got '%s'", wsMsg.Type)
		}
		if wsMsg.Data.URL != "wss://failed.relay" {
			t.Errorf("expected URL 'wss://failed.relay', got '%s'", wsMsg.Data.URL)
		}
		if wsMsg.Data.Connected {
			t.Error("expected Connected to be false")
		}
		if wsMsg.Data.Error != "connection refused" {
			t.Errorf("expected Error 'connection refused', got '%s'", wsMsg.Data.Error)
		}
	case <-time.After(500 * time.Millisecond):
		t.Error("timed out waiting for broadcast message")
	}
}

func TestNewServer_NilRelayPool(t *testing.T) {
	cfg := &config.Config{}
	api := NewAPI(cfg, nil, nil, nil)

	// Should not panic when relayPool is nil
	server := NewServer(":0", nil, api)

	if server == nil {
		t.Error("expected NewServer to return non-nil server")
	}
	if server.hub == nil {
		t.Error("expected hub to be initialized")
	}
}
