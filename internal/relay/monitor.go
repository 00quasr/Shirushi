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

// DefaultRingBufferSize is the default capacity for time-series ring buffers.
const DefaultRingBufferSize = 100

// TimeSeriesRingBuffer is a fixed-size circular buffer for time-series data.
type TimeSeriesRingBuffer struct {
	data  []types.TimeSeriesPoint
	size  int
	head  int // next write position
	count int // number of elements
}

// NewTimeSeriesRingBuffer creates a new ring buffer with the given capacity.
func NewTimeSeriesRingBuffer(size int) *TimeSeriesRingBuffer {
	if size <= 0 {
		size = DefaultRingBufferSize
	}
	return &TimeSeriesRingBuffer{
		data: make([]types.TimeSeriesPoint, size),
		size: size,
	}
}

// Add adds a new data point to the ring buffer.
func (rb *TimeSeriesRingBuffer) Add(timestamp int64, value float64) {
	rb.data[rb.head] = types.TimeSeriesPoint{
		Timestamp: timestamp,
		Value:     value,
	}
	rb.head = (rb.head + 1) % rb.size
	if rb.count < rb.size {
		rb.count++
	}
}

// GetAll returns all data points in chronological order.
func (rb *TimeSeriesRingBuffer) GetAll() []types.TimeSeriesPoint {
	if rb.count == 0 {
		return nil
	}

	result := make([]types.TimeSeriesPoint, rb.count)
	if rb.count < rb.size {
		// Buffer not full yet, data starts at index 0
		copy(result, rb.data[:rb.count])
	} else {
		// Buffer is full, oldest data is at head
		copy(result, rb.data[rb.head:])
		copy(result[rb.size-rb.head:], rb.data[:rb.head])
	}
	return result
}

// GetLast returns the last n data points in chronological order.
func (rb *TimeSeriesRingBuffer) GetLast(n int) []types.TimeSeriesPoint {
	if rb.count == 0 || n <= 0 {
		return nil
	}
	if n > rb.count {
		n = rb.count
	}

	result := make([]types.TimeSeriesPoint, n)
	// Calculate the start position for the last n items
	start := (rb.head - n + rb.size) % rb.size

	for i := 0; i < n; i++ {
		idx := (start + i) % rb.size
		result[i] = rb.data[idx]
	}
	return result
}

// Len returns the number of elements in the buffer.
func (rb *TimeSeriesRingBuffer) Len() int {
	return rb.count
}

// Cap returns the capacity of the buffer.
func (rb *TimeSeriesRingBuffer) Cap() int {
	return rb.size
}

// Clear removes all elements from the buffer.
func (rb *TimeSeriesRingBuffer) Clear() {
	rb.head = 0
	rb.count = 0
}

// Monitor tracks relay health and statistics.
type Monitor struct {
	pool           *Pool
	stats          map[string]*relayMetrics
	mu             sync.RWMutex
	interval       time.Duration
	ringBufferSize int
}

// relayMetrics holds metrics for a single relay.
type relayMetrics struct {
	URL            string
	Latency        int64 // milliseconds
	LatencyHistory *TimeSeriesRingBuffer
	EventCount     int64
	EventsPerSec   float64
	EventHistory   *TimeSeriesRingBuffer
	LastCheck      time.Time
	LastEvent      time.Time
	ErrorCount     int
	LastError      string
	CheckCount     int64
	SuccessCount   int64
}

// NewMonitor creates a new relay monitor.
func NewMonitor(pool *Pool) *Monitor {
	return &Monitor{
		pool:           pool,
		stats:          make(map[string]*relayMetrics),
		interval:       30 * time.Second,
		ringBufferSize: DefaultRingBufferSize,
	}
}

// NewMonitorWithBufferSize creates a new relay monitor with custom ring buffer size.
func NewMonitorWithBufferSize(pool *Pool, bufferSize int) *Monitor {
	return &Monitor{
		pool:           pool,
		stats:          make(map[string]*relayMetrics),
		interval:       30 * time.Second,
		ringBufferSize: bufferSize,
	}
}

