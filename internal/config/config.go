// Package config handles loading configuration from .env and agents.yaml
package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config holds all application configuration
type Config struct {
	OpenAIKey    string
	Relays       []string
	WebAddr      string
	AgentsConfig string
	FilterMode   string
	Agents       []AgentConfig
	Workflow     WorkflowConfig
}

// AgentConfig defines a single agent
type AgentConfig struct {
	Name         string `yaml:"name"`
	Role         string `yaml:"role"`
	Kind         int    `yaml:"kind"`
	Description  string `yaml:"description"`
	SystemPrompt string `yaml:"system_prompt"`
	PrivateKey   string `yaml:"private_key,omitempty"`
}

// WorkflowConfig defines agent connections
type WorkflowConfig struct {
	Default []WorkflowStep `yaml:"default"`
}

// WorkflowStep defines a single workflow connection
type WorkflowStep struct {
	From string `yaml:"from"`
	To   string `yaml:"to"`
}

// AgentsFile represents the agents.yaml structure
type AgentsFile struct {
	Agents   []AgentConfig  `yaml:"agents"`
	Workflow WorkflowConfig `yaml:"workflow"`
}

// Load loads configuration from .env and agents.yaml
func Load() (*Config, error) {
	cfg := &Config{
		Relays:       []string{"wss://relay.damus.io", "wss://nos.lol"},
		WebAddr:      ":8080",
		AgentsConfig: "agents.yaml",
		FilterMode:   "trusted",
	}

	// Load .env file if it exists
	if err := loadEnvFile(".env"); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("error loading .env: %w", err)
	}

	// Read from environment
	if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		cfg.OpenAIKey = key
	}

	if relays := os.Getenv("NOSTR_RELAYS"); relays != "" {
		cfg.Relays = parseRelays(relays)
	}

	if addr := os.Getenv("WEB_ADDR"); addr != "" {
		cfg.WebAddr = addr
	}

	if agentsCfg := os.Getenv("AGENTS_CONFIG"); agentsCfg != "" {
		cfg.AgentsConfig = agentsCfg
	}

	if filterMode := os.Getenv("FILTER_MODE"); filterMode != "" {
		cfg.FilterMode = filterMode
	}

	// Load agents configuration
	if err := loadAgentsConfig(cfg); err != nil {
		return nil, fmt.Errorf("error loading agents config: %w", err)
	}

	return cfg, nil
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

func loadAgentsConfig(cfg *Config) error {
	data, err := os.ReadFile(cfg.AgentsConfig)
	if err != nil {
		if os.IsNotExist(err) {
			// Use default agents if config doesn't exist
			cfg.Agents = defaultAgents()
			cfg.Workflow = defaultWorkflow()
			return nil
		}
		return err
	}

	var agentsFile AgentsFile
	if err := yaml.Unmarshal(data, &agentsFile); err != nil {
		return fmt.Errorf("invalid agents.yaml: %w", err)
	}

	cfg.Agents = agentsFile.Agents
	cfg.Workflow = agentsFile.Workflow

	return nil
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

func defaultAgents() []AgentConfig {
	return []AgentConfig{
		{
			Name:        "Shihaisha",
			Role:        "Coordinator",
			Kind:        5001,
			Description: "Task decomposition and routing",
		},
		{
			Name:        "Kenkyusha",
			Role:        "Researcher",
			Kind:        5300,
			Description: "Information gathering",
		},
		{
			Name:        "Sakka",
			Role:        "Writer",
			Kind:        5050,
			Description: "Content generation",
		},
		{
			Name:        "Hihyoka",
			Role:        "Critic",
			Kind:        5051,
			Description: "Quality review",
		},
	}
}

func defaultWorkflow() WorkflowConfig {
	return WorkflowConfig{
		Default: []WorkflowStep{
			{From: "coordinator", To: "researcher"},
			{From: "researcher", To: "writer"},
			{From: "writer", To: "critic"},
			{From: "critic", To: "coordinator"},
		},
	}
}

// GetAgentByKind returns an agent config by its kind number
func (c *Config) GetAgentByKind(kind int) *AgentConfig {
	for i := range c.Agents {
		if c.Agents[i].Kind == kind {
			return &c.Agents[i]
		}
	}
	return nil
}

// GetAgentByName returns an agent config by its name (case-insensitive)
func (c *Config) GetAgentByName(name string) *AgentConfig {
	name = strings.ToLower(name)
	for i := range c.Agents {
		if strings.ToLower(c.Agents[i].Name) == name ||
			strings.ToLower(c.Agents[i].Role) == name {
			return &c.Agents[i]
		}
	}
	return nil
}

// IsMockMode returns true if no OpenAI key is configured
func (c *Config) IsMockMode() bool {
	return c.OpenAIKey == ""
}
