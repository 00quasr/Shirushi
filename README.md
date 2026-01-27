# Shirushi - Nostr Protocol Explorer

A **web-based Nostr protocol testing and monitoring tool** built in Go. Test NIP implementations, monitor relay connections, and explore the Nostr network through an intuitive dashboard.

## Features

- **Relay Management** - Connect to multiple relays, monitor latency and health
- **Event Explorer** - Real-time event stream with filtering by kind and author
- **NIP Testing** - Interactive test panels for 7 NIPs (01, 02, 05, 19, 44, 57, 90)
- **Key Management** - Generate keypairs, encode/decode NIP-19 entities
- **nak Console** - Run nak CLI commands directly from the browser

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
┌─────────────────────────────────────────────────────────────────┐
│  Shirushi - Nostr Protocol Explorer                    Connected│
├─────────────────────────────────────────────────────────────────┤
│  [Relays] [Events] [Testing] [Keys] [Console]                   │
├─────────────────────────────────────────────────────────────────┤
│  Connected Relays                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │ wss://relay.damus.io    │  │ wss://nos.lol           │       │
│  │ ● Connected             │  │ ● Connected             │       │
│  │ Latency: 45ms           │  │ Latency: 32ms           │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## NIP Tests

| NIP | Name | Description |
|-----|------|-------------|
| **NIP-01** | Basic Protocol | Create, sign, publish, and verify events |
| **NIP-02** | Follow List | Fetch and parse contact lists (kind 3) |
| **NIP-05** | DNS Identity | Verify NIP-05 addresses via DNS lookup |
| **NIP-19** | Bech32 Encoding | Encode/decode npub, nsec, nevent roundtrips |
| **NIP-44** | Encrypted Payloads | Test encryption/decryption with keypairs |
| **NIP-57** | Lightning Zaps | Parse zap receipts and verify LNURL endpoints |
| **NIP-90** | Data Vending Machines | Discover DVMs, view job requests and results |

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
│   │   └── monitor.go             # Health monitoring
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
└── go.mod
```

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

## Tech Stack

- **Backend**: Go + [go-nostr](https://github.com/nbd-wtf/go-nostr)
- **CLI**: [nak](https://github.com/fiatjaf/nak) for Nostr operations
- **Frontend**: Vanilla JS + WebSocket for real-time updates
- **Styling**: Custom CSS with dark theme

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
