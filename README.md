# Shirushi - Nostr Protocol Explorer

A **web-based Nostr protocol testing and monitoring tool** built in Go. Explore profiles, monitor relay performance with real-time charts, test NIP implementations, and interact with the Nostr network through an intuitive dashboard.

## Features

### Core Features
- **Profile Explorer** - Browse Nostr profiles by npub or NIP-05 address with beautiful profile cards, avatars, banners, and verification badges
- **Relay Management** - Connect to multiple relays with real-time latency monitoring and health scores
- **Event Stream** - Real-time event feed with filtering, syntax-highlighted JSON inspector, and thread viewer
- **NIP Testing** - Interactive test panels for 7 NIPs (01, 02, 05, 19, 44, 57, 90) with step-by-step results
- **Key Management** - Generate keypairs, encode/decode NIP-19 entities
- **nak Console** - Run nak CLI commands directly from the browser

### Visual Features
- **Monitoring Dashboard** - Real-time latency charts and event throughput graphs powered by Chart.js
- **Health Score Cards** - Computed 0-100 health scores for each relay
- **Zap Animations** - Lightning bolt animations for zap receipts
- **Toast Notifications** - Beautiful success/error/info notifications replacing alerts
- **Loading States** - Spinners and skeleton loaders for smooth UX

### Advanced Features
- **NIP-07 Extension Support** - Sign events with your browser extension (Alby, nos2x, etc.)
- **Thread Viewer** - View reply threads with NIP-10 support
- **Relay NIP Detection** - See which NIPs each relay supports
- **Test History** - Persist and review past test results
- **Keyboard Shortcuts** - Power-user navigation
- **Mobile Responsive** - Collapsible sidebar, touch-friendly interface

## Quick Start

### Prerequisites

