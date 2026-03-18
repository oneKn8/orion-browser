# Research Report: AI Automated Browser - Open Source Tools & Research Papers

**Generated:** 2026-03-18
**Methodology:** Rule of 5 Deep Research
**Searches Performed:** 37+
**Sources Cited:** 60+

## Executive Summary

AI browser automation has exploded since 2024, driven by multimodal LLMs capable of interpreting web pages visually and through DOM. The field spans open-source frameworks (Browser-Use at 81k stars leads), foundational research papers (30+ key papers from WebArena to UI-TARS), and commercial products (Anthropic Computer Use, OpenAI CUA/Operator, Google Mariner). Vision-first approaches are winning over DOM-only methods. WebArena benchmark scores jumped from 14% to ~60% in two years. The market is projected at $2.87B by 2034. Key open challenges: grounding accuracy, safety/prompt injection, production reliability, and multi-step task completion on real websites.

---

## Part 1: Open-Source Tools & Frameworks

### Tier 1: Market Leaders

#### 1. Browser-Use
- **GitHub:** https://github.com/browser-use/browser-use
- **Stars:** 81.1k
- **License:** MIT
- **Architecture:** DOM restructuring + optional vision (hybrid). Strips irrelevant elements, labels interactive components for LLMs
- **LLM Backends:** ChatBrowserUse (optimized), OpenAI, Anthropic Claude, Google Gemini, Ollama (local)
- **Key Features:** Natural language tasking, persistent sessions, dynamic layout adaptation, CLI interface, custom tool extensions, cloud stealth browser option
- **Benchmark:** 89.1% success on WebVoyager (586 tasks) -- current SOTA for open-source
- **Founded:** 2024 by Magnus Muller & Gregor Zunic (YC-backed)
- **Last Active:** March 18, 2026
- **Limitations:** Python >= 3.11 required, memory-intensive for parallel agents, CAPTCHAs require cloud service, production deployments need Browser Use Cloud
- **Source:** https://browser-use.com/, https://www.ycombinator.com/companies/browser-use

#### 2. Stagehand (by Browserbase)
- **GitHub:** https://github.com/browserbase/stagehand
- **Stars:** 21.6k
- **License:** MIT
- **Architecture:** Hybrid -- AI + code-based Playwright automation via CDP engine
- **LLM Backends:** Configurable (requires API key for LLM provider)
- **Key Features:** `act()` for single actions, `agent()` for multi-step, `extract()` for data; auto-caching + self-healing; 44% faster in v3; TypeScript + Python + Rust SDKs
- **Last Active:** March 10, 2026 (v3.6.1)
- **Limitations:** Designed for Browserbase cloud infra; local use possible but optimized for cloud
- **Source:** https://www.stagehand.dev/, https://www.browserbase.com/blog/stagehand-v3

#### 3. Skyvern
- **GitHub:** https://github.com/Skyvern-AI/skyvern
- **Stars:** ~15k (estimated)
- **License:** AGPL-3.0 (core logic open; anti-bot in cloud offering)
- **Architecture:** Vision LLM + computer vision over Playwright
- **Key Features:** No-code workflow builder, Playwright-compatible SDK, self-writing/maintaining code (2.7x cheaper, 2.3x faster), visual page interpretation
- **Benchmark:** 85.85% on WebVoyager (v2.0 release)
- **Funding:** $2.7M seed (YC-backed)
- **Last Active:** Active 2026
- **Limitations:** AGPL license restricts commercial use without cloud; anti-bot features gated
- **Source:** https://www.skyvern.com/, https://www.ycombinator.com/companies/skyvern

### Tier 2: Notable Frameworks

#### 4. LaVague
- **GitHub:** https://github.com/lavague-ai/LaVague
- **Stars:** 6.3k
- **License:** Apache-2.0
- **Architecture:** World Model (planning) + Action Engine (Selenium/Playwright execution)
- **LLM Backends:** Default GPT-4o, customizable, supports local models (Gemma-7b)
- **Key Features:** Gradio UI, token counter, Chrome extension, QA testing via Gherkin specs
- **Last Active:** January 21, 2025 (appears less actively maintained)
- **Limitations:** Relatively inactive; smaller community
- **Source:** https://www.lavague.ai/, https://github.com/lavague-ai/LaVague

