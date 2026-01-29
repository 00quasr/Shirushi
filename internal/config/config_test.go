// Package config tests for configuration loading.
package config

import (
	"os"
	"testing"
)

func TestConfig_ProductionMode(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		wantProd bool
	}{
		{
			name:     "production mode enabled with true",
			envValue: "true",
			wantProd: true,
		},
		{
			name:     "production mode enabled with 1",
			envValue: "1",
			wantProd: true,
		},
		{
			name:     "production mode disabled with false",
			envValue: "false",
			wantProd: false,
		},
		{
			name:     "production mode disabled with empty",
			envValue: "",
			wantProd: false,
		},
		{
			name:     "production mode disabled with 0",
			envValue: "0",
			wantProd: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear and set environment variable
			os.Unsetenv("PRODUCTION")
			if tt.envValue != "" {
				os.Setenv("PRODUCTION", tt.envValue)
			}
			defer os.Unsetenv("PRODUCTION")

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}

			if cfg.Production != tt.wantProd {
				t.Errorf("Production = %v, want %v", cfg.Production, tt.wantProd)
			}
		})
	}
}

func TestConfig_DefaultValues(t *testing.T) {
	// Clear environment variables that might affect defaults
	os.Unsetenv("WEB_ADDR")
	os.Unsetenv("DEFAULT_RELAYS")
	os.Unsetenv("PRODUCTION")
	defer func() {
		os.Unsetenv("WEB_ADDR")
		os.Unsetenv("DEFAULT_RELAYS")
		os.Unsetenv("PRODUCTION")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.WebAddr != ":8080" {
		t.Errorf("WebAddr = %v, want :8080", cfg.WebAddr)
	}

	if cfg.Production != false {
		t.Errorf("Production = %v, want false", cfg.Production)
	}

	if len(cfg.DefaultRelays) != 2 {
		t.Errorf("DefaultRelays length = %v, want 2", len(cfg.DefaultRelays))
	}
}
