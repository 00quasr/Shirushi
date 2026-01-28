// Package web provides REST API handlers for Shirushi.
package web

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
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
	GetConnected() []string
	QueryEvents(kindStr, author, limitStr string) ([]types.Event, error)
	QueryEventsWithTiming(kindStr, author, limitStr string) (*types.EventsQueryResponse, error)
	QueryEventsAdvanced(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64, selectedRelays ...string) ([]types.Event, error)
	QueryEventsAdvancedWithTiming(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64, selectedRelays ...string) (*types.EventsQueryResponse, error)
	QueryEventsByIDs(ids []string) ([]types.Event, error)
	QueryBatchEventsByIDs(ids []string) *types.BatchQueryResponse
	QueryEventReplies(eventID string) ([]types.Event, error)
	QueryEventFromAllRelays(eventID string) *types.EventFetchAllRelaysResponse
	AggregateEvents(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64, selectedRelays ...string) (*types.EventAggregation, error)
	Subscribe(kinds []int, authors []string, callback func(types.Event)) string
	MonitoringData() *types.MonitoringData
	GetRelayInfo(url string) *types.RelayInfo
	RefreshRelayInfo(url string) error
	SetStatusCallback(callback func(url string, connected bool, err string))
	SetOnRelayInfo(callback func(url string, info *types.RelayInfo))
	PublishEventJSON(eventJSON []byte, relayURLs []string) (string, []types.PublishResult)
}

// TestRunner defines the interface for running NIP tests
type TestRunner interface {
	RunTest(ctx context.Context, nipID string, params map[string]interface{}) (*types.TestResult, error)
}

// NakClient defines the interface for nak CLI operations
type NakClient interface {
	GenerateKey() (*nak.Keypair, error)
	Decode(input string) (*nak.Decoded, error)
	Encode(typ string, hex string) (string, error)
	CreateEvent(opts nak.CreateEventOptions) (*nak.Event, error)
	Verify(eventJSON string) (bool, error)
	Run(args ...string) (string, error)
}

// API handles REST API requests.
type API struct {
	cfg              *config.Config
	nak              NakClient
	relayPool        RelayPool
	testRunner       TestRunner
	hub              *Hub
	testHistory      []types.TestHistoryEntry
	testHistoryMutex sync.RWMutex
}

// NewAPI creates a new API handler.
// maxTestHistoryEntries is the maximum number of test history entries to keep.
const maxTestHistoryEntries = 100

func NewAPI(cfg *config.Config, nakClient NakClient, relayPool RelayPool, testRunner TestRunner) *API {
	return &API{
		cfg:         cfg,
		nak:         nakClient,
		relayPool:   relayPool,
		testRunner:  testRunner,
		testHistory: make([]types.TestHistoryEntry, 0),
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

// HandleRelayInfo returns NIP-11 info for a specific relay.
// Path: /api/relays/info?url=wss://...
func (a *API) HandleRelayInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	url := r.URL.Query().Get("url")
	if url == "" {
		writeError(w, http.StatusBadRequest, "url query parameter required")
		return
	}

	// POST refreshes the info, GET just returns cached info
	if r.Method == http.MethodPost {
		if err := a.relayPool.RefreshRelayInfo(url); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	info := a.relayPool.GetRelayInfo(url)
	if info == nil {
		writeError(w, http.StatusNotFound, "relay info not available")
		return
	}

	writeJSON(w, info)
}

// EventQueryParams holds the parsed query parameters for event queries.
type EventQueryParams struct {
	Kinds   []int
	Authors []string
	Tags    map[string][]string
	Limit   int
	Since   int64
	Until   int64
	Relays  []string
}

// HandleEvents handles event queries.
// Accepts optional query params:
// - kinds: comma-separated list of event kinds (e.g., "1,7,30023")
// - authors: comma-separated list of pubkeys (hex or npub format)
// - tags: comma-separated tag filters in format "#tagname:value" (e.g., "#e:abc123,#t:nostr")
// - limit: max number of events to return (default 20, max 500)
// - since: Unix timestamp for events created after this time
// - until: Unix timestamp for events created before this time
// - timing: if "true", returns per-relay timing data
// - relays: comma-separated list of relay URLs to query from (only connected relays are used)
func (a *API) HandleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Parse query parameters
	params, err := a.parseEventQueryParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	includeTiming := r.URL.Query().Get("timing") == "true"

	if includeTiming {
		response, err := a.relayPool.QueryEventsAdvancedWithTiming(params.Kinds, params.Authors, params.Tags, params.Limit, params.Since, params.Until, params.Relays...)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, response)
		return
	}

	events, err := a.relayPool.QueryEventsAdvanced(params.Kinds, params.Authors, params.Tags, params.Limit, params.Since, params.Until, params.Relays...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, events)
}