#### 5. AgentQL
- **GitHub:** https://github.com/tinyfish-io/agentql
- **Stars:** ~3k
- **License:** Open source
- **Architecture:** AI-powered query language + Playwright integration
- **Key Features:** Natural language selectors (replacing XPath/CSS), self-healing queries, Python + JS SDKs, REST API, Chrome debugger extension, Langchain/Zapier integrations
- **Limitations:** Query language is novel but niche adoption
- **Source:** https://www.agentql.com/, https://docs.agentql.com/

#### 6. Agent Browser (Vercel Labs)
- **GitHub:** https://github.com/vercel-labs/agent-browser
- **Stars:** 14k+
- **License:** Open source
- **Architecture:** Rust CLI giving AI agents direct browser control
- **Key Features:** Command-line browser control for AI agents, fast Rust implementation
- **Source:** https://github.com/vercel-labs/agent-browser

#### 7. Steel Browser
- **GitHub:** https://github.com/steel-dev/steel-browser
- **Stars:** ~5k
- **License:** Open source
- **Architecture:** Batteries-included browser sandbox API
- **Key Features:** Browser API for AI agents & apps, handles infrastructure complexity
- **Source:** https://github.com/steel-dev/steel-browser

#### 8. BrowserOS
- **GitHub:** https://github.com/browseros-ai/BrowserOS
- **Stars:** Growing
- **License:** Open source
- **Architecture:** Chromium fork with native AI agents
- **Key Features:** First open-source browser with built-in AI, privacy-first, natural language task automation, macOS/Windows/Linux
- **Positioning:** Alternative to ChatGPT Atlas, Perplexity Comet, Dia
- **Source:** https://www.browseros.com/

#### 9. Agent Browser Protocol (ABP)
- **GitHub:** https://github.com/theredsix/agent-browser-protocol
- **Architecture:** Deterministic browser automation protocol
- **Key Features:** Works out of box with Claude/Codex/OpenCode, deterministic (not probabilistic)
- **Source:** https://github.com/theredsix/agent-browser-protocol

#### 10. Nanobrowser
- **Website:** https://nanobrowser.ai/
- **Architecture:** Open source AI web agent
- **Key Features:** Lightweight AI-powered web agent
- **Source:** https://nanobrowser.ai/

#### 11. OpenFang
- **GitHub:** https://github.com/RightNow-AI/openfang
- **Architecture:** Full Agent Operating System built in Rust
- **Key Features:** Designed as OS for autonomous agents (not just browser)
- **Source:** https://github.com/RightNow-AI/openfang

### Tier 3: AI-Powered Testing Tools (Playwright-Based)

| Tool | Description |
|------|-------------|
| Auto Playwright | ChatGPT-powered natural language actions for Playwright |
| AIRAS Agent | Vision-enhanced browsing agent (GPT-4V + Ollama) |
| Midscene.js | Vision-driven UI automation integrated with Playwright |
| Playwright Skill (TestDino) | MIT-licensed structured guide for AI test generation |
| Octomind | Automated E2E testing at scale |
| QA Wolf AI | AI-driven QA automation |

### Cloud/Infrastructure Layer

| Service | Role | Notes |
|---------|------|-------|
| Browserbase | Managed headless browsers for AI | $40M Series B at $300M valuation (June 2025). "AWS for headless browsers" |
| Hyperbrowser | Cloud browser infra | Competitor to Browserbase |
| Browser Use Cloud | Managed Browser-Use deployment | Stealth mode, scaling, CAPTCHA solving |

### Commercial Agentic Browsers

