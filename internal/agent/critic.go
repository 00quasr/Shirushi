package agent

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/keanuklestil/shirushi/internal/ai"
	"github.com/keanuklestil/shirushi/internal/dvm"
)

const criticSystemPrompt = `You are Hihyoka (批評家), the Critic agent in a decentralized AI swarm.

Your role is to:
1. Review content for quality, accuracy, and completeness
2. Provide constructive feedback and improvement suggestions
3. Rate the content on various dimensions
4. Approve content or request revisions

Review criteria:
- Accuracy: Is the information correct and well-sourced?
- Clarity: Is the content easy to understand?
- Completeness: Does it cover the topic adequately?
- Structure: Is it well-organized?
- Style: Is the writing engaging and appropriate?

Format your review as:
## Overall Assessment
Brief summary and overall rating (1-10)

## Strengths
- What works well

## Areas for Improvement
- Specific suggestions

## Verdict
APPROVED - Ready for publication
or
REVISION NEEDED - List specific changes required`

// Critic reviews and provides feedback on content.
type Critic struct {
	*Agent
}

// CriticConfig holds configuration for the critic.
type CriticConfig struct {
	PrivateKey     string
	Relays         []string
	AI             ai.Provider
	VizBroadcast   VizBroadcaster
	TrustedPubkeys []string
}

// NewCritic creates a new Critic agent.
func NewCritic(cfg CriticConfig) (*Critic, error) {
	agent, err := NewAgent(Config{
		Name:           "critic",
		JapaneseName:   "Hihyoka",
		Description:    "Quality review and feedback",
		Kind:           dvm.KindJobRequestCritic,
		PrivateKey:     cfg.PrivateKey,
		Relays:         cfg.Relays,
		AI:             cfg.AI,
		TrustedPubkeys: cfg.TrustedPubkeys,
		VizBroadcast: cfg.VizBroadcast,
	})
	if err != nil {
		return nil, err
	}

	return &Critic{Agent: agent}, nil
}

// ProcessJob handles a review job request.
func (c *Critic) ProcessJob(ctx context.Context, job *dvm.JobRequest) (*dvm.JobResult, error) {
	log.Printf("[%s] Reviewing: %s", c.Name, truncate(job.Input, 50))

	// Send processing feedback
	c.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusProcessing,
		ExtraInfo:  "Analyzing content",
		Percentage: 25,
	})

	// Simulate review progress
	stages := []string{"Checking accuracy", "Evaluating structure", "Assessing quality"}
	for i, stage := range stages {
		time.Sleep(400 * time.Millisecond)
		c.PublishFeedback(&dvm.JobFeedback{
			JobID:      job.EventID,
			Status:     dvm.StatusProcessing,
			ExtraInfo:  stage,
			Percentage: 25 + ((i + 1) * 20),
		})
	}

	// Use AI to generate review
	response, err := c.AI.Complete(ctx, criticSystemPrompt, job.Input)
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
	c.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusSuccess,
		ExtraInfo:  "Review complete",
		Percentage: 100,
	})

	return result, nil
}

// Run starts the critic's main loop.
func (c *Critic) Run(ctx context.Context) error {
	if err := c.Start(ctx); err != nil {
		return err
	}

	for {
		select {
		case job := <-c.Jobs():
			result, err := c.ProcessJob(ctx, job)
			if err != nil {
				log.Printf("[%s] Error processing job: %v", c.Name, err)
				c.PublishFeedback(&dvm.JobFeedback{
					JobID:     job.EventID,
					Status:    dvm.StatusError,
					ExtraInfo: err.Error(),
				})
				continue
			}
			if err := c.PublishResult(result); err != nil {
				log.Printf("[%s] Error publishing result: %v", c.Name, err)
			}
		case <-ctx.Done():
			c.Stop()
			return ctx.Err()
		}
	}
}
