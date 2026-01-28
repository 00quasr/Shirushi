// Package relay provides relay connection pool management.
package relay

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip11"
)

// StatusChangeCallback is called when a relay's connection status changes.
// url is the relay URL, connected indicates the new connection state,
// and err contains any error message (empty if connected successfully).
type StatusChangeCallback func(url string, connected bool, err string)

// RelayInfoCallback is called when NIP-11 relay info is fetched for a relay.
type RelayInfoCallback func(url string, info *types.RelayInfo)

// Pool manages connections to multiple Nostr relays.
type Pool struct {
	relays         map[string]*RelayConn
	mu             sync.RWMutex
	pool           *nostr.SimplePool
	monitor        *Monitor
	infoCache      *RelayInfoCache
	ctx            context.Context
	cancel         context.CancelFunc
	subCounter     int
	subMu          sync.Mutex
	onStatusChange StatusChangeCallback
	onRelayInfo    func(url string, info *types.RelayInfo)
}

// RelayConn represents a connection to a single relay.
type RelayConn struct {
	URL           string
	Relay         *nostr.Relay
	Connected     bool
	Error         string
	AddedAt       time.Time
	Info          *types.RelayInfo
	SupportedNIPs []int
}

// NewPool creates a new relay pool.
func NewPool(defaultRelays []string) *Pool {
	ctx, cancel := context.WithCancel(context.Background())
	p := &Pool{
		relays:    make(map[string]*RelayConn),
		pool:      nostr.NewSimplePool(ctx),
		infoCache: NewRelayInfoCache(DefaultCacheTTL),
		ctx:       ctx,
		cancel:    cancel,
	}
	p.monitor = NewMonitor(p)

	// Add default relays
	for _, url := range defaultRelays {
		p.Add(url)
	}

	// Start monitoring
	go p.monitor.Start()

	return p
}

// Add adds a relay to the pool.
func (p *Pool) Add(url string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if _, exists := p.relays[url]; exists {
		return nil // Already added
	}

	conn := &RelayConn{
		URL:       url,
		AddedAt:   time.Now(),
		Connected: false,
	}
	p.relays[url] = conn

	// Connect in background
	go p.connect(url)

	return nil
}

// SetOnStatusChange sets the callback function that is invoked when a relay's
// connection status changes.
func (p *Pool) SetOnStatusChange(callback StatusChangeCallback) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.onStatusChange = callback
}

// SetStatusCallback sets the callback function that is invoked when a relay's
// connection status changes. This is an alias for SetOnStatusChange.
func (p *Pool) SetStatusCallback(callback func(url string, connected bool, err string)) {
	p.SetOnStatusChange(callback)
}

// SetOnRelayInfo sets the callback function that is invoked when NIP-11
// relay information is fetched for a relay.
func (p *Pool) SetOnRelayInfo(callback func(url string, info *types.RelayInfo)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.onRelayInfo = callback
}

// notifyRelayInfo invokes the relay info callback if set.
// Must be called without holding the mutex.
func (p *Pool) notifyRelayInfo(url string, info *types.RelayInfo) {
	p.mu.RLock()
	callback := p.onRelayInfo
	p.mu.RUnlock()

	if callback != nil {
		callback(url, info)
	}
}

// notifyStatusChange invokes the status change callback if set.
// Must be called without holding the mutex.
func (p *Pool) notifyStatusChange(url string, connected bool, errMsg string) {
	p.mu.RLock()
	callback := p.onStatusChange
	p.mu.RUnlock()

	if callback != nil {
		callback(url, connected, errMsg)
	}
}

// connect attempts to connect to a relay.
func (p *Pool) connect(url string) {
	ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
	defer cancel()

	relay, err := nostr.RelayConnect(ctx, url)

	p.mu.Lock()
	conn, exists := p.relays[url]
	if !exists {
		p.mu.Unlock()
		return // Was removed while connecting
	}

	if err != nil {
		conn.Connected = false
		conn.Error = err.Error()
		log.Printf("[Relay] Failed to connect to %s: %v", url, err)
		p.mu.Unlock()
		p.notifyStatusChange(url, false, err.Error())
		return
	}

	conn.Relay = relay
	conn.Connected = true
	conn.Error = ""
	log.Printf("[Relay] Connected to %s", url)
	p.mu.Unlock()

	p.notifyStatusChange(url, true, "")

	// Fetch NIP-11 relay info in background
	go p.fetchRelayInfo(url)
}

// fetchRelayInfo fetches NIP-11 relay information document.
func (p *Pool) fetchRelayInfo(url string) {
	ctx, cancel := context.WithTimeout(p.ctx, 7*time.Second)
	defer cancel()

	info, err := nip11.Fetch(ctx, url)
	if err != nil {
		log.Printf("[Relay] Failed to fetch NIP-11 info for %s: %v", url, err)
		return
	}

	relayInfo := p.convertNIP11Info(&info)

	p.mu.Lock()

	conn, exists := p.relays[url]
	if !exists {
		p.mu.Unlock()
		// Still cache it even if relay was removed during fetch
		if p.infoCache != nil {
			p.infoCache.Set(url, relayInfo)
		}
		return
	}

	conn.Info = relayInfo
	conn.SupportedNIPs = info.SupportedNIPs

	log.Printf("[Relay] Fetched NIP-11 info for %s: %s (supports %d NIPs)", url, info.Name, len(info.SupportedNIPs))

	p.mu.Unlock()

	// Store in cache (thread-safe, separate lock)
	if p.infoCache != nil {
		p.infoCache.Set(url, relayInfo)
	}

	// Notify callback after releasing mutex
	p.notifyRelayInfo(url, relayInfo)
}

