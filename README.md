# Orion Browser

A privacy-first, AI-native Chromium fork that runs browser agents locally. Your keys, your data, your machine.

## What is Orion?

Orion is a custom Chromium browser with a built-in AI agent system. It combines a patched Chromium build with a powerful Chrome extension that enables browser automation, MCP server integration, and local LLM support.

```
orion-browser/
|
|-- packages/orion/            Chromium build system + patches
|   |-- build/                 Python build scripts and configs
|   |-- chromium_patches/      Source patches applied to Chromium
|   |-- chromium_files/        Additional files injected into Chromium
|   |-- resources/             Icons, version info, entitlements
|   |-- series_patches/        Ordered patch series
|   `-- tools/                 Build utilities
|
|-- packages/orion-agent/      Chrome extension (AI agent)
|   |-- apps/
|   |   |-- agent/             Main agent UI (side panel, new tab)
|   |   |-- server/            Local agent server (Node.js)
|   |   |-- controller-ext/    Browser controller extension
|   |   `-- eval/              Agent evaluation framework
|   |-- packages/              Shared libraries
|   `-- tools/                 MCP server, CLI tools
|
`-- docs/                      Project documentation
```

## Core Capabilities

- **Browser Agent** -- AI-powered automation that runs in your browser, not in the cloud
- **MCP Server** -- 31 tools exposing browser control to Claude Code, Gemini CLI, or any MCP client
- **Workflows** -- Visual graph builder for repeatable browser automations
- **Cowork** -- Combine browser automation with local file operations
- **Scheduled Tasks** -- Run agents on autopilot at configurable intervals
- **LLM Hub** -- Compare Claude, ChatGPT, and Gemini side-by-side on any page
- **Ad Blocking** -- Built-in uBlock Origin with Manifest V2 support
- **Privacy Patches** -- Enhanced privacy from ungoogled-chromium patches
- **Local LLM Support** -- Ollama and LMStudio integration, no cloud required

## Development

### Agent Development (recommended starting point)

The agent is a Chrome extension. Most development happens here.

```bash
cd packages/orion-agent
bun install
cp .env.example .env    # Add your LITELLM_API_KEY
bun run build:dev
```

Load in any Chromium browser:
1. Open chrome://extensions/
2. Enable Developer mode
3. Click Load unpacked
4. Select packages/orion-agent/dist/

### Browser Development

Building the Chromium fork requires ~100GB disk and 16GB+ RAM. Only needed for browser-level patches.

```bash
# First: follow https://www.chromium.org/developers/how-tos/get-the-code/
# Then:
cd packages/orion

# Debug build
python build/build.py --config build/config/debug.linux.yaml \
  --chromium-src /path/to/chromium/src --build

# Release build
python build/build.py --config build/config/release.linux.yaml \
  --chromium-src /path/to/chromium/src --build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup instructions.

## Roadmap

### Phase 1 -- Foundation (current)
- Rebrand and fork from upstream
- Establish independent build pipeline
- Set up CI/CD for agent and browser builds

### Phase 2 -- Agent Enhancements
- Improved tool reliability and error recovery
- Better multi-tab coordination
- Enhanced workflow builder
- Agent memory and context persistence

### Phase 3 -- Browser Integration
- Deeper Chromium-level agent integration
- Custom DevTools panels for agent debugging
- Native sidebar improvements
- Performance profiling for agent actions

### Phase 4 -- Platform
- Plugin system for third-party agent tools
- Shared workflow marketplace
- Cross-device sync (encrypted, self-hosted option)

## Architecture

The system has two main components that communicate over a local WebSocket/HTTP connection:

**Orion Browser** (Chromium fork) -- A patched Chromium build that includes a local server proxy, extension management, metrics collection, and custom UI (welcome page, settings). The build system applies patches from `chromium_patches/` to the Chromium source tree and produces platform-specific binaries.

**Orion Agent** (Chrome extension) -- A multi-app extension system:
- `agent` -- Main AI agent with side panel UI, new tab page, and LLM integrations
- `server` -- Local Node.js server providing tool execution, file operations, and MCP endpoints
- `controller-ext` -- Browser controller handling tab management, navigation, and DOM interaction
- `eval` -- Testing and evaluation framework for agent quality

## License

AGPL-3.0. See [LICENSE](LICENSE).

## Credits

- [ungoogled-chromium](https://github.com/ungoogled-software/ungoogled-chromium) -- Privacy patches
- [The Chromium Project](https://www.chromium.org/) -- The foundation
