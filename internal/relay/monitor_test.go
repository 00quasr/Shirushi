package relay

import (
	"testing"
)

func TestNewTimeSeriesRingBuffer(t *testing.T) {
	// Test with valid size
	rb := NewTimeSeriesRingBuffer(10)
	if rb.Cap() != 10 {
		t.Errorf("expected capacity 10, got %d", rb.Cap())
	}
	if rb.Len() != 0 {
		t.Errorf("expected length 0, got %d", rb.Len())
	}

	// Test with zero size (should use default)
	rb = NewTimeSeriesRingBuffer(0)
	if rb.Cap() != DefaultRingBufferSize {
		t.Errorf("expected default capacity %d, got %d", DefaultRingBufferSize, rb.Cap())
	}

	// Test with negative size (should use default)
	rb = NewTimeSeriesRingBuffer(-5)
	if rb.Cap() != DefaultRingBufferSize {
		t.Errorf("expected default capacity %d, got %d", DefaultRingBufferSize, rb.Cap())
	}
}

func TestTimeSeriesRingBufferAdd(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(5)

	// Add some items
	rb.Add(1000, 10.0)
	rb.Add(1001, 20.0)
	rb.Add(1002, 30.0)

	if rb.Len() != 3 {
		t.Errorf("expected length 3, got %d", rb.Len())
	}

	data := rb.GetAll()
	if len(data) != 3 {
		t.Fatalf("expected 3 items, got %d", len(data))
	}
	if data[0].Timestamp != 1000 || data[0].Value != 10.0 {
		t.Errorf("first item mismatch: got %+v", data[0])
	}
	if data[2].Timestamp != 1002 || data[2].Value != 30.0 {
		t.Errorf("last item mismatch: got %+v", data[2])
	}
}

func TestTimeSeriesRingBufferWrapAround(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(3)

	// Fill the buffer
	rb.Add(1000, 10.0)
	rb.Add(1001, 20.0)
	rb.Add(1002, 30.0)

	if rb.Len() != 3 {
		t.Errorf("expected length 3, got %d", rb.Len())
	}

	// Add more items to trigger wrap-around
	rb.Add(1003, 40.0)
	rb.Add(1004, 50.0)

	if rb.Len() != 3 {
		t.Errorf("expected length 3 after wrap, got %d", rb.Len())
	}

	// Should have the 3 most recent items
	data := rb.GetAll()
	if len(data) != 3 {
		t.Fatalf("expected 3 items after wrap, got %d", len(data))
	}

	// Verify chronological order
	if data[0].Timestamp != 1002 || data[0].Value != 30.0 {
		t.Errorf("first item after wrap mismatch: expected {1002, 30.0}, got %+v", data[0])
	}
	if data[1].Timestamp != 1003 || data[1].Value != 40.0 {
		t.Errorf("second item after wrap mismatch: expected {1003, 40.0}, got %+v", data[1])
	}
	if data[2].Timestamp != 1004 || data[2].Value != 50.0 {
		t.Errorf("third item after wrap mismatch: expected {1004, 50.0}, got %+v", data[2])
	}
}

func TestTimeSeriesRingBufferGetAll(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(5)

	// Empty buffer
	data := rb.GetAll()
	if data != nil {
		t.Errorf("expected nil for empty buffer, got %v", data)
	}

	// Partially filled buffer
	rb.Add(1000, 10.0)
	rb.Add(1001, 20.0)
	data = rb.GetAll()
	if len(data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(data))
	}
	if data[0].Timestamp != 1000 {
		t.Errorf("expected first timestamp 1000, got %d", data[0].Timestamp)
	}
	if data[1].Timestamp != 1001 {
		t.Errorf("expected second timestamp 1001, got %d", data[1].Timestamp)
	}
}

func TestTimeSeriesRingBufferGetLast(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(5)

	// Empty buffer
	data := rb.GetLast(3)
	if data != nil {
		t.Errorf("expected nil for empty buffer, got %v", data)
	}

	// Add items
	rb.Add(1000, 10.0)
	rb.Add(1001, 20.0)
	rb.Add(1002, 30.0)
	rb.Add(1003, 40.0)

	// Get last 2
	data = rb.GetLast(2)
	if len(data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(data))
	}
	if data[0].Timestamp != 1002 || data[0].Value != 30.0 {
		t.Errorf("GetLast(2)[0] mismatch: expected {1002, 30.0}, got %+v", data[0])
	}
	if data[1].Timestamp != 1003 || data[1].Value != 40.0 {
		t.Errorf("GetLast(2)[1] mismatch: expected {1003, 40.0}, got %+v", data[1])
	}

	// Get last 10 (more than buffer has)
	data = rb.GetLast(10)
	if len(data) != 4 {
		t.Fatalf("expected 4 items (all), got %d", len(data))
	}

	// Get last 0 (should return nil)
	data = rb.GetLast(0)
	if data != nil {
		t.Errorf("expected nil for n=0, got %v", data)
	}

	// Get last -1 (should return nil)
	data = rb.GetLast(-1)
	if data != nil {
		t.Errorf("expected nil for n=-1, got %v", data)
	}
}

