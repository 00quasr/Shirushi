// Package main tests for Shirushi server startup.
package main

import (
	"context"
	"io"
	"io/fs"
	"net"
	"net/http"
	"testing"
	"testing/fstest"
	"time"

	"github.com/keanuklestil/shirushi/internal/config"
	"github.com/keanuklestil/shirushi/internal/relay"
	shtesting "github.com/keanuklestil/shirushi/internal/testing"
	"github.com/keanuklestil/shirushi/internal/web"
)

// findAvailablePort finds an available port for testing.
func findAvailablePort(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatalf("Failed to find available port: %v", err)
	}
	defer listener.Close()
	return listener.Addr().String()
}

// TestServerStarts verifies that the server starts and responds to requests.
func TestServerStarts(t *testing.T) {
	// Create minimal config
	cfg := &config.Config{
		WebAddr:       findAvailablePort(t),
		DefaultRelays: []string{}, // Empty to avoid connecting to real relays
	}

	// Create components
	relayPool := relay.NewPool(cfg.DefaultRelays)
	defer relayPool.Close()

	testRunner := shtesting.NewRunner(nil, relayPool)
	api := web.NewAPI(cfg, nil, relayPool, testRunner)

	// Create a minimal test filesystem
	testFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<html><body>Test</body></html>"),
		},
	}

	// Create and start server
	server := web.NewServer(cfg.WebAddr, testFS, api)

	// Start server in goroutine
	serverErr := make(chan error, 1)
	go func() {
		serverErr <- server.Start()
	}()

	// Give the server time to start
	time.Sleep(100 * time.Millisecond)

	// Create context with timeout for the test
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Test that the server responds
	url := "http://" + cfg.WebAddr + "/api/status"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to connect to server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("Expected status 200, got %d: %s", resp.StatusCode, string(body))
	}
}

// TestServerServesStaticFiles verifies that static files are served correctly.
func TestServerServesStaticFiles(t *testing.T) {
	cfg := &config.Config{
		WebAddr:       findAvailablePort(t),
		DefaultRelays: []string{},
	}

	relayPool := relay.NewPool(cfg.DefaultRelays)
	defer relayPool.Close()

	testRunner := shtesting.NewRunner(nil, relayPool)
	api := web.NewAPI(cfg, nil, relayPool, testRunner)

	// Create test filesystem with index.html
	expectedContent := "<html><body>Shirushi Test</body></html>"
	testFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte(expectedContent),
		},
	}

	server := web.NewServer(cfg.WebAddr, testFS, api)

	go server.Start()
	time.Sleep(100 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := "http://" + cfg.WebAddr + "/index.html"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to connect to server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	if string(body) != expectedContent {
		t.Errorf("Expected body %q, got %q", expectedContent, string(body))
	}
}

// TestAPIEndpointsAvailable verifies that API endpoints are registered.
func TestAPIEndpointsAvailable(t *testing.T) {
	cfg := &config.Config{
		WebAddr:       findAvailablePort(t),
		DefaultRelays: []string{},
	}

	relayPool := relay.NewPool(cfg.DefaultRelays)
	defer relayPool.Close()

	testRunner := shtesting.NewRunner(nil, relayPool)
	api := web.NewAPI(cfg, nil, relayPool, testRunner)

	testFS := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("test")},
	}

	server := web.NewServer(cfg.WebAddr, testFS, api)

	go server.Start()
	time.Sleep(100 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	endpoints := []string{
		"/api/status",
		"/api/relays",
		"/api/nips",
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint, func(t *testing.T) {
			url := "http://" + cfg.WebAddr + endpoint
			req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("Failed to connect to %s: %v", endpoint, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200 for %s, got %d", endpoint, resp.StatusCode)
			}
		})
	}
}

// testFS implements fs.FS for testing
var _ fs.FS = fstest.MapFS{}