| Browser | Stars/Users | Notes |
|---------|-------------|-------|
| Dia (Browser Company) | N/A | AI-native browser from Arc team; acquired by Atlassian Oct 2025 |
| Perplexity Comet | N/A | AI search-native browser |
| ChatGPT Atlas | N/A | OpenAI's browser agent (replaced Operator Aug 2025) |
| Opera Neon | N/A | Chromium-based, dual agent modes, 169+ models, $19.90/mo premium |

### Open-Source Tool Comparison Matrix

| Tool | Stars | License | Approach | LLM Backends | Language | WebVoyager Score |
|------|-------|---------|----------|-------------|----------|-----------------|
| Browser-Use | 81.1k | MIT | DOM + Vision | Multi-provider + Ollama | Python | 89.1% |
| Stagehand | 21.6k | MIT | Hybrid (AI + Code) | Configurable | TypeScript | N/A |
| Skyvern | ~15k | AGPL-3.0 | Vision LLM + CV | Multi-provider | Python | 85.85% |
| Agent Browser | 14k | Open | CLI + Rust | Multi-provider | Rust | N/A |
| LaVague | 6.3k | Apache-2.0 | World Model + Action | GPT-4o + local | Python | N/A |
| Steel Browser | ~5k | Open | Browser API | Agent-agnostic | TypeScript | N/A |
| AgentQL | ~3k | Open | Query Language | Multi-provider | Python/JS | N/A |
| BrowserOS | Growing | Open | Chromium Fork | Native | C++/JS | N/A |

---

## Part 2: Research Papers (30+ Papers)

### Foundational Papers (Pre-2024)

| # | Paper | Authors | Venue | Year | Key Contribution |
|---|-------|---------|-------|------|-----------------|
| 1 | **World of Bits (WoB)** | Shi, Karpathy, Fan, Hernandez, Liang | ICML 2017 | 2017 | First open-domain platform for web agents; introduced MiniWoB |
| 2 | **MiniWoB++** | Liu, Guu, Pasupat, Shi, Liang | ICLR 2018 | 2018 | Extended to 100+ web interaction environments; workflow-guided RL exploration |
| 3 | **WebGPT** | Nakano, Hilton, Kadavath et al. (OpenAI) | arXiv 2112.09332 | 2021 | GPT-3 fine-tuned for text-based web browsing + RLHF; 56% preferred over humans |
| 4 | **CC-Net** | Humphreys, Raposo, Pohlen et al. (DeepMind) | ICML 2022 | 2022 | Scaling demonstrations is key; hybrid vision+DOM; SOTA MiniWoB with 2.4M examples |
| 5 | **ReAct** | Yao, Zhao, Yu et al. | ICLR 2023 | 2022 | Foundational interleaved reasoning+acting paradigm; became de facto web agent pattern |
| 6 | **Set-of-Mark (SoM)** | Yang, Zhang, Li et al. (Microsoft) | arXiv 2310.11441 | 2023 | Visual prompting with alphanumeric marks on segmented regions; widely adopted |
| 7 | **Pix2Act** | Google DeepMind | NeurIPS 2023 | 2023 | Pure pixel agent (Pix2Struct + T5); outperformed human crowdworkers on MiniWoB++ |
| 8 | **CogAgent** | Hong, Wang et al. (Tsinghua) | CVPR 2024 | 2023 | 18B VLM with dual-resolution encoders (1120x1120); SOTA on 9 benchmarks screenshot-only |
| 9 | **Tree of Thoughts** | Yao, Yu, Zhao et al. | NeurIPS 2023 | 2023 | Tree-structured reasoning with backtracking; GPT-4 Game of 24: 4% CoT to 74% ToT |

### Benchmark Papers

