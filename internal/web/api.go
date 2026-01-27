// Package web provides REST API handlers for Shirushi.
package web

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

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
	MonitoringData() *types.MonitoringData
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

// HandleMonitoringHistory returns historical monitoring data for all relays.
func (a *API) HandleMonitoringHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	data := a.relayPool.MonitoringData()
	writeJSON(w, data)
}

// HandleMonitoringHealth returns current health summary for all relays.
// Unlike /history, this excludes time-series data for a lighter response.
func (a *API) HandleMonitoringHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	data := a.relayPool.MonitoringData()
	if data == nil {
		writeJSON(w, nil)
		return
	}

	// Build a lightweight health summary without history data
	relayHealthSummaries := make([]types.RelayHealthSummary, len(data.Relays))
	for i, relay := range data.Relays {
		relayHealthSummaries[i] = types.RelayHealthSummary{
			URL:          relay.URL,
			Connected:    relay.Connected,
			Latency:      relay.Latency,
			EventsPerSec: relay.EventsPerSec,
			Uptime:       relay.Uptime,
			HealthScore:  relay.HealthScore,
			LastSeen:     relay.LastSeen,
			ErrorCount:   relay.ErrorCount,
			LastError:    relay.LastError,
		}
	}

	summary := types.HealthSummary{
		Relays:         relayHealthSummaries,
		TotalEvents:    data.TotalEvents,
		EventsPerSec:   data.EventsPerSec,
		ConnectedCount: data.ConnectedCount,
		TotalCount:     data.TotalCount,
		Timestamp:      data.Timestamp,
	}

	writeJSON(w, summary)
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

// HandleProfile looks up a Nostr profile by pubkey from URL path.
// Path: /api/profile/{pubkey}
func (a *API) HandleProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Extract pubkey from URL path: /api/profile/{pubkey}
	path := strings.TrimPrefix(r.URL.Path, "/api/profile/")
	pubkey := strings.TrimSpace(path)

	if pubkey == "" {
		writeError(w, http.StatusBadRequest, "pubkey is required in path")
		return
	}

	// Delegate to the common profile lookup logic
	a.lookupProfile(w, pubkey)
}

// HandleProfileLookup looks up a Nostr profile by pubkey or NIP-19 identifier.
func (a *API) HandleProfileLookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Get pubkey from query parameter
	pubkey := r.URL.Query().Get("pubkey")
	if pubkey == "" {
		writeError(w, http.StatusBadRequest, "pubkey query parameter is required")
		return
	}

	// Delegate to the common profile lookup logic
	a.lookupProfile(w, pubkey)
}

// lookupProfile is the shared logic for looking up a profile by pubkey.
func (a *API) lookupProfile(w http.ResponseWriter, pubkey string) {
	// If input starts with "npub" or "nprofile", decode it first
	if strings.HasPrefix(pubkey, "npub") || strings.HasPrefix(pubkey, "nprofile") {
		if a.nak == nil {
			writeError(w, http.StatusServiceUnavailable, "nak CLI not available for NIP-19 decoding")
			return
		}
		decoded, err := a.nak.Decode(pubkey)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid NIP-19 identifier: "+err.Error())
			return
		}
		// Extract hex pubkey from decoded result
		if decoded.Pubkey != "" {
			pubkey = decoded.Pubkey
		} else if decoded.Hex != "" {
			pubkey = decoded.Hex
		} else {
			writeError(w, http.StatusBadRequest, "could not extract pubkey from NIP-19 identifier")
			return
		}
	}

	// Validate pubkey format (should be 64 hex characters)
	if len(pubkey) != 64 {
		writeError(w, http.StatusBadRequest, "pubkey must be a 64-character hex string")
		return
	}
	for _, c := range pubkey {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			writeError(w, http.StatusBadRequest, "pubkey must be a valid hex string")
			return
		}
	}

	// Query kind 0 (profile metadata) events for this pubkey
	events, err := a.relayPool.QueryEvents("0", pubkey, "1")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query profile: "+err.Error())
		return
	}

	if len(events) == 0 {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}

	// Parse profile metadata from event content
	event := events[0]
	profile := types.Profile{
		PubKey:    pubkey,
		CreatedAt: event.CreatedAt,
	}

	// Parse JSON content
	var metadata map[string]interface{}
	if err := json.Unmarshal([]byte(event.Content), &metadata); err == nil {
		if name, ok := metadata["name"].(string); ok {
			profile.Name = name
		}
		if displayName, ok := metadata["display_name"].(string); ok {
			profile.DisplayName = displayName
		}
		if about, ok := metadata["about"].(string); ok {
			profile.About = about
		}
		if picture, ok := metadata["picture"].(string); ok {
			profile.Picture = picture
		}
		if banner, ok := metadata["banner"].(string); ok {
			profile.Banner = banner
		}
		if website, ok := metadata["website"].(string); ok {
			profile.Website = website
		}
		if nip05, ok := metadata["nip05"].(string); ok {
			profile.NIP05 = nip05
		}
		if lud16, ok := metadata["lud16"].(string); ok {
			profile.LUD16 = lud16
		}
	}

	// Verify NIP-05 if present
	if profile.NIP05 != "" {
		profile.NIP05Valid = verifyNIP05(profile.NIP05, pubkey)
	}

	writeJSON(w, profile)
}