func TestTimeSeriesRingBufferGetLastAfterWrap(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(3)

	// Fill and wrap
	rb.Add(1000, 10.0)
	rb.Add(1001, 20.0)
	rb.Add(1002, 30.0)
	rb.Add(1003, 40.0)
	rb.Add(1004, 50.0)

	// Get last 2
	data := rb.GetLast(2)
	if len(data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(data))
	}
	if data[0].Timestamp != 1003 || data[0].Value != 40.0 {
		t.Errorf("GetLast(2)[0] after wrap mismatch: expected {1003, 40.0}, got %+v", data[0])
	}
	if data[1].Timestamp != 1004 || data[1].Value != 50.0 {
		t.Errorf("GetLast(2)[1] after wrap mismatch: expected {1004, 50.0}, got %+v", data[1])
	}
}

func TestTimeSeriesRingBufferClear(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(5)

	rb.Add(1000, 10.0)
	rb.Add(1001, 20.0)
	rb.Add(1002, 30.0)

	if rb.Len() != 3 {
		t.Errorf("expected length 3 before clear, got %d", rb.Len())
	}

	rb.Clear()

	if rb.Len() != 0 {
		t.Errorf("expected length 0 after clear, got %d", rb.Len())
	}
	if rb.Cap() != 5 {
		t.Errorf("expected capacity unchanged after clear, got %d", rb.Cap())
	}

	data := rb.GetAll()
	if data != nil {
		t.Errorf("expected nil data after clear, got %v", data)
	}
}

func TestTimeSeriesRingBufferStress(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(100)

	// Add 1000 items
	for i := 0; i < 1000; i++ {
		rb.Add(int64(i), float64(i*2))
	}

	if rb.Len() != 100 {
		t.Errorf("expected length 100, got %d", rb.Len())
	}

	data := rb.GetAll()
	if len(data) != 100 {
		t.Fatalf("expected 100 items, got %d", len(data))
	}

	// Verify we have the last 100 items (900-999)
	if data[0].Timestamp != 900 {
		t.Errorf("expected first timestamp 900, got %d", data[0].Timestamp)
	}
	if data[99].Timestamp != 999 {
		t.Errorf("expected last timestamp 999, got %d", data[99].Timestamp)
	}

	// Verify chronological order
	for i := 1; i < len(data); i++ {
		if data[i].Timestamp <= data[i-1].Timestamp {
			t.Errorf("data not in chronological order at index %d", i)
			break
		}
	}
}

func TestTimeSeriesRingBufferSingleItem(t *testing.T) {
	rb := NewTimeSeriesRingBuffer(1)

	rb.Add(1000, 10.0)
	if rb.Len() != 1 {
		t.Errorf("expected length 1, got %d", rb.Len())
	}

	rb.Add(1001, 20.0)
	if rb.Len() != 1 {
		t.Errorf("expected length 1 after overwrite, got %d", rb.Len())
	}

	data := rb.GetAll()
	if len(data) != 1 {
		t.Fatalf("expected 1 item, got %d", len(data))
	}
	if data[0].Timestamp != 1001 || data[0].Value != 20.0 {
		t.Errorf("expected {1001, 20.0}, got %+v", data[0])
	}
}

func TestNewMonitorWithBufferSize(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}

	// Default monitor
	m := NewMonitor(pool)
	if m.ringBufferSize != DefaultRingBufferSize {
		t.Errorf("expected default buffer size %d, got %d", DefaultRingBufferSize, m.ringBufferSize)
	}

	// Custom buffer size
	m = NewMonitorWithBufferSize(pool, 50)
	if m.ringBufferSize != 50 {
		t.Errorf("expected buffer size 50, got %d", m.ringBufferSize)
	}
}

