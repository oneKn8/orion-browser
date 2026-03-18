# Orion Browser -- Project Conventions

## Repository Structure

Monorepo with two main packages:
- `packages/orion` -- Chromium build system (Python, C++, patches)
- `packages/orion-agent` -- Chrome extension and agent system (TypeScript, React)

## Build Commands

### Agent (packages/orion-agent)
```bash
bun install              # Install dependencies
bun run build:dev        # Development build
bun run build            # Production build
bun run test             # Run tests
bun run lint             # Lint check
bun run typecheck        # TypeScript type checking
```

### Browser (packages/orion)
```bash
python build/build.py --config build/config/debug.linux.yaml --chromium-src /path/to/src --build
```

## Code Style

### TypeScript (Agent)
- Strict typing, no `any`
- Zod schemas for data validation (not raw TypeScript interfaces)
- Path aliases: use `@/lib` not `../../../lib`
- PascalCase for classes/components, camelCase for functions/variables, UPPERCASE for constants
- Tailwind CSS only for styling (no SCSS, no CSS modules)
- Vitest for testing (not Jest)
- Keep functions under 20 lines where practical

### C++ (Chromium Patches)
- Follow Chromium style guide
- All new files go in `chromium_patches/`
- Patch files reference paths within the Chromium source tree

### Python (Build System)
- Python 3.11+
- uv for dependency management
- pyright for type checking

## Environment Variables

Key env vars used by the system (prefix indicates scope):
- `ORION_SERVER_PORT` -- Local agent server port
- `ORION_CDP_PORT` -- Chrome DevTools Protocol port
- `ORION_EXTENSION_PORT` -- Extension communication port
- `ORION_BINARY` -- Path to Orion browser binary
- `ORION_RESOURCES_DIR` -- Path to resources directory
- `VITE_ORION_SERVER_PORT` -- Server port exposed to Vite builds

## Key Directories

- `packages/orion/chromium_patches/` -- Patches applied to Chromium source
- `packages/orion/build/` -- Build system scripts and configs
- `packages/orion/resources/` -- Icons, version file, entitlements
- `packages/orion-agent/apps/agent/` -- Main agent extension UI
- `packages/orion-agent/apps/server/` -- Local agent server
- `packages/orion-agent/apps/controller-ext/` -- Browser controller
- `packages/orion-agent/tools/` -- MCP server and CLI tools

## Version File

Version is stored in `packages/orion/resources/ORION_VERSION`:
```
ORION_MAJOR=0
ORION_MINOR=1
ORION_BUILD=0
ORION_PATCH=0
```

## Important Notes

- The `browserOS` Chrome permission in Chromium patches refers to a compiled Chromium API name. It cannot be renamed without rebuilding Chromium from source with the full patch set. Leave references to this permission as-is.
- Chromium patches reference paths like `chrome/browser/orion/` -- these are paths within the Chromium source tree, not within this repo.
- The agent can be developed independently using any Chromium browser. The custom Chromium build is only needed for browser-level features.