// Remove removes a relay from the pool.
func (p *Pool) Remove(url string) {
	p.mu.Lock()
	conn, exists := p.relays[url]
	if !exists {
		p.mu.Unlock()
		return
	}

	wasConnected := conn.Connected
	if conn.Relay != nil {
		conn.Relay.Close()
	}

	delete(p.relays, url)
	log.Printf("[Relay] Removed %s", url)
	p.mu.Unlock()

	// Notify if the relay was connected (now disconnected due to removal)
	if wasConnected {
		p.notifyStatusChange(url, false, "removed")
	}
}

// List returns all relays with their status.
func (p *Pool) List() []types.RelayStatus {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := p.monitor.GetStats()
	var list []types.RelayStatus
	for url, conn := range p.relays {
		status := types.RelayStatus{
			URL:           url,
			Connected:     conn.Connected,
			Error:         conn.Error,
			SupportedNIPs: conn.SupportedNIPs,
			RelayInfo:     conn.Info,
		}
		if s, ok := stats[url]; ok {
			status.Latency = s.Latency
			status.EventsPS = s.EventsPerSec
		}
		list = append(list, status)
	}
	return list
}

// Stats returns statistics for all relays.
func (p *Pool) Stats() map[string]types.RelayStats {
	return p.monitor.GetStats()
}

// Count returns the number of relays in the pool.
func (p *Pool) Count() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.relays)
}

// GetConnected returns all connected relay URLs.
func (p *Pool) GetConnected() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var urls []string
	for url, conn := range p.relays {
		if conn.Connected {
			urls = append(urls, url)
		}
	}
	return urls
}

// getRelaysForQuery returns the list of relays to use for a query.
// If selectedRelays is provided and non-empty, only those relays are returned (if connected).
// Otherwise, all connected relays are returned.
func (p *Pool) getRelaysForQuery(selectedRelays []string) []string {
	connectedRelays := p.GetConnected()
	if len(selectedRelays) == 0 {
		return connectedRelays
	}

	// Create a set of connected relays for O(1) lookup
	connectedSet := make(map[string]bool)
	for _, url := range connectedRelays {
		connectedSet[url] = true
	}

	// Filter selected relays to only include connected ones
	var result []string
	for _, url := range selectedRelays {
		if connectedSet[url] {
			result = append(result, url)
		}
	}
	return result
}

// QueryEvents queries events from connected relays.
func (p *Pool) QueryEvents(kindStr, author, limitStr string) ([]types.Event, error) {
	relays := p.GetConnected()
	if len(relays) == 0 {
		return nil, fmt.Errorf("no connected relays")
	}

	filter := nostr.Filter{}

	// Parse kind
	if kindStr != "" {
		kind, err := strconv.Atoi(kindStr)
		if err == nil {
			filter.Kinds = []int{kind}
		}
	}

	// Parse author
	if author != "" {
		filter.Authors = []string{author}
	}

	// Parse limit
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	filter.Limit = limit

	ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
	defer cancel()

	var events []types.Event
	ch := p.pool.SubManyEose(ctx, relays, nostr.Filters{filter})

	for ev := range ch {
		events = append(events, types.Event{
			ID:        ev.Event.ID,
			Kind:      ev.Event.Kind,
			PubKey:    ev.Event.PubKey,
			Content:   ev.Event.Content,
			CreatedAt: int64(ev.Event.CreatedAt),
			Tags:      convertTags(ev.Event.Tags),
			Sig:       ev.Event.Sig,
			Relay:     ev.Relay.URL,
		})
	}

	return events, nil
}

// QueryEventsWithTiming queries events from connected relays and returns per-relay timing data.
func (p *Pool) QueryEventsWithTiming(kindStr, author, limitStr string) (*types.EventsQueryResponse, error) {
	totalStart := time.Now()

	relays := p.GetConnected()
	if len(relays) == 0 {
		return nil, fmt.Errorf("no connected relays")
	}

	filter := nostr.Filter{}

	// Parse kind
	if kindStr != "" {
		kind, err := strconv.Atoi(kindStr)
		if err == nil {
			filter.Kinds = []int{kind}
		}
	}

	// Parse author
	if author != "" {
		filter.Authors = []string{author}
	}

	// Parse limit
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	filter.Limit = limit

	// Query each relay individually to track per-relay timing
	type relayResult struct {
		timing types.RelayFetchTiming
		events []types.Event
	}

	var wg sync.WaitGroup
	resultsChan := make(chan relayResult, len(relays))

	for _, relayURL := range relays {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			result := relayResult{
				timing: types.RelayFetchTiming{
					URL:       url,
					Connected: true,
				},
				events: make([]types.Event, 0),
			}

			start := time.Now()
			var firstEventTime time.Time

			ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
			defer cancel()

			// Get the relay connection
			relay, err := p.pool.EnsureRelay(url)
			if err != nil {
				result.timing.Error = fmt.Sprintf("connection error: %v", err)
				result.timing.LatencyMs = time.Since(start).Milliseconds()
				result.timing.Connected = false
				resultsChan <- result
				return
			}

			sub, err := relay.Subscribe(ctx, nostr.Filters{filter})
			if err != nil {
				result.timing.Error = fmt.Sprintf("subscribe error: %v", err)
				result.timing.LatencyMs = time.Since(start).Milliseconds()
				resultsChan <- result
				return
			}
			defer sub.Unsub()

			// Collect events until EOSE or timeout
		eventLoop:
			for {
				select {
				case ev := <-sub.Events:
					if ev != nil {
						if firstEventTime.IsZero() {
							firstEventTime = time.Now()
						}
						result.events = append(result.events, types.Event{
							ID:        ev.ID,
							Kind:      ev.Kind,
							PubKey:    ev.PubKey,
							Content:   ev.Content,
							CreatedAt: int64(ev.CreatedAt),
							Tags:      convertTags(ev.Tags),
							Sig:       ev.Sig,
							Relay:     url,
						})
					}
				case <-sub.EndOfStoredEvents:
					break eventLoop
				case <-ctx.Done():
					result.timing.Error = "timeout"
					break eventLoop
				}
			}

			result.timing.LatencyMs = time.Since(start).Milliseconds()
			result.timing.EventCount = len(result.events)
			if !firstEventTime.IsZero() {
				result.timing.FirstEventMs = firstEventTime.Sub(start).Milliseconds()
			}
			resultsChan <- result
		}(relayURL)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	response := &types.EventsQueryResponse{
		Events:       make([]types.Event, 0),
		RelayTimings: make([]types.RelayFetchTiming, 0, len(relays)),
	}

	seenEvents := make(map[string]bool)
	for result := range resultsChan {
		response.RelayTimings = append(response.RelayTimings, result.timing)
		// Deduplicate events by ID
		for _, ev := range result.events {
			if !seenEvents[ev.ID] {
				seenEvents[ev.ID] = true
				response.Events = append(response.Events, ev)
			}
		}
	}

	response.TotalTimeMs = time.Since(totalStart).Milliseconds()

	return response, nil
}