| # | Paper | Venue | Year | Tasks | Human vs Best Model |
|---|-------|-------|------|-------|-------------------|
| 10 | **WebShop** | NeurIPS 2022 | 2022 | 12,087 instructions, 1.18M products | 59% vs 29% |
| 11 | **Mind2Web** | NeurIPS 2023 (Spotlight) | 2023 | 2,000+ tasks, 137 websites, 31 domains | First generalist web agent dataset |
| 12 | **WebArena** | ICLR 2024 | 2023 | 812 tasks, 4 self-hosted domains | 78.24% vs 14.41% (now ~60%) |
| 13 | **Android in the Wild (AITW)** | NeurIPS 2023 D&B | 2023 | 715K episodes, 30K instructions | Mobile GUI benchmark |
| 14 | **VisualWebArena** | ACL 2024 | 2024 | 910 tasks requiring visual understanding | 88.7% vs 16.4% |
| 15 | **OSWorld** | NeurIPS 2024 | 2024 | 369 tasks, Ubuntu/Windows/macOS | 72.36% vs 12.24% |
| 16 | **GUI-World** | 2024 | 2024 | 6 GUI scenarios, 8 question types | Video-based GUI benchmark |
| 17 | **BrowserGym** | TMLR 2025 | 2024 | Unified gym-like framework | Integrates WebArena, Mind2Web, MiniWoB++ |
| 18 | **Online-Mind2Web** | COLM 2025 | 2025 | 300 tasks, 136 real websites | Exposed inflated prior results |
| 19 | **WebBench** | 2025 | 2025 | ~2.5k READ + ACTION tasks | GitHub: Halluminate/WebBench |
| 20 | **MM-BrowseComp** | OpenReview 2025 | 2025 | 224 multimodal retrieval+reasoning questions | Multimodal browsing agent benchmark |
| 21 | **BrowseComp** | OpenAI | 2025 | Hard browsing tasks | Browsing agent challenge benchmark |

### Agent Architecture Papers (2024-2026)

| # | Paper | Venue | Year | Approach | Key Result |
|---|-------|-------|------|----------|-----------|
| 22 | **WebAgent** (DeepMind) | ICLR 2024 | 2023 | HTML-T5 + program synthesis | 70% success; +50% over single-LM |
| 23 | **SeeAct** (OSU NLP) | ICML 2024 | 2024 | GPT-4V vision + HTML grounding | 51.1% with manual grounding; grounding = bottleneck |
| 24 | **WebVoyager** | ACL 2024 | 2024 | End-to-end LMM on real sites | 59.1% (vs 30.8% GPT-4 All Tools) |
| 25 | **AutoWebGLM** (Tsinghua/Zhipu) | KDD 2024 | 2024 | Curriculum learning + self-sampling RL | ~10K browsing traces |
| 26 | **Agent-E** | arXiv 2407.13032 | 2024 | Hierarchical (Planner + Navigator + Executors) | +10-30% over prior SOTA |
| 27 | **Agent Q** | arXiv 2408.07199 | 2024 | MCTS + self-critique + DPO | LLaMA 3: 18.6% to 81.7% on OpenTable |
| 28 | **Agent Workflow Memory (AWM)** | ICML 2025 | 2024 | Reusable workflow routines from experience | +51.1% on WebArena, +24.6% on Mind2Web |
| 29 | **WebRL** | ICLR 2025 | 2024 | Self-evolving online curriculum RL | Consistent continual improvements |
| 30 | **UI-TARS** (ByteDance) | arXiv 2501.12326 | 2025 | End-to-end VLM, screenshot-only | OSWorld 24.6 (beats Claude 22.0); SOTA on 10+ benchmarks |
| 31 | **UGround** (OSU NLP) | ICLR 2025 Oral | 2024 | 10M elements + 1.3M screenshots visual grounding | +20% absolute over prior grounding |
| 32 | **GUI-Actor** (Microsoft) | NeurIPS 2025 | 2025 | Coordinate-free attention-based grounding | 7B model (44.6) beats UI-TARS-72B (38.1) on ScreenSpot-Pro |
| 33 | **ShowUI** | CVPR 2025 | 2025 | Qwen2-VL-2B enhanced for GUI | Efficient high-res screenshot processing |
| 34 | **BrowserAgent** | arXiv 2510.10666 | 2025 | Human-inspired browsing actions | Natural web interaction |
| 35 | **WebHierarch** (Stanford) | Stanford CS 224R | 2025 | Hierarchical skill learning | Two-tier task decomposition |

