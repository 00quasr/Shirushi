package viz

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/keanuklestil/shirushi/internal/dvm"
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
		return true // Allow all origins for demo
	},
}

// Server serves the visualization dashboard and WebSocket connections.
type Server struct {
	hub      *Hub
	addr     string
	staticFS fs.FS
}

// NewServer creates a new visualization server.
func NewServer(addr string, staticFS fs.FS) *Server {
	return &Server{
		hub:      NewHub(),
		addr:     addr,
		staticFS: staticFS,
	}
}

// Start begins serving the dashboard.
func (s *Server) Start() error {
	go s.hub.Run()

	mux := http.NewServeMux()

	// Serve static files
	if s.staticFS != nil {
		mux.Handle("/", http.FileServer(http.FS(s.staticFS)))
	} else {
		mux.HandleFunc("/", s.handleIndex)
	}

	// WebSocket endpoint
	mux.HandleFunc("/ws", s.handleWebSocket)

	// API endpoints
	mux.HandleFunc("/api/status", s.handleStatus)

	log.Printf("[Viz] Starting dashboard server at http://%s", s.addr)
	return http.ListenAndServe(s.addr, mux)
}

// GetBroadcaster returns a function that broadcasts events to all clients.
func (s *Server) GetBroadcaster() func(dvm.VizEvent) {
	return s.hub.BroadcastEvent
}

// handleWebSocket handles WebSocket connections.
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Viz] WebSocket upgrade error: %v", err)
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

// handleStatus returns the current server status.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","clients":` + string(rune(s.hub.ClientCount()+'0')) + `}`))
}

// readPump pumps messages from the WebSocket connection.
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
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Viz] WebSocket error: %v", err)
			}
			break
		}
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

			// Add queued messages to the current websocket message
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

// EmbeddedFS is a placeholder for embedded static files.
// In production, this would use go:embed to include web/static files.
var EmbeddedFS embed.FS

const defaultHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Shirushi - Agent Swarm Visualization</title>
    <meta charset="UTF-8">
    <script>window.location.href = '/index.html';</script>
</head>
<body>
    <p>Redirecting to dashboard...</p>
</body>
</html>`