// parseEventQueryParams parses the query parameters for event queries.
func (a *API) parseEventQueryParams(r *http.Request) (*EventQueryParams, error) {
	params := &EventQueryParams{
		Limit: 20, // default
	}

	// Parse kinds (comma-separated)
	kindsStr := r.URL.Query().Get("kinds")
	if kindsStr == "" {
		// Fallback to legacy "kind" parameter for backwards compatibility
		kindsStr = r.URL.Query().Get("kind")
	}
	if kindsStr != "" {
		kindStrs := strings.Split(kindsStr, ",")
		for _, ks := range kindStrs {
			ks = strings.TrimSpace(ks)
			if ks != "" {
				kind, err := strconv.Atoi(ks)
				if err != nil {
					return nil, fmt.Errorf("invalid kind value: %s", ks)
				}
				params.Kinds = append(params.Kinds, kind)
			}
		}
	}

	// Parse authors (comma-separated, can be hex or npub)
	authorsStr := r.URL.Query().Get("authors")
	if authorsStr == "" {
		// Fallback to legacy "author" parameter for backwards compatibility
		authorsStr = r.URL.Query().Get("author")
	}
	if authorsStr != "" {
		authorStrs := strings.Split(authorsStr, ",")
		for _, as := range authorStrs {
			as = strings.TrimSpace(as)
			if as == "" {
				continue
			}
			// Decode npub/nprofile to hex if needed
			if strings.HasPrefix(as, "npub") || strings.HasPrefix(as, "nprofile") {
				if a.nak == nil {
					return nil, fmt.Errorf("nak CLI not available for decoding npub")
				}
				decoded, err := a.nak.Decode(as)
				if err != nil {
					return nil, fmt.Errorf("invalid author pubkey: %s", as)
				}
				if decoded.Pubkey != "" {
					as = decoded.Pubkey
				} else if decoded.Hex != "" {
					as = decoded.Hex
				}
			}
			params.Authors = append(params.Authors, as)
		}
	}

	// Parse tags (comma-separated, format: #tagname:value)
	tagsStr := r.URL.Query().Get("tags")
	if tagsStr != "" {
		params.Tags = make(map[string][]string)
		tagStrs := strings.Split(tagsStr, ",")
		for _, ts := range tagStrs {
			ts = strings.TrimSpace(ts)
			if !strings.HasPrefix(ts, "#") || !strings.Contains(ts, ":") {
				continue
			}
			// Remove the # prefix and split by :
			ts = strings.TrimPrefix(ts, "#")
			parts := strings.SplitN(ts, ":", 2)
			if len(parts) == 2 {
				tagName := strings.TrimSpace(parts[0])
				tagValue := strings.TrimSpace(parts[1])
				if tagName != "" && tagValue != "" {
					params.Tags[tagName] = append(params.Tags[tagName], tagValue)
				}
			}
		}
	}

	// Parse limit
	limitStr := r.URL.Query().Get("limit")
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return nil, fmt.Errorf("invalid limit value: %s", limitStr)
		}
		if limit < 1 {
			limit = 1
		}
		if limit > 500 {
			limit = 500
		}
		params.Limit = limit
	}

	// Parse since (Unix timestamp)
	sinceStr := r.URL.Query().Get("since")
	if sinceStr != "" {
		since, err := strconv.ParseInt(sinceStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid since value: %s", sinceStr)
		}
		params.Since = since
	}

	// Parse until (Unix timestamp)
	untilStr := r.URL.Query().Get("until")
	if untilStr != "" {
		until, err := strconv.ParseInt(untilStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid until value: %s", untilStr)
		}
		params.Until = until
	}

	// Parse relays (comma-separated relay URLs)
	relaysStr := r.URL.Query().Get("relays")
	if relaysStr != "" {
		relayURLs := strings.Split(relaysStr, ",")
		for _, url := range relayURLs {
			url = strings.TrimSpace(url)
			if url != "" {
				params.Relays = append(params.Relays, url)
			}
		}
	}

	return params, nil
}