### Survey Papers

| # | Paper | Venue | Year | Focus |
|---|-------|-------|------|-------|
| 36 | **A Survey of WebAgents** | KDD 2025 | 2025 | Architecture + training + trustworthiness (most comprehensive) |
| 37 | **LLM-Brained GUI Agents: A Survey** (Microsoft) | arXiv 2411.18279 | 2024-25 | History, components, techniques, Large Action Models, benchmarks |
| 38 | **GUI Agents with Foundation Models Enhanced by RL** | arXiv 2504.20464 | 2025 | GUI agents x reinforcement learning intersection |
| 39 | **Building Browser Agents: Architecture, Security, Practical Solutions** | arXiv 2511.19477 | 2025 | Production focus: context > model scale, security requires programmatic constraints |

### Safety/Security Papers

| # | Paper | Venue | Year | Key Finding |
|---|-------|-------|------|-------------|
| 40 | **Dark Patterns and LLM-Based Web Agents** | IEEE S&P 2026 | 2025 | LiteAgent + TrickyArena; deceptive UI patterns affect agent decisions |
| 41 | **An Illusion of Progress?** | COLM 2025 | 2025 | Previously reported web agent results were inflated |

### Commercial System Papers/Announcements

| System | Company | Date | Key Results |
|--------|---------|------|------------|
| **Claude Computer Use** | Anthropic | Oct 2024 | OSWorld 14.9% (then-SOTA); pixel-counting; generalist training |
| **CUA / Operator** | OpenAI | Jan 2025 | OSWorld 38.1%; WebArena 58.1%; WebVoyager 87% |
| **ChatGPT Agent (Atlas)** | OpenAI | Jul 2025 | Replaced Operator (deprecated Aug 2025) |
| **Project Mariner** | Google | 2025 | Chrome extension for web agent tasks |
| **Cowork** | Anthropic | Jan 2026 | Research preview of expanded computer use |

---

## Part 3: Benchmarks & Evaluation

### Major Benchmarks

| Benchmark | Tasks | Websites | What It Measures | Current SOTA | Human |
|-----------|-------|----------|-----------------|-------------|-------|
| **MiniWoB++** | 100+ | Synthetic | Basic web interactions (clicks, forms) | ~95% (Pix2Act) | ~95% |
| **WebShop** | 12,087 | 1 (simulated e-commerce) | Product search + purchase | ~50% | 59% |
| **Mind2Web** | 2,000+ | 137 real | Generalist web navigation | ~45% | N/A |
| **WebArena** | 812 | 4 self-hosted | Long-horizon multi-step tasks | ~60% (CUA) | 78% |
| **VisualWebArena** | 910 | 3 | Visual understanding tasks | ~25% | 88.7% |
| **OSWorld** | 369 | Full desktop (Ubuntu/Win/Mac) | Computer-use across apps | 38.1% (CUA) | 72.4% |
| **WebVoyager** | 586 | 15 real | End-to-end real web tasks | 89.1% (Browser-Use) | ~90% |
| **AITW** | 715K episodes | Android | Mobile GUI control | UI-TARS 46.6 | N/A |
| **BrowseComp** | Varies | Real web | Hard browsing research tasks | OpenAI Deep Research | N/A |
| **MM-BrowseComp** | 224 | Real web | Multimodal retrieval + reasoning | New (2025) | N/A |
| **WebBench** | ~2,500 | Real web | READ + ACTION tasks | New (2025) | N/A |
| **BrowserGym** | Unified | Multiple | Standardized agent evaluation | Framework, not benchmark | N/A |
| **Online-Mind2Web** | 300 | 136 real | Real website generalization | Showed inflation in prior results | N/A |

### Benchmark Progress Timeline (WebArena)

