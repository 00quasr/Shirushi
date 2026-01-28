// Package web provides WebSocket hub for real-time updates.
package web

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/keanuklestil/shirushi/internal/types"
)

// Client represents a connected WebSocket client.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex

	// Event rate limiting and deduplication
	// eventMu protects eventBuffer and seenEventIDs
	eventBuffer  []types.Event
	seenEventIDs map[string]bool
	eventMu      sync.Mutex

	eventTicker     *time.Ticker
	maxEventsPerSec int
	stopChan        chan struct{}
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	h := &Hub{
		clients:         make(map[*Client]bool),
		broadcast:       make(chan []byte, 256),
		register:        make(chan *Client),
		unregister:      make(chan *Client),
		eventBuffer:     make([]types.Event, 0),
		maxEventsPerSec: 20, // Limit to 20 events per second
		stopChan:        make(chan struct{}),
		seenEventIDs:    make(map[string]bool),
	}
	return h
}

// Run starts the hub's main loop.
func (h *Hub) Run() {
	// Start the event flush ticker (100ms = 10 flushes per second)
	h.eventTicker = time.NewTicker(100 * time.Millisecond)
	defer h.eventTicker.Stop()

	for {
		select {
		case <-h.stopChan:
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			log.Printf("[Hub] Client connected (%d total)", len(h.clients))
			h.mu.Unlock()

			// Send initial state
			h.sendInitialState(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("[Hub] Client disconnected (%d total)", len(h.clients))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			// Collect clients that fail to receive the message
			var deadClients []*Client
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					deadClients = append(deadClients, client)
				}
			}
			h.mu.RUnlock()

			// Remove dead clients with proper write lock
			if len(deadClients) > 0 {
				h.mu.Lock()
				for _, client := range deadClients {
					if _, ok := h.clients[client]; ok {
						delete(h.clients, client)
						close(client.send)
					}
				}
				h.mu.Unlock()
			}

		case <-h.eventTicker.C:
			h.flushEventBuffer()
		}
	}
}

// Stop gracefully stops the hub.
func (h *Hub) Stop() {
	close(h.stopChan)
}

// flushEventBuffer sends buffered events as a batch to all clients.
func (h *Hub) flushEventBuffer() {
	h.eventMu.Lock()
	if len(h.eventBuffer) == 0 {
		h.eventMu.Unlock()
		return
	}

	// Take up to maxEventsPerSec/10 events per tick (10 ticks per second)
	maxPerTick := h.maxEventsPerSec / 10
	if maxPerTick < 1 {
		maxPerTick = 1
	}

	eventsToSend := h.eventBuffer
	if len(eventsToSend) > maxPerTick {
		eventsToSend = h.eventBuffer[:maxPerTick]
		h.eventBuffer = h.eventBuffer[maxPerTick:]
	} else {
		h.eventBuffer = h.eventBuffer[:0]
	}
	h.eventMu.Unlock()

	// Send events as a batch message
	if len(eventsToSend) > 0 {
		h.Broadcast(Message{
			Type: "events_batch",
			Data: eventsToSend,
		})
	}
}

// HandleClientMessage processes incoming messages from clients
func (h *Hub) HandleClientMessage(data []byte) {
	var msg struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}

	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("[Hub] Error parsing client message: %v", err)
		return
	}

	switch msg.Type {
	case "subscribe_events":
		// Handle event subscription requests
		log.Printf("[Hub] Event subscription request")
	case "ping":
		// Handle ping
	default:
		log.Printf("[Hub] Unknown message type: %s", msg.Type)
	}
}

// sendInitialState sends the initial application state to a new client.
func (h *Hub) sendInitialState(client *Client) {
	msg := Message{
		Type: "init",
		Data: InitData{
			NIPs: GetNIPList(),
		},
	}

	data, _ := json.Marshal(msg)
	select {
	case client.send <- data:
	default:
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[Hub] Error marshaling message: %v", err)
		return
	}

	select {
	case h.broadcast <- data:
	default:
		log.Printf("[Hub] Broadcast channel full, dropping message")
	}
}

// BroadcastEvent buffers an event for rate-limited broadcast to all clients.
// Duplicate events (by ID) are ignored to prevent sending the same event multiple times.
func (h *Hub) BroadcastEvent(event types.Event) {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()

	// Deduplicate by event ID
	if h.seenEventIDs[event.ID] {
		return
	}
	h.seenEventIDs[event.ID] = true

	// Limit seen events map size to prevent memory issues
	const maxSeenEvents = 1000
	if len(h.seenEventIDs) > maxSeenEvents {
		// Clear older entries by resetting the map
		// This is a simple approach; events in the current buffer are re-added
		h.seenEventIDs = make(map[string]bool)
		for _, ev := range h.eventBuffer {
			h.seenEventIDs[ev.ID] = true
		}
		h.seenEventIDs[event.ID] = true
	}

	// Limit buffer size to prevent memory issues
	const maxBufferSize = 100
	if len(h.eventBuffer) >= maxBufferSize {
		// Drop oldest event to make room
		h.eventBuffer = h.eventBuffer[1:]
	}
	h.eventBuffer = append(h.eventBuffer, event)
}

