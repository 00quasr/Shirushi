package dvm

import (
	"encoding/json"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

// Parser handles parsing of Nostr events into DVM types.
type Parser struct{}

// NewParser creates a new DVM event parser.
func NewParser() *Parser {
	return &Parser{}
}

// ParseJobRequest parses a Nostr event into a JobRequest.
func (p *Parser) ParseJobRequest(event *nostr.Event) (*JobRequest, error) {
	job := &JobRequest{
		ID:        event.ID,
		Kind:      event.Kind,
		Customer:  event.PubKey,
		CreatedAt: time.Unix(int64(event.CreatedAt), 0),
		EventID:   event.ID,
		Params:    make(map[string]string),
	}

	// Parse tags
	for _, tag := range event.Tags {
		if len(tag) < 2 {
			continue
		}

		switch tag[0] {
		case "i":
			job.Input = tag[1]
			if len(tag) > 2 {
				job.InputType = tag[2]
			} else {
				job.InputType = "text"
			}
		case "param":
			if len(tag) >= 3 {
				job.Params[tag[1]] = tag[2]
			}
		case "relays":
			if len(tag) > 1 {
				job.RelayURL = tag[1]
			}
		}
	}

	// If input is empty, use content
	if job.Input == "" {
		job.Input = event.Content
		job.InputType = "text"
	}

	return job, nil
}

// ParseJobResult parses a Nostr event into a JobResult.
func (p *Parser) ParseJobResult(event *nostr.Event) (*JobResult, error) {
	result := &JobResult{
		ID:        event.ID,
		Kind:      event.Kind,
		Output:    event.Content,
		Provider:  event.PubKey,
		CreatedAt: time.Unix(int64(event.CreatedAt), 0),
		EventID:   event.ID,
	}

	// Parse tags
	for _, tag := range event.Tags {
		if len(tag) < 2 {
			continue
		}

		switch tag[0] {
		case "e":
			if result.JobID == "" {
				result.JobID = tag[1]
			}
		case "request":
			result.JobID = tag[1]
		case "i":
			if result.Output == "" {
				result.Output = tag[1]
			}
			if len(tag) > 2 {
				result.OutputType = tag[2]
			}
		}
	}

	if result.OutputType == "" {
		result.OutputType = "text"
	}

	return result, nil
}

// ParseJobFeedback parses a Nostr kind 7000 event into JobFeedback.
func (p *Parser) ParseJobFeedback(event *nostr.Event) (*JobFeedback, error) {
	feedback := &JobFeedback{
		Provider:  event.PubKey,
		CreatedAt: time.Unix(int64(event.CreatedAt), 0),
	}

	// Parse tags
	for _, tag := range event.Tags {
		if len(tag) < 2 {
			continue
		}

		switch tag[0] {
		case "e":
			feedback.JobID = tag[1]
		case "status":
			feedback.Status = Status(tag[1])
			if len(tag) > 2 {
				feedback.ExtraInfo = tag[2]
			}
		}
	}

	// Parse content for percentage
	if event.Content != "" {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(event.Content), &data); err == nil {
			if pct, ok := data["percentage"].(float64); ok {
				feedback.Percentage = int(pct)
			}
		}
	}

	return feedback, nil
}

// IsJobRequest checks if an event kind is a job request kind.
func IsJobRequest(kind int) bool {
	return kind >= 5000 && kind < 6000
}

// IsJobResult checks if an event kind is a job result kind.
func IsJobResult(kind int) bool {
	return kind >= 6000 && kind < 7000
}

// IsJobFeedback checks if an event is a job feedback event.
func IsJobFeedback(kind int) bool {
	return kind == KindJobFeedback
}
