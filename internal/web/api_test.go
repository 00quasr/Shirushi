package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/keanuklestil/shirushi/internal/config"
	"github.com/keanuklestil/shirushi/internal/types"
)

// mockRelayPool is a mock implementation of RelayPool for testing.
type mockRelayPool struct {
	events []types.Event
	err    error
}

func (m *mockRelayPool) Add(url string) error               { return nil }
func (m *mockRelayPool) Remove(url string)                  {}
func (m *mockRelayPool) List() []types.RelayStatus          { return nil }
func (m *mockRelayPool) Stats() map[string]types.RelayStats { return nil }
func (m *mockRelayPool) Count() int                         { return 0 }
func (m *mockRelayPool) Subscribe(kinds []int, authors []string, callback func(types.Event)) string {
	return ""
}
func (m *mockRelayPool) QueryEvents(kindStr, author, limitStr string) ([]types.Event, error) {
	return m.events, m.err
}

func TestHandleProfileLookup_Success(t *testing.T) {
	profileContent := `{"name":"testuser","display_name":"Test User","about":"A test profile","picture":"https://example.com/avatar.png","website":"https://example.com","nip05":"test@example.com","lud16":"test@getalby.com"}`

	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event123",
				Kind:      0,
				PubKey:    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				Content:   profileContent,
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var profile types.Profile
	if err := json.NewDecoder(w.Body).Decode(&profile); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if profile.PubKey != "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" {
		t.Errorf("expected pubkey '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', got '%s'", profile.PubKey)
	}
	if profile.Name != "testuser" {
		t.Errorf("expected name 'testuser', got '%s'", profile.Name)
	}
	if profile.DisplayName != "Test User" {
		t.Errorf("expected display_name 'Test User', got '%s'", profile.DisplayName)
	}
	if profile.About != "A test profile" {
		t.Errorf("expected about 'A test profile', got '%s'", profile.About)
	}
	if profile.Picture != "https://example.com/avatar.png" {
		t.Errorf("expected picture 'https://example.com/avatar.png', got '%s'", profile.Picture)
	}
	if profile.Website != "https://example.com" {
		t.Errorf("expected website 'https://example.com', got '%s'", profile.Website)
	}
	if profile.NIP05 != "test@example.com" {
		t.Errorf("expected nip05 'test@example.com', got '%s'", profile.NIP05)
	}
	if profile.LUD16 != "test@getalby.com" {
		t.Errorf("expected lud16 'test@getalby.com', got '%s'", profile.LUD16)
	}
	if profile.CreatedAt != 1700000000 {
		t.Errorf("expected created_at 1700000000, got %d", profile.CreatedAt)
	}
}

func TestHandleProfileLookup_MissingPubkey(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "pubkey query parameter is required" {
		t.Errorf("expected error message about missing pubkey, got '%s'", resp["error"])
	}
}

func TestHandleProfileLookup_InvalidPubkeyLength(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=tooshort", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "pubkey must be a 64-character hex string" {
		t.Errorf("expected error about pubkey length, got '%s'", resp["error"])
	}
}

func TestHandleProfileLookup_InvalidPubkeyHex(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	// 64 characters but not valid hex (contains 'g')
	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=g234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "pubkey must be a valid hex string" {
		t.Errorf("expected error about invalid hex, got '%s'", resp["error"])
	}
}

func TestHandleProfileLookup_ProfileNotFound(t *testing.T) {
	pool := &mockRelayPool{
		events: []types.Event{}, // No events returned
	}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "profile not found" {
		t.Errorf("expected error 'profile not found', got '%s'", resp["error"])
	}
}

