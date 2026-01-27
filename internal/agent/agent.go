// Package agent implements the NIP-90 DVM agent framework.
package agent

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/keanuklestil/shirushi/internal/ai"
	"github.com/keanuklestil/shirushi/internal/dvm"
	"github.com/nbd-wtf/go-nostr"
)

// VizBroadcaster is a function type for broadcasting visualization events.
type VizBroadcaster func(event dvm.VizEvent)

// Agent represents a base DVM agent with Nostr connectivity.
type Agent struct {
	Name         string
	JapaneseName string
	Description  string
	Kind         int
	PrivateKey   string
	PublicKey    string
	Relays       []string
	AI           ai.Provider
	Parser       *dvm.Parser
	VizBroadcast VizBroadcaster

	// TrustedPubkeys limits job processing to these pubkeys only (if set)
	TrustedPubkeys map[string]bool
	// ProcessedJobs tracks job IDs we've already processed (deduplication)
	ProcessedJobs map[string]time.Time

	pool      *nostr.SimplePool
	ctx       context.Context
	cancel    context.CancelFunc
	mu        sync.RWMutex
	running   bool
	jobChan   chan *dvm.JobRequest
	resultSub chan *dvm.JobResult
}

// Config holds configuration for creating an agent.
type Config struct {
	Name           string
	JapaneseName   string
	Description    string
	Kind           int
	PrivateKey     string // Optional - will generate if empty
	Relays         []string
	AI             ai.Provider
	VizBroadcast   VizBroadcaster
	TrustedPubkeys []string // If set, only process jobs from these pubkeys
}

// NewAgent creates a new base agent with the given configuration.
func NewAgent(cfg Config) (*Agent, error) {
	privateKey := cfg.PrivateKey
	if privateKey == "" {
		keyBytes := make([]byte, 32)
		if _, err := rand.Read(keyBytes); err != nil {
			return nil, fmt.Errorf("failed to generate private key: %w", err)
		}
		privateKey = hex.EncodeToString(keyBytes)
	}

	publicKey, err := nostr.GetPublicKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to derive public key: %w", err)
	}

	relays := cfg.Relays
	if len(relays) == 0 {
		relays = []string{
			"wss://relay.damus.io",
			"wss://nos.lol",
		}
	}

	trustedPubkeys := make(map[string]bool)
	for _, pk := range cfg.TrustedPubkeys {
		trustedPubkeys[pk] = true
	}

	return &Agent{
		Name:           cfg.Name,
		JapaneseName:   cfg.JapaneseName,
		Description:    cfg.Description,
		Kind:           cfg.Kind,
		PrivateKey:     privateKey,
		PublicKey:      publicKey,
		Relays:         relays,
		AI:             cfg.AI,
		Parser:         dvm.NewParser(),
		VizBroadcast:   cfg.VizBroadcast,
		TrustedPubkeys: trustedPubkeys,
		ProcessedJobs:  make(map[string]time.Time),
		jobChan:        make(chan *dvm.JobRequest, 100),
		resultSub:      make(chan *dvm.JobResult, 100),
	}, nil
}

// AddTrustedPubkey adds a pubkey to the trusted list
func (a *Agent) AddTrustedPubkey(pubkey string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.TrustedPubkeys[pubkey] = true
}

// Start begins the agent's event loop, listening for jobs.
func (a *Agent) Start(ctx context.Context) error {
	a.mu.Lock()
	if a.running {
		a.mu.Unlock()
		return fmt.Errorf("agent %s is already running", a.Name)
	}
	a.running = true
	a.ctx, a.cancel = context.WithCancel(ctx)
	a.mu.Unlock()

	a.pool = nostr.NewSimplePool(a.ctx)

	log.Printf("[%s] Agent started (pubkey: %s...)", a.Name, a.PublicKey[:16])
	log.Printf("[%s] Listening for kind %d job requests", a.Name, a.Kind)

	if len(a.TrustedPubkeys) > 0 {
		log.Printf("[%s] Filtering: only trusted pubkeys (%d)", a.Name, len(a.TrustedPubkeys))
	} else {
		log.Printf("[%s] Warning: processing ALL public jobs (no filter)", a.Name)
	}

	go a.subscribeToJobs()
	go a.cleanupProcessedJobs()

	return nil
}

// Stop gracefully stops the agent.
func (a *Agent) Stop() {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.running {
		return
	}

	log.Printf("[%s] Stopping agent...", a.Name)
	a.cancel()
	a.running = false
}

// subscribeToJobs subscribes to Nostr events for this agent's job kind.
func (a *Agent) subscribeToJobs() {
	now := nostr.Timestamp(time.Now().Unix())
	filters := []nostr.Filter{
		{
			Kinds: []int{a.Kind},
			Since: &now,
		},
	}

	for ev := range a.pool.SubMany(a.ctx, a.Relays, filters) {
		// Check if from trusted pubkey (if filtering is enabled)
		if len(a.TrustedPubkeys) > 0 {
			a.mu.RLock()
			trusted := a.TrustedPubkeys[ev.Event.PubKey]
			a.mu.RUnlock()

			if !trusted {
				continue
			}
		}

		// Check for duplicate (already processed)
		a.mu.Lock()
		if _, exists := a.ProcessedJobs[ev.Event.ID]; exists {
			a.mu.Unlock()
			continue
		}
		a.ProcessedJobs[ev.Event.ID] = time.Now()
		a.mu.Unlock()

		job, err := a.Parser.ParseJobRequest(ev.Event)
		if err != nil {
			log.Printf("[%s] Error parsing job request: %v", a.Name, err)
			continue
		}

		log.Printf("[%s] Received job request: %s", a.Name, job.ID[:16])

		if a.VizBroadcast != nil {
			a.VizBroadcast(dvm.VizEvent{
				Type:      "job_request",
				From:      "network",
				To:        a.Name,
				Kind:      a.Kind,
				EventID:   job.EventID,
				Content:   truncate(job.Input, 100),
				Timestamp: time.Now(),
			})
		}

		a.jobChan <- job
	}
}