// HandleEventsAggregate queries events and returns aggregated statistics.
// Accepts the same query params as HandleEvents:
// - kinds: comma-separated list of event kinds
// - authors: comma-separated list of pubkeys
// - tags: comma-separated tag filters in format "#tagname:value"
// - limit: max number of events to aggregate (default 100, max 500)
// - since: Unix timestamp for events created after this time
// - until: Unix timestamp for events created before this time
// - relays: comma-separated list of relay URLs to query from
func (a *API) HandleEventsAggregate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Parse query parameters (reuse the same parsing logic)
	params, err := a.parseEventQueryParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Default limit for aggregation is higher (100 instead of 20)
	if params.Limit == 20 {
		limitStr := r.URL.Query().Get("limit")
		if limitStr == "" {
			params.Limit = 100
		}
	}

	// Query and aggregate events
	aggregation, err := a.relayPool.AggregateEvents(params.Kinds, params.Authors, params.Tags, params.Limit, params.Since, params.Until, params.Relays...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, aggregation)
}

// HandleEventSubscribe handles event subscription management.
// Accepts an optional JSON body with kinds and authors filters.
// If body is empty or missing, defaults to empty filters (subscribes to all events).
func (a *API) HandleEventSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		Kinds   []int    `json:"kinds"`
		Authors []string `json:"authors"`
	}

	// Read the body to check if it's empty
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	// Only decode if body is not empty
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
	}
	// If body is empty, req stays with zero values (empty slices)

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
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil && err.Error() != "EOF" {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	// Run test
	result, err := a.testRunner.RunTest(r.Context(), "nip"+nipID, params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Store in history
	entry := a.addTestHistory(*result)

	// Broadcast result
	if a.hub != nil {
		a.hub.BroadcastTestResult(*result)
	}

	// Return result with history entry ID
	response := map[string]interface{}{
		"id":        entry.ID,
		"timestamp": entry.Timestamp,
		"result":    result,
	}
	writeJSON(w, response)
}

// addTestHistory adds a test result to the history.
func (a *API) addTestHistory(result types.TestResult) types.TestHistoryEntry {
	entry := types.TestHistoryEntry{
		ID:        fmt.Sprintf("%d-%s", time.Now().UnixNano(), result.NIPID),
		Timestamp: time.Now().Unix(),
		Result:    result,
	}

	a.testHistoryMutex.Lock()
	defer a.testHistoryMutex.Unlock()

	// Prepend to history (newest first)
	a.testHistory = append([]types.TestHistoryEntry{entry}, a.testHistory...)

	// Trim to max size
	if len(a.testHistory) > maxTestHistoryEntries {
		a.testHistory = a.testHistory[:maxTestHistoryEntries]
	}

	return entry
}

// HandleTestHistory returns the test history.
func (a *API) HandleTestHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.testHistoryMutex.RLock()
		history := make([]types.TestHistoryEntry, len(a.testHistory))
		copy(history, a.testHistory)
		a.testHistoryMutex.RUnlock()
		writeJSON(w, history)

	case http.MethodDelete:
		// Clear all history
		a.testHistoryMutex.Lock()
		a.testHistory = make([]types.TestHistoryEntry, 0)
		a.testHistoryMutex.Unlock()
		writeJSON(w, map[string]string{"status": "cleared"})

	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// HandleTestHistoryEntry handles single test history entry operations.
func (a *API) HandleTestHistoryEntry(w http.ResponseWriter, r *http.Request) {
	// Extract entry ID from path: /api/test/history/{id}
	path := strings.TrimPrefix(r.URL.Path, "/api/test/history/")
	entryID := strings.TrimSpace(path)

	if entryID == "" {
		writeError(w, http.StatusBadRequest, "entry ID required")
		return
	}

	switch r.Method {
	case http.MethodGet:
		// Find entry by ID
		a.testHistoryMutex.RLock()
		var foundEntry *types.TestHistoryEntry
		for _, entry := range a.testHistory {
			if entry.ID == entryID {
				entryCopy := entry
				foundEntry = &entryCopy
				break
			}
		}
		a.testHistoryMutex.RUnlock()

		if foundEntry != nil {
			writeJSON(w, foundEntry)
		} else {
			writeError(w, http.StatusNotFound, "entry not found")
		}

	case http.MethodDelete:
		// Remove entry by ID
		a.testHistoryMutex.Lock()
		found := false
		for i, entry := range a.testHistory {
			if entry.ID == entryID {
				a.testHistory = append(a.testHistory[:i], a.testHistory[i+1:]...)
				found = true
				break
			}
		}
		a.testHistoryMutex.Unlock()

		if found {
			writeJSON(w, map[string]string{"status": "deleted", "id": entryID})
		} else {
			writeError(w, http.StatusNotFound, "entry not found")
		}

	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
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

// HandleEventLookup looks up an event by its ID (hex or note1.../nevent1... format).
func (a *API) HandleEventLookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Get the event ID from query parameter
	eventID := r.URL.Query().Get("id")
	if eventID == "" {
		writeError(w, http.StatusBadRequest, "event ID is required")
		return
	}

	eventID = strings.TrimSpace(eventID)

	// If input is note1... or nevent1..., decode it to hex
	if strings.HasPrefix(eventID, "note1") || strings.HasPrefix(eventID, "nevent1") {
		if a.nak == nil {
			writeError(w, http.StatusServiceUnavailable, "nak CLI not available for decoding")
			return
		}
		decoded, err := a.nak.Decode(eventID)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("failed to decode event ID: %v", err))
			return
		}
		eventID = decoded.Hex
	}

	// Validate hex format (64 characters, valid hex)
	if len(eventID) != 64 {
		writeError(w, http.StatusBadRequest, "event ID must be 64 hex characters")
		return
	}
	for _, c := range eventID {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			writeError(w, http.StatusBadRequest, "event ID must contain only hexadecimal characters")
			return
		}
	}

	// Query the event by ID
	events, err := a.relayPool.QueryEventsByIDs([]string{eventID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to query event: %v", err))
		return
	}

	if len(events) == 0 {
		writeError(w, http.StatusNotFound, "event not found")
		return
	}

	writeJSON(w, events[0])
}