// convertTags converts nostr.Tags to [][]string
func convertTags(tags nostr.Tags) [][]string {
	result := make([][]string, len(tags))
	for i, tag := range tags {
		result[i] = tag
	}
	return result
}

// buildFilter creates a nostr.Filter from the given parameters.
func buildFilter(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64) nostr.Filter {
	filter := nostr.Filter{}

	if len(kinds) > 0 {
		filter.Kinds = kinds
	}

	if len(authors) > 0 {
		filter.Authors = authors
	}

	if len(tags) > 0 {
		filter.Tags = make(nostr.TagMap)
		for tagName, tagValues := range tags {
			filter.Tags[tagName] = tagValues
		}
	}

	if limit > 0 {
		filter.Limit = limit
	} else {
		filter.Limit = 20 // default
	}

	if since > 0 {
		ts := nostr.Timestamp(since)
		filter.Since = &ts
	}

	if until > 0 {
		ts := nostr.Timestamp(until)
		filter.Until = &ts
	}

	return filter
}

// QueryEventsAdvanced queries events from connected relays with advanced filter options.
// If selectedRelays is provided and non-empty, only those relays are queried (must be connected).
func (p *Pool) QueryEventsAdvanced(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64, selectedRelays ...string) ([]types.Event, error) {
	relays := p.getRelaysForQuery(selectedRelays)
	if len(relays) == 0 {
		return nil, fmt.Errorf("no connected relays")
	}

	filter := buildFilter(kinds, authors, tags, limit, since, until)

	ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
	defer cancel()

	var events []types.Event
	ch := p.pool.SubManyEose(ctx, relays, nostr.Filters{filter})

	for ev := range ch {
		events = append(events, types.Event{
			ID:        ev.Event.ID,
			Kind:      ev.Event.Kind,
			PubKey:    ev.Event.PubKey,
			Content:   ev.Event.Content,
			CreatedAt: int64(ev.Event.CreatedAt),
			Tags:      convertTags(ev.Event.Tags),
			Sig:       ev.Event.Sig,
			Relay:     ev.Relay.URL,
		})
	}

	return events, nil
}

// QueryEventsAdvancedWithTiming queries events with advanced filter options and returns per-relay timing data.
// If selectedRelays is provided and non-empty, only those relays are queried (must be connected).
func (p *Pool) QueryEventsAdvancedWithTiming(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64, selectedRelays ...string) (*types.EventsQueryResponse, error) {
	totalStart := time.Now()

	relays := p.getRelaysForQuery(selectedRelays)
	if len(relays) == 0 {
		return nil, fmt.Errorf("no connected relays")
	}

	filter := buildFilter(kinds, authors, tags, limit, since, until)

	// Query each relay individually to track per-relay timing
	type relayResult struct {
		timing types.RelayFetchTiming
		events []types.Event
	}

	var wg sync.WaitGroup
	resultsChan := make(chan relayResult, len(relays))

	for _, relayURL := range relays {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			result := relayResult{
				timing: types.RelayFetchTiming{
					URL:       url,
					Connected: true,
				},
				events: make([]types.Event, 0),
			}

			start := time.Now()
			var firstEventTime time.Time

			ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
			defer cancel()

			// Get the relay connection
			relay, err := p.pool.EnsureRelay(url)
			if err != nil {
				result.timing.Error = fmt.Sprintf("connection error: %v", err)
				result.timing.LatencyMs = time.Since(start).Milliseconds()
				result.timing.Connected = false
				resultsChan <- result
				return
			}

			sub, err := relay.Subscribe(ctx, nostr.Filters{filter})
			if err != nil {
				result.timing.Error = fmt.Sprintf("subscribe error: %v", err)
				result.timing.LatencyMs = time.Since(start).Milliseconds()
				resultsChan <- result
				return
			}
			defer sub.Unsub()

			// Collect events until EOSE or timeout
		eventLoop:
			for {
				select {
				case ev := <-sub.Events:
					if ev != nil {
						if firstEventTime.IsZero() {
							firstEventTime = time.Now()
						}
						result.events = append(result.events, types.Event{
							ID:        ev.ID,
							Kind:      ev.Kind,
							PubKey:    ev.PubKey,
							Content:   ev.Content,
							CreatedAt: int64(ev.CreatedAt),
							Tags:      convertTags(ev.Tags),
							Sig:       ev.Sig,
							Relay:     url,
						})
					}
				case <-sub.EndOfStoredEvents:
					break eventLoop
				case <-ctx.Done():
					result.timing.Error = "timeout"
					break eventLoop
				}
			}

			result.timing.LatencyMs = time.Since(start).Milliseconds()
			result.timing.EventCount = len(result.events)
			if !firstEventTime.IsZero() {
				result.timing.FirstEventMs = firstEventTime.Sub(start).Milliseconds()
			}
			resultsChan <- result
		}(relayURL)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	response := &types.EventsQueryResponse{
		Events:       make([]types.Event, 0),
		RelayTimings: make([]types.RelayFetchTiming, 0, len(relays)),
	}

	seenEvents := make(map[string]bool)
	for result := range resultsChan {
		response.RelayTimings = append(response.RelayTimings, result.timing)
		// Deduplicate events by ID
		for _, ev := range result.events {
			if !seenEvents[ev.ID] {
				seenEvents[ev.ID] = true
				response.Events = append(response.Events, ev)
			}
		}
	}

	response.TotalTimeMs = time.Since(totalStart).Milliseconds()

	return response, nil
}