func TestHandleProfileLookup_MethodNotAllowed(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/profile/lookup?pubkey=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestHandleProfileLookup_PartialProfileData(t *testing.T) {
	// Test with minimal profile content (only name)
	profileContent := `{"name":"minimaluser"}`

	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event456",
				Kind:      0,
				PubKey:    "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				Content:   profileContent,
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var profile types.Profile
	if err := json.NewDecoder(w.Body).Decode(&profile); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if profile.Name != "minimaluser" {
		t.Errorf("expected name 'minimaluser', got '%s'", profile.Name)
	}
	// Other fields should be empty
	if profile.DisplayName != "" {
		t.Errorf("expected empty display_name, got '%s'", profile.DisplayName)
	}
	if profile.About != "" {
		t.Errorf("expected empty about, got '%s'", profile.About)
	}
}

func TestHandleProfileLookup_InvalidJSON(t *testing.T) {
	// Test with invalid JSON in content
	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event789",
				Kind:      0,
				PubKey:    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				Content:   "not valid json",
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	// Should still return OK with just the pubkey set
	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var profile types.Profile
	if err := json.NewDecoder(w.Body).Decode(&profile); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if profile.PubKey != "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" {
		t.Errorf("expected pubkey to be set even with invalid content")
	}
	// Other fields should be empty since JSON parsing failed
	if profile.Name != "" {
		t.Errorf("expected empty name when JSON is invalid, got '%s'", profile.Name)
	}
}

func TestHandleProfileLookup_WithBanner(t *testing.T) {
	profileContent := `{"name":"testuser","banner":"https://example.com/banner.jpg"}`

	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event123",
				Kind:      0,
				PubKey:    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				Content:   profileContent,
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var profile types.Profile
	if err := json.NewDecoder(w.Body).Decode(&profile); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if profile.Banner != "https://example.com/banner.jpg" {
		t.Errorf("expected banner 'https://example.com/banner.jpg', got '%s'", profile.Banner)
	}
}

func TestHandleProfileLookup_NIP19WithoutNak(t *testing.T) {
	// Test that npub input without nak available returns appropriate error
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=npub1abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "nak CLI not available for NIP-19 decoding" {
		t.Errorf("expected error about nak unavailable, got '%s'", resp["error"])
	}
}

func TestHandleProfileLookup_NProfileWithoutNak(t *testing.T) {
	// Test that nprofile input without nak available returns appropriate error
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=nprofile1abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestHandleProfileLookup_UppercaseHex(t *testing.T) {
	// Test that uppercase hex is accepted
	profileContent := `{"name":"testuser"}`

	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event123",
				Kind:      0,
				PubKey:    "1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
				Content:   profileContent,
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/lookup?pubkey=1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF", nil)
	w := httptest.NewRecorder()

	api.HandleProfileLookup(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}

// Tests for HandleProfile (path-based endpoint: /api/profile/{pubkey})

func TestHandleProfile_Success(t *testing.T) {
	profileContent := `{"name":"testuser","display_name":"Test User","about":"A test profile","picture":"https://example.com/avatar.png","website":"https://example.com","nip05":"test@example.com","lud16":"test@getalby.com"}`

	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event123",
				Kind:      0,
				PubKey:    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				Content:   profileContent,
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var profile types.Profile
	if err := json.NewDecoder(w.Body).Decode(&profile); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if profile.PubKey != "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" {
		t.Errorf("expected pubkey '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', got '%s'", profile.PubKey)
	}
	if profile.Name != "testuser" {
		t.Errorf("expected name 'testuser', got '%s'", profile.Name)
	}
	if profile.DisplayName != "Test User" {
		t.Errorf("expected display_name 'Test User', got '%s'", profile.DisplayName)
	}
	if profile.About != "A test profile" {
		t.Errorf("expected about 'A test profile', got '%s'", profile.About)
	}
	if profile.Picture != "https://example.com/avatar.png" {
		t.Errorf("expected picture 'https://example.com/avatar.png', got '%s'", profile.Picture)
	}
	if profile.Website != "https://example.com" {
		t.Errorf("expected website 'https://example.com', got '%s'", profile.Website)
	}
	if profile.NIP05 != "test@example.com" {
		t.Errorf("expected nip05 'test@example.com', got '%s'", profile.NIP05)
	}
	if profile.LUD16 != "test@getalby.com" {
		t.Errorf("expected lud16 'test@getalby.com', got '%s'", profile.LUD16)
	}
	if profile.CreatedAt != 1700000000 {
		t.Errorf("expected created_at 1700000000, got %d", profile.CreatedAt)
	}
}

func TestHandleProfile_MissingPubkey(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "pubkey is required in path" {
		t.Errorf("expected error message about missing pubkey, got '%s'", resp["error"])
	}
}

func TestHandleProfile_InvalidPubkeyLength(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/tooshort", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "pubkey must be a 64-character hex string" {
		t.Errorf("expected error about pubkey length, got '%s'", resp["error"])
	}
}

func TestHandleProfile_InvalidPubkeyHex(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	// 64 characters but not valid hex (contains 'g')
	req := httptest.NewRequest(http.MethodGet, "/api/profile/g234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "pubkey must be a valid hex string" {
		t.Errorf("expected error about invalid hex, got '%s'", resp["error"])
	}
}

func TestHandleProfile_ProfileNotFound(t *testing.T) {
	pool := &mockRelayPool{
		events: []types.Event{}, // No events returned
	}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "profile not found" {
		t.Errorf("expected error 'profile not found', got '%s'", resp["error"])
	}
}

func TestHandleProfile_MethodNotAllowed(t *testing.T) {
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/profile/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestHandleProfile_NIP19WithoutNak(t *testing.T) {
	// Test that npub input without nak available returns appropriate error
	pool := &mockRelayPool{}
	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/npub1abcdef", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["error"] != "nak CLI not available for NIP-19 decoding" {
		t.Errorf("expected error about nak unavailable, got '%s'", resp["error"])
	}
}

func TestHandleProfile_UppercaseHex(t *testing.T) {
	// Test that uppercase hex is accepted
	profileContent := `{"name":"testuser"}`

	pool := &mockRelayPool{
		events: []types.Event{
			{
				ID:        "event123",
				Kind:      0,
				PubKey:    "1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
				Content:   profileContent,
				CreatedAt: 1700000000,
			},
		},
	}

	api := NewAPI(&config.Config{}, nil, pool, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/profile/1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF", nil)
	w := httptest.NewRecorder()

	api.HandleProfile(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}