// HandleEventFetchAllRelays fetches an event by ID from all connected relays,
// returning individual results for each relay.
func (a *API) HandleEventFetchAllRelays(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Get the event ID from query parameter
	eventID := r.URL.Query().Get("id")
	if eventID == "" {
		writeError(w, http.StatusBadRequest, "event ID is required")
		return
	}

	eventID = strings.TrimSpace(eventID)

	// If input is note1... or nevent1..., decode it to hex
	if strings.HasPrefix(eventID, "note1") || strings.HasPrefix(eventID, "nevent1") {
		if a.nak == nil {
			writeError(w, http.StatusServiceUnavailable, "nak CLI not available for decoding")
			return
		}
		decoded, err := a.nak.Decode(eventID)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("failed to decode event ID: %v", err))
			return
		}
		eventID = decoded.Hex
	}

	// Validate hex format (64 characters, valid hex)
	if len(eventID) != 64 {
		writeError(w, http.StatusBadRequest, "event ID must be 64 hex characters")
		return
	}
	for _, c := range eventID {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			writeError(w, http.StatusBadRequest, "event ID must contain only hexadecimal characters")
			return
		}
	}

	// Query the event from all relays
	response := a.relayPool.QueryEventFromAllRelays(eventID)

	writeJSON(w, response)
}

// HandleBatchEventLookup looks up multiple events by their IDs.
// Accepts POST with JSON body: {"ids": ["id1", "id2", ...]}
// Each ID can be hex, note1..., or nevent1... format.
func (a *API) HandleBatchEventLookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "at least one event ID is required")
		return
	}

	// Limit the number of IDs to prevent abuse
	const maxBatchSize = 100
	if len(req.IDs) > maxBatchSize {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("maximum batch size is %d events", maxBatchSize))
		return
	}

	// Decode and validate all IDs
	hexIDs := make([]string, 0, len(req.IDs))
	for _, id := range req.IDs {
		id = strings.TrimSpace(id)

		// If input is note1... or nevent1..., decode it to hex
		if strings.HasPrefix(id, "note1") || strings.HasPrefix(id, "nevent1") {
			if a.nak == nil {
				writeError(w, http.StatusServiceUnavailable, "nak CLI not available for decoding")
				return
			}
			decoded, err := a.nak.Decode(id)
			if err != nil {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("failed to decode event ID '%s': %v", id, err))
				return
			}
			id = decoded.Hex
		}

		// Validate hex format (64 characters, valid hex)
		if len(id) != 64 {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("event ID '%s' must be 64 hex characters", id))
			return
		}
		for _, c := range id {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("event ID '%s' must contain only hexadecimal characters", id))
				return
			}
		}

		hexIDs = append(hexIDs, id)
	}

	// Query events in batch
	response := a.relayPool.QueryBatchEventsByIDs(hexIDs)

	writeJSON(w, response)
}