// Subscribe creates a subscription to events matching the filter.
func (p *Pool) Subscribe(kinds []int, authors []string, callback func(types.Event)) string {
	p.subMu.Lock()
	p.subCounter++
	subID := fmt.Sprintf("sub-%d", p.subCounter)
	p.subMu.Unlock()

	relays := p.GetConnected()
	if len(relays) == 0 {
		return subID // Return ID but subscription won't work without relays
	}

	filter := nostr.Filter{}
	if len(kinds) > 0 {
		filter.Kinds = kinds
	}
	if len(authors) > 0 {
		filter.Authors = authors
	}

	go func() {
		ch := p.pool.SubMany(p.ctx, relays, nostr.Filters{filter})
		for ev := range ch {
			p.monitor.RecordEvent(ev.Relay.URL)
			callback(types.Event{
				ID:        ev.Event.ID,
				Kind:      ev.Event.Kind,
				PubKey:    ev.Event.PubKey,
				Content:   ev.Event.Content,
				CreatedAt: int64(ev.Event.CreatedAt),
				Tags:      convertTags(ev.Event.Tags),
				Sig:       ev.Event.Sig,
				Relay:     ev.Relay.URL,
			})
		}
	}()

	return subID
}

// MonitoringData returns aggregated monitoring data for all relays.
func (p *Pool) MonitoringData() *types.MonitoringData {
	return p.monitor.GetMonitoringData()
}

// QueryEventsByIDs fetches events by their IDs from connected relays.
func (p *Pool) QueryEventsByIDs(ids []string) ([]types.Event, error) {
	relays := p.GetConnected()
	if len(relays) == 0 {
		return nil, fmt.Errorf("no connected relays")
	}

	if len(ids) == 0 {
		return []types.Event{}, nil
	}

	filter := nostr.Filter{
		IDs:   ids,
		Limit: len(ids),
	}

	ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
	defer cancel()

	var events []types.Event
	seen := make(map[string]bool)
	ch := p.pool.SubManyEose(ctx, relays, nostr.Filters{filter})

	for ev := range ch {
		if !seen[ev.Event.ID] {
			seen[ev.Event.ID] = true
			events = append(events, types.Event{
				ID:        ev.Event.ID,
				Kind:      ev.Event.Kind,
				PubKey:    ev.Event.PubKey,
				Content:   ev.Event.Content,
				CreatedAt: int64(ev.Event.CreatedAt),
				Tags:      convertTags(ev.Event.Tags),
				Sig:       ev.Event.Sig,
				Relay:     ev.Relay.URL,
			})
		}
	}

	return events, nil
}

// QueryEventReplies fetches events that reference (reply to) a given event ID.
func (p *Pool) QueryEventReplies(eventID string) ([]types.Event, error) {
	relays := p.GetConnected()
	if len(relays) == 0 {
		return nil, fmt.Errorf("no connected relays")
	}

	// Query for kind 1 events with e-tags referencing this event ID
	filter := nostr.Filter{
		Kinds: []int{1},
		Tags: nostr.TagMap{
			"e": []string{eventID},
		},
		Limit: 100,
	}

	ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
	defer cancel()

	var events []types.Event
	seen := make(map[string]bool)
	ch := p.pool.SubManyEose(ctx, relays, nostr.Filters{filter})

	for ev := range ch {
		if !seen[ev.Event.ID] {
			seen[ev.Event.ID] = true
			events = append(events, types.Event{
				ID:        ev.Event.ID,
				Kind:      ev.Event.Kind,
				PubKey:    ev.Event.PubKey,
				Content:   ev.Event.Content,
				CreatedAt: int64(ev.Event.CreatedAt),
				Tags:      convertTags(ev.Event.Tags),
				Sig:       ev.Event.Sig,
				Relay:     ev.Relay.URL,
			})
		}
	}

	return events, nil
}

