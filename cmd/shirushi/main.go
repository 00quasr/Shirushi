// Package main is the entry point for Shirushi - Nostr Protocol Explorer.
package main

import (
	"context"
	"flag"
	"io/fs"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/keanuklestil/shirushi/internal/config"
	"github.com/keanuklestil/shirushi/internal/nak"
	"github.com/keanuklestil/shirushi/internal/relay"
	"github.com/keanuklestil/shirushi/internal/testing"
	"github.com/keanuklestil/shirushi/internal/web"
)

func main() {
	flag.Parse()

	log.SetFlags(log.Ltime | log.Lmicroseconds)
	log.Println("Shirushi - Nostr Protocol Explorer")
	log.Println("===================================")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("\nShutting down...")
		cancel()
	}()

	// Initialize nak CLI wrapper
	var nakClient *nak.Nak
	if cfg.HasNak() {
		nakClient = nak.New(cfg.NakPath)
		version, err := nakClient.Version()
		if err != nil {
			log.Printf("[nak] Found at %s (version check failed: %v)", cfg.NakPath, err)
		} else {
			log.Printf("[nak] Found at %s (%s)", cfg.NakPath, version)
		}
	} else {
		log.Println("[nak] CLI not found - some features will be limited")
		log.Println("[nak] Install from: https://github.com/fiatjaf/nak")
	}

	// Initialize relay pool
	relayPool := relay.NewPool(cfg.DefaultRelays)
	log.Printf("[Relays] Default: %v", cfg.DefaultRelays)

	// Initialize test runner
	testRunner := testing.NewRunner(nakClient, relayPool)
	log.Printf("[Testing] %d NIP tests available", len(testRunner.ListTests()))

	// Create API handler
	api := web.NewAPI(cfg, nakClient, relayPool, testRunner)

	// Start web server
	webFS, _ := fs.Sub(os.DirFS("web"), ".")
	server := web.NewServer(cfg.WebAddr, webFS, api)

	log.Printf("[Web] Dashboard: http://localhost%s", cfg.WebAddr)
	log.Println()
	log.Println("Ready! Open the dashboard in your browser.")

	// Start server (blocks)
	go func() {
		if err := server.Start(); err != nil {
			log.Fatalf("[Web] Server error: %v", err)
		}
	}()

	// Wait for shutdown
	<-ctx.Done()
	relayPool.Close()
	log.Println("Shutdown complete")
}