func TestMonitorNewRelayMetrics(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitorWithBufferSize(pool, 25)

	metrics := m.newRelayMetrics("wss://test.relay.com")

	if metrics.URL != "wss://test.relay.com" {
		t.Errorf("expected URL wss://test.relay.com, got %s", metrics.URL)
	}
	if metrics.LatencyHistory == nil {
		t.Error("LatencyHistory should not be nil")
	}
	if metrics.LatencyHistory.Cap() != 25 {
		t.Errorf("expected LatencyHistory capacity 25, got %d", metrics.LatencyHistory.Cap())
	}
	if metrics.EventHistory == nil {
		t.Error("EventHistory should not be nil")
	}
	if metrics.EventHistory.Cap() != 25 {
		t.Errorf("expected EventHistory capacity 25, got %d", metrics.EventHistory.Cap())
	}
}

func TestMonitorRecordEvent(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	url := "wss://test.relay.com"

	// Record first event
	m.RecordEvent(url)

	m.mu.RLock()
	metrics, exists := m.stats[url]
	m.mu.RUnlock()

	if !exists {
		t.Fatal("metrics should exist after RecordEvent")
	}
	if metrics.EventCount != 1 {
		t.Errorf("expected EventCount 1, got %d", metrics.EventCount)
	}
	if metrics.LastEvent.IsZero() {
		t.Error("LastEvent should not be zero")
	}

	// Record more events
	m.RecordEvent(url)
	m.RecordEvent(url)

	m.mu.RLock()
	if m.stats[url].EventCount != 3 {
		t.Errorf("expected EventCount 3, got %d", m.stats[url].EventCount)
	}
	m.mu.RUnlock()
}

func TestMonitorGetStats(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	// Setup some metrics directly
	m.mu.Lock()
	m.stats["wss://relay1.com"] = &relayMetrics{
		URL:            "wss://relay1.com",
		Latency:        100,
		EventCount:     50,
		EventsPerSec:   5.0,
		LatencyHistory: NewTimeSeriesRingBuffer(m.ringBufferSize),
		EventHistory:   NewTimeSeriesRingBuffer(m.ringBufferSize),
	}
	m.stats["wss://relay2.com"] = &relayMetrics{
		URL:            "wss://relay2.com",
		Latency:        200,
		EventCount:     100,
		EventsPerSec:   10.0,
		LatencyHistory: NewTimeSeriesRingBuffer(m.ringBufferSize),
		EventHistory:   NewTimeSeriesRingBuffer(m.ringBufferSize),
	}
	m.mu.Unlock()

	stats := m.GetStats()

	if len(stats) != 2 {
		t.Fatalf("expected 2 stats entries, got %d", len(stats))
	}

	s1 := stats["wss://relay1.com"]
	if s1.Latency != 100 {
		t.Errorf("expected relay1 latency 100, got %d", s1.Latency)
	}
	if s1.TotalEvents != 50 {
		t.Errorf("expected relay1 total events 50, got %d", s1.TotalEvents)
	}
	if s1.EventsPerSec != 5.0 {
		t.Errorf("expected relay1 events/sec 5.0, got %f", s1.EventsPerSec)
	}

	s2 := stats["wss://relay2.com"]
	if s2.Latency != 200 {
		t.Errorf("expected relay2 latency 200, got %d", s2.Latency)
	}
}

func TestMonitorGetRelayLatency(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	// Non-existent relay
	latency := m.GetRelayLatency("wss://nonexistent.com")
	if latency != -1 {
		t.Errorf("expected -1 for non-existent relay, got %d", latency)
	}

	// Add metrics
	m.mu.Lock()
	m.stats["wss://test.relay.com"] = &relayMetrics{
		URL:            "wss://test.relay.com",
		Latency:        150,
		LatencyHistory: NewTimeSeriesRingBuffer(m.ringBufferSize),
		EventHistory:   NewTimeSeriesRingBuffer(m.ringBufferSize),
	}
	m.mu.Unlock()

	latency = m.GetRelayLatency("wss://test.relay.com")
	if latency != 150 {
		t.Errorf("expected latency 150, got %d", latency)
	}
}

