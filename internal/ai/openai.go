package ai

import (
	"context"
	"fmt"
	"os"

	openai "github.com/sashabaranov/go-openai"
)

// OpenAIProvider implements the Provider interface using OpenAI's API.
type OpenAIProvider struct {
	client *openai.Client
	model  string
}

// NewOpenAIProvider creates a new OpenAI provider.
// It reads the API key from the OPENAI_API_KEY environment variable.
func NewOpenAIProvider() (*OpenAIProvider, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	client := openai.NewClient(apiKey)
	return &OpenAIProvider{
		client: client,
		model:  openai.GPT4o, // Using GPT-4o as default
	}, nil
}

// NewOpenAIProviderWithKey creates a new OpenAI provider with an explicit API key.
func NewOpenAIProviderWithKey(apiKey string) *OpenAIProvider {
	client := openai.NewClient(apiKey)
	return &OpenAIProvider{
		client: client,
		model:  openai.GPT4o,
	}
}

// SetModel sets the model to use for completions.
func (p *OpenAIProvider) SetModel(model string) {
	p.model = model
}

// Complete generates a completion using OpenAI's chat API.
func (p *OpenAIProvider) Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: systemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: userPrompt,
		},
	}

	resp, err := p.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:       p.model,
			Messages:    messages,
			MaxTokens:   4096,
			Temperature: 0.7,
		},
	)
	if err != nil {
		return "", fmt.Errorf("openai completion error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no completion choices returned")
	}

	return resp.Choices[0].Message.Content, nil
}

// Name returns the provider name.
func (p *OpenAIProvider) Name() string {
	return fmt.Sprintf("OpenAI (%s)", p.model)
}

// MockProvider is a mock AI provider for testing without API calls.
type MockProvider struct {
	responses map[string]string
}

// NewMockProvider creates a mock provider with predefined responses.
func NewMockProvider() *MockProvider {
	return &MockProvider{
		responses: map[string]string{
			"coordinator": "Tasks identified:\n1. Research Bitcoin L2 solutions\n2. Write technical overview\n3. Review and refine content",
			"researcher":  "Research findings:\n- Lightning Network: Payment channels for fast, cheap transactions\n- Liquid Network: Federated sidechain for faster settlements\n- RGB: Smart contracts using client-side validation\n- Stacks: Smart contracts with Bitcoin security",
			"writer":      "# Bitcoin Layer 2 Solutions Technical Brief\n\nBitcoin Layer 2 solutions address scalability by processing transactions off the main chain...",
			"critic":      "Review complete. The brief is technically accurate and well-structured. Minor suggestions:\n1. Add more specific throughput numbers\n2. Include comparison table\n\nScore: 8/10 - Ready for publication with minor revisions.",
		},
	}
}

// Complete returns a mock response based on the system prompt.
func (p *MockProvider) Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	// Return based on agent type detected in system prompt
	for agent, response := range p.responses {
		if containsAgent(systemPrompt, agent) {
			return response, nil
		}
	}
	return "Mock response for: " + userPrompt, nil
}

// Name returns the provider name.
func (p *MockProvider) Name() string {
	return "Mock Provider"
}

func containsAgent(s, agent string) bool {
	switch agent {
	case "coordinator":
		return contains(s, "coordinator") || contains(s, "Shihaisha") || contains(s, "orchestrat")
	case "researcher":
		return contains(s, "researcher") || contains(s, "Kenkyusha") || contains(s, "research")
	case "writer":
		return contains(s, "writer") || contains(s, "Sakka") || contains(s, "content")
	case "critic":
		return contains(s, "critic") || contains(s, "Hihyoka") || contains(s, "review")
	}
	return false
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsLower(s, substr))
}

func containsLower(s, substr string) bool {
	s = toLower(s)
	substr = toLower(substr)
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := range s {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}
