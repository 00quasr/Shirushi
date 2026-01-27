// Package web provides REST API handlers for Shirushi.
package web

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/keanuklestil/shirushi/internal/config"
	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/types"
)

// RelayPool defines the interface for relay pool operations
type RelayPool interface {
	Add(url string) error
	Remove(url string)
	List() []types.RelayStatus
	Stats() map[string]types.RelayStats
	Count() int
	QueryEvents(kindStr, author, limitStr string) ([]types.Event, error)
	Subscribe(kinds []int, authors []string, callback func(types.Event)) string
}

// TestRunner defines the interface for running NIP tests
type TestRunner interface {
	RunTest(ctx context.Context, nipID string, params map[string]interface{}) (*types.TestResult, error)
}

// API handles REST API requests.
type API struct {
	cfg        *config.Config
	nak        *nak.Nak
	relayPool  RelayPool
	testRunner TestRunner
	hub        *Hub
}

// NewAPI creates a new API handler.
func NewAPI(cfg *config.Config, nakClient *nak.Nak, relayPool RelayPool, testRunner TestRunner) *API {
	return &API{
		cfg:        cfg,
		nak:        nakClient,
		relayPool:  relayPool,
		testRunner: testRunner,
	}
}

// SetHub sets the WebSocket hub for broadcasting
func (a *API) SetHub(hub *Hub) {
	a.hub = hub
}

// HandleStatus returns server status.
func (a *API) HandleStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":    "ok",
		"nak_found": a.cfg.HasNak(),
	}
	if a.cfg.HasNak() {
		status["nak_path"] = a.cfg.NakPath
	}
	if a.relayPool != nil {
		status["relay_count"] = a.relayPool.Count()
	}
	writeJSON(w, status)
}

// HandleRelays handles relay list and management.
func (a *API) HandleRelays(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		relays := a.relayPool.List()
		writeJSON(w, relays)

	case http.MethodPost:
		var req struct {
			URL string `json:"url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.URL == "" {
			writeError(w, http.StatusBadRequest, "url is required")
			return
		}
		if err := a.relayPool.Add(req.URL); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, map[string]string{"status": "added", "url": req.URL})

	case http.MethodDelete:
		url := r.URL.Query().Get("url")
		if url == "" {
			writeError(w, http.StatusBadRequest, "url query parameter required")
			return
		}
		a.relayPool.Remove(url)
		writeJSON(w, map[string]string{"status": "removed", "url": url})

	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// HandleRelayStats returns relay statistics.
func (a *API) HandleRelayStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	stats := a.relayPool.Stats()
	writeJSON(w, stats)
}

// HandleRelayPresets returns available relay presets.
func (a *API) HandleRelayPresets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, config.RelayPresets)
}

// HandleEvents handles event queries.
func (a *API) HandleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Parse query parameters
	kindStr := r.URL.Query().Get("kind")
	author := r.URL.Query().Get("author")
	limit := r.URL.Query().Get("limit")

	events, err := a.relayPool.QueryEvents(kindStr, author, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, events)
}

// HandleEventSubscribe handles event subscription management.
func (a *API) HandleEventSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		Kinds   []int    `json:"kinds"`
		Authors []string `json:"authors"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Start subscription
	subID := a.relayPool.Subscribe(req.Kinds, req.Authors, func(event types.Event) {
		if a.hub != nil {
			a.hub.BroadcastEvent(event)
		}
	})

	writeJSON(w, map[string]string{"subscription_id": subID})
}

// HandleNIPs returns the list of supported NIPs.
func (a *API) HandleNIPs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, GetNIPList())
}

// HandleTest handles NIP test execution.
func (a *API) HandleTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Extract NIP ID from path: /api/test/nip01
	path := strings.TrimPrefix(r.URL.Path, "/api/test/")
	nipID := strings.TrimPrefix(path, "nip")
	if nipID == "" {
		writeError(w, http.StatusBadRequest, "NIP ID required")
		return
	}

	// Parse test parameters from body
	var params map[string]interface{}
	json.NewDecoder(r.Body).Decode(&params)

	// Run test
	result, err := a.testRunner.RunTest(r.Context(), "nip"+nipID, params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Broadcast result
	if a.hub != nil {
		a.hub.BroadcastTestResult(*result)
	}

	writeJSON(w, result)
}

// HandleKeyGenerate generates a new keypair.
func (a *API) HandleKeyGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	keypair, err := a.nak.GenerateKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, keypair)
}

// HandleKeyDecode decodes a NIP-19 entity.
func (a *API) HandleKeyDecode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	var req struct {
		Input string `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	decoded, err := a.nak.Decode(req.Input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, decoded)
}

// HandleKeyEncode encodes data to NIP-19 format.
func (a *API) HandleKeyEncode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	var req struct {
		Type string `json:"type"` // npub, nsec, note, etc.
		Hex  string `json:"hex"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	encoded, err := a.nak.Encode(req.Type, req.Hex)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, map[string]string{"encoded": encoded})
}

// HandleNak executes a raw nak command.
func (a *API) HandleNak(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	var req struct {
		Args []string `json:"args"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	output, err := a.nak.Run(req.Args...)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, map[string]string{"output": output})
}