- Go 1.22+
- [nak CLI](https://github.com/fiatjaf/nak) (optional, auto-detected)

### Install nak (Recommended)

```bash
go install github.com/fiatjaf/nak@latest
```

### Run Shirushi

```bash
go run ./cmd/shirushi
```

Open http://localhost:8080 in your browser.

## Screenshot

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Shirushi - Nostr Protocol Explorer              [NIP-07] Connected     │
├─────────────────────────────────────────────────────────────────────────┤
│  [Explorer] [Relays] [Monitoring] [Events] [Testing] [Keys] [Console]   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ╔═══════════════════════════════════════════════════════════╗  │    │
│  │  ║                      Banner Image                         ║  │    │
│  │  ╚═══════════════════════════════════════════════════════════╝  │    │
│  │  ┌────┐                                                          │    │
│  │  │ PFP│  fiatjaf  ✓ NIP-05                                      │    │
│  │  └────┘  @fiatjaf.com                                           │    │
│  │          Creator of Nostr                                       │    │
│  │          Following: 423  |  Followers: 12.4k                    │    │
│  │  [Notes] [Following] [Zaps]                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tabs Overview

| Tab | Description |
|-----|-------------|
| **Explorer** | Browse profiles by npub/NIP-05, view notes, follows, and zaps |
| **Relays** | Manage relay connections, view status and latency |
| **Monitoring** | Real-time charts for latency, throughput, and health scores |
| **Events** | Live event stream with filters and JSON inspector |
| **Testing** | Run NIP compliance tests with detailed results |
| **Keys** | Generate keypairs, encode/decode NIP-19 |
| **Console** | Direct nak CLI access |

## NIP Tests

| NIP | Name | Category | Description |
|-----|------|----------|-------------|
| **NIP-01** | Basic Protocol | Core | Create, sign, publish, and verify events |
| **NIP-02** | Follow List | Core | Fetch and parse contact lists (kind 3) |
| **NIP-05** | DNS Identity | Identity | Verify NIP-05 addresses via DNS lookup |
| **NIP-19** | Bech32 Encoding | Encoding | Encode/decode npub, nsec, nevent roundtrips |
| **NIP-44** | Encrypted Payloads | Encryption | Test encryption/decryption with keypairs |
| **NIP-57** | Lightning Zaps | Payments | Parse zap receipts and verify LNURL endpoints |
| **NIP-90** | Data Vending Machines | DVMs | Discover DVMs, view job requests and results |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-7` | Switch to tab (Explorer, Relays, etc.) |
| `?` | Show keyboard shortcuts |
| `Esc` | Close modal/dialog |
| `/` | Focus search/input |

## Configuration

Create a `.env` file (optional):

```bash
# Path to nak CLI (auto-detected if not set)
NAK_PATH=/path/to/nak

# Web server address
WEB_ADDR=:8080

# Default relays (comma-separated)
DEFAULT_RELAYS=wss://relay.damus.io,wss://nos.lol
```

### Relay Presets

Built-in presets for common relay configurations:

| Preset | Relays |
|--------|--------|
| Popular | relay.damus.io, nos.lol, relay.nostr.band |
| Fast | relay.primal.net, nostr.mom |
| DVMs | relay.damus.io, relay.nostr.band |
| Privacy | nostr.oxtr.dev |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server status and nak availability |
| GET | `/api/relays` | List connected relays |
| POST | `/api/relays` | Add a relay |
| DELETE | `/api/relays?url=...` | Remove a relay |
| GET | `/api/relays/presets` | Get relay presets |
| GET | `/api/events` | Query events (kind, author, limit) |
| GET | `/api/nips` | List available NIP tests |
| POST | `/api/test/{nip}` | Run a NIP test |
| POST | `/api/keys/generate` | Generate keypair |
| POST | `/api/keys/decode` | Decode NIP-19 |
| POST | `/api/keys/encode` | Encode to NIP-19 |
| POST | `/api/nak` | Run raw nak command |
| GET | `/api/profile/lookup?q=...` | Lookup profile by npub or NIP-05 |
| GET | `/api/profile/{pubkey}` | Get profile details |
| GET | `/api/profile/{pubkey}/notes` | Get user's notes |
| GET | `/api/profile/{pubkey}/follows` | Get follow list |
| GET | `/api/profile/{pubkey}/zaps` | Get zap receipts |
| GET | `/api/monitoring/history` | Get relay latency history |
| GET | `/api/monitoring/health` | Get relay health scores |

## Project Structure

```
shirushi/
├── cmd/shirushi/main.go          # Entry point
├── internal/
│   ├── config/config.go          # Configuration & relay presets
│   ├── nak/                       # nak CLI wrapper
│   │   ├── nak.go                 # Core wrapper
│   │   ├── keys.go                # Key generation
│   │   ├── events.go              # Event operations
│   │   └── decode.go              # NIP-19 encode/decode
│   ├── relay/                     # Relay management
│   │   ├── pool.go                # Connection pool
│   │   └── monitor.go             # Health monitoring & time-series
│   ├── testing/                   # NIP test framework
│   │   ├── framework.go           # Test runner
│   │   └── nip*.go                # Individual NIP tests
│   ├── types/types.go             # Shared types
│   └── web/                       # Web server
│       ├── server.go              # HTTP + WebSocket
│       ├── hub.go                 # WebSocket hub
│       └── api.go                 # REST API handlers
├── web/
│   ├── index.html                 # Dashboard UI
│   └── static/
│       ├── app.js                 # Frontend application
│       └── style.css              # Styling
├── PRD.md                         # Product requirements
├── claude.md                      # Project context
└── go.mod
```

## Tech Stack

- **Backend**: Go + [go-nostr](https://github.com/nbd-wtf/go-nostr)
- **CLI**: [nak](https://github.com/fiatjaf/nak) for Nostr operations
- **Frontend**: Vanilla JS + WebSocket for real-time updates
- **Charts**: [Chart.js](https://www.chartjs.org/) for monitoring visualizations
- **Styling**: Custom CSS with dark theme, animations, and responsive design

## Browser Extension Support

Shirushi supports NIP-07 browser extensions for signing events with your own keys:

- [Alby](https://getalby.com/)
- [nos2x](https://github.com/fiatjaf/nos2x)
- [Flamingo](https://www.flamingo.me/)

When an extension is detected, you'll see a "Connected via Extension" badge in the header.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
