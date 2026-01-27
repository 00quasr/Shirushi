package agent

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/keanuklestil/shirushi/internal/ai"
	"github.com/keanuklestil/shirushi/internal/dvm"
)

const researcherSystemPrompt = `You are Kenkyusha (研究者), the Researcher agent in a decentralized AI swarm.

Your role is to:
1. Gather relevant information on the given topic
2. Identify key facts, concepts, and data points
3. Organize findings in a clear, structured format
4. Provide citations and sources when possible

Your output should be well-organized research findings that other agents can use.
Focus on accuracy, comprehensiveness, and clarity.

Format your response as:
## Key Findings
- Bullet points of main discoveries

## Details
Detailed explanations of important concepts

## Sources/References
List any referenced materials or knowledge sources`

// Researcher gathers information on topics.
type Researcher struct {
	*Agent
}

// ResearcherConfig holds configuration for the researcher.
type ResearcherConfig struct {
	PrivateKey     string
	Relays         []string
	AI             ai.Provider
	VizBroadcast   VizBroadcaster
	TrustedPubkeys []string
}

// NewResearcher creates a new Researcher agent.
func NewResearcher(cfg ResearcherConfig) (*Researcher, error) {
	agent, err := NewAgent(Config{
		Name:           "researcher",
		JapaneseName:   "Kenkyusha",
		Description:    "Information gathering and research",
		Kind:           dvm.KindJobRequestResearcher,
		PrivateKey:     cfg.PrivateKey,
		Relays:         cfg.Relays,
		AI:             cfg.AI,
		VizBroadcast:   cfg.VizBroadcast,
		TrustedPubkeys: cfg.TrustedPubkeys,
	})
	if err != nil {
		return nil, err
	}

	return &Researcher{Agent: agent}, nil
}

// ProcessJob handles a research job request.
func (r *Researcher) ProcessJob(ctx context.Context, job *dvm.JobRequest) (*dvm.JobResult, error) {
	log.Printf("[%s] Researching: %s", r.Name, truncate(job.Input, 50))

	// Send processing feedback
	r.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusProcessing,
		ExtraInfo:  "Gathering information",
		Percentage: 20,
	})

	// Simulate research progress
	for i := 1; i <= 3; i++ {
		time.Sleep(500 * time.Millisecond)
		r.PublishFeedback(&dvm.JobFeedback{
			JobID:      job.EventID,
			Status:     dvm.StatusProcessing,
			ExtraInfo:  fmt.Sprintf("Analyzing sources (%d/3)", i),
			Percentage: 20 + (i * 20),
		})
	}

	// Use AI to generate research
	response, err := r.AI.Complete(ctx, researcherSystemPrompt, job.Input)
	if err != nil {
		return nil, fmt.Errorf("AI completion error: %w", err)
	}

	result := &dvm.JobResult{
		ID:         job.EventID + "-result",
		JobID:      job.EventID,
		Output:     response,
		OutputType: "text",
		CreatedAt:  time.Now(),
	}

	// Send success feedback
	r.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusSuccess,
		ExtraInfo:  "Research complete",
		Percentage: 100,
	})

	return result, nil
}

// Run starts the researcher's main loop.
func (r *Researcher) Run(ctx context.Context) error {
	if err := r.Start(ctx); err != nil {
		return err
	}

	for {
		select {
		case job := <-r.Jobs():
			result, err := r.ProcessJob(ctx, job)
			if err != nil {
				log.Printf("[%s] Error processing job: %v", r.Name, err)
				r.PublishFeedback(&dvm.JobFeedback{
					JobID:     job.EventID,
					Status:    dvm.StatusError,
					ExtraInfo: err.Error(),
				})
				continue
			}
			if err := r.PublishResult(result); err != nil {
				log.Printf("[%s] Error publishing result: %v", r.Name, err)
			}
		case <-ctx.Done():
			r.Stop()
			return ctx.Err()
		}
	}
}
