// Package web provides WebSocket hub for real-time updates.
package web

import (
	"encoding/json"
	"log"
	"sync"

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
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop.
func (h *Hub) Run() {
	for {
		select {
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
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
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

// BroadcastEvent sends an event to all clients.
func (h *Hub) BroadcastEvent(event types.Event) {
	h.Broadcast(Message{
		Type: "event",
		Data: event,
	})
}

// BroadcastRelayStatus sends relay status update to all clients.
func (h *Hub) BroadcastRelayStatus(status types.RelayStatus) {
	h.Broadcast(Message{
		Type: "relay_status",
		Data: status,
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
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/01.md",
			HasTest:     true,
		},
		{
			ID:          "nip02",
			Name:        "NIP-02",
			Title:       "Follow List",
			Description: "Contact list and petname scheme",
			Category:    "core",
			RelatedNIPs: []string{"nip01", "nip05"},
			EventKinds:  []int{3},
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/02.md",
			HasTest:     true,
		},
		{
			ID:          "nip05",
			Name:        "NIP-05",
			Title:       "DNS Identity",
			Description: "Mapping Nostr keys to DNS-based identifiers",
			Category:    "identity",
			RelatedNIPs: []string{"nip01", "nip02"},
			EventKinds:  []int{0},
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/05.md",
			HasTest:     true,
		},
		{
			ID:          "nip19",
			Name:        "NIP-19",
			Title:       "Bech32 Encoding",
			Description: "bech32-encoded entities (npub, nsec, note, etc.)",
			Category:    "encoding",
			RelatedNIPs: []string{"nip01"},
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/19.md",
			HasTest:     true,
		},
		{
			ID:          "nip44",
			Name:        "NIP-44",
			Title:       "Encrypted Payloads",
			Description: "Versioned encryption for DMs and other content",
			Category:    "encryption",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{1059},
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/44.md",
			HasTest:     true,
		},
		{
			ID:          "nip57",
			Name:        "NIP-57",
			Title:       "Lightning Zaps",
			Description: "Zap receipts for Lightning payments",
			Category:    "payments",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{9734, 9735},
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/57.md",
			HasTest:     true,
		},
		{
			ID:          "nip90",
			Name:        "NIP-90",
			Title:       "Data Vending Machines",
			Description: "Marketplace for data processing over Nostr",
			Category:    "dvms",
			RelatedNIPs: []string{"nip01"},
			EventKinds:  []int{5000, 5001, 6000, 6001, 7000},
			SpecURL:     "https://github.com/nostr-protocol/nips/blob/master/90.md",
			HasTest:     true,
		},
	}
}