// QueryEventFromAllRelays fetches an event by ID from all connected relays,
// returning individual results for each relay (whether found, latency, errors).
func (p *Pool) QueryEventFromAllRelays(eventID string) *types.EventFetchAllRelaysResponse {
	relays := p.GetConnected()
	response := &types.EventFetchAllRelaysResponse{
		EventID:     eventID,
		Results:     make([]types.EventRelayResult, 0, len(relays)),
		TotalRelays: len(relays),
	}

	if len(relays) == 0 {
		return response
	}

	filter := nostr.Filter{
		IDs:   []string{eventID},
		Limit: 1,
	}

	// Query each relay individually to get per-relay results
	var wg sync.WaitGroup
	var mu sync.Mutex
	resultsChan := make(chan types.EventRelayResult, len(relays))

	for _, relayURL := range relays {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			result := types.EventRelayResult{
				URL:   url,
				Found: false,
			}

			start := time.Now()
			ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
			defer cancel()

			// Get a single relay from the pool for this specific query
			relay, err := p.pool.EnsureRelay(url)
			if err != nil {
				result.Error = fmt.Sprintf("connection error: %v", err)
				result.Latency = time.Since(start).Milliseconds()
				resultsChan <- result
				return
			}

			sub, err := relay.Subscribe(ctx, nostr.Filters{filter})
			if err != nil {
				result.Error = fmt.Sprintf("subscribe error: %v", err)
				result.Latency = time.Since(start).Milliseconds()
				resultsChan <- result
				return
			}
			defer sub.Unsub()

			// Wait for either an event or EOSE
			select {
			case ev := <-sub.Events:
				if ev != nil {
					result.Found = true
					result.Event = &types.Event{
						ID:        ev.ID,
						Kind:      ev.Kind,
						PubKey:    ev.PubKey,
						Content:   ev.Content,
						CreatedAt: int64(ev.CreatedAt),
						Tags:      convertTags(ev.Tags),
						Sig:       ev.Sig,
						Relay:     url,
					}
				}
			case <-sub.EndOfStoredEvents:
				// No event found, result.Found remains false
			case <-ctx.Done():
				result.Error = "timeout"
			}

			result.Latency = time.Since(start).Milliseconds()
			resultsChan <- result
		}(relayURL)
	}

	// Close the channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	for result := range resultsChan {
		mu.Lock()
		response.Results = append(response.Results, result)
		if result.Found {
			response.FoundCount++
		}
		mu.Unlock()
	}

	return response
}

// QueryBatchEventsByIDs fetches multiple events by ID from all connected relays,
// returning per-event results with relay availability information.
func (p *Pool) QueryBatchEventsByIDs(ids []string) *types.BatchQueryResponse {
	totalStart := time.Now()

	relays := p.GetConnected()
	response := &types.BatchQueryResponse{
		Results:      make([]types.BatchEventResult, 0, len(ids)),
		TotalQueried: len(ids),
	}

	if len(relays) == 0 || len(ids) == 0 {
		// Return empty results for each ID
		for _, id := range ids {
			response.Results = append(response.Results, types.BatchEventResult{
				EventID:   id,
				Found:     false,
				FoundOn:   []string{},
				MissingOn: relays,
			})
		}
		response.TotalTimeMs = time.Since(totalStart).Milliseconds()
		return response
	}

	// Track which events are found on which relays
	type eventRelayInfo struct {
		event   *types.Event
		foundOn map[string]bool
	}
	eventResults := make(map[string]*eventRelayInfo)
	var eventMu sync.Mutex

	// Initialize tracking for all requested IDs
	for _, id := range ids {
		eventResults[id] = &eventRelayInfo{
			foundOn: make(map[string]bool),
		}
	}

	filter := nostr.Filter{
		IDs:   ids,
		Limit: len(ids),
	}

	// Query each relay individually to track per-relay availability
	var wg sync.WaitGroup
	for _, relayURL := range relays {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
			defer cancel()

			relay, err := p.pool.EnsureRelay(url)
			if err != nil {
				return
			}

			sub, err := relay.Subscribe(ctx, nostr.Filters{filter})
			if err != nil {
				return
			}
			defer sub.Unsub()

		eventLoop:
			for {
				select {
				case ev := <-sub.Events:
					if ev != nil {
						eventMu.Lock()
						if info, exists := eventResults[ev.ID]; exists {
							info.foundOn[url] = true
							if info.event == nil {
								info.event = &types.Event{
									ID:        ev.ID,
									Kind:      ev.Kind,
									PubKey:    ev.PubKey,
									Content:   ev.Content,
									CreatedAt: int64(ev.CreatedAt),
									Tags:      convertTags(ev.Tags),
									Sig:       ev.Sig,
									Relay:     url,
								}
							}
						}
						eventMu.Unlock()
					}
				case <-sub.EndOfStoredEvents:
					break eventLoop
				case <-ctx.Done():
					break eventLoop
				}
			}
		}(relayURL)
	}

	wg.Wait()

	// Build results maintaining the order of input IDs
	for _, id := range ids {
		info := eventResults[id]
		result := types.BatchEventResult{
			EventID:   id,
			Event:     info.event,
			Found:     info.event != nil,
			FoundOn:   make([]string, 0),
			MissingOn: make([]string, 0),
		}

		for _, url := range relays {
			if info.foundOn[url] {
				result.FoundOn = append(result.FoundOn, url)
			} else {
				result.MissingOn = append(result.MissingOn, url)
			}
		}

		if result.Found {
			response.TotalFound++
		}
		response.Results = append(response.Results, result)
	}

	response.TotalTimeMs = time.Since(totalStart).Milliseconds()
	return response
}

