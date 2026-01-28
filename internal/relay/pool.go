// Package relay provides relay connection pool management.
package relay

import (
	"context"
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

// Pool manages connections to multiple Nostr relays.
type Pool struct {
	relays         map[string]*RelayConn
	mu             sync.RWMutex
	pool           *nostr.SimplePool
	monitor        *Monitor
	ctx            context.Context
	cancel         context.CancelFunc
	subCounter     int
	subMu          sync.Mutex
	onStatusChange StatusChangeCallback
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
		relays: make(map[string]*RelayConn),
		pool:   nostr.NewSimplePool(ctx),
		ctx:    ctx,
		cancel: cancel,
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

	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.relays[url]
	if !exists {
		return
	}

	// Convert nip11.RelayInformationDocument to types.RelayInfo
	conn.Info = &types.RelayInfo{
		Name:          info.Name,
		Description:   info.Description,
		PubKey:        info.PubKey,
		Contact:       info.Contact,
		SupportedNIPs: info.SupportedNIPs,
		Software:      info.Software,
		Version:       info.Version,
		Icon:          info.Icon,
	}

	// Copy limitation info if available
	if info.Limitation != nil {
		conn.Info.Limitation = &types.RelayLimitation{
			MaxMessageLength: info.Limitation.MaxMessageLength,
			MaxSubscriptions: info.Limitation.MaxSubscriptions,
			MaxLimit:         info.Limitation.MaxLimit,
			MaxEventTags:     info.Limitation.MaxEventTags,
			MaxContentLength: info.Limitation.MaxContentLength,
			MinPOWDifficulty: info.Limitation.MinPowDifficulty,
			AuthRequired:     info.Limitation.AuthRequired,
			PaymentRequired:  info.Limitation.PaymentRequired,
		}
	}

	conn.SupportedNIPs = info.SupportedNIPs

	log.Printf("[Relay] Fetched NIP-11 info for %s: %s (supports %d NIPs)", url, info.Name, len(info.SupportedNIPs))
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
			Relay:     ev.Relay.URL,
		})
	}

	return events, nil
}

// convertTags converts nostr.Tags to [][]string
func convertTags(tags nostr.Tags) [][]string {
	result := make([][]string, len(tags))
	for i, tag := range tags {
		result[i] = tag
	}
	return result
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
				Relay:     ev.Relay.URL,
			})
		}
	}

	return events, nil
}

// GetRelayInfo returns the NIP-11 info for a specific relay.
func (p *Pool) GetRelayInfo(url string) *types.RelayInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if conn, exists := p.relays[url]; exists {
		return conn.Info
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

	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.relays[url]
	if !exists {
		return fmt.Errorf("relay removed during fetch")
	}

	conn.Info = &types.RelayInfo{
		Name:          info.Name,
		Description:   info.Description,
		PubKey:        info.PubKey,
		Contact:       info.Contact,
		SupportedNIPs: info.SupportedNIPs,
		Software:      info.Software,
		Version:       info.Version,
		Icon:          info.Icon,
	}

	if info.Limitation != nil {
		conn.Info.Limitation = &types.RelayLimitation{
			MaxMessageLength: info.Limitation.MaxMessageLength,
			MaxSubscriptions: info.Limitation.MaxSubscriptions,
			MaxLimit:         info.Limitation.MaxLimit,
			MaxEventTags:     info.Limitation.MaxEventTags,
			MaxContentLength: info.Limitation.MaxContentLength,
			MinPOWDifficulty: info.Limitation.MinPowDifficulty,
			AuthRequired:     info.Limitation.AuthRequired,
			PaymentRequired:  info.Limitation.PaymentRequired,
		}
	}

	conn.SupportedNIPs = info.SupportedNIPs

	return nil
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
