# Orion -- Agentic Browser Design Document

**Date:** 2026-03-18
**Status:** Draft
**Vision:** An open-source agentic browser forked from BrowserOS where AI is a first-class citizen. Users interact with the web through natural language. The browser plans, executes, remembers, and learns.

---

## 1. Product Vision

### What Orion Is
An open-source Chromium-based browser with AI built natively into the browser process. Not a wrapper, not an extension, not an external controller -- the agent lives inside the browser and has direct access to the DOM, compositor, and event system.

### Core Differentiators
- **Native AI agent** -- 10-12x faster browser operations vs Playwright/CDP approaches
- **Provider-agnostic** -- swap between OpenAI, Anthropic, Gemini, Ollama, llama.cpp seamlessly
- **Agent memory** -- remembers workflows, sites, preferences across sessions
- **Built-in workflow engine** -- Airtable, forms, research, scraping as native browser features
- **Multi-step planner** -- goal decomposition with error recovery and retry
- **Native ad blocking** -- uBlock Origin filter lists compiled in, not bolted on
- **Privacy-first** -- local LLM support means zero data leaves your machine

### Target Users
Power users, developers, automation engineers who want a browser that works for them autonomously.

### Based On
Fork of BrowserOS (https://github.com/browseros-ai/BrowserOS) -- open-source Chromium fork with existing AI agent scaffolding.

---

## 2. Technical Architecture

### Layer Diagram

```
+---------------------------------------------------------------+
|                     ORION BROWSER SHELL                        |
|  +----------------------------------------------------------+ |
|  |  Layer 4: Workflow Engine                                 | |
|  |  Skills registry | Triggers | Airtable, forms, research  | |
|  +----------------------------------------------------------+ |
|  |  Layer 3: Agent Core                                      | |
|  |  DOM Extractor | Vision | Actions | Planner | Memory      | |
|  +----------------------------------------------------------+ |
|  |  Layer 2: Provider Abstraction                            | |
|  |  OpenAI | Anthropic | Gemini | Ollama | llama.cpp         | |
|  |  Model Router | Token Tracking | Fallback Chain           | |
|  +----------------------------------------------------------+ |
|  |  Layer 1: Browser Shell (Chromium via BrowserOS fork)     | |
|  |  Rendering | Native Ad Blocker | AI Sidebar | CDP Bridge  | |
|  |  Tab Manager | New Tab Page | Command Bar                 | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

### Layer 1: Browser Shell

**Base:** BrowserOS Chromium fork
**Language:** C++ (Chromium core), JavaScript/TypeScript (UI layers)

Components:
- **Chromium rendering engine** -- unmodified web rendering
- **Native ad blocker** -- uBlock Origin's filter engine compiled into the browser binary. Loads EasyList, EasyPrivacy, Peter Lowe's list, and uBlock filters at startup. No extension overhead. Blocks at the network request level before resources load.
- **AI sidebar** -- persistent, resizable panel on the right side. Shows agent chat, current task status, action log, and memory. Implemented as a browser-native panel (not a web page).
- **Command bar** -- Cmd/Ctrl+K overlay for natural language commands. Type a goal, agent executes it. Also supports traditional URL entry.
- **Tab manager** -- agent-aware tab management. Agent can open, close, switch, and group tabs. Each tab exposes its DOM and state to the agent without CDP serialization.
- **New tab page** -- custom page showing recent agent tasks, saved workflows, quick actions.

### Layer 2: Provider Abstraction

**Language:** TypeScript (runs in browser's Node.js/V8 context)

```
Interface: LLMProvider
  - send(messages: Message[], config: ModelConfig): AsyncStream<Chunk>
  - models(): Model[]
  - supports(capability: string): boolean

Implementations:
  - OpenAIProvider (GPT-4o, GPT-4.1, o3, o4-mini)
  - AnthropicProvider (Claude Opus, Sonnet, Haiku)
  - GeminiProvider (Gemini 2.5 Pro, Flash)
  - OllamaProvider (any Ollama-served model)
  - LlamaCppProvider (direct GGUF loading)
```

**Model Router:**
- Routes tasks to appropriate models based on complexity
- Fast model (Haiku, Flash, local small) for: element identification, simple clicks, extraction
- Strong model (Opus, GPT-4.1, o3) for: multi-step planning, complex reasoning, error recovery
- User-configurable routing rules
- Token tracking and cost estimation per session
- Fallback chain: if primary provider fails (rate limit, error), automatically try next

**Configuration:**
- Settings UI for adding/removing providers
- API key management (encrypted local storage)
- Ollama auto-detection (localhost:11434)
- Model download manager for llama.cpp GGUF files

### Layer 3: Agent Core

**Language:** TypeScript with C++ bindings for performance-critical paths

#### DOM Extractor
- Direct access to Chromium's render tree (no serialization)
- Strips irrelevant elements (scripts, styles, hidden elements, ads)
- Labels interactive elements with unique IDs (like Set-of-Mark but DOM-native)
- Outputs clean, LLM-friendly representation of the page
- Handles iframes, shadow DOM, dynamic content
- Performance target: full page extraction in <20ms

#### Vision Module
- Captures screenshots directly from compositor buffer (no PNG encode/transfer)
- Set-of-Mark overlay: draws numbered labels on interactive elements
- Dual-mode: text-only (DOM) for simple pages, vision+DOM for complex/dynamic pages
- Visual diff detection: knows when page has meaningfully changed
- Performance target: screenshot capture in <30ms

#### Action Executor
Executes browser actions in-process:
- `click(elementId)` -- click identified element
- `type(elementId, text)` -- type into input/textarea
- `scroll(direction, amount)` -- scroll page or element
- `navigate(url)` -- go to URL
- `wait(condition)` -- wait for element, network idle, timeout
- `extract(selector, schema)` -- pull structured data from page
- `tab(action)` -- open, close, switch tabs
- `download(url, path)` -- download file
- `screenshot()` -- capture current viewport
- All actions return result + updated page state
- Performance target: <5ms per action (excluding network waits)

#### Planner (ReAct Loop)
```
Input: User goal (natural language)

Loop:
  1. OBSERVE -- extract DOM state + optional screenshot
  2. THINK -- LLM reasons about current state vs goal
  3. PLAN -- decompose remaining work into next action(s)
  4. ACT -- execute action via Action Executor
  5. VERIFY -- check if action succeeded (DOM changed as expected)
  6. REPEAT or COMPLETE

Error handling:
  - Action failed -> retry with different approach (up to 3x)
  - Page changed unexpectedly -> re-observe and re-plan
  - Goal seems impossible -> report to user with explanation
  - Stuck in loop -> escalate to stronger model or ask user
```

**Planning strategies:**
- Single-step: simple commands ("click login")
- Multi-step sequential: ordered task list ("fill this form")
- Hierarchical: goal decomposition into sub-goals ("book a flight")
- Parallel: independent sub-tasks on different tabs simultaneously

#### Memory System
- **Short-term:** current task context, recent actions, page history (in-memory)
- **Long-term:** persisted to local SQLite + vector store
  - Site knowledge: login flows, navigation patterns, element locations
  - Workflow patterns: recorded sequences that worked before
  - User preferences: default values for forms, preferred options, behavioral patterns
- **Vector store:** local embeddings (via local model or provider) for semantic search over memory
- **Memory triggers:** automatically stores successful workflow completions
- **Privacy:** all memory is local. Optional encrypted sync between devices.

### Layer 4: Workflow Engine

#### Skill Registry
Skills are packaged workflows the browser knows how to execute.

```
Interface: Skill
  - name: string
  - description: string
  - triggers: Trigger[]
  - parameters: Parameter[]
  - execute(params, agent): Result

Built-in skills:
  - AirtableSkill: CRUD operations, view management, field manipulation
  - FormFillerSkill: detect forms, fill with user data or AI-generated content
  - ResearchSkill: multi-tab search, read, extract, synthesize
  - ScraperSkill: navigate pagination, extract structured data, export CSV/JSON
  - MonitorSkill: watch page for changes, alert on conditions
```

#### Trigger System
- **Manual:** user types command or clicks skill button
- **Scheduled:** cron-style recurring execution (check price daily, scrape weekly)
- **Event-based:** page matches URL pattern, element appears, notification received
- **Chained:** skill A completes -> skill B starts

#### Skill Builder
- Record mode: user performs actions, browser records as replayable skill
- Edit mode: modify recorded steps, add conditions, parameterize
- Share mode: export/import skills as JSON files
- Community: optional skill marketplace (future phase)

---

## 3. Phased Roadmap

### Phase 1: Foundation
**Goal:** Fork BrowserOS, get it building, establish Orion identity, native ad blocking.

Tasks:
- Fork BrowserOS repository
- Set up build system (GN + Ninja for Chromium)
- Rename/rebrand to Orion (icons, strings, about page)
- Integrate uBlock Origin filter engine natively (compile adblock-rust or use existing C++ filter parser)
- Load EasyList + EasyPrivacy + uBlock filters at startup
- Block ads at network request level (before resource loads)
- Verify browser launches, renders pages, blocks ads
- Strip BrowserOS features we don't need / will replace
- Set up CI for automated builds (Linux first, then macOS, Windows)

**Deliverable:** Orion browser that launches, renders web, blocks ads. No AI yet.

### Phase 2: Provider Abstraction + AI Sidebar
**Goal:** Add LLM integration with provider switching, basic AI chat about current page.

Tasks:
- Implement LLMProvider interface and all backends (OpenAI, Anthropic, Gemini, Ollama, llama.cpp)
- Model router with fast/strong model selection
- Token tracking and cost display
- API key management UI (encrypted storage)
- Ollama auto-detection
- AI sidebar panel (browser-native, not extension)
- Sidebar can: chat about current page, summarize content, answer questions
- Pass current page DOM/text to LLM as context
- Settings page for provider configuration
- Fallback chain implementation

**Deliverable:** Orion with working AI sidebar. User can chat with any LLM about any page.

### Phase 3: Browser Agent Core
**Goal:** Agent can follow single-step natural language commands.

Tasks:
- DOM extractor with clean LLM-friendly output
- Interactive element labeling (Set-of-Mark style, DOM-native)
- Vision module: compositor screenshot capture
- Action executor: click, type, scroll, navigate, wait, extract
- Command bar (Cmd/Ctrl+K) for natural language input
- Single-step command execution: "click the login button", "type hello in the search box"
- Action result verification (did the page change as expected?)
- Action log in sidebar (show what agent did and why)

**Deliverable:** User types a command, agent executes it on the page. Single actions only.

### Phase 4: Multi-Step Planner
**Goal:** Agent can achieve complex goals through planning and execution.

Tasks:
- ReAct planning loop (observe -> think -> plan -> act -> verify)
- Goal decomposition into sub-steps
- Error recovery: retry with different approach, escalate to stronger model
- Stuck detection and user escalation
- Multi-tab support (agent opens tabs as needed)
- Parallel execution for independent sub-tasks
- Progress display in sidebar (current step, remaining steps, status)
- Plan editing: user can modify/approve plan before execution
- Hierarchical planning for complex goals

**Deliverable:** "Book a flight from NYC to London under $500" works end-to-end.

### Phase 5: Memory & Learning
**Goal:** Agent remembers and improves over time.

Tasks:
- SQLite local database for structured memory
- Vector store for semantic search (local embeddings)
- Short-term context management (current session)
- Long-term site knowledge (login flows, nav patterns)
- Workflow recording: watch user, extract replayable pattern
- User preference learning (form defaults, behavioral patterns)
- Memory viewer/editor in settings
- Cross-session memory persistence
- Privacy controls: what to remember, what to forget

**Deliverable:** Agent gets better with use. Knows your sites, your preferences, your patterns.

### Phase 6: Built-in Workflows
**Goal:** Native skill system with built-in and custom workflows.

Tasks:
- Skill registry and execution engine
- Built-in skills: Airtable, form filler, research, scraper, monitor
- Trigger system: manual, scheduled (cron), event-based, chained
- Skill builder: record mode (watch and learn from user)
- Skill editor: modify steps, add conditions, parameterize
- Skill import/export (JSON format)
- Skill library UI in new tab page
- Scheduled execution (background tasks)

**Deliverable:** Users can build, save, share, and schedule browser workflows.

### Phase 7: Polish & Ship
**Goal:** Production-ready open-source release.

Tasks:
- UI/UX polish across all surfaces
- Keyboard shortcuts and accessibility
- Extension support (Chrome extensions compatibility)
- Auto-updater
- Crash reporting (opt-in)
- Documentation site
- Landing page
- GitHub release automation
- Community contribution guidelines
- Launch on HN, Reddit, Product Hunt

**Deliverable:** Public open-source release of Orion.

---

## 4. Tech Stack Summary

| Component | Technology | Why |
|-----------|-----------|-----|
| Browser engine | Chromium (via BrowserOS fork) | Industry standard, web compat |
| Browser UI | C++ / JavaScript | Chromium's native stack |
| AI sidebar | TypeScript / React | Fast iteration on UI |
| Provider layer | TypeScript | Async-friendly, type-safe |
| Agent core | TypeScript + C++ bindings | TS for logic, C++ for perf-critical |
| Ad blocker | adblock-rust or C++ filter parser | Native performance, no extension overhead |
| Memory store | SQLite | Local, fast, zero-config |
| Vector store | sqlite-vss or hnswlib | Local embeddings search |
| Embeddings | Local model (all-MiniLM-L6) or provider | Privacy-first default |
| Build system | GN + Ninja | Chromium's build system |
| CI/CD | GitHub Actions | Standard, free for open source |
| Package | .deb, .dmg, .exe installers | Native platform packaging |

---

## 5. Project Structure (Planned)

```
orion/
  src/
    browser/           # Chromium fork modifications
      adblocker/       # Native ad blocking engine
      sidebar/         # AI sidebar panel
      commandbar/      # Cmd+K command overlay
      newtab/          # Custom new tab page
    providers/         # LLM provider abstraction
      openai.ts
      anthropic.ts
      gemini.ts
      ollama.ts
      llamacpp.ts
      router.ts        # Model routing logic
    agent/             # Agent core
      dom/             # DOM extraction and labeling
      vision/          # Screenshot and visual grounding
      actions/         # Action executor
      planner/         # ReAct planning loop
      memory/          # Memory system
    workflows/         # Workflow engine
      skills/          # Built-in skills
      triggers/        # Trigger system
      recorder/        # Skill recording
    ui/                # Shared UI components
  filters/             # Ad block filter lists
  docs/                # Documentation
  tests/               # Test suites
  build/               # Build configuration
```

---

## 6. Success Criteria

### Phase 1
- Orion builds and launches on Linux
- Pages render correctly
- Ads are blocked (verify on ad-heavy sites)
- BrowserOS bloat stripped

### Phase 2
- Can chat with GPT-4o, Claude, Gemini, and Ollama about a page
- Provider switching works without restart
- Token usage displayed accurately

### Phase 3
- "Click the login button" works on 90%+ of sites
- DOM extraction runs in <20ms
- Actions execute in <5ms

### Phase 4
- Multi-step tasks complete with >70% success rate on common workflows
- Error recovery handles at least 2 retry strategies
- User can see and modify plan before execution

### Phase 5
- Agent remembers login flows after seeing them once
- Recorded workflows replay successfully
- Memory persists across browser restarts

### Phase 6
- Airtable skill can create/read/update records
- Scraper handles paginated sites
- Scheduled tasks run in background

### Phase 7
- Installs cleanly on Linux, macOS, Windows
- Chrome extensions work
- Documentation covers all features

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| BrowserOS fork diverges, hard to merge upstream | High | Track upstream changes, contribute back |
| Chromium build complexity (long build times, large codebase) | Medium | Docker build environment, CI caching, incremental builds |
| LLM costs for heavy agent use | Medium | Model router uses cheapest model that works; local LLM default |
| Ad blocker cat-and-mouse with sites | Low | Use well-maintained filter lists, community contributions |
| Agent safety (accidental purchases, data leaks) | High | Confirmation prompts for destructive actions, sandbox mode, spending limits |
| Chrome extension compatibility breaks | Medium | Track Chromium extension API changes, test popular extensions |

---

## 8. Open Questions

1. **Branding:** Logo, color scheme, visual identity TBD
2. **Telemetry:** Opt-in analytics for crash reporting? What data?
3. **Sync:** Multi-device memory sync? End-to-end encrypted?
4. **Marketplace:** Community skill sharing platform? Later phase?
5. **Mobile:** Android/iOS version? Much later or never?