// GetRelayInfo returns the NIP-11 info for a specific relay.
// First checks the active connection, then falls back to cache.
func (p *Pool) GetRelayInfo(url string) *types.RelayInfo {
	p.mu.RLock()
	conn, exists := p.relays[url]
	p.mu.RUnlock()

	// First try to get from active connection
	if exists && conn.Info != nil {
		return conn.Info
	}

	// Fall back to cache (returns nil if expired or not found)
	if p.infoCache != nil {
		return p.infoCache.Get(url)
	}
	return nil
}

// RefreshRelayInfo refreshes the NIP-11 info for a specific relay.
func (p *Pool) RefreshRelayInfo(url string) error {
	p.mu.RLock()
	_, exists := p.relays[url]
	p.mu.RUnlock()

	if !exists {
		return fmt.Errorf("relay not found: %s", url)
	}

	// Fetch in foreground for immediate result
	ctx, cancel := context.WithTimeout(p.ctx, 7*time.Second)
	defer cancel()

	info, err := nip11.Fetch(ctx, url)
	if err != nil {
		return fmt.Errorf("failed to fetch NIP-11 info: %w", err)
	}

	relayInfo := p.convertNIP11Info(&info)

	p.mu.Lock()

	conn, exists := p.relays[url]
	if !exists {
		p.mu.Unlock()
		// Still cache it even if relay was removed during fetch
		if p.infoCache != nil {
			p.infoCache.Set(url, relayInfo)
		}
		return fmt.Errorf("relay removed during fetch")
	}

	conn.Info = relayInfo
	conn.SupportedNIPs = info.SupportedNIPs

	p.mu.Unlock()

	// Also update the cache
	if p.infoCache != nil {
		p.infoCache.Set(url, relayInfo)
	}

	return nil
}

// GetCachedRelayInfo returns cached relay info regardless of connection state.
// This allows getting info for relays that are not currently in the pool.
func (p *Pool) GetCachedRelayInfo(url string) *types.RelayInfo {
	if p.infoCache == nil {
		return nil
	}
	return p.infoCache.Get(url)
}

// GetCachedRelayInfoWithMetadata returns cached info with cache metadata.
func (p *Pool) GetCachedRelayInfoWithMetadata(url string) *CachedRelayInfo {
	if p.infoCache == nil {
		return nil
	}
	return p.infoCache.GetWithMetadata(url)
}

// FetchRelayInfoCached fetches and caches relay info for any relay URL.
// This can be used to get info for relays not in the pool.
// If info is already cached and not expired, returns cached info.
// Set forceRefresh to true to bypass cache and fetch fresh info.
func (p *Pool) FetchRelayInfoCached(url string, forceRefresh bool) (*types.RelayInfo, error) {
	// Check cache first (unless force refresh)
	if !forceRefresh && p.infoCache != nil {
		if info := p.infoCache.Get(url); info != nil {
			return info, nil
		}
	}

	// Fetch from network
	ctx, cancel := context.WithTimeout(p.ctx, 7*time.Second)
	defer cancel()

	info, err := nip11.Fetch(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch NIP-11 info: %w", err)
	}

	relayInfo := p.convertNIP11Info(&info)

	// Store in cache
	if p.infoCache != nil {
		p.infoCache.Set(url, relayInfo)
	}

	return relayInfo, nil
}

// convertNIP11Info converts nip11.RelayInformationDocument to types.RelayInfo.
func (p *Pool) convertNIP11Info(info *nip11.RelayInformationDocument) *types.RelayInfo {
	relayInfo := &types.RelayInfo{
		Name:          info.Name,
		Description:   info.Description,
		PubKey:        info.PubKey,
		Contact:       info.Contact,
		SupportedNIPs: info.SupportedNIPs,
		Software:      info.Software,
		Version:       info.Version,
		Icon:          info.Icon,
		PaymentsURL:   info.PaymentsURL,
	}

	if info.Limitation != nil {
		relayInfo.Limitation = &types.RelayLimitation{
			MaxMessageLength: info.Limitation.MaxMessageLength,
			MaxSubscriptions: info.Limitation.MaxSubscriptions,
			MaxLimit:         info.Limitation.MaxLimit,
			MaxEventTags:     info.Limitation.MaxEventTags,
			MaxContentLength: info.Limitation.MaxContentLength,
			MinPOWDifficulty: info.Limitation.MinPowDifficulty,
			AuthRequired:     info.Limitation.AuthRequired,
			PaymentRequired:  info.Limitation.PaymentRequired,
			RestrictedWrites: info.Limitation.RestrictedWrites,
		}
	}

	if info.Fees != nil {
		relayInfo.Fees = &types.RelayFees{}
		for _, a := range info.Fees.Admission {
			relayInfo.Fees.Admission = append(relayInfo.Fees.Admission, types.RelayFeeEntry{
				Amount: a.Amount,
				Unit:   a.Unit,
			})
		}
		for _, s := range info.Fees.Subscription {
			relayInfo.Fees.Subscription = append(relayInfo.Fees.Subscription, types.RelayFeeEntry{
				Amount: s.Amount,
				Unit:   s.Unit,
				Period: s.Period,
			})
		}
		for _, pub := range info.Fees.Publication {
			relayInfo.Fees.Publication = append(relayInfo.Fees.Publication, types.RelayFeeEntry{
				Amount: pub.Amount,
				Unit:   pub.Unit,
				Kinds:  pub.Kinds,
			})
		}
	}

	return relayInfo
}

// InfoCache returns the relay info cache for direct access.
func (p *Pool) InfoCache() *RelayInfoCache {
	return p.infoCache
}