func TestMonitorGetRelayHealth(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	// Non-existent relay
	health := m.GetRelayHealth("wss://nonexistent.com")
	if health != nil {
		t.Error("expected nil for non-existent relay")
	}

	// Add relay to pool and metrics
	pool.mu.Lock()
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
	}
	pool.mu.Unlock()

	m.mu.Lock()
	metrics := m.newRelayMetrics("wss://test.relay.com")
	metrics.Latency = 100
	metrics.EventsPerSec = 5.0
	metrics.CheckCount = 10
	metrics.SuccessCount = 9
	metrics.ErrorCount = 1
	metrics.LastError = "temporary error"
	metrics.LatencyHistory.Add(1000, 90.0)
	metrics.LatencyHistory.Add(1001, 100.0)
	m.stats["wss://test.relay.com"] = metrics
	m.mu.Unlock()

	health = m.GetRelayHealth("wss://test.relay.com")
	if health == nil {
		t.Fatal("expected health data")
	}
	if health.URL != "wss://test.relay.com" {
		t.Errorf("expected URL wss://test.relay.com, got %s", health.URL)
	}
	if !health.Connected {
		t.Error("expected connected to be true")
	}
	if health.Latency != 100 {
		t.Errorf("expected latency 100, got %d", health.Latency)
	}
	if health.EventsPerSec != 5.0 {
		t.Errorf("expected events/sec 5.0, got %f", health.EventsPerSec)
	}
	if health.Uptime != 90.0 {
		t.Errorf("expected uptime 90.0, got %f", health.Uptime)
	}
	if health.ErrorCount != 1 {
		t.Errorf("expected error count 1, got %d", health.ErrorCount)
	}
	if health.LastError != "temporary error" {
		t.Errorf("expected last error 'temporary error', got '%s'", health.LastError)
	}
	if len(health.LatencyHistory) != 2 {
		t.Errorf("expected 2 latency history points, got %d", len(health.LatencyHistory))
	}
}

func TestMonitorGetMonitoringData(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	// Add relays to pool
	pool.mu.Lock()
	pool.relays["wss://relay1.com"] = &RelayConn{
		URL:       "wss://relay1.com",
		Connected: true,
	}
	pool.relays["wss://relay2.com"] = &RelayConn{
		URL:       "wss://relay2.com",
		Connected: false,
		Error:     "connection lost",
	}
	pool.mu.Unlock()

	// Add metrics
	m.mu.Lock()
	m1 := m.newRelayMetrics("wss://relay1.com")
	m1.Latency = 100
	m1.EventCount = 50
	m1.EventsPerSec = 5.0
	m1.CheckCount = 10
	m1.SuccessCount = 10
	m.stats["wss://relay1.com"] = m1

	m2 := m.newRelayMetrics("wss://relay2.com")
	m2.Latency = 200
	m2.EventCount = 30
	m2.EventsPerSec = 3.0
	m2.CheckCount = 10
	m2.SuccessCount = 7
	m2.ErrorCount = 3
	m2.LastError = "timeout"
	m.stats["wss://relay2.com"] = m2
	m.mu.Unlock()

	data := m.GetMonitoringData()

	if data == nil {
		t.Fatal("expected monitoring data")
	}
	if data.TotalCount != 2 {
		t.Errorf("expected total count 2, got %d", data.TotalCount)
	}
	if data.ConnectedCount != 1 {
		t.Errorf("expected connected count 1, got %d", data.ConnectedCount)
	}
	if data.TotalEvents != 80 {
		t.Errorf("expected total events 80, got %d", data.TotalEvents)
	}
	if data.EventsPerSec != 8.0 {
		t.Errorf("expected events/sec 8.0, got %f", data.EventsPerSec)
	}
	if len(data.Relays) != 2 {
		t.Fatalf("expected 2 relays, got %d", len(data.Relays))
	}
	if data.Timestamp == 0 {
		t.Error("expected non-zero timestamp")
	}
}

func TestCalculateLatencyScore(t *testing.T) {
	tests := []struct {
		name     string
		latency  int64
		expected float64
	}{
		{"zero latency", 0, 0},
		{"negative latency", -1, 0},
		{"very fast (50ms)", 50, 100.0},
		{"fast (100ms)", 100, 100.0},
		{"medium (300ms)", 300, 75.0},
		{"slow (500ms)", 500, 50.0},
		{"very slow (1250ms)", 1250, 25.0},
		{"timeout (2000ms)", 2000, 0.0},
		{"beyond timeout (3000ms)", 3000, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := calculateLatencyScore(tt.latency)
			if score != tt.expected {
				t.Errorf("calculateLatencyScore(%d) = %f, want %f", tt.latency, score, tt.expected)
			}
		})
	}
}

