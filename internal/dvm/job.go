package dvm

import (
	"encoding/json"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

// JobRequest represents a NIP-90 DVM job request.
type JobRequest struct {
	ID        string            `json:"id"`
	Kind      int               `json:"kind"`
	Input     string            `json:"input"`
	InputType string            `json:"input_type"` // "text", "url", "event", "job"
	Params    map[string]string `json:"params,omitempty"`
	Customer  string            `json:"customer"` // pubkey of requester
	CreatedAt time.Time         `json:"created_at"`
	EventID   string            `json:"event_id"` // original nostr event id
	RelayURL  string            `json:"relay_url,omitempty"`
}

// JobResult represents a NIP-90 DVM job result.
type JobResult struct {
	ID         string    `json:"id"`
	Kind       int       `json:"kind"`
	JobID      string    `json:"job_id"` // references the job request event id
	Output     string    `json:"output"`
	OutputType string    `json:"output_type"` // "text", "url", "event"
	Provider   string    `json:"provider"`    // pubkey of DVM provider
	CreatedAt  time.Time `json:"created_at"`
	EventID    string    `json:"event_id"`
}

// JobFeedback represents a NIP-90 kind 7000 status update.
type JobFeedback struct {
	JobID      string    `json:"job_id"`
	Status     Status    `json:"status"`
	ExtraInfo  string    `json:"extra_info,omitempty"`
	Provider   string    `json:"provider"`
	CreatedAt  time.Time `json:"created_at"`
	Percentage int       `json:"percentage,omitempty"` // 0-100 progress
}

// ToEvent converts a JobRequest to a Nostr event.
func (j *JobRequest) ToEvent(sk string) (*nostr.Event, error) {
	pub, err := nostr.GetPublicKey(sk)
	if err != nil {
		return nil, err
	}

	tags := nostr.Tags{
		{"i", j.Input, j.InputType},
	}

	// Add params as tags
	for k, v := range j.Params {
		tags = append(tags, nostr.Tag{"param", k, v})
	}

	event := &nostr.Event{
		Kind:      j.Kind,
		PubKey:    pub,
		CreatedAt: nostr.Timestamp(time.Now().Unix()),
		Tags:      tags,
		Content:   "",
	}

	if err := event.Sign(sk); err != nil {
		return nil, err
	}

	j.EventID = event.ID
	return event, nil
}

// ToEvent converts a JobResult to a Nostr event.
func (j *JobResult) ToEvent(sk string) (*nostr.Event, error) {
	pub, err := nostr.GetPublicKey(sk)
	if err != nil {
		return nil, err
	}

	tags := nostr.Tags{
		{"e", j.JobID},                        // reference to job request
		{"p", j.Provider},                     // service provider (self)
		{"request", j.JobID},                  // NIP-90 request reference
		{"i", j.Output, j.OutputType, "text"}, // output
	}

	event := &nostr.Event{
		Kind:      j.Kind,
		PubKey:    pub,
		CreatedAt: nostr.Timestamp(time.Now().Unix()),
		Tags:      tags,
		Content:   j.Output,
	}

	if err := event.Sign(sk); err != nil {
		return nil, err
	}

	j.EventID = event.ID
	return event, nil
}

// ToEvent converts JobFeedback to a Nostr kind 7000 event.
func (f *JobFeedback) ToEvent(sk string) (*nostr.Event, error) {
	pub, err := nostr.GetPublicKey(sk)
	if err != nil {
		return nil, err
	}

	tags := nostr.Tags{
		{"e", f.JobID},
		{"status", string(f.Status)},
	}

	if f.ExtraInfo != "" {
		tags = append(tags, nostr.Tag{"status", string(f.Status), f.ExtraInfo})
	}

	content := ""
	if f.Percentage > 0 {
		data, _ := json.Marshal(map[string]int{"percentage": f.Percentage})
		content = string(data)
	}

	event := &nostr.Event{
		Kind:      KindJobFeedback,
		PubKey:    pub,
		CreatedAt: nostr.Timestamp(time.Now().Unix()),
		Tags:      tags,
		Content:   content,
	}

	if err := event.Sign(sk); err != nil {
		return nil, err
	}

	return event, nil
}

// VizEvent is a simplified event for visualization purposes.
type VizEvent struct {
	Type       string    `json:"type"` // "job_request", "job_result", "feedback"
	From       string    `json:"from"` // agent name or "user"
	To         string    `json:"to"`   // agent name or "user"
	Kind       int       `json:"kind"`
	EventID    string    `json:"event_id"`
	Content    string    `json:"content"`
	Status     string    `json:"status,omitempty"`
	Percentage int       `json:"percentage,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}