// PublishEvent publishes an event to the specified relays.
// If relayURLs is empty, publishes to all connected relays.
// Returns results for each relay attempted.
func (p *Pool) PublishEvent(event *nostr.Event, relayURLs []string) []types.PublishResult {
	// If no specific relays provided, use all connected relays
	if len(relayURLs) == 0 {
		relayURLs = p.GetConnected()
	}

	if len(relayURLs) == 0 {
		return []types.PublishResult{{
			URL:     "",
			Success: false,
			Error:   "no connected relays",
		}}
	}

	results := make([]types.PublishResult, 0, len(relayURLs))
	var wg sync.WaitGroup
	var resultsMu sync.Mutex

	for _, url := range relayURLs {
		wg.Add(1)
		go func(relayURL string) {
			defer wg.Done()

			result := types.PublishResult{URL: relayURL}

			p.mu.RLock()
			conn, exists := p.relays[relayURL]
			p.mu.RUnlock()

			if !exists {
				result.Success = false
				result.Error = "relay not in pool"
				resultsMu.Lock()
				results = append(results, result)
				resultsMu.Unlock()
				return
			}

			if !conn.Connected || conn.Relay == nil {
				result.Success = false
				result.Error = "relay not connected"
				resultsMu.Lock()
				results = append(results, result)
				resultsMu.Unlock()
				return
			}

			ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
			defer cancel()

			err := conn.Relay.Publish(ctx, *event)
			if err != nil {
				result.Success = false
				result.Error = err.Error()
			} else {
				result.Success = true
			}

			resultsMu.Lock()
			results = append(results, result)
			resultsMu.Unlock()
		}(url)
	}

	wg.Wait()
	return results
}

// PublishEventJSON publishes a signed event (as JSON bytes) to the specified relays.
// This is a convenience method that parses the JSON and publishes the event.
func (p *Pool) PublishEventJSON(eventJSON []byte, relayURLs []string) (string, []types.PublishResult) {
	var event nostr.Event
	if err := json.Unmarshal(eventJSON, &event); err != nil {
		return "", []types.PublishResult{{
			URL:     "",
			Success: false,
			Error:   "invalid event JSON: " + err.Error(),
		}}
	}

	results := p.PublishEvent(&event, relayURLs)
	return event.ID, results
}

// AggregateEvents queries events and returns aggregated statistics.
// This is useful for analyzing event patterns without fetching full event data.
func (p *Pool) AggregateEvents(kinds []int, authors []string, tags map[string][]string, limit int, since, until int64, selectedRelays ...string) (*types.EventAggregation, error) {
	totalStart := time.Now()

	// Query events using existing method
	events, err := p.QueryEventsAdvanced(kinds, authors, tags, limit, since, until, selectedRelays...)
	if err != nil {
		return nil, err
	}

	return p.aggregateEventData(events, time.Since(totalStart).Milliseconds()), nil
}

// aggregateEventData computes aggregation statistics from a slice of events.
func (p *Pool) aggregateEventData(events []types.Event, queryTimeMs int64) *types.EventAggregation {
	agg := &types.EventAggregation{
		TotalEvents:  len(events),
		KindCounts:   []types.KindCount{},
		AuthorCounts: []types.AuthorCount{},
		TagCounts:    make(map[string][]types.TagCount),
		RelayDistrib: []types.RelayCount{},
		TimeDistrib:  []types.TimeBucket{},
		TotalTimeMs:  queryTimeMs,
	}

	if len(events) == 0 {
		return agg
	}

	// Track counts
	kindCounts := make(map[int]int)
	authorCounts := make(map[string]int)
	tagCounts := make(map[string]map[string]int) // tagName -> value -> count
	relayCounts := make(map[string]int)

	var earliest, latest int64
	var totalContentLen int
	minContentLen := -1
	maxContentLen := 0
	emptyContent := 0

	for _, event := range events {
		// Kind counts
		kindCounts[event.Kind]++

		// Author counts
		authorCounts[event.PubKey]++

		// Relay counts
		if event.Relay != "" {
			relayCounts[event.Relay]++
		}

		// Time range
		if earliest == 0 || event.CreatedAt < earliest {
			earliest = event.CreatedAt
		}
		if event.CreatedAt > latest {
			latest = event.CreatedAt
		}

		// Content stats
		contentLen := len(event.Content)
		totalContentLen += contentLen
		if contentLen == 0 {
			emptyContent++
		}
		if minContentLen == -1 || contentLen < minContentLen {
			minContentLen = contentLen
		}
		if contentLen > maxContentLen {
			maxContentLen = contentLen
		}

		// Tag counts (track top tag types: e, p, t)
		for _, tag := range event.Tags {
			if len(tag) < 2 {
				continue
			}
			tagName := tag[0]
			tagValue := tag[1]
			// Only track common tag types to avoid memory bloat
			if tagName == "e" || tagName == "p" || tagName == "t" || tagName == "a" || tagName == "d" {
				if tagCounts[tagName] == nil {
					tagCounts[tagName] = make(map[string]int)
				}
				tagCounts[tagName][tagValue]++
			}
		}
	}

	// Convert kind counts to sorted slice
	for kind, count := range kindCounts {
		agg.KindCounts = append(agg.KindCounts, types.KindCount{
			Kind:  kind,
			Count: count,
			Label: getKindLabel(kind),
		})
	}
	// Sort by count descending
	sortKindCounts(agg.KindCounts)

	// Convert author counts to sorted slice (top 10)
	agg.UniqueAuthors = len(authorCounts)
	for pubkey, count := range authorCounts {
		agg.AuthorCounts = append(agg.AuthorCounts, types.AuthorCount{
			PubKey: pubkey,
			Count:  count,
		})
	}
	sortAuthorCounts(agg.AuthorCounts)
	if len(agg.AuthorCounts) > 10 {
		agg.AuthorCounts = agg.AuthorCounts[:10]
	}

	// Convert tag counts to map of sorted slices (top 10 per tag type)
	for tagName, valueCounts := range tagCounts {
		var tagCountSlice []types.TagCount
		for value, count := range valueCounts {
			tagCountSlice = append(tagCountSlice, types.TagCount{
				Value: value,
				Count: count,
			})
		}
		sortTagCounts(tagCountSlice)
		if len(tagCountSlice) > 10 {
			tagCountSlice = tagCountSlice[:10]
		}
		agg.TagCounts[tagName] = tagCountSlice
	}

	// Convert relay counts to sorted slice
	for url, count := range relayCounts {
		agg.RelayDistrib = append(agg.RelayDistrib, types.RelayCount{
			URL:   url,
			Count: count,
		})
	}
	sortRelayCounts(agg.RelayDistrib)

	// Time distribution (hourly buckets if range > 1 day, otherwise 10-minute buckets)
	if earliest > 0 && latest > 0 {
		agg.EarliestEvent = earliest
		agg.LatestEvent = latest
		agg.TimeDistrib = computeTimeDistribution(events, earliest, latest)
	}

	// Content stats
	if minContentLen == -1 {
		minContentLen = 0
	}
	avgLen := 0
	if len(events) > 0 {
		avgLen = totalContentLen / len(events)
	}
	agg.ContentStats = types.ContentStats{
		AvgLength:  avgLen,
		MinLength:  minContentLen,
		MaxLength:  maxContentLen,
		EmptyCount: emptyContent,
	}

	return agg
}