// HandleEventPublish publishes a signed event to connected relays.
// Request body can be either:
// 1. A signed event JSON directly
// 2. An object with "event" (signed event) and optional "relays" (array of relay URLs)
func (a *API) HandleEventPublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	var eventJSON []byte
	var targetRelays []string

	// Try to parse as a publish request with optional relays
	var publishReq struct {
		Event  json.RawMessage `json:"event"`
		Relays []string        `json:"relays"`
	}
	if err := json.Unmarshal(body, &publishReq); err == nil && publishReq.Event != nil {
		eventJSON = publishReq.Event
		targetRelays = publishReq.Relays
	} else {
		// Assume the body is the event itself
		eventJSON = body
	}

	// Validate that we have event JSON
	if len(eventJSON) == 0 {
		writeError(w, http.StatusBadRequest, "event data is required")
		return
	}

	// If no specific relays provided, use all connected relays
	if len(targetRelays) == 0 {
		relays := a.relayPool.List()
		for _, relay := range relays {
			if relay.Connected {
				targetRelays = append(targetRelays, relay.URL)
			}
		}
	}

	if len(targetRelays) == 0 {
		writeError(w, http.StatusBadRequest, "no connected relays")
		return
	}

	// Publish to relays using the relay pool
	eventID, results := a.relayPool.PublishEventJSON(eventJSON, targetRelays)

	// Check if at least one relay succeeded
	hasSuccess := false
	for _, result := range results {
		if result.Success {
			hasSuccess = true
			break
		}
	}

	if !hasSuccess && eventID == "" {
		// If we don't have an event ID, there was a parsing error
		if len(results) > 0 && results[0].Error != "" {
			writeError(w, http.StatusBadRequest, results[0].Error)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to publish event")
		return
	}

	writeJSON(w, types.PublishResponse{
		EventID: eventID,
		Results: results,
	})
}

// HandleThread fetches a thread for a given event ID (NIP-10).
// Path: /api/events/thread/{eventId}
func (a *API) HandleThread(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Extract event ID from URL path: /api/events/thread/{eventId}
	path := strings.TrimPrefix(r.URL.Path, "/api/events/thread/")
	eventID := strings.TrimSpace(path)

	if eventID == "" {
		writeError(w, http.StatusBadRequest, "event ID is required in path")
		return
	}

	// Validate event ID format (should be 64 hex characters)
	if len(eventID) != 64 {
		writeError(w, http.StatusBadRequest, "event ID must be a 64-character hex string")
		return
	}
	for _, c := range eventID {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			writeError(w, http.StatusBadRequest, "event ID must be a valid hex string")
			return
		}
	}

	// Build the thread
	thread, err := a.buildThread(eventID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build thread: "+err.Error())
		return
	}

	writeJSON(w, thread)
}