// verifyNIP05 verifies a NIP-05 identifier against an expected pubkey.
// It fetches the .well-known/nostr.json file and checks if the name maps to the expected pubkey.
func verifyNIP05(address, expectedPubkey string) bool {
	// Parse address (user@domain)
	parts := strings.Split(address, "@")
	if len(parts) != 2 {
		return false
	}
	name := parts[0]
	domain := parts[1]

	// Build URL
	url := fmt.Sprintf("https://%s/.well-known/nostr.json?name=%s", domain, name)

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	// Fetch nostr.json
	req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		return false
	}

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	// Read and parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false
	}

	var nip05Data struct {
		Names map[string]string `json:"names"`
	}
	if err := json.Unmarshal(body, &nip05Data); err != nil {
		return false
	}

	// Check if the name maps to the expected pubkey
	pubkey, exists := nip05Data.Names[name]
	if !exists {
		return false
	}

	// Compare pubkeys (case-insensitive hex comparison)
	return strings.EqualFold(pubkey, expectedPubkey)
}

// HandleEventSign signs an event with a provided private key.
func (a *API) HandleEventSign(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	var req struct {
		Kind       int        `json:"kind"`
		Content    string     `json:"content"`
		Tags       [][]string `json:"tags"`
		PrivateKey string     `json:"privateKey"` // nsec format
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.PrivateKey == "" {
		writeError(w, http.StatusBadRequest, "privateKey is required")
		return
	}

	event, err := a.nak.CreateEvent(nak.CreateEventOptions{
		Kind:       req.Kind,
		Content:    req.Content,
		Tags:       req.Tags,
		PrivateKey: req.PrivateKey,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create event: "+err.Error())
		return
	}

	writeJSON(w, event)
}

// HandleEventVerify verifies a signed event's signature.
func (a *API) HandleEventVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	valid, err := a.nak.Verify(string(body))
	if err != nil {
		writeJSON(w, map[string]interface{}{"valid": false, "error": err.Error()})
		return
	}

	writeJSON(w, map[string]interface{}{"valid": valid})
}

// HandleEventPublish publishes a signed event to connected relays.
func (a *API) HandleEventPublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if a.nak == nil {
		writeError(w, http.StatusServiceUnavailable, "nak CLI not available")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	eventJSON := string(body)

	// Get connected relays
	relays := a.relayPool.List()
	var connectedRelays []string
	for _, relay := range relays {
		if relay.Connected {
			connectedRelays = append(connectedRelays, relay.URL)
		}
	}

	if len(connectedRelays) == 0 {
		writeError(w, http.StatusBadRequest, "no connected relays")
		return
	}

	// Publish to first connected relay
	err = a.nak.Publish(eventJSON, connectedRelays[0])
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to publish: "+err.Error())
		return
	}

	writeJSON(w, map[string]interface{}{
		"success": true,
		"relay":   connectedRelays[0],
	})
}