// getKindLabel returns a human-readable label for an event kind.
func getKindLabel(kind int) string {
	labels := map[int]string{
		0:     "Metadata",
		1:     "Short Text Note",
		2:     "Recommend Relay",
		3:     "Contacts",
		4:     "Encrypted DM",
		5:     "Deletion",
		6:     "Repost",
		7:     "Reaction",
		8:     "Badge Award",
		9:     "Group Chat",
		10:    "Group Chat Threaded",
		40:    "Channel Creation",
		41:    "Channel Metadata",
		42:    "Channel Message",
		43:    "Channel Hide",
		44:    "Channel Mute",
		1063:  "File Metadata",
		1984:  "Report",
		9734:  "Zap Request",
		9735:  "Zap Receipt",
		10000: "Mute List",
		10001: "Pin List",
		10002: "Relay List",
		30000: "Categorized People",
		30001: "Categorized Bookmarks",
		30008: "Profile Badges",
		30009: "Badge Definition",
		30023: "Long-form Content",
		30024: "Draft Long-form",
		30078: "App-specific Data",
	}
	if label, ok := labels[kind]; ok {
		return label
	}
	return fmt.Sprintf("Kind %d", kind)
}

// Sort helpers
func sortKindCounts(counts []types.KindCount) {
	for i := 0; i < len(counts)-1; i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].Count > counts[i].Count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}
}

func sortAuthorCounts(counts []types.AuthorCount) {
	for i := 0; i < len(counts)-1; i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].Count > counts[i].Count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}
}

func sortTagCounts(counts []types.TagCount) {
	for i := 0; i < len(counts)-1; i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].Count > counts[i].Count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}
}

func sortRelayCounts(counts []types.RelayCount) {
	for i := 0; i < len(counts)-1; i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].Count > counts[i].Count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}
}

// computeTimeDistribution creates time buckets for event distribution.
func computeTimeDistribution(events []types.Event, earliest, latest int64) []types.TimeBucket {
	if len(events) == 0 || earliest >= latest {
		return []types.TimeBucket{}
	}

	// Determine bucket size based on time range
	rangeSeconds := latest - earliest
	var bucketSize int64
	var numBuckets int

	if rangeSeconds > 7*24*3600 { // > 7 days: daily buckets
		bucketSize = 24 * 3600
		numBuckets = int(rangeSeconds/bucketSize) + 1
	} else if rangeSeconds > 24*3600 { // > 1 day: hourly buckets
		bucketSize = 3600
		numBuckets = int(rangeSeconds/bucketSize) + 1
	} else { // <= 1 day: 10-minute buckets
		bucketSize = 600
		numBuckets = int(rangeSeconds/bucketSize) + 1
	}

	// Limit to max 50 buckets
	if numBuckets > 50 {
		bucketSize = rangeSeconds / 50
		numBuckets = 50
	}

	// Initialize buckets
	buckets := make([]types.TimeBucket, numBuckets)
	for i := 0; i < numBuckets; i++ {
		buckets[i] = types.TimeBucket{
			Timestamp: earliest + int64(i)*bucketSize,
			Count:     0,
		}
	}

	// Count events per bucket
	for _, event := range events {
		bucketIdx := int((event.CreatedAt - earliest) / bucketSize)
		if bucketIdx >= numBuckets {
			bucketIdx = numBuckets - 1
		}
		if bucketIdx < 0 {
			bucketIdx = 0
		}
		buckets[bucketIdx].Count++
	}

	return buckets
}

// Close closes all relay connections.
func (p *Pool) Close() {
	p.cancel()
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, conn := range p.relays {
		if conn.Relay != nil {
			conn.Relay.Close()
		}
	}
}
