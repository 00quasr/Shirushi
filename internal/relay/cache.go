// Package relay provides relay connection pool management.
package relay

import (
	"sync"
	"time"

	"github.com/keanuklestil/shirushi/internal/types"
)

// DefaultCacheTTL is the default time-to-live for cached relay info.
const DefaultCacheTTL = 5 * time.Minute

// CachedRelayInfo holds relay info with metadata for cache management.
type CachedRelayInfo struct {
	Info      *types.RelayInfo
	FetchedAt time.Time
	ExpiresAt time.Time
}

// IsExpired returns true if the cached info has expired.
func (c *CachedRelayInfo) IsExpired() bool {
	return time.Now().After(c.ExpiresAt)
}

// RelayInfoCache provides thread-safe caching for NIP-11 relay information.
type RelayInfoCache struct {
	cache map[string]*CachedRelayInfo
	mu    sync.RWMutex
	ttl   time.Duration
}

// NewRelayInfoCache creates a new relay info cache with the specified TTL.
func NewRelayInfoCache(ttl time.Duration) *RelayInfoCache {
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}
	return &RelayInfoCache{
		cache: make(map[string]*CachedRelayInfo),
		ttl:   ttl,
	}
}

// Get retrieves relay info from the cache.
// Returns nil if not found or expired.
func (c *RelayInfoCache) Get(url string) *types.RelayInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[url]
	if !exists {
		return nil
	}

	if entry.IsExpired() {
		return nil
	}

	return entry.Info
}

// GetWithMetadata retrieves relay info with cache metadata.
// Returns nil if not found (does not check expiry).
func (c *RelayInfoCache) GetWithMetadata(url string) *CachedRelayInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[url]
	if !exists {
		return nil
	}

	// Return a copy to prevent mutations
	return &CachedRelayInfo{
		Info:      entry.Info,
		FetchedAt: entry.FetchedAt,
		ExpiresAt: entry.ExpiresAt,
	}
}

// Set stores relay info in the cache.
func (c *RelayInfoCache) Set(url string, info *types.RelayInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	c.cache[url] = &CachedRelayInfo{
		Info:      info,
		FetchedAt: now,
		ExpiresAt: now.Add(c.ttl),
	}
}

// SetWithTTL stores relay info with a custom TTL.
func (c *RelayInfoCache) SetWithTTL(url string, info *types.RelayInfo, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	c.cache[url] = &CachedRelayInfo{
		Info:      info,
		FetchedAt: now,
		ExpiresAt: now.Add(ttl),
	}
}

// Delete removes relay info from the cache.
func (c *RelayInfoCache) Delete(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.cache, url)
}

// Clear removes all entries from the cache.
func (c *RelayInfoCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]*CachedRelayInfo)
}

// CleanExpired removes all expired entries from the cache.
// Returns the number of entries removed.
func (c *RelayInfoCache) CleanExpired() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	removed := 0
	for url, entry := range c.cache {
		if entry.IsExpired() {
			delete(c.cache, url)
			removed++
		}
	}
	return removed
}

// Size returns the number of entries in the cache (including expired).
func (c *RelayInfoCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.cache)
}

// URLs returns all cached relay URLs (including expired).
func (c *RelayInfoCache) URLs() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	urls := make([]string, 0, len(c.cache))
	for url := range c.cache {
		urls = append(urls, url)
	}
	return urls
}

// TTL returns the cache's default TTL.
func (c *RelayInfoCache) TTL() time.Duration {
	return c.ttl
}
