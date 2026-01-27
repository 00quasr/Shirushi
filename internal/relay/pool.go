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
)

// Pool manages connections to multiple Nostr relays.
type Pool struct {
	relays     map[string]*RelayConn
	mu         sync.RWMutex
	pool       *nostr.SimplePool
	monitor    *Monitor
	ctx        context.Context
	cancel     context.CancelFunc
	subCounter int
	subMu      sync.Mutex
}

// RelayConn represents a connection to a single relay.
type RelayConn struct {
	URL       string
	Relay     *nostr.Relay
	Connected bool
	Error     string
	AddedAt   time.Time
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

// connect attempts to connect to a relay.
func (p *Pool) connect(url string) {
	ctx, cancel := context.WithTimeout(p.ctx, 10*time.Second)
	defer cancel()

	relay, err := nostr.RelayConnect(ctx, url)

	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.relays[url]
	if !exists {
		return // Was removed while connecting
	}

	if err != nil {
		conn.Connected = false
		conn.Error = err.Error()
		log.Printf("[Relay] Failed to connect to %s: %v", url, err)
		return
	}

	conn.Relay = relay
	conn.Connected = true
	conn.Error = ""
	log.Printf("[Relay] Connected to %s", url)
}

// Remove removes a relay from the pool.
func (p *Pool) Remove(url string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.relays[url]
	if !exists {
		return
	}

	if conn.Relay != nil {
		conn.Relay.Close()
	}

	delete(p.relays, url)
	log.Printf("[Relay] Removed %s", url)
}

// List returns all relays with their status.
func (p *Pool) List() []types.RelayStatus {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := p.monitor.GetStats()
	var list []types.RelayStatus
	for url, conn := range p.relays {
		status := types.RelayStatus{
			URL:       url,
			Connected: conn.Connected,
			Error:     conn.Error,
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
