# orion-cli

Command-line interface for controlling Orion via MCP. Talks to the Orion MCP server over JSON-RPC 2.0 / StreamableHTTP.

## Setup

Requires Go 1.25+.

```bash
# Build
make

# First run — configure server connection
./orion-cli init
```

The `init` command prompts for your MCP server URL. Find it in:
**Orion → Settings → Orion MCP → Server URL**

The port varies per installation (e.g., `http://127.0.0.1:9004/mcp`).

Config is saved to `~/.config/orion-cli/config.yaml`.

## Usage

```bash
# Check connection
orion-cli health
orion-cli status

# Pages
orion-cli pages                 # List all tabs
orion-cli active                # Show active tab
orion-cli open https://example.com
orion-cli close 42

# Navigation
orion-cli nav https://example.com
orion-cli back
orion-cli forward
orion-cli reload

# Observation
orion-cli snap                  # Accessibility tree snapshot
orion-cli snap -e               # Enhanced snapshot
orion-cli text                  # Extract page as markdown
orion-cli links                 # Extract all links
orion-cli eval "document.title" # Run JavaScript

# Input
orion-cli click e5              # Click element by ref
orion-cli click-at 100 200      # Click at coordinates
orion-cli fill e12 "hello"      # Type into input
orion-cli key Enter             # Press key
orion-cli hover e3
orion-cli scroll down 500

# Screenshots & export
orion-cli ss                    # Screenshot (saves to screenshot.png)
orion-cli ss -o shot.png        # Screenshot to specific file
orion-cli pdf -o page.pdf       # Export as PDF

# Resource management (grouped commands)
orion-cli window list
orion-cli bookmark search "github"
orion-cli history recent
orion-cli group list
```

## Global Flags

| Flag | Env Var | Description |
|------|---------|-------------|
| `--server, -s` | `ORION_URL` | Server URL (default: from config) |
| `--page, -p` | `ORION_PAGE` | Target page ID (default: active page) |
| `--json` | `BOS_JSON=1` | JSON output (outputs structuredContent) |
| `--debug` | `BOS_DEBUG=1` | Debug output |
| `--timeout, -t` | | Request timeout (default: 2m) |

Priority for server URL: `--server` flag > `ORION_URL` env > config file

If no server URL is configured, the CLI exits with setup instructions instead of assuming a localhost port.

## Testing

Integration tests require a running Orion server with the dev build (for structured content support).

```bash
# 1. Start the dev server from the monorepo root
bun run dev:watch:new

# 2. Configure the CLI to point at the dev server
./orion-cli init
# Enter the Server URL shown in Orion settings

# 3. Run integration tests
make test

# Or with a custom server URL
ORION_URL=http://127.0.0.1:9105 go test -tags integration -v ./...
```

Tests skip gracefully if no server is reachable — they won't fail in environments without Orion.

The integration tests (`integration_test.go`) cover:
- Health check and version
- Page lifecycle: open → text → snap → eval → screenshot → nav → reload → close
- Active page query
- Info command
- Error handling (invalid page ID, JS errors)

## Build

```bash
make                    # Build binary
make vet                # Run go vet
make test               # Run integration tests
make install            # Install to $GOPATH/bin
make clean              # Remove binary
VERSION=1.0 make        # Build with version
```

## Architecture

```
apps/cli/
├── main.go             # Entry point
├── Makefile            # Build targets
├── config/
│   └── config.go       # Config file (~/.config/orion-cli/config.yaml)
├── cmd/
│   ├── root.go         # Root command, global flags
│   ├── init.go         # Server URL configuration
│   ├── open.go         # open (new_page / new_hidden_page)
│   ├── nav.go          # nav, back, forward, reload
│   ├── pages.go        # pages, active, close
│   ├── snap.go         # snap (take_snapshot / take_enhanced_snapshot)
│   ├── text.go         # text, links
│   ├── screenshot.go   # ss (take_screenshot / save_screenshot)
│   ├── eval.go         # eval (evaluate_script)
│   ├── click.go        # click, click-at
│   ├── fill.go         # fill, clear, key
│   ├── interact.go     # hover, focus, check, uncheck, select, drag, upload
│   ├── scroll.go       # scroll
│   ├── dialog.go       # dialog (handle_dialog)
│   ├── wait.go         # wait (wait_for)
│   ├── file_actions.go # pdf, download
│   ├── dom.go          # dom, dom-search
│   ├── window.go       # window {list,create,close,activate}
│   ├── bookmark.go     # bookmark {list,create,remove,update,move,search}
│   ├── history.go      # history {search,recent,delete,delete-range}
│   ├── group.go        # group {list,create,update,ungroup,close}
│   ├── health.go       # health, status (REST endpoints)
│   └── info.go         # info (orion_info)
├── mcp/
│   ├── client.go       # MCP JSON-RPC 2.0 client (initialize + tools/call)
│   └── types.go        # JSON-RPC and MCP type definitions
└── output/
    └── printer.go      # Human-readable and JSON output formatting
```

The CLI communicates with Orion via two HTTP POST requests per command:
1. `initialize` — MCP handshake
2. `tools/call` — execute the actual tool

All 54 MCP tools are mapped to CLI commands.
