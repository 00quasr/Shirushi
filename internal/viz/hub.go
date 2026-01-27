// Package viz provides WebSocket-based real-time visualization for the agent swarm.
package viz

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/keanuklestil/shirushi/internal/dvm"
)

// TaskHandler is called when a task is submitted via WebSocket
type TaskHandler func(input string)

// Client represents a connected WebSocket client.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	clients     map[*Client]bool
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	mu          sync.RWMutex
	taskHandler TaskHandler
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

// SetTaskHandler sets the callback for task submissions
func (h *Hub) SetTaskHandler(handler TaskHandler) {
	h.taskHandler = handler
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
		Type string `json:"type"`
		Data struct {
			Input string `json:"input"`
		} `json:"data"`
	}

	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("[Hub] Error parsing client message: %v", err)
		return
	}

	if msg.Type == "submit_task" && h.taskHandler != nil {
		log.Printf("[Hub] Received task: %s", truncateStr(msg.Data.Input, 50))
		h.taskHandler(msg.Data.Input)
	}
}

// sendInitialState sends the initial agent configuration to a new client.
func (h *Hub) sendInitialState(client *Client) {
	agents := []AgentInfo{
		{ID: "coordinator", Name: "Shihaisha", Role: "Coordinator", Kind: dvm.KindJobRequestCoordinator},
		{ID: "researcher", Name: "Kenkyusha", Role: "Researcher", Kind: dvm.KindJobRequestResearcher},
		{ID: "writer", Name: "Sakka", Role: "Writer", Kind: dvm.KindJobRequestWriter},
		{ID: "critic", Name: "Hihyoka", Role: "Critic", Kind: dvm.KindJobRequestCritic},
	}

	msg := Message{
		Type: "init",
		Data: InitData{
			Agents: agents,
			Links: []LinkInfo{
				{Source: "coordinator", Target: "researcher"},
				{Source: "coordinator", Target: "writer"},
				{Source: "coordinator", Target: "critic"},
				{Source: "researcher", Target: "writer"},
				{Source: "writer", Target: "critic"},
				{Source: "critic", Target: "coordinator"},
			},
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

// BroadcastEvent sends a visualization event to all clients.
func (h *Hub) BroadcastEvent(event dvm.VizEvent) {
	h.Broadcast(Message{
		Type: "event",
		Data: event,
	})
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// Message represents a WebSocket message.
type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// AgentInfo describes an agent for visualization.
type AgentInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
	Kind int    `json:"kind"`
}

// LinkInfo describes a connection between agents.
type LinkInfo struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// InitData is the initial data sent to new clients.
type InitData struct {
	Agents []AgentInfo `json:"agents"`
	Links  []LinkInfo  `json:"links"`
}
