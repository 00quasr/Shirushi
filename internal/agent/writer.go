package agent

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/keanuklestil/shirushi/internal/ai"
	"github.com/keanuklestil/shirushi/internal/dvm"
)

const writerSystemPrompt = `You are Sakka (作家), the Writer agent in a decentralized AI swarm.

Your role is to:
1. Generate high-quality written content based on instructions
2. Incorporate research and context provided by other agents
3. Write in a clear, engaging, and professional style
4. Structure content appropriately for the intended format

Content guidelines:
- Use clear headings and sections
- Include an executive summary when appropriate
- Write concisely but comprehensively
- Maintain a professional tone unless otherwise specified

Format your output as polished, publication-ready content.`

// Writer generates written content.
type Writer struct {
	*Agent
}

// WriterConfig holds configuration for the writer.
type WriterConfig struct {
	PrivateKey     string
	Relays         []string
	AI             ai.Provider
	VizBroadcast   VizBroadcaster
	TrustedPubkeys []string
}

// NewWriter creates a new Writer agent.
func NewWriter(cfg WriterConfig) (*Writer, error) {
	agent, err := NewAgent(Config{
		Name:           "writer",
		JapaneseName:   "Sakka",
		Description:    "Content generation and writing",
		Kind:           dvm.KindJobRequestWriter,
		PrivateKey:     cfg.PrivateKey,
		Relays:         cfg.Relays,
		AI:             cfg.AI,
		VizBroadcast:   cfg.VizBroadcast,
		TrustedPubkeys: cfg.TrustedPubkeys,
	})
	if err != nil {
		return nil, err
	}

	return &Writer{Agent: agent}, nil
}

// ProcessJob handles a writing job request.
func (w *Writer) ProcessJob(ctx context.Context, job *dvm.JobRequest) (*dvm.JobResult, error) {
	log.Printf("[%s] Writing: %s", w.Name, truncate(job.Input, 50))

	// Send processing feedback
	w.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusProcessing,
		ExtraInfo:  "Drafting content",
		Percentage: 30,
	})

	// Simulate writing progress
	stages := []string{"Creating outline", "Writing draft", "Polishing content"}
	for i, stage := range stages {
		time.Sleep(500 * time.Millisecond)
		w.PublishFeedback(&dvm.JobFeedback{
			JobID:      job.EventID,
			Status:     dvm.StatusProcessing,
			ExtraInfo:  stage,
			Percentage: 30 + ((i + 1) * 20),
		})
	}

	// Use AI to generate content
	response, err := w.AI.Complete(ctx, writerSystemPrompt, job.Input)
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
	w.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusSuccess,
		ExtraInfo:  "Content generation complete",
		Percentage: 100,
	})

	return result, nil
}

// Run starts the writer's main loop.
func (w *Writer) Run(ctx context.Context) error {
	if err := w.Start(ctx); err != nil {
		return err
	}

	for {
		select {
		case job := <-w.Jobs():
			result, err := w.ProcessJob(ctx, job)
			if err != nil {
				log.Printf("[%s] Error processing job: %v", w.Name, err)
				w.PublishFeedback(&dvm.JobFeedback{
					JobID:     job.EventID,
					Status:    dvm.StatusError,
					ExtraInfo: err.Error(),
				})
				continue
			}
			if err := w.PublishResult(result); err != nil {
				log.Printf("[%s] Error publishing result: %v", w.Name, err)
			}
		case <-ctx.Done():
			w.Stop()
			return ctx.Err()
		}
	}
}