// BroadcastRelayStatus sends relay status update to all clients.
func (h *Hub) BroadcastRelayStatus(status types.RelayStatus) {
	h.Broadcast(Message{
		Type: "relay_status",
		Data: status,
	})
}

// BroadcastRelayInfo sends NIP-11 relay info update to all clients.
func (h *Hub) BroadcastRelayInfo(url string, info *types.RelayInfo) {
	h.Broadcast(Message{
		Type: "relay_info",
		Data: map[string]interface{}{
			"url":  url,
			"info": info,
		},
	})
}

// BroadcastTestResult sends a test result to all clients.
func (h *Hub) BroadcastTestResult(result types.TestResult) {
	h.Broadcast(Message{
		Type: "test_result",
		Data: result,
	})
}

// BroadcastMonitoringUpdate sends monitoring data to all clients.
func (h *Hub) BroadcastMonitoringUpdate(data types.MonitoringData) {
	h.Broadcast(Message{
		Type: "monitoring_update",
		Data: data,
	})
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Message represents a WebSocket message.
type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// InitData is the initial data sent to new clients.
type InitData struct {
	NIPs []types.NIPInfo `json:"nips"`
}

// GetNIPList returns the list of supported NIPs
func GetNIPList() []types.NIPInfo {
	return []types.NIPInfo{
		{
			ID:          "nip01",
			Name:        "NIP-01",
			Title:       "Basic Protocol",
			Description: "Core protocol: events, signatures, subscriptions",
			Category:    "core",
			RelatedNIPs: []string{"nip02", "nip05", "nip19"},
			EventKinds:  []int{0, 1},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "User Metadata (Kind 0)",
					JSON: `{
  "id": "...",
  "pubkey": "...",
  "created_at": 1704067200,
  "kind": 0,
  "tags": [],
  "content": "{\"name\":\"alice\",\"about\":\"Bitcoin enthusiast\",\"picture\":\"https://example.com/alice.jpg\"}",
  "sig": "..."
}`,
				},
				{
					Description: "Text Note (Kind 1)",
					JSON: `{
  "id": "...",
  "pubkey": "...",
  "created_at": 1704067200,
  "kind": 1,
  "tags": [
    ["e", "5c83da..."],
    ["p", "f7234bd..."]
  ],
  "content": "Hello, Nostr!",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/01.md",
			HasTest: true,
		},
		{
			ID:          "nip02",
			Name:        "NIP-02",
			Title:       "Follow List",
			Description: "Contact list and petname scheme",
			Category:    "core",
			RelatedNIPs: []string{"nip01", "nip05"},
			EventKinds:  []int{3},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "Follow List (Kind 3)",
					JSON: `{
  "id": "...",
  "pubkey": "...",
  "created_at": 1704067200,
  "kind": 3,
  "tags": [
    ["p", "91cf9a...", "wss://relay1.example.com", "alice"],
    ["p", "14aeb...", "wss://relay2.example.com", "bob"],
    ["p", "612ae...", "", "carol"]
  ],
  "content": "",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/02.md",
			HasTest: true,
		},
		{
			ID:          "nip10",
			Name:        "NIP-10",
			Title:       "Reply Threads",
			Description: "Marked e and p tags for threading text notes into conversations",
			Category:    "core",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{1},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "Reply with marked tags (preferred)",
					JSON: `{
  "id": "...",
  "pubkey": "...",
  "created_at": 1704067200,
  "kind": 1,
  "tags": [
    ["e", "root-event-id...", "wss://relay.example.com", "root"],
    ["e", "parent-event-id...", "wss://relay.example.com", "reply"],
    ["p", "root-author-pubkey..."],
    ["p", "parent-author-pubkey..."]
  ],
  "content": "This is a reply to a thread!",
  "sig": "..."
}`,
				},
				{
					Description: "Top-level reply to root",
					JSON: `{
  "id": "...",
  "pubkey": "...",
  "created_at": 1704067200,
  "kind": 1,
  "tags": [
    ["e", "root-event-id...", "wss://relay.example.com", "root"],
    ["p", "root-author-pubkey..."]
  ],
  "content": "This is a direct reply to the root!",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/10.md",
			HasTest: false,
		},
		{
			ID:          "nip05",
			Name:        "NIP-05",
			Title:       "DNS Identity",
			Description: "Mapping Nostr keys to DNS-based identifiers",
			Category:    "identity",
			RelatedNIPs: []string{"nip01", "nip02"},
			EventKinds:  []int{0},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "Metadata with NIP-05 identifier",
					JSON: `{
  "id": "...",
  "pubkey": "b0635d...",
  "created_at": 1704067200,
  "kind": 0,
  "tags": [],
  "content": "{\"name\":\"bob\",\"nip05\":\"bob@example.com\"}",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/05.md",
			HasTest: true,
		},
		{
			ID:          "nip19",
			Name:        "NIP-19",
			Title:       "Bech32 Encoding",
			Description: "bech32-encoded entities (npub, nsec, note, etc.)",
			Category:    "encoding",
			RelatedNIPs: []string{"nip01"},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "npub (public key)",
					JSON:        `npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcpk7`,
				},
				{
					Description: "note (event id)",
					JSON:        `note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdxmwd6`,
				},
				{
					Description: "nprofile (with relay hints)",
					JSON:        `nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p`,
				},
				{
					Description: "nevent (event with hints)",
					JSON:        `nevent1qqsqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzfhxc4`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/19.md",
			HasTest: true,
		},
		{
			ID:          "nip44",
			Name:        "NIP-44",
			Title:       "Encrypted Payloads",
			Description: "Versioned encryption for DMs and other content",
			Category:    "encryption",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{1059},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "Gift Wrap (Kind 1059)",
					JSON: `{
  "id": "...",
  "pubkey": "ephemeral_pubkey...",
  "created_at": 1704067200,
  "kind": 1059,
  "tags": [
    ["p", "recipient_pubkey..."]
  ],
  "content": "encrypted_seal_using_nip44...",
  "sig": "..."
}`,
				},
				{
					Description: "Seal (Kind 13)",
					JSON: `{
  "id": "...",
  "pubkey": "sender_real_pubkey...",
  "created_at": 1704067200,
  "kind": 13,
  "tags": [],
  "content": "encrypted_rumor_using_nip44...",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/44.md",
			HasTest: true,
		},
		{
			ID:          "nip57",
			Name:        "NIP-57",
			Title:       "Lightning Zaps",
			Description: "Zap receipts for Lightning payments",
			Category:    "payments",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{9734, 9735},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "Zap Request (Kind 9734)",
					JSON: `{
  "id": "...",
  "pubkey": "sender_pubkey...",
  "created_at": 1704067200,
  "kind": 9734,
  "tags": [
    ["p", "recipient_pubkey..."],
    ["amount", "21000"],
    ["relays", "wss://relay1.example.com", "wss://relay2.example.com"],
    ["e", "event_to_zap_id..."]
  ],
  "content": "Great post! ⚡",
  "sig": "..."
}`,
				},
				{
					Description: "Zap Receipt (Kind 9735)",
					JSON: `{
  "id": "...",
  "pubkey": "lnurl_provider_pubkey...",
  "created_at": 1704067200,
  "kind": 9735,
  "tags": [
    ["p", "recipient_pubkey..."],
    ["P", "sender_pubkey..."],
    ["e", "event_zapped_id..."],
    ["bolt11", "lnbc210n1..."],
    ["description", "{\"kind\":9734,...}"]
  ],
  "content": "",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/57.md",
			HasTest: true,
		},
		{
			ID:          "nip90",
			Name:        "NIP-90",
			Title:       "Data Vending Machines",
			Description: "Marketplace for data processing over Nostr",
			Category:    "dvms",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{5000, 5001, 6000, 6001, 7000},
			ExampleEvents: []types.ExampleEvent{
				{
					Description: "Job Request - Text Extraction (Kind 5000)",
					JSON: `{
  "id": "...",
  "pubkey": "customer_pubkey...",
  "created_at": 1704067200,
  "kind": 5000,
  "tags": [
    ["i", "https://example.com/document.pdf", "url"],
    ["output", "text/plain"]
  ],
  "content": "",
  "sig": "..."
}`,
				},
				{
					Description: "Job Result (Kind 6000)",
					JSON: `{
  "id": "...",
  "pubkey": "service_provider_pubkey...",
  "created_at": 1704067200,
  "kind": 6000,
  "tags": [
    ["e", "job_request_id...", "", "job"],
    ["p", "customer_pubkey..."],
    ["amount", "1000", "lnbc10n1..."]
  ],
  "content": "Extracted text content here...",
  "sig": "..."
}`,
				},
				{
					Description: "Job Feedback (Kind 7000)",
					JSON: `{
  "id": "...",
  "pubkey": "service_provider_pubkey...",
  "created_at": 1704067200,
  "kind": 7000,
  "tags": [
    ["e", "job_request_id...", "", "job"],
    ["p", "customer_pubkey..."],
    ["status", "processing", "25%"]
  ],
  "content": "Processing document...",
  "sig": "..."
}`,
				},
			},
			SpecURL: "https://github.com/nostr-protocol/nips/blob/master/90.md",
			HasTest: true,
		},
	}
}
