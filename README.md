# 指 Shirushi - Visual AI Agent Swarm over Nostr

A **Go-based AI agent swarm** that coordinates over Nostr using NIP-90 (Data Vending Machine), with a **real-time web visualization** showing agents working together.

## Why This Is Novel

- **First Go implementation** of NIP-90 agent framework (only Python/TS exist)
- **First visual DVM swarm** demonstration
- Impressive live demo of decentralized AI coordination

## Architecture

### Agent Swarm (4 Agents)

| Agent | Japanese | Role | DVM Kind |
|-------|----------|------|----------|
| **Coordinator** | Shihaisha (指揮者) | Task decomposition & routing | 5001 |
| **Researcher** | Kenkyusha (研究者) | Information gathering | 5300 |
| **Writer** | Sakka (作家) | Content generation | 5050 |
| **Critic** | Hihyoka (批評家) | Quality review | 5051 |

### Flow

```
User Request -> Coordinator -> Researcher -> Writer -> Critic -> Final Result
                    ^                                      |
                    +---------- (revision loop) -----------+
```

All communication happens via Nostr events (NIP-90 job requests/results).

## Tech Stack

- **Backend**: Go + [go-nostr](https://github.com/nbd-wtf/go-nostr)
- **Frontend**: D3.js force-directed graph + WebSocket
- **AI**: OpenAI GPT-4 (or mock provider)
- **Relays**: wss://relay.damus.io, wss://nos.lol

## Quick Start

### Prerequisites

- Go 1.22+
- OpenAI API key (optional - can use mock provider)

### Install Dependencies

```bash
go mod tidy
```

### Run with Mock AI (No API Key Required)

```bash
go run ./cmd/shirushi --mock
```

### Run with OpenAI

```bash
export OPENAI_API_KEY="your-api-key"
go run ./cmd/shirushi
```

### Run Demo Scenario

```bash
go run ./cmd/shirushi --mock --demo "Write a technical brief about Bitcoin Layer 2 solutions"
```

### Access Dashboard

Open http://localhost:8080 in your browser to see the real-time visualization.

## Command Line Options

| Flag | Default | Description |
|------|---------|-------------|
| `-web` | `:8080` | Web dashboard address |
| `-mock` | `false` | Use mock AI provider (no API calls) |
| `-relays` | `wss://relay.damus.io,wss://nos.lol` | Comma-separated relay URLs |
| `-demo` | `""` | Run demo with specified task |

## Project Structure

```
shirushi/
├── cmd/
│   └── shirushi/main.go        # Main entry point
├── internal/
│   ├── agent/
│   │   ├── agent.go            # Base agent struct
│   │   ├── coordinator.go      # Task orchestration (Shihaisha)
│   │   ├── researcher.go       # Info gathering (Kenkyusha)
│   │   ├── writer.go           # Content generation (Sakka)
│   │   └── critic.go           # Review logic (Hihyoka)
│   ├── dvm/
│   │   ├── kinds.go            # NIP-90 kind constants
│   │   ├── job.go              # Job request/result types
│   │   └── parser.go           # Event parsing
│   ├── ai/
│   │   ├── provider.go         # AI interface
│   │   └── openai.go           # OpenAI GPT-4 client
│   └── viz/
│       ├── server.go           # WebSocket server
│       └── hub.go              # Client connections
├── web/
│   ├── index.html              # Dashboard
│   └── static/
│       ├── graph.js            # D3.js visualization
│       └── style.css
├── go.mod
└── README.md
```

## NIP-90 Implementation

This project implements the [NIP-90 Data Vending Machine](https://github.com/nostr-protocol/nips/blob/master/90.md) specification:

- **Job Requests**: Kind 5xxx events with input data
- **Job Results**: Kind 6xxx events (request kind + 1000)
- **Job Feedback**: Kind 7000 status updates with progress

### Custom DVM Kinds

| Kind | Type | Purpose |
|------|------|---------|
| 5001 | Request | Coordinator job |
| 5050 | Request | Writer job |
| 5051 | Request | Critic job |
| 5300 | Request | Researcher job |
| 6001 | Result | Coordinator result |
| 6050 | Result | Writer result |
| 6051 | Result | Critic result |
| 6300 | Result | Researcher result |
| 7000 | Feedback | Status updates |

## Dashboard Features

- **Force-directed graph**: D3.js visualization of agent network
- **Real-time updates**: WebSocket connection for live events
- **Event stream**: Shows all Nostr events flowing between agents
- **Agent status**: Processing indicators with progress percentages
- **Task submission**: Submit tasks directly from the UI

## Demo Scenario

**Input**: "Write a technical brief about Bitcoin Layer 2 solutions"

**Visible Flow**:
1. Coordinator receives request, decomposes into sub-tasks
2. Researcher gathers information (node pulses, progress updates)
3. Writer generates draft with research context
4. Critic reviews and suggests improvements
5. Final result published back to user

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
