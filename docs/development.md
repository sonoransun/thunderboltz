# Development

## Quick Start

You must have Bun, Rust, and Docker installed first. Then:

```sh
# Install dependencies
make setup

# Set up .env files
cp .env.example .env
cd backend && cp .env.example .env
cd ..

# Run postgres + powersync
make docker-up

# Run backend
# cd backend && bun dev

# Browser:
bun dev
# -> open http://localhost:1420 in your browser.

# Desktop
bun tauri:dev:desktop

# iOS Simulator
bun tauri:dev:ios

# Android Emulator
bun tauri:dev:android
```

## Testing local model providers

Thunderbolt supports running models via Ollama, llama.cpp, HuggingFace Router, and in-browser WebGPU. See [Local Models](./local-models.md) for user-facing setup. Developer notes:

- The Ollama and llama.cpp sidecar commands are **desktop-only** (`#[cfg(desktop)]` in `src-tauri/src/local_server.rs`), so test them with `bun tauri:dev:desktop`, not `bun dev`.
- In-browser inference via `@mlc-ai/web-llm` is lazy-loaded (see `vite.config.ts`'s `manualChunks`). To verify the chunk split, run `bun run analyze` and confirm an `llm-inference-*.js` chunk exists separately from the main entry.
- CSP allows `'wasm-unsafe-eval'` in `script-src` specifically for web-llm. Non-Tauri hosted deployments must replicate this.
- Tauri capabilities in `src-tauri/capabilities/default.json` include `http://localhost:11434` (Ollama), `http://localhost:8080/:8081` (llama.cpp), `https://router.huggingface.co`, `https://huggingface.co`, and `https://raw.githubusercontent.com` (web-llm weight manifests).

## Testing

```sh
# Run frontend tests (src/ and scripts/)
bun run test

# Run frontend tests in watch mode
bun run test:watch

# Run backend tests
bun run test:backend

# Run backend tests in watch mode
bun run test:backend:watch
```

**Note**: Don't use `bun test` without the npm script from the project root, as it will pick up both frontend and backend tests. The `test` script is configured to only run tests in `./src` and `./scripts` directories.

See [testing.md](./testing.md) for detailed testing guidelines.