// newRelayMetrics creates a new relayMetrics with initialized ring buffers.
func (m *Monitor) newRelayMetrics(url string) *relayMetrics {
	return &relayMetrics{
		URL:            url,
		LatencyHistory: NewTimeSeriesRingBuffer(m.ringBufferSize),
		EventHistory:   NewTimeSeriesRingBuffer(m.ringBufferSize),
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
		m.stats[url] = m.newRelayMetrics(url)
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
		m.mu.Lock()
		metrics.CheckCount++
		metrics.ErrorCount++
		metrics.LastError = err.Error()
		m.mu.Unlock()
		return
	}
	defer relay.Close()

	// Send a simple query to measure round-trip time
	filter := nostr.Filter{Kinds: []int{1}, Limit: 1}
	_, err = relay.QuerySync(ctx, filter)
	latency := time.Since(start).Milliseconds()
	now := time.Now()

	m.mu.Lock()
	metrics.Latency = latency
	metrics.LastCheck = now
	metrics.CheckCount++
	metrics.LatencyHistory.Add(now.Unix(), float64(latency))
	if err != nil {
		metrics.ErrorCount++
		metrics.LastError = err.Error()
	} else {
		metrics.SuccessCount++
		metrics.LastError = ""
	}
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

	now := time.Now()
	if metrics, exists := m.stats[url]; exists {
		metrics.EventCount++
		metrics.LastEvent = now
	} else {
		metrics = m.newRelayMetrics(url)
		metrics.EventCount = 1
		metrics.LastEvent = now
		m.stats[url] = metrics
	}
}

// calculateRates calculates events per second for each relay.
func (m *Monitor) calculateRates() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for _, metrics := range m.stats {
		if !metrics.LastEvent.IsZero() {
			elapsed := time.Since(metrics.LastCheck).Seconds()
			if elapsed > 0 {
				metrics.EventsPerSec = float64(metrics.EventCount) / elapsed
				metrics.EventHistory.Add(now.Unix(), metrics.EventsPerSec)
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

// GetRelayHealth returns detailed health information for a specific relay.
func (m *Monitor) GetRelayHealth(url string) *types.RelayHealth {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metrics, exists := m.stats[url]
	if !exists {
		return nil
	}

	// Check pool for connection status
	m.pool.mu.RLock()
	connected := false
	if conn, ok := m.pool.relays[url]; ok {
		connected = conn.Connected
	}
	m.pool.mu.RUnlock()

	// Calculate uptime percentage
	var uptime float64
	if metrics.CheckCount > 0 {
		uptime = float64(metrics.SuccessCount) / float64(metrics.CheckCount) * 100
	}

	return &types.RelayHealth{
		URL:              url,
		Connected:        connected,
		Latency:          metrics.Latency,
		LatencyHistory:   metrics.LatencyHistory.GetAll(),
		EventsPerSec:     metrics.EventsPerSec,
		EventRateHistory: metrics.EventHistory.GetAll(),
		Uptime:           uptime,
		LastSeen:         metrics.LastCheck.Unix(),
		ErrorCount:       metrics.ErrorCount,
		LastError:        metrics.LastError,
	}
}

// GetMonitoringData returns aggregated monitoring data for all relays.
func (m *Monitor) GetMonitoringData() *types.MonitoringData {
	m.mu.RLock()
	defer m.mu.RUnlock()

	relays := make([]types.RelayHealth, 0, len(m.stats))
	var totalEvents int64
	var totalEventsPerSec float64
	connectedCount := 0

	m.pool.mu.RLock()
	for url, metrics := range m.stats {
		connected := false
		if conn, ok := m.pool.relays[url]; ok {
			connected = conn.Connected
			if connected {
				connectedCount++
			}
		}

		var uptime float64
		if metrics.CheckCount > 0 {
			uptime = float64(metrics.SuccessCount) / float64(metrics.CheckCount) * 100
		}

		relays = append(relays, types.RelayHealth{
			URL:              url,
			Connected:        connected,
			Latency:          metrics.Latency,
			LatencyHistory:   metrics.LatencyHistory.GetAll(),
			EventsPerSec:     metrics.EventsPerSec,
			EventRateHistory: metrics.EventHistory.GetAll(),
			Uptime:           uptime,
			LastSeen:         metrics.LastCheck.Unix(),
			ErrorCount:       metrics.ErrorCount,
			LastError:        metrics.LastError,
		})

		totalEvents += metrics.EventCount
		totalEventsPerSec += metrics.EventsPerSec
	}
	m.pool.mu.RUnlock()

	return &types.MonitoringData{
		Relays:         relays,
		TotalEvents:    totalEvents,
		EventsPerSec:   totalEventsPerSec,
		ConnectedCount: connectedCount,
		TotalCount:     len(m.stats),
		Timestamp:      time.Now().Unix(),
	}
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
