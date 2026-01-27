// Package nak provides event creation and management via nak CLI.
package nak

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Event represents a Nostr event.
type Event struct {
	ID        string     `json:"id"`
	PubKey    string     `json:"pubkey"`
	CreatedAt int64      `json:"created_at"`
	Kind      int        `json:"kind"`
	Tags      [][]string `json:"tags"`
	Content   string     `json:"content"`
	Sig       string     `json:"sig"`
}

// CreateEventOptions contains options for creating an event.
type CreateEventOptions struct {
	Kind       int
	Content    string
	Tags       [][]string
	PrivateKey string // nsec or hex
}

// CreateEvent creates a new Nostr event.
func (n *Nak) CreateEvent(opts CreateEventOptions) (*Event, error) {
	args := []string{"event"}

	// Add kind
	args = append(args, "-k", strconv.Itoa(opts.Kind))

	// Add content
	if opts.Content != "" {
		args = append(args, "-c", opts.Content)
	}

	// Add tags
	for _, tag := range opts.Tags {
		if len(tag) >= 2 {
			args = append(args, "-t", strings.Join(tag, "="))
		}
	}

	// Add private key for signing
	if opts.PrivateKey != "" {
		args = append(args, "--sec", opts.PrivateKey)
	}

	output, err := n.Run(args...)
	if err != nil {
		return nil, err
	}

	var event Event
	if err := json.Unmarshal([]byte(output), &event); err != nil {
		return nil, fmt.Errorf("failed to parse event: %w", err)
	}

	return &event, nil
}

// Publish publishes an event to relays.
func (n *Nak) Publish(eventJSON string, relays ...string) error {
	if len(relays) == 0 {
		return fmt.Errorf("at least one relay required")
	}

	args := []string{"publish"}
	args = append(args, relays...)

	// nak publish reads event from stdin
	_, err := n.RunWithStdin(eventJSON, args...)
	return err
}

// PublishEvent creates and publishes an event in one step.
func (n *Nak) PublishEvent(opts CreateEventOptions, relays ...string) (*Event, error) {
	event, err := n.CreateEvent(opts)
	if err != nil {
		return nil, err
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return nil, err
	}

	if err := n.Publish(string(eventJSON), relays...); err != nil {
		return event, err // Return event even if publish fails
	}

	return event, nil
}

// QueryOptions contains options for querying events.
type QueryOptions struct {
	Kinds   []int
	Authors []string
	IDs     []string
	Tags    map[string][]string
	Limit   int
	Since   int64
	Until   int64
}

// Query queries events from relays.
func (n *Nak) Query(relays []string, opts QueryOptions) ([]Event, error) {
	if len(relays) == 0 {
		return nil, fmt.Errorf("at least one relay required")
	}

	args := []string{"req"}

	// Add kinds
	for _, k := range opts.Kinds {
		args = append(args, "-k", strconv.Itoa(k))
	}

	// Add authors
	for _, a := range opts.Authors {
		args = append(args, "-a", a)
	}

	// Add limit
	if opts.Limit > 0 {
		args = append(args, "-l", strconv.Itoa(opts.Limit))
	}

	// Add relays
	args = append(args, relays...)

	output, err := n.Run(args...)
	if err != nil {
		return nil, err
	}

	// Parse newline-separated events
	var events []Event
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var event Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue // Skip malformed events
		}
		events = append(events, event)
	}

	return events, nil
}

// Verify verifies an event's signature.
func (n *Nak) Verify(eventJSON string) (bool, error) {
	_, err := n.RunWithStdin(eventJSON, "verify")
	if err != nil {
		return false, nil // Verification failed
	}
	return true, nil
}

// Fetch fetches an event by NIP-19 reference.
func (n *Nak) Fetch(nip19Ref string) (*Event, error) {
	output, err := n.Run("fetch", nip19Ref)
	if err != nil {
		return nil, err
	}

	var event Event
	if err := json.Unmarshal([]byte(output), &event); err != nil {
		return nil, fmt.Errorf("failed to parse event: %w", err)
	}

	return &event, nil
}