```
2023 Jul: GPT-4 baseline             14.4%
2024 Jan: SeeAct (GPT-4V)            ~20%
2024 Mid: Agent-E                     ~35%
2024 End: Claude Computer Use         ~40%
2025 Jan: OpenAI CUA                  58.1%
2025 Mid: Various improvements        ~55-60%
2026:     Active area of competition   ~60%+
```

### LLM Model Benchmarks for Browser Tasks

| Model | WebArena | WebVoyager | OSWorld |
|-------|----------|------------|---------|
| GPT-4o | ~35% | ~70% | ~25% |
| Claude 3.5 Sonnet (Computer Use) | ~40% | N/A | 14.9% (Oct 2024) |
| OpenAI CUA (GPT-4o + RL) | 58.1% | 87% | 38.1% |
| UI-TARS (ByteDance) | N/A | N/A | 24.6% |
| Gemini 2.0 Flash | N/A | ~75% | N/A |

### Pareto-Optimal Configurations (Cost vs Accuracy)

Per HAL leaderboard analysis:
- **SeeAct + GPT-5 Medium** -- best accuracy/cost tradeoff
- **Browser-Use + Gemini 2.0 Flash** -- best budget option

---

## Part 4: Architecture Approaches

### Approach Comparison

| Approach | How It Works | Pros | Cons | Examples |
|----------|-------------|------|------|----------|
| **DOM-only** | Parse HTML, filter elements, feed to LLM | Structured, precise element targeting | Breaks on dynamic/JS-heavy sites; misses visual context | Mind2Web, early WebArena agents |
| **Vision-only** | Screenshot to VLM, pixel-level actions | No HTML dependency; works on any UI | Grounding imprecision; higher compute | UI-TARS, CogAgent, Pix2Act, Claude Computer Use |
| **Hybrid (DOM + Vision)** | Both HTML structure and screenshots | Best accuracy; redundant signals | Higher complexity and cost | Browser-Use, SeeAct, Agent-E |
| **Query Language** | AI interprets natural language selectors | Self-healing; cross-site compatible | Novel paradigm; learning curve | AgentQL |
| **Code Generation** | LLM generates Playwright/Selenium code | Deterministic execution; cacheable | Brittle to layout changes | LaVague, Skyvern v2 |

### Architecture Evolution (2017-2026)

```
2017-2020: RL on synthetic environments (MiniWoB)
     |
2021-2022: LLM-based text browsing (WebGPT, ReAct)
     |
2023: DOM/HTML parsing + LLMs (Mind2Web, WebArena)
     |
2024 H1: Vision enters (GPT-4V, SeeAct, CogAgent)
     |
2024 H2: Hybrid dominates (Agent-E, Browser-Use)
     |
2025: End-to-end VLMs (UI-TARS), RL enhancement (Agent Q, WebRL)
     |
2026: Production focus (Stagehand v3), agentic browsers (BrowserOS), MCP integration
```

### Key Architectural Insight (from arXiv 2511.19477)

> "Context management determines success more than model scale. Architecture matters more than LLM capabilities. Security requires programmatic constraints over LLM-based judgments. Specialization outperforms general-purpose approaches."

---

## Part 5: Trends & Market (2025-2026)

### What Converged to Make Browser Agents Viable

1. **LLMs got good enough** -- GPT-4o, Claude 4, Gemini 2.5 can accurately interpret page structure and plan multi-step actions
2. **Cloud browser infrastructure matured** -- Browserbase ($40M Series B), Hyperbrowser, etc.
3. **MCP became dominant** -- Model Context Protocol standardized how agents connect to tools/services

### Market Data

- Web scraping/automation market: **$2.87 billion by 2034** (14.3% CAGR)
- Browserbase valuation: **$300M** (June 2025)
- Browser-Use: 50k stars in 3 months, 81k total
- OpenClaw: 147k stars (fastest-growing OS AI project)

### Key Trends

