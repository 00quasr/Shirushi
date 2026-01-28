package relay

import (
	"testing"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
)

func TestNewRelayInfoCache(t *testing.T) {
	t.Run("with positive TTL", func(t *testing.T) {
		cache := NewRelayInfoCache(10 * time.Minute)
		if cache.TTL() != 10*time.Minute {
			t.Errorf("expected TTL of 10m, got %v", cache.TTL())
		}
	})

	t.Run("with zero TTL uses default", func(t *testing.T) {
		cache := NewRelayInfoCache(0)
		if cache.TTL() != DefaultCacheTTL {
			t.Errorf("expected default TTL %v, got %v", DefaultCacheTTL, cache.TTL())
		}
	})

	t.Run("with negative TTL uses default", func(t *testing.T) {
		cache := NewRelayInfoCache(-1 * time.Minute)
		if cache.TTL() != DefaultCacheTTL {
			t.Errorf("expected default TTL %v, got %v", DefaultCacheTTL, cache.TTL())
		}
	})
}

func TestRelayInfoCache_SetAndGet(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	info := &types.RelayInfo{
		Name:        "Test Relay",
		Description: "A test relay",
	}

	cache.Set("wss://test.relay", info)

	// Get should return the cached info
	got := cache.Get("wss://test.relay")
	if got == nil {
		t.Fatal("expected cached info, got nil")
	}
	if got.Name != "Test Relay" {
		t.Errorf("expected name 'Test Relay', got '%s'", got.Name)
	}
}

func TestRelayInfoCache_GetNonExistent(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	got := cache.Get("wss://nonexistent.relay")
	if got != nil {
		t.Errorf("expected nil for non-existent relay, got %+v", got)
	}
}

func TestRelayInfoCache_Expiry(t *testing.T) {
	// Use a very short TTL for testing
	cache := NewRelayInfoCache(10 * time.Millisecond)

	info := &types.RelayInfo{
		Name: "Expiring Relay",
	}

	cache.Set("wss://test.relay", info)

	// Should be available immediately
	if got := cache.Get("wss://test.relay"); got == nil {
		t.Fatal("expected cached info immediately after set")
	}

	// Wait for expiry
	time.Sleep(20 * time.Millisecond)

	// Should be expired now
	if got := cache.Get("wss://test.relay"); got != nil {
		t.Errorf("expected nil for expired entry, got %+v", got)
	}
}

func TestRelayInfoCache_GetWithMetadata(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	info := &types.RelayInfo{
		Name: "Metadata Test",
	}

	before := time.Now()
	cache.Set("wss://test.relay", info)
	after := time.Now()

	meta := cache.GetWithMetadata("wss://test.relay")
	if meta == nil {
		t.Fatal("expected metadata, got nil")
	}

	if meta.FetchedAt.Before(before) || meta.FetchedAt.After(after) {
		t.Errorf("FetchedAt %v outside expected range [%v, %v]", meta.FetchedAt, before, after)
	}

	expectedExpiry := meta.FetchedAt.Add(5 * time.Minute)
	if !meta.ExpiresAt.Equal(expectedExpiry) {
		t.Errorf("expected ExpiresAt %v, got %v", expectedExpiry, meta.ExpiresAt)
	}

	if meta.Info.Name != "Metadata Test" {
		t.Errorf("expected name 'Metadata Test', got '%s'", meta.Info.Name)
	}
}

func TestRelayInfoCache_GetWithMetadata_NonExistent(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	meta := cache.GetWithMetadata("wss://nonexistent.relay")
	if meta != nil {
		t.Errorf("expected nil for non-existent relay, got %+v", meta)
	}
}

func TestRelayInfoCache_SetWithTTL(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	info := &types.RelayInfo{
		Name: "Custom TTL",
	}

	// Set with a very short custom TTL
	cache.SetWithTTL("wss://test.relay", info, 10*time.Millisecond)

	// Should be available immediately
	if got := cache.Get("wss://test.relay"); got == nil {
		t.Fatal("expected cached info immediately after set")
	}

	// Wait for expiry
	time.Sleep(20 * time.Millisecond)

	// Should be expired now
	if got := cache.Get("wss://test.relay"); got != nil {
		t.Errorf("expected nil for expired entry, got %+v", got)
	}
}

func TestRelayInfoCache_Delete(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	info := &types.RelayInfo{
		Name: "To Delete",
	}

	cache.Set("wss://test.relay", info)

	// Verify it exists
	if got := cache.Get("wss://test.relay"); got == nil {
		t.Fatal("expected cached info before delete")
	}

	cache.Delete("wss://test.relay")

	// Should be gone
	if got := cache.Get("wss://test.relay"); got != nil {
		t.Errorf("expected nil after delete, got %+v", got)
	}
}

func TestRelayInfoCache_Delete_NonExistent(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	// Should not panic
	cache.Delete("wss://nonexistent.relay")
}