// cleanupProcessedJobs removes old entries from ProcessedJobs to prevent memory leak
func (a *Agent) cleanupProcessedJobs() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			a.mu.Lock()
			cutoff := time.Now().Add(-10 * time.Minute)
			for id, timestamp := range a.ProcessedJobs {
				if timestamp.Before(cutoff) {
					delete(a.ProcessedJobs, id)
				}
			}
			a.mu.Unlock()
		}
	}
}

// Jobs returns a channel of incoming job requests.
func (a *Agent) Jobs() <-chan *dvm.JobRequest {
	return a.jobChan
}

// PublishResult publishes a job result to the relays.
func (a *Agent) PublishResult(result *dvm.JobResult) error {
	result.Provider = a.PublicKey
	result.Kind = dvm.ResultKindFor(a.Kind)

	event, err := result.ToEvent(a.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to create result event: %w", err)
	}

	log.Printf("[%s] Publishing result for job %s", a.Name, result.JobID[:16])

	for _, relay := range a.Relays {
		r, err := a.pool.EnsureRelay(relay)
		if err != nil {
			log.Printf("[%s] Failed to connect to relay %s: %v", a.Name, relay, err)
			continue
		}
		if err := r.Publish(a.ctx, *event); err != nil {
			log.Printf("[%s] Failed to publish to relay %s: %v", a.Name, relay, err)
		} else {
			log.Printf("[%s] Published to %s", a.Name, relay)
		}
	}

	if a.VizBroadcast != nil {
		a.VizBroadcast(dvm.VizEvent{
			Type:      "job_result",
			From:      a.Name,
			To:        "network",
			Kind:      result.Kind,
			EventID:   result.EventID,
			Content:   truncate(result.Output, 100),
			Timestamp: time.Now(),
		})
	}

	return nil
}

// PublishFeedback publishes a job status update (kind 7000).
func (a *Agent) PublishFeedback(feedback *dvm.JobFeedback) error {
	feedback.Provider = a.PublicKey

	event, err := feedback.ToEvent(a.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to create feedback event: %w", err)
	}

	log.Printf("[%s] Publishing feedback for job %s: %s", a.Name, feedback.JobID[:16], feedback.Status)

	// Only publish to one relay to reduce rate limiting
	if len(a.Relays) > 0 {
		r, err := a.pool.EnsureRelay(a.Relays[0])
		if err == nil {
			r.Publish(a.ctx, *event)
		}
	}

	if a.VizBroadcast != nil {
		a.VizBroadcast(dvm.VizEvent{
			Type:       "feedback",
			From:       a.Name,
			To:         "network",
			Kind:       dvm.KindJobFeedback,
			EventID:    event.ID,
			Status:     string(feedback.Status),
			Percentage: feedback.Percentage,
			Timestamp:  time.Now(),
		})
	}

	return nil
}

// SubmitJob submits a job request to the network.
func (a *Agent) SubmitJob(job *dvm.JobRequest) error {
	event, err := job.ToEvent(a.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to create job event: %w", err)
	}

	log.Printf("[%s] Submitting job (kind %d): %s", a.Name, job.Kind, job.ID)

	for _, relay := range a.Relays {
		r, err := a.pool.EnsureRelay(relay)
		if err != nil {
			log.Printf("[%s] Failed to connect to relay %s: %v", a.Name, relay, err)
			continue
		}
		if err := r.Publish(a.ctx, *event); err != nil {
			log.Printf("[%s] Failed to publish to relay %s: %v", a.Name, relay, err)
		}
	}

	if a.VizBroadcast != nil {
		targetAgent := kindToAgentName(job.Kind)
		a.VizBroadcast(dvm.VizEvent{
			Type:      "job_request",
			From:      a.Name,
			To:        targetAgent,
			Kind:      job.Kind,
			EventID:   job.EventID,
			Content:   truncate(job.Input, 100),
			Timestamp: time.Now(),
		})
	}

	return nil
}

// SubscribeToResults subscribes to job results for a specific job ID.
func (a *Agent) SubscribeToResults(jobID string, resultKind int) <-chan *dvm.JobResult {
	resultChan := make(chan *dvm.JobResult, 10)

	go func() {
		defer close(resultChan)

		filters := []nostr.Filter{
			{
				Kinds: []int{resultKind},
				Tags: map[string][]string{
					"e": {jobID},
				},
			},
		}

		for ev := range a.pool.SubMany(a.ctx, a.Relays, filters) {
			result, err := a.Parser.ParseJobResult(ev.Event)
			if err != nil {
				log.Printf("[%s] Error parsing result: %v", a.Name, err)
				continue
			}
			resultChan <- result
		}
	}()

	return resultChan
}

// GetPool returns the underlying Nostr connection pool.
func (a *Agent) GetPool() *nostr.SimplePool {
	return a.pool
}

// IsRunning returns whether the agent is currently running.
func (a *Agent) IsRunning() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.running
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func kindToAgentName(kind int) string {
	switch kind {
	case dvm.KindJobRequestCoordinator:
		return "coordinator"
	case dvm.KindJobRequestResearcher:
		return "researcher"
	case dvm.KindJobRequestWriter:
		return "writer"
	case dvm.KindJobRequestCritic:
		return "critic"
	default:
		return "unknown"
	}
}