1. **Vision-first is winning** -- Pure screenshot agents (UI-TARS, UGround, CogAgent) now outperform DOM/HTML approaches in most benchmarks
2. **Grounding remains the bottleneck** -- SeeAct, UGround, GUI-Actor all focus on this; GUI-Actor 7B beats UI-TARS 72B via better grounding
3. **RL is closing the gap** -- Agent Q (MCTS), WebRL (curriculum RL), UI-TARS (reflective traces)
4. **Production != Research** -- Context management > model scale; specialized > general-purpose
5. **Safety concerns growing** -- "Unmitigated agents fall for 24% of prompt injection attacks" (Anthropic research); dark patterns exploit agents; previously reported results were inflated
6. **Agentic browsers emerging** -- Full browsers with native AI (BrowserOS, Dia/Atlassian, Opera Neon, Perplexity Comet)
7. **Hybrid AI+Code is the production winner** -- Stagehand's approach (AI for understanding, code for execution) is more reliable than pure AI agents
8. **Self-evolving agents** -- Skyvern writes its own code; WebRL generates its own training curriculum; Agent Q self-improves via MCTS

### Open Challenges

1. **Grounding accuracy** -- Translating "click the submit button" to exact pixel/element still fails often
2. **Multi-step reliability** -- Error compounds across steps; 90% per-step accuracy = 35% over 10 steps
3. **Real-world generalization** -- Online-Mind2Web showed previously reported results were inflated on real sites
4. **Security** -- Prompt injection via web content, dark patterns, data exfiltration risks
5. **Cost** -- LLM API calls per action step add up fast for complex workflows
6. **CAPTCHAs and anti-bot** -- Require specialized infrastructure or cloud services
7. **Evaluation gaps** -- Static benchmarks don't capture real-world website dynamics

---

## Part 6: Recommended Reading Order

### If you have 1 hour:
1. **Survey of WebAgents** (KDD 2025) -- comprehensive landscape overview
2. **WebArena** (ICLR 2024) -- the benchmark that defined the field
3. **Building Browser Agents** (arXiv 2511.19477) -- production reality check

### If you have 1 day:
Add:
4. **Mind2Web** -- foundational dataset
5. **SeeAct** -- grounding as bottleneck
6. **UI-TARS** -- current SOTA vision agent
7. **Agent Q** -- RL for self-improvement
8. **LLM-Brained GUI Agents Survey** -- comprehensive taxonomy

### If building a browser agent:
- Start with **Browser-Use** (MIT, most mature, best benchmark scores)
- For TypeScript/production: **Stagehand** (Browserbase backing, self-healing, caching)
- For vision-first research: **UI-TARS** paper + UGround
- For evaluation: **BrowserGym** (unified framework)

---

## All Sources

