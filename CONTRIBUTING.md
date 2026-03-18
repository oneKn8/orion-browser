# Contributing to Orion

Thanks for your interest in Orion. Whether you are fixing bugs, adding features, or improving docs, contributions are welcome.

Orion is a monorepo with two main parts:
- **Agent** -- The Chrome extension with AI agent features (TypeScript/React)
- **Browser** -- The custom Chromium build (C++/Python)

Most contributors start with the agent since it is easier to set up and iterate on.

## Agent Development

The agent is a Chrome extension that provides AI-powered browser automation.

### Setup

```bash
cd packages/orion-agent
bun install
cp .env.example .env       # Add your LITELLM_API_KEY
bun run build:dev          # Development build
```

### Load in Browser

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select `packages/orion-agent/dist/`
5. Click the Agent icon in the extensions toolbar to open the agent panel

For detailed architecture and code standards, see [packages/orion-agent/CONTRIBUTING.md](packages/orion-agent/CONTRIBUTING.md).

## Browser Development

Building the custom Chromium browser requires significant disk space and time. Only needed for browser-level patches.

### Prerequisites

- ~100GB disk space for Chromium source
- 16GB+ RAM recommended
- Platform tools:
  - macOS: Xcode + Command Line Tools
  - Linux: build-essential and dependencies
  - Windows: Visual Studio Build Tools

### Setup

**1. Checkout Chromium source**

Follow the official guide: [Chromium: Get the Code](https://www.chromium.org/developers/how-tos/get-the-code/)

This sets up `depot_tools` and fetches the Chromium source tree (~100GB, 2-3 hours).

**2. Build Orion**

```bash
cd packages/orion

# Debug build (for development)
python build/build.py --config build/config/debug.linux.yaml \
  --chromium-src /path/to/chromium/src --build

# Release build (for production)
python build/build.py --config build/config/release.linux.yaml \
  --chromium-src /path/to/chromium/src --build
```

Replace `linux` with `macos` or `windows` as appropriate. Build typically takes 1-3 hours.

## Making a Contribution

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run tests and lint checks
5. Open a pull request

### Pull Request Guidelines

- Clear title in conventional commit format (e.g., `fix: resolve tab crash on navigation`)
- Description explaining what changed and why
- Screenshots or videos for UI changes
- Link to related issues (e.g., "Fixes #123")

## Code Standards

### TypeScript (Agent)

- Strict typing -- always declare types, avoid `any`
- Zod schemas for data validation instead of raw TypeScript interfaces
- Path aliases -- use `@/lib` not relative paths like `../../../`
- Naming: PascalCase for classes/components, camelCase for functions/variables, UPPERCASE for constants
- Tailwind CSS only for styling
- Vitest for testing

### C++ (Chromium Patches)

- Follow the [Chromium style guide](https://chromium.googlesource.com/chromium/src/+/HEAD/styleguide/c++/c++.md)
- All new files go in `chromium_patches/`

### Python (Build System)

- Python 3.11+
- Type hints required
- pyright for type checking

## Project Structure

```
orion-browser/
  packages/
    orion/                    Chromium build system
      build/                  Python build scripts
      chromium_patches/       Patches to Chromium source
      resources/              Icons, version, configs
    orion-agent/              Chrome extension
      apps/
        agent/                Main agent UI
        server/               Local agent server
        controller-ext/       Browser controller
        eval/                 Evaluation framework
      packages/               Shared libraries
      tools/                  MCP server, CLI tools
  docs/                       Documentation
```

## Reporting Bugs

[Open an issue](https://github.com/oneKn8/orion-browser/issues/new) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or videos if applicable
- OS and Orion version

## Suggesting Features

Open an issue with the `enhancement` label describing the problem you want solved and your proposed approach.

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.
