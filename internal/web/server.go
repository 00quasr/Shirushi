// Package web provides HTTP/WebSocket server for the Shirushi dashboard.
package web

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/keanuklestil/shirushi/internal/types"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Server serves the dashboard and WebSocket connections.
type Server struct {
	hub      *Hub
	api      *API
	addr     string
	staticFS fs.FS
}

// NewServer creates a new web server.
func NewServer(addr string, staticFS fs.FS, api *API) *Server {
	hub := NewHub()
	api.SetHub(hub)

	// Wire up relay status changes to broadcast via WebSocket
	if api.relayPool != nil {
		api.relayPool.SetStatusCallback(func(url string, connected bool, errMsg string) {
			hub.BroadcastRelayStatus(types.RelayStatus{
				URL:       url,
				Connected: connected,
				Error:     errMsg,
			})
		})

		// Wire up NIP-11 relay info updates to broadcast via WebSocket
		api.relayPool.SetOnRelayInfo(func(url string, info *types.RelayInfo) {
			hub.BroadcastRelayInfo(url, info)
		})
	}

	return &Server{
		hub:      hub,
		api:      api,
		addr:     addr,
		staticFS: staticFS,
	}
}

// Start begins serving the dashboard.
func (s *Server) Start() error {
	go s.hub.Run()

	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/status", s.api.HandleStatus)
	mux.HandleFunc("/api/relays", s.api.HandleRelays)
	mux.HandleFunc("/api/relays/stats", s.api.HandleRelayStats)
	mux.HandleFunc("/api/relays/presets", s.api.HandleRelayPresets)
	mux.HandleFunc("/api/relays/info", s.api.HandleRelayInfo)
	mux.HandleFunc("/api/monitoring/history", s.api.HandleMonitoringHistory)
	mux.HandleFunc("/api/monitoring/health", s.api.HandleMonitoringHealth)
	mux.HandleFunc("/api/events", s.api.HandleEvents)
	mux.HandleFunc("/api/events/thread/", s.api.HandleThread)
	mux.HandleFunc("/api/events/subscribe", s.api.HandleEventSubscribe)
	mux.HandleFunc("/api/nips", s.api.HandleNIPs)
	mux.HandleFunc("/api/test/history/", s.api.HandleTestHistoryEntry)
	mux.HandleFunc("/api/test/history", s.api.HandleTestHistory)
	mux.HandleFunc("/api/test/", s.api.HandleTest)
	mux.HandleFunc("/api/keys/generate", s.api.HandleKeyGenerate)
	mux.HandleFunc("/api/keys/decode", s.api.HandleKeyDecode)
	mux.HandleFunc("/api/keys/encode", s.api.HandleKeyEncode)
	mux.HandleFunc("/api/nak", s.api.HandleNak)
	mux.HandleFunc("/api/profile/lookup", s.api.HandleProfileLookup)
	mux.HandleFunc("/api/profile/", s.api.HandleProfile)
	mux.HandleFunc("/api/events/sign", s.api.HandleEventSign)
	mux.HandleFunc("/api/events/verify", s.api.HandleEventVerify)
	mux.HandleFunc("/api/events/publish", s.api.HandleEventPublish)
	mux.HandleFunc("/api/events/lookup", s.api.HandleEventLookup)

	// WebSocket
	mux.HandleFunc("/ws", s.handleWebSocket)

	// Static files
	if s.staticFS != nil {
		mux.Handle("/", http.FileServer(http.FS(s.staticFS)))
	} else {
		mux.HandleFunc("/", s.handleIndex)
	}

	log.Printf("[Web] Starting server at http://%s", s.addr)
	return http.ListenAndServe(s.addr, mux)
}

// Hub returns the WebSocket hub for broadcasting
func (s *Server) Hub() *Hub {
	return s.hub
}

// handleWebSocket handles WebSocket connections.
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Web] WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  s.hub,
		conn: conn,
		send: make(chan []byte, 256),
	}

	s.hub.register <- client

	go client.writePump()
	go client.readPump()
}

// handleIndex serves the main dashboard HTML.
func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(defaultHTML))
}

// readPump pumps messages from the WebSocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Web] WebSocket error: %v", err)
			}
			break
		}

		c.hub.HandleClientMessage(message)
	}
}

// writePump pumps messages to the WebSocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// writeJSON writes a JSON response
func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// writeError writes an error response
func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

var EmbeddedFS embed.FS

const defaultHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Shirushi</title>
    <meta charset="UTF-8">
    <script>window.location.href = '/index.html';</script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>`
