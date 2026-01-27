// Package ai provides AI inference capabilities for agents.
package ai

import "context"

// Provider defines the interface for AI inference providers.
type Provider interface {
	// Complete generates a completion for the given prompt with a system message.
	Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error)
	// Name returns the provider name for logging.
	Name() string
}

// Message represents a chat message.
type Message struct {
	Role    string `json:"role"` // "system", "user", "assistant"
	Content string `json:"content"`
}

// CompletionRequest represents a completion request.
type CompletionRequest struct {
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}