func TestRelayInfoCache_Clear(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	cache.Set("wss://relay1.test", &types.RelayInfo{Name: "Relay 1"})
	cache.Set("wss://relay2.test", &types.RelayInfo{Name: "Relay 2"})
	cache.Set("wss://relay3.test", &types.RelayInfo{Name: "Relay 3"})

	if cache.Size() != 3 {
		t.Errorf("expected size 3, got %d", cache.Size())
	}

	cache.Clear()

	if cache.Size() != 0 {
		t.Errorf("expected size 0 after clear, got %d", cache.Size())
	}
}

func TestRelayInfoCache_CleanExpired(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	// Add some entries with short TTL
	cache.SetWithTTL("wss://expired1.test", &types.RelayInfo{Name: "Expired 1"}, 10*time.Millisecond)
	cache.SetWithTTL("wss://expired2.test", &types.RelayInfo{Name: "Expired 2"}, 10*time.Millisecond)

	// Add some entries with long TTL
	cache.Set("wss://valid1.test", &types.RelayInfo{Name: "Valid 1"})
	cache.Set("wss://valid2.test", &types.RelayInfo{Name: "Valid 2"})

	if cache.Size() != 4 {
		t.Errorf("expected size 4, got %d", cache.Size())
	}

	// Wait for short TTL entries to expire
	time.Sleep(20 * time.Millisecond)

	removed := cache.CleanExpired()
	if removed != 2 {
		t.Errorf("expected 2 removed, got %d", removed)
	}

	if cache.Size() != 2 {
		t.Errorf("expected size 2 after cleanup, got %d", cache.Size())
	}

	// Valid entries should still be accessible
	if got := cache.Get("wss://valid1.test"); got == nil {
		t.Error("expected valid1 to still be cached")
	}
	if got := cache.Get("wss://valid2.test"); got == nil {
		t.Error("expected valid2 to still be cached")
	}
}

func TestRelayInfoCache_Size(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	if cache.Size() != 0 {
		t.Errorf("expected size 0 for empty cache, got %d", cache.Size())
	}

	cache.Set("wss://relay1.test", &types.RelayInfo{Name: "Relay 1"})
	if cache.Size() != 1 {
		t.Errorf("expected size 1, got %d", cache.Size())
	}

	cache.Set("wss://relay2.test", &types.RelayInfo{Name: "Relay 2"})
	if cache.Size() != 2 {
		t.Errorf("expected size 2, got %d", cache.Size())
	}

	// Overwrite existing entry
	cache.Set("wss://relay1.test", &types.RelayInfo{Name: "Relay 1 Updated"})
	if cache.Size() != 2 {
		t.Errorf("expected size 2 after overwrite, got %d", cache.Size())
	}
}

func TestRelayInfoCache_URLs(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	cache.Set("wss://relay1.test", &types.RelayInfo{Name: "Relay 1"})
	cache.Set("wss://relay2.test", &types.RelayInfo{Name: "Relay 2"})

	urls := cache.URLs()
	if len(urls) != 2 {
		t.Errorf("expected 2 URLs, got %d", len(urls))
	}

	// Check that both URLs are present (order not guaranteed)
	urlMap := make(map[string]bool)
	for _, url := range urls {
		urlMap[url] = true
	}

	if !urlMap["wss://relay1.test"] {
		t.Error("expected relay1 URL in list")
	}
	if !urlMap["wss://relay2.test"] {
		t.Error("expected relay2 URL in list")
	}
}

func TestRelayInfoCache_Overwrite(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)

	cache.Set("wss://test.relay", &types.RelayInfo{Name: "Original"})

	// Overwrite with new info
	cache.Set("wss://test.relay", &types.RelayInfo{Name: "Updated"})

	got := cache.Get("wss://test.relay")
	if got == nil {
		t.Fatal("expected cached info after overwrite")
	}
	if got.Name != "Updated" {
		t.Errorf("expected name 'Updated', got '%s'", got.Name)
	}
}

func TestCachedRelayInfo_IsExpired(t *testing.T) {
	t.Run("not expired", func(t *testing.T) {
		entry := &CachedRelayInfo{
			Info:      &types.RelayInfo{Name: "Test"},
			FetchedAt: time.Now(),
			ExpiresAt: time.Now().Add(5 * time.Minute),
		}
		if entry.IsExpired() {
			t.Error("expected entry to not be expired")
		}
	})

	t.Run("expired", func(t *testing.T) {
		entry := &CachedRelayInfo{
			Info:      &types.RelayInfo{Name: "Test"},
			FetchedAt: time.Now().Add(-10 * time.Minute),
			ExpiresAt: time.Now().Add(-5 * time.Minute),
		}
		if !entry.IsExpired() {
			t.Error("expected entry to be expired")
		}
	})
}

func TestRelayInfoCache_ConcurrentAccess(t *testing.T) {
	cache := NewRelayInfoCache(5 * time.Minute)
	done := make(chan bool)

	// Start multiple goroutines doing concurrent operations
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				url := "wss://test.relay"
				cache.Set(url, &types.RelayInfo{Name: "Test"})
				cache.Get(url)
				cache.GetWithMetadata(url)
				cache.Size()
				cache.URLs()
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}
