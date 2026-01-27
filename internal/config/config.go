// Package config handles loading configuration from .env
package config

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Config holds all application configuration
type Config struct {
	NakPath       string
	WebAddr       string
	DefaultRelays []string
}

// RelayPresets defines preset relay groups (all free public relays)
var RelayPresets = map[string][]string{
	"popular": {"wss://relay.damus.io", "wss://nos.lol", "wss://relay.nostr.band"},
	"fast":    {"wss://relay.primal.net", "wss://nostr.mom"},
	"dvms":    {"wss://relay.damus.io", "wss://relay.nostr.band"},
	"privacy": {"wss://nostr.oxtr.dev"},
}

// Load loads configuration from .env
func Load() (*Config, error) {
	cfg := &Config{
		WebAddr:       ":8080",
		DefaultRelays: []string{"wss://relay.damus.io", "wss://nos.lol"},
	}

	// Load .env file if it exists
	if err := loadEnvFile(".env"); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("error loading .env: %w", err)
	}

	// Read from environment
	if nakPath := os.Getenv("NAK_PATH"); nakPath != "" {
		cfg.NakPath = nakPath
	} else {
		// Try to find nak in PATH
		cfg.NakPath = findNak()
	}

	if addr := os.Getenv("WEB_ADDR"); addr != "" {
		cfg.WebAddr = addr
	}

	if relays := os.Getenv("DEFAULT_RELAYS"); relays != "" {
		cfg.DefaultRelays = parseRelays(relays)
	}

	return cfg, nil
}

// findNak attempts to locate the nak binary
func findNak() string {
	// Check common locations
	paths := []string{
		"/usr/local/bin/nak",
		"/usr/bin/nak",
		"/opt/homebrew/bin/nak",
	}

	// Add home go/bin path
	if home, err := os.UserHomeDir(); err == nil {
		paths = append(paths, home+"/go/bin/nak")
	}

	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	// Try to find in PATH
	if path, err := exec.LookPath("nak"); err == nil {
		return path
	}

	return ""
}

// HasNak returns true if nak CLI is available
func (c *Config) HasNak() bool {
	return c.NakPath != ""
}

func loadEnvFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Parse KEY=value
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}

		// Only set if not already set in environment
		if os.Getenv(key) == "" && value != "" {
			os.Setenv(key, value)
		}
	}

	return scanner.Err()
}

func parseRelays(relaysStr string) []string {
	var relays []string
	for _, r := range strings.Split(relaysStr, ",") {
		r = strings.TrimSpace(r)
		if r != "" {
			relays = append(relays, r)
		}
	}
	return relays
}