// buildThread constructs a thread starting from a given event ID.
// It fetches the target event, finds the root via "e" tags with "root" marker,
// and then fetches all replies to build the tree structure.
func (a *API) buildThread(eventID string) (*types.Thread, error) {
	thread := &types.Thread{
		TargetID: eventID,
		Events:   []types.ThreadEvent{},
	}

	// Fetch the target event
	events, err := a.relayPool.QueryEventsByIDs([]string{eventID})
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, fmt.Errorf("event not found")
	}

	targetEvent := events[0]

	// Parse NIP-10 tags to find root and reply references
	rootID, replyID := parseNIP10Tags(targetEvent.Tags)

	// If no root is found, this event IS the root
	if rootID == "" {
		rootID = eventID
	}

	// Collect all event IDs we need to fetch (ancestors)
	ancestorIDs := make(map[string]bool)
	if rootID != eventID {
		ancestorIDs[rootID] = true
	}
	if replyID != "" && replyID != eventID && replyID != rootID {
		ancestorIDs[replyID] = true
	}

	// Fetch ancestors if any
	var ancestors []types.Event
	if len(ancestorIDs) > 0 {
		ids := make([]string, 0, len(ancestorIDs))
		for id := range ancestorIDs {
			ids = append(ids, id)
		}
		ancestors, _ = a.relayPool.QueryEventsByIDs(ids)
	}

	// Fetch replies to the root (to build the thread)
	replies, _ := a.relayPool.QueryEventReplies(rootID)

	// Also fetch replies to the target event if it's not the root
	if eventID != rootID {
		targetReplies, _ := a.relayPool.QueryEventReplies(eventID)
		replies = append(replies, targetReplies...)
	}

	// Build a map of all events
	eventMap := make(map[string]types.Event)
	eventMap[targetEvent.ID] = targetEvent
	for _, e := range ancestors {
		eventMap[e.ID] = e
	}
	for _, e := range replies {
		eventMap[e.ID] = e
	}

	// Build parent-child relationships
	children := make(map[string][]string) // parentID -> []childID
	parents := make(map[string]string)    // childID -> parentID
	eventRoots := make(map[string]string) // eventID -> rootID

	for id, event := range eventMap {
		eRoot, eReply := parseNIP10Tags(event.Tags)
		if eRoot != "" {
			eventRoots[id] = eRoot
		} else {
			eventRoots[id] = id // It's a root
		}

		// Determine parent
		parentID := eReply
		if parentID == "" && eRoot != "" {
			parentID = eRoot
		}

		if parentID != "" && parentID != id {
			parents[id] = parentID
			children[parentID] = append(children[parentID], id)
		}
	}

	// Calculate depths using BFS from root
	depths := make(map[string]int)
	depths[rootID] = 0
	queue := []string{rootID}
	maxDepth := 0

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		currentDepth := depths[current]
		if currentDepth > maxDepth {
			maxDepth = currentDepth
		}

		for _, childID := range children[current] {
			if _, visited := depths[childID]; !visited {
				depths[childID] = currentDepth + 1
				queue = append(queue, childID)
			}
		}
	}

	// Convert to ThreadEvent slice, sorted by timestamp
	var threadEvents []types.ThreadEvent
	for id, event := range eventMap {
		depth := depths[id]
		if depth == 0 && id != rootID {
			depth = 1 // Default to 1 if not reachable from root
		}

		te := types.ThreadEvent{
			Event:      event,
			Depth:      depth,
			IsRoot:     id == rootID,
			ParentID:   parents[id],
			RootID:     eventRoots[id],
			ReplyCount: len(children[id]),
		}
		threadEvents = append(threadEvents, te)

		if id == rootID {
			thread.RootEvent = &te
		}
	}

	// Sort by timestamp (oldest first for thread display)
	for i := 0; i < len(threadEvents)-1; i++ {
		for j := i + 1; j < len(threadEvents); j++ {
			if threadEvents[i].CreatedAt > threadEvents[j].CreatedAt {
				threadEvents[i], threadEvents[j] = threadEvents[j], threadEvents[i]
			}
		}
	}

	thread.Events = threadEvents
	thread.TotalSize = len(threadEvents)
	thread.MaxDepth = maxDepth

	return thread, nil
}

// parseNIP10Tags extracts root and reply event IDs from NIP-10 formatted tags.
// Returns (rootID, replyID)
func parseNIP10Tags(tags [][]string) (string, string) {
	var rootID, replyID string
	var eTags [][]string

	// Collect all "e" tags
	for _, tag := range tags {
		if len(tag) >= 2 && tag[0] == "e" {
			eTags = append(eTags, tag)
		}
	}

	// Look for marked tags first (NIP-10 preferred method)
	for _, tag := range eTags {
		if len(tag) >= 4 {
			marker := tag[3]
			switch marker {
			case "root":
				rootID = tag[1]
			case "reply":
				replyID = tag[1]
			}
		}
	}

	// Fall back to positional method if no markers found
	if rootID == "" && replyID == "" && len(eTags) > 0 {
		// Deprecated positional method: first = root, last = reply
		rootID = eTags[0][1]
		if len(eTags) > 1 {
			replyID = eTags[len(eTags)-1][1]
		}
	}

	return rootID, replyID
}
