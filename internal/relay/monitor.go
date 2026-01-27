// Package relay provides relay health monitoring.
package relay

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
	"github.com/nbd-wtf/go-nostr"
)

// Monitor tracks relay health and statistics.
type Monitor struct {
	pool     *Pool
	stats    map[string]*relayMetrics
	mu       sync.RWMutex
	interval time.Duration
}

// relayMetrics holds metrics for a single relay.
type relayMetrics struct {
	URL          string
	Latency      int64 // milliseconds
	EventCount   int64
	EventsPerSec float64
	LastCheck    time.Time
	LastEvent    time.Time
}

// NewMonitor creates a new relay monitor.
func NewMonitor(pool *Pool) *Monitor {
	return &Monitor{
		pool:     pool,
		stats:    make(map[string]*relayMetrics),
		interval: 30 * time.Second,
	}
}

// Start begins monitoring relays.
func (m *Monitor) Start() {
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Run immediately on start
	m.checkAll()

	for range ticker.C {
		m.checkAll()
	}
}

// checkAll checks all relays in the pool.
func (m *Monitor) checkAll() {
	m.pool.mu.RLock()
	relays := make([]string, 0, len(m.pool.relays))
	for url := range m.pool.relays {
		relays = append(relays, url)
	}
	m.pool.mu.RUnlock()

	for _, url := range relays {
		m.checkRelay(url)
	}

	// Calculate events per second
	m.calculateRates()
}

// checkRelay checks a single relay's latency.
func (m *Monitor) checkRelay(url string) {
	m.mu.Lock()
	if _, exists := m.stats[url]; !exists {
		m.stats[url] = &relayMetrics{URL: url}
	}
	metrics := m.stats[url]
	m.mu.Unlock()

	// Measure latency by connecting and querying
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	relay, err := nostr.RelayConnect(ctx, url)
	if err != nil {
		log.Printf("[Monitor] Failed to connect to %s: %v", url, err)
		return
	}
	defer relay.Close()

	// Send a simple query to measure round-trip time
	filter := nostr.Filter{Kinds: []int{1}, Limit: 1}
	_, err = relay.QuerySync(ctx, filter)
	latency := time.Since(start).Milliseconds()

	m.mu.Lock()
	metrics.Latency = latency
	metrics.LastCheck = time.Now()
	m.mu.Unlock()

	if err != nil {
		log.Printf("[Monitor] Query to %s failed: %v", url, err)
	}

	// Update pool connection status
	m.pool.mu.Lock()
	if conn, exists := m.pool.relays[url]; exists {
		conn.Connected = err == nil
		if err != nil {
			conn.Error = err.Error()
		} else {
			conn.Error = ""
		}
	}
	m.pool.mu.Unlock()
}

// RecordEvent records that an event was received from a relay.
func (m *Monitor) RecordEvent(url string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if metrics, exists := m.stats[url]; exists {
		metrics.EventCount++
		metrics.LastEvent = time.Now()
	} else {
		m.stats[url] = &relayMetrics{
			URL:        url,
			EventCount: 1,
			LastEvent:  time.Now(),
		}
	}
}

// calculateRates calculates events per second for each relay.
func (m *Monitor) calculateRates() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, metrics := range m.stats {
		if !metrics.LastEvent.IsZero() {
			elapsed := time.Since(metrics.LastCheck).Seconds()
			if elapsed > 0 {
				metrics.EventsPerSec = float64(metrics.EventCount) / elapsed
			}
		}
	}
}

// GetStats returns current statistics for all relays.
func (m *Monitor) GetStats() map[string]types.RelayStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]types.RelayStats)
	for url, metrics := range m.stats {
		result[url] = types.RelayStats{
			URL:          url,
			Latency:      metrics.Latency,
			EventsPerSec: metrics.EventsPerSec,
			TotalEvents:  metrics.EventCount,
		}
	}
	return result
}

// GetRelayLatency returns the latency for a specific relay.
func (m *Monitor) GetRelayLatency(url string) int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if metrics, exists := m.stats[url]; exists {
		return metrics.Latency
	}
	return -1
}