func TestCalculateErrorScore(t *testing.T) {
	tests := []struct {
		name       string
		errorCount int
		expected   float64
	}{
		{"no errors", 0, 100.0},
		{"negative errors", -1, 100.0},
		{"1 error", 1, 90.0},
		{"5 errors", 5, 50.0},
		{"10 errors", 10, 33.333333333333336},
		{"20 errors", 20, 0.0},
		{"many errors", 50, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := calculateErrorScore(tt.errorCount)
			if score != tt.expected {
				t.Errorf("calculateErrorScore(%d) = %f, want %f", tt.errorCount, score, tt.expected)
			}
		})
	}
}

func TestCalculateHealthScore(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	tests := []struct {
		name       string
		metrics    *relayMetrics
		connected  bool
		minScore   float64
		maxScore   float64
	}{
		{
			name: "perfect health - connected, fast, no errors",
			metrics: &relayMetrics{
				Latency:      50,
				CheckCount:   100,
				SuccessCount: 100,
				ErrorCount:   0,
			},
			connected: true,
			minScore:  99.0,
			maxScore:  100.0,
		},
		{
			name: "good health - connected, moderate latency",
			metrics: &relayMetrics{
				Latency:      200,
				CheckCount:   100,
				SuccessCount: 95,
				ErrorCount:   2,
			},
			connected: true,
			minScore:  75.0,
			maxScore:  95.0,
		},
		{
			name: "poor health - disconnected, high latency, errors",
			metrics: &relayMetrics{
				Latency:      1500,
				CheckCount:   100,
				SuccessCount: 50,
				ErrorCount:   15,
			},
			connected: false,
			minScore:  10.0,
			maxScore:  40.0,
		},
		{
			name: "zero health - disconnected, timeout, many errors",
			metrics: &relayMetrics{
				Latency:      3000,
				CheckCount:   100,
				SuccessCount: 0,
				ErrorCount:   50,
			},
			connected: false,
			minScore:  0.0,
			maxScore:  5.0,
		},
		{
			name: "no checks yet - new relay (connected, no latency data, no uptime data, no errors)",
			metrics: &relayMetrics{
				Latency:      0,
				CheckCount:   0,
				SuccessCount: 0,
				ErrorCount:   0,
			},
			connected: true,
			minScore:  50.0, // 30% connection + 0% latency + 0% uptime + 20% no errors = 50%
			maxScore:  50.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := m.CalculateHealthScore(tt.metrics, tt.connected)
			if score < tt.minScore || score > tt.maxScore {
				t.Errorf("CalculateHealthScore() = %f, want between %f and %f", score, tt.minScore, tt.maxScore)
			}
		})
	}
}

func TestGetRelayHealthIncludesHealthScore(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	// Add relay to pool
	pool.mu.Lock()
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
	}
	pool.mu.Unlock()

	// Add metrics
	m.mu.Lock()
	metrics := m.newRelayMetrics("wss://test.relay.com")
	metrics.Latency = 50
	metrics.CheckCount = 100
	metrics.SuccessCount = 100
	metrics.ErrorCount = 0
	m.stats["wss://test.relay.com"] = metrics
	m.mu.Unlock()

	health := m.GetRelayHealth("wss://test.relay.com")
	if health == nil {
		t.Fatal("expected health data")
	}

	// Should have a high health score (connected, fast, no errors, 100% uptime)
	if health.HealthScore < 95.0 {
		t.Errorf("expected high health score (>=95), got %f", health.HealthScore)
	}
}

func TestGetMonitoringDataIncludesHealthScore(t *testing.T) {
	pool := &Pool{
		relays: make(map[string]*RelayConn),
	}
	m := NewMonitor(pool)

	// Add relay to pool
	pool.mu.Lock()
	pool.relays["wss://test.relay.com"] = &RelayConn{
		URL:       "wss://test.relay.com",
		Connected: true,
	}
	pool.mu.Unlock()

	// Add metrics
	m.mu.Lock()
	metrics := m.newRelayMetrics("wss://test.relay.com")
	metrics.Latency = 50
	metrics.CheckCount = 100
	metrics.SuccessCount = 100
	metrics.ErrorCount = 0
	m.stats["wss://test.relay.com"] = metrics
	m.mu.Unlock()

	data := m.GetMonitoringData()
	if data == nil {
		t.Fatal("expected monitoring data")
	}
	if len(data.Relays) != 1 {
		t.Fatalf("expected 1 relay, got %d", len(data.Relays))
	}

	// Should have a high health score
	if data.Relays[0].HealthScore < 95.0 {
		t.Errorf("expected high health score (>=95), got %f", data.Relays[0].HealthScore)
	}
}