### Open-Source Tools
1. [Browser-Use GitHub](https://github.com/browser-use/browser-use) - MIT, 81.1k stars
2. [Stagehand GitHub](https://github.com/browserbase/stagehand) - MIT, 21.6k stars
3. [Skyvern GitHub](https://github.com/Skyvern-AI/skyvern) - AGPL-3.0
4. [LaVague GitHub](https://github.com/lavague-ai/LaVague) - Apache-2.0, 6.3k stars
5. [AgentQL GitHub](https://github.com/tinyfish-io/agentql) - Open source
6. [Agent Browser (Vercel)](https://github.com/vercel-labs/agent-browser) - 14k stars
7. [Steel Browser](https://github.com/steel-dev/steel-browser) - Open source
8. [BrowserOS](https://github.com/browseros-ai/BrowserOS) - Open source
9. [Agent Browser Protocol](https://github.com/theredsix/agent-browser-protocol) - Open source
10. [Nanobrowser](https://nanobrowser.ai/) - Open source
11. [OpenFang](https://github.com/RightNow-AI/openfang) - Agent OS in Rust

### Research Papers
12. Shi et al. "World of Bits" ICML 2017
13. Liu et al. "MiniWoB++" ICLR 2018
14. Nakano et al. "WebGPT" arXiv 2112.09332 (2021)
15. Humphreys et al. "CC-Net" ICML 2022
16. Yao et al. "ReAct" ICLR 2023 (arXiv 2210.03629)
17. Yang et al. "Set-of-Mark Prompting" arXiv 2310.11441 (2023)
18. "Pix2Act" NeurIPS 2023 (arXiv 2306.00245)
19. Hong et al. "CogAgent" CVPR 2024 (arXiv 2312.08914)
20. Yao et al. "Tree of Thoughts" NeurIPS 2023 (arXiv 2305.10601)
21. Yao et al. "WebShop" NeurIPS 2022 (arXiv 2207.01206)
22. Deng et al. "Mind2Web" NeurIPS 2023 (arXiv 2306.06070)
23. Zhou et al. "WebArena" ICLR 2024 (arXiv 2307.13854)
24. "Android in the Wild" NeurIPS 2023 (arXiv 2307.10088)
25. Koh et al. "VisualWebArena" ACL 2024 (arXiv 2401.13649)
26. Xie et al. "OSWorld" NeurIPS 2024 (arXiv 2404.07972)
27. "BrowserGym" TMLR 2025 (arXiv 2412.05467)
28. Xue et al. "Online-Mind2Web" COLM 2025 (arXiv 2504.01382)
29. Gur et al. "WebAgent" ICLR 2024 (arXiv 2307.12856)
30. Zheng et al. "SeeAct" ICML 2024 (arXiv 2401.01614)
31. He et al. "WebVoyager" ACL 2024 (arXiv 2401.13919)
32. "AutoWebGLM" KDD 2024 (arXiv 2404.03648)
33. Abuelsaad et al. "Agent-E" arXiv 2407.13032 (2024)
34. Putta et al. "Agent Q" arXiv 2408.07199 (2024)
35. Wang et al. "Agent Workflow Memory" ICML 2025 (arXiv 2409.07429)
36. "WebRL" ICLR 2025 (arXiv 2411.02337)
37. Qin et al. "UI-TARS" arXiv 2501.12326 (2025)
38. "UGround" ICLR 2025 Oral (arXiv 2410.05243)
39. "GUI-Actor" NeurIPS 2025 (microsoft.github.io/GUI-Actor)
40. "ShowUI" CVPR 2025
41. "BrowserAgent" arXiv 2510.10666 (2025)
42. "WebHierarch" Stanford CS 224R (2025)
43. Ning et al. "Survey of WebAgents" KDD 2025 (arXiv 2503.23350)
44. Zhang et al. "LLM-Brained GUI Agents Survey" arXiv 2411.18279 (2024-25)
45. "GUI Agents with RL Survey" arXiv 2504.20464 (2025)
46. "Building Browser Agents" arXiv 2511.19477 (2025)
47. "Dark Patterns and LLM Web Agents" IEEE S&P 2026 (arXiv 2510.18113)

### Industry Sources
48. [Anthropic Computer Use Blog](https://www.anthropic.com/news/developing-computer-use)
49. [OpenAI CUA Blog](https://openai.com/index/computer-using-agent/)
50. [Browserbase Blog - Stagehand v3](https://www.browserbase.com/blog/stagehand-v3)
51. [Browser-Use YC Page](https://www.ycombinator.com/companies/browser-use)
52. [Firecrawl - 11 Best AI Browser Agents 2026](https://www.firecrawl.dev/blog/best-browser-agents)
53. [AIMultiple - 30+ Open Source Web Agents](https://aimultiple.com/open-source-web-agents)
54. [BrightData - 10 Best Agentic Browsers 2026](https://brightdata.com/blog/ai/best-agent-browsers)
55. [Browser-Use Benchmark Page](https://browser-use.com/posts/ai-browser-agent-benchmark)
56. [Skyvern Blog](https://www.skyvern.com/blog/)
57. [NoHacksPod - Agentic Browser Landscape 2026](https://www.nohackspod.com/blog/agentic-browser-landscape-2026)
58. [GUI-World Project](https://gui-world.github.io/)
59. [HuggingFace BrowserGym Paper](https://huggingface.co/papers/2412.05467)
60. [Microsoft GUI-Agent Survey](https://aka.ms/gui-agent)
