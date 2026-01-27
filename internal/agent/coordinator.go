package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/keanuklestil/shirushi/internal/ai"
	"github.com/keanuklestil/shirushi/internal/dvm"
)

const coordinatorSystemPrompt = `You are Shihaisha (指揮者), the Coordinator agent in a decentralized AI swarm.

Your role is to:
1. Analyze incoming user requests
2. Decompose complex tasks into sub-tasks for other agents
3. Route tasks to appropriate specialists
4. Orchestrate the workflow between agents

Available agents you can delegate to:
- Researcher (Kenkyusha): Information gathering, fact-finding, data collection
- Writer (Sakka): Content generation, drafting, creative writing
- Critic (Hihyoka): Quality review, feedback, improvement suggestions

Respond with a JSON object containing your analysis and task plan:
{
  "analysis": "Brief analysis of the request",
  "tasks": [
    {"agent": "researcher", "instruction": "What to research"},
    {"agent": "writer", "instruction": "What to write, using research"},
    {"agent": "critic", "instruction": "Review the written content"}
  ]
}

Keep your analysis concise. Focus on actionable task delegation.`

// Coordinator orchestrates tasks between agents.
type Coordinator struct {
	*Agent
	researcherKind int
	writerKind     int
	criticKind     int
}

// CoordinatorConfig holds configuration for the coordinator.
type CoordinatorConfig struct {
	PrivateKey   string
	Relays       []string
	AI           ai.Provider
	VizBroadcast VizBroadcaster
}

// NewCoordinator creates a new Coordinator agent.
func NewCoordinator(cfg CoordinatorConfig) (*Coordinator, error) {
	agent, err := NewAgent(Config{
		Name:         "coordinator",
		JapaneseName: "Shihaisha",
		Description:  "Task decomposition and routing",
		Kind:         dvm.KindJobRequestCoordinator,
		PrivateKey:   cfg.PrivateKey,
		Relays:       cfg.Relays,
		AI:           cfg.AI,
		VizBroadcast: cfg.VizBroadcast,
	})
	if err != nil {
		return nil, err
	}

	return &Coordinator{
		Agent:          agent,
		researcherKind: dvm.KindJobRequestResearcher,
		writerKind:     dvm.KindJobRequestWriter,
		criticKind:     dvm.KindJobRequestCritic,
	}, nil
}

// TaskPlan represents the coordinator's decomposed task plan.
type TaskPlan struct {
	Analysis string     `json:"analysis"`
	Tasks    []SubTask  `json:"tasks"`
}

// SubTask represents a task delegated to another agent.
type SubTask struct {
	Agent       string `json:"agent"`
	Instruction string `json:"instruction"`
}

// ProcessRequest handles an incoming user request.
func (c *Coordinator) ProcessRequest(ctx context.Context, job *dvm.JobRequest) (*dvm.JobResult, error) {
	log.Printf("[%s] Processing request: %s", c.Name, truncate(job.Input, 50))

	// Send processing feedback
	c.PublishFeedback(&dvm.JobFeedback{
		JobID:      job.EventID,
		Status:     dvm.StatusProcessing,
		ExtraInfo:  "Analyzing request and creating task plan",
		Percentage: 10,
	})

	// Use AI to analyze and decompose the task
	response, err := c.AI.Complete(ctx, coordinatorSystemPrompt, job.Input)
	if err != nil {
		return nil, fmt.Errorf("AI completion error: %w", err)
	}

	// Parse the task plan
	var plan TaskPlan
	if err := json.Unmarshal([]byte(response), &plan); err != nil {
		// If JSON parsing fails, create a simple plan
		plan = TaskPlan{
			Analysis: "Processing request",
			Tasks: []SubTask{
				{Agent: "researcher", Instruction: "Research: " + job.Input},
				{Agent: "writer", Instruction: "Write content about: " + job.Input},
				{Agent: "critic", Instruction: "Review the generated content"},
			},
		}
	}

	log.Printf("[%s] Created task plan with %d tasks", c.Name, len(plan.Tasks))

	// Execute the task chain
	result, err := c.executeTaskChain(ctx, job, plan)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// executeTaskChain executes tasks in sequence, passing outputs to next agent.
func (c *Coordinator) executeTaskChain(ctx context.Context, originalJob *dvm.JobRequest, plan TaskPlan) (*dvm.JobResult, error) {
	var lastOutput string
	totalTasks := len(plan.Tasks)

	for i, task := range plan.Tasks {
		progress := 10 + (80 * (i + 1) / (totalTasks + 1))

		c.PublishFeedback(&dvm.JobFeedback{
			JobID:      originalJob.EventID,
			Status:     dvm.StatusProcessing,
			ExtraInfo:  fmt.Sprintf("Delegating to %s", task.Agent),
			Percentage: progress,
		})

		// Determine the target kind
		var targetKind int
		switch task.Agent {
		case "researcher":
			targetKind = c.researcherKind
		case "writer":
			targetKind = c.writerKind
		case "critic":
			targetKind = c.criticKind
		default:
			log.Printf("[%s] Unknown agent type: %s", c.Name, task.Agent)
			continue
		}

		// Create the sub-job
		input := task.Instruction
		if lastOutput != "" {
			input = fmt.Sprintf("%s\n\nContext from previous step:\n%s", task.Instruction, lastOutput)
		}

		subJob := &dvm.JobRequest{
			ID:        fmt.Sprintf("%s-%d", originalJob.EventID[:16], i),
			Kind:      targetKind,
			Input:     input,
			InputType: "text",
			Customer:  c.PublicKey,
			CreatedAt: time.Now(),
		}

		// Submit the job
		if err := c.SubmitJob(subJob); err != nil {
			log.Printf("[%s] Failed to submit job to %s: %v", c.Name, task.Agent, err)
			continue
		}

		// Wait for result (with timeout)
		resultKind := dvm.ResultKindFor(targetKind)
		resultChan := c.SubscribeToResults(subJob.EventID, resultKind)

		select {
		case result := <-resultChan:
			if result != nil {
				lastOutput = result.Output
				log.Printf("[%s] Received result from %s", c.Name, task.Agent)

				// Broadcast visualization
				if c.VizBroadcast != nil {
					c.VizBroadcast(dvm.VizEvent{
						Type:      "job_result",
						From:      task.Agent,
						To:        c.Name,
						Kind:      resultKind,
						EventID:   result.EventID,
						Content:   truncate(result.Output, 100),
						Timestamp: time.Now(),
					})
				}
			}
		case <-time.After(60 * time.Second):
			log.Printf("[%s] Timeout waiting for %s result", c.Name, task.Agent)
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	// Create final result
	finalResult := &dvm.JobResult{
		ID:         originalJob.EventID + "-final",
		JobID:      originalJob.EventID,
		Output:     lastOutput,
		OutputType: "text",
		CreatedAt:  time.Now(),
	}

	// Publish success feedback
	c.PublishFeedback(&dvm.JobFeedback{
		JobID:      originalJob.EventID,
		Status:     dvm.StatusSuccess,
		ExtraInfo:  "Task completed successfully",
		Percentage: 100,
	})

	return finalResult, nil
}

// Run starts the coordinator's main loop.
func (c *Coordinator) Run(ctx context.Context) error {
	if err := c.Start(ctx); err != nil {
		return err
	}

	for {
		select {
		case job := <-c.Jobs():
			result, err := c.ProcessRequest(ctx, job)
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
