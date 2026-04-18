# Local Models

Thunderbolt supports four providers for running open-weight models **without routing through Thunderbolt's hosted inference proxy**:

| Provider | Runs on | Transport | Network traffic |
| --- | --- | --- | --- |
| **Ollama** | Your machine | OpenAI-compatible HTTP (`:11434`) | Loopback only — inference stays on-device |
| **llama.cpp** | Your machine | OpenAI-compatible HTTP (`:8080`) | Loopback only — inference stays on-device |
| **HuggingFace (in-browser)** | Your browser tab | WebGPU via `@mlc-ai/web-llm` | Weights downloaded once; inference stays in-tab |
| **HuggingFace Router** | HuggingFace's cloud | OpenAI-compatible HTTPS | Your requests go to HuggingFace |

The first three are true local inference. The fourth routes through HuggingFace's hosted Inference Router — useful when you want access to open-weight models without running a local server, but it's not "local" in the privacy sense.

---

## Choosing a model for your task

The built-in **modes** (Chat · Search · Research) and **automations** (Daily Brief, Important Emails) have different requirements. Tool use, context length, and raw capability matter more for some than others. This table is a starting point — you can always edit a model's `toolUsage` flag from Settings → Models if the default is wrong for your setup.

| Task | What it needs | Recommended providers | Concrete model picks |
| --- | --- | --- | --- |
| **Chat mode** — casual Q&A, brainstorming | Low latency, minimal context | Anywhere | Ollama `llama3.2:3b`, HF in-browser `Llama-3.2-3B-Instruct`, Anthropic Haiku, Mistral 3.1 |
| **Search mode** — web lookups via `fetch_content` | **Reliable tool calling**, medium context | Router or hosted | Anthropic Sonnet, HF Router `Qwen/Qwen2.5-72B-Instruct`, OpenAI GPT-4o |
| **Research mode** — multi-step investigation | **Reliable tool calling**, long context, strong reasoning | Router or hosted | Anthropic Opus/Sonnet, HF Router `meta-llama/Llama-3.3-70B-Instruct` |
| **Automations** (Daily Brief etc.) | Tool calling, stable output | Router or hosted | Same as Search/Research |
| **Code assistance** | Code-tuned model, ≥16k context | Ollama (if RAM permits), HF Router | Ollama `qwen2.5-coder:14b` or `qwen2.5-coder:32b`, HF Router `Qwen/Qwen2.5-Coder-32B-Instruct` |
| **Confidential documents** | Zero network egress | **Ollama, llama.cpp, HF in-browser only** | Ollama `llama3.3:70b` if RAM permits, else `qwen2.5:14b` |
| **Offline / air-gapped** | No network at all | **Ollama, llama.cpp, HF in-browser only** | Same as above |
| **Lowest cost experimentation** | Free local inference | Ollama / llama.cpp / HF in-browser | Ollama `llama3.2:1b` or `qwen2.5:1.5b` |
| **Multi-modal (vision / audio)** | Vision-enabled model | Hosted (no local support yet) | Anthropic Claude, OpenAI GPT-4o |

### Important: tool-calling caveat for local models

Thunderbolt's Search, Research, and Automation features send tools (e.g. `fetch_content`, `search_web`, email/calendar actions) to the model. Small local models frequently emit malformed tool JSON, which Thunderbolt drops. **If a small local model seems to "ignore" the tools you expect it to use, that's usually the cause.** Fixes:

1. Try a bigger model (14B+ tends to be the inflection point — Qwen 2.5 14B and Llama 3.3 70B are reliable).
2. Switch to the HuggingFace Router for the same open-weight model (the router's inference server handles grammar-constrained decoding more carefully than a local install).
3. Or pick a hosted provider (Anthropic / OpenAI) for tool-heavy modes and keep a local model for Chat.

### Assigning a model per automation

Automations (Settings → Automations) let you choose **which model runs the automation**, independent of the current chat mode. You can keep chat on a small/fast model while routing the Daily Brief at 7 AM through Sonnet. Setting → Automations → edit → **Model**.

### Tuning a local model

Settings → Models → click the model:

- **Tool Usage** — turn on if you've confirmed the model handles tool calls. Leave off for 1B/3B local models.
- **Context Window** — set to what the runtime actually supports (e.g., Ollama's default is often lower than the model's maximum; consult `ollama show <model>`).
- **URL** — point to a non-default host if you're running Ollama/llama.cpp on another machine on your LAN.

---

## Provider comparison

| | Ollama | llama.cpp | HF in-browser | HF Router |
| --- | --- | --- | --- | --- |
| Platforms | Desktop (Tauri) | Desktop (Tauri) | Web + Tauri desktop with WebGPU | All |
| Requires user install | Yes (`ollama` binary) | Yes (`llama-server` binary) | No — bundled | No — remote |
| Tool use | Off by default (flip per model) | Off by default | Off (not supported) | On by default |
| First-run cost | `ollama pull <model>` | Download a gguf | Download model weights (hundreds of MB – GBs) | API token |
| Credentials | None | None | None | HuggingFace token |

---

## Ollama

### 1. Install the binary

```sh
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download the installer from https://ollama.com/download
```

Pull at least one model:

```sh
ollama pull llama3.2
```

### 2. Let Thunderbolt spawn it

When Thunderbolt is built as a desktop Tauri app, the **Models** settings page exposes a "Local Model Servers" panel with Start / Stop controls for Ollama. Thunderbolt detects the binary on `PATH` (with fallbacks to `~/.local/bin`, `/usr/local/bin`, `/opt/homebrew/bin`, `/usr/bin` for AppImage environments) and spawns `ollama serve` as a managed child process. The process is killed when you quit the app, so Ollama won't linger.

You can also run `ollama serve` yourself — Thunderbolt detects an already-running server via the status check.

### 3. Add a model

- Settings → Models → **Add Model**
- Provider: **Ollama**
- URL pre-fills to `http://localhost:11434/v1` (override if you run Ollama elsewhere)
- Click the model dropdown's **refresh** icon — Thunderbolt calls Ollama's `/api/tags` endpoint and lists installed models
- Pick one, save, and open a chat

### 4. Tool use

Small local models (≤8B params) often produce malformed tool JSON. Tool use is **disabled by default** on new Ollama models. If your chosen model handles tools well, toggle `toolUsage` on per-model.

---

## llama.cpp

### 1. Install and run

```sh
# macOS
brew install llama.cpp

# Download a gguf model
curl -L -o model.gguf https://huggingface.co/.../llama-3.2-3b-q4.gguf

# Serve it
llama-server -m model.gguf --port 8080
```

Thunderbolt's sidecar manager can also spawn `llama-server` automatically — supply the model path in the server options and it spawns with `--port 8080`.

### 2. Add a model

- Provider: **llama.cpp**
- URL pre-fills to `http://localhost:8080/v1`
- Model field accepts any string (llama.cpp doesn't expose a discoverable model list)
- Save and chat

---

## HuggingFace (in-browser)

**Runs the model entirely inside your browser tab using WebGPU** via [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm). No server involved, no data leaves the tab.

### Requirements

- A browser with WebGPU enabled (Chrome 113+, Edge 113+, Safari 26+). Firefox users need to enable `dom.webgpu.enabled` in `about:config`.
- Several GB of free disk space for weight caching.
- A relatively recent GPU (4+ GB VRAM recommended for 3B models).

The provider option is **hidden** on browsers without WebGPU and on mobile, so you won't see it unless it'll work.

### Adding an in-browser model

- Provider: **HuggingFace (in-browser)**
- The model dropdown shows a curated list (Llama 3.2 1B/3B, Qwen 2.5 0.5B/1.5B/7B, Phi 3.5 Mini) with approximate download sizes
- Select one and save

### First use

The first message triggers a download of the model weights. Progress is reported in the chat UI. Subsequent runs (even after a hard refresh) use the cached weights from IndexedDB.

### Limitations

- No tool use.
- No vision / audio.
- One engine per tab (switching models reloads weights).

---

## HuggingFace Router

The HuggingFace Inference Router is an OpenAI-compatible HTTPS endpoint that fronts many open-weight models without requiring you to run a server.

### Get a token

1. Create an account at <https://huggingface.co/>.
2. Generate a token at <https://huggingface.co/settings/tokens> with **inference** permission.

### Adding a Router model

- Provider: **HuggingFace**
- URL pre-fills to `https://router.huggingface.co/v1`
- Paste your HF token in the API Key field
- Click the model dropdown's refresh icon — the list is fetched from `router.huggingface.co/v1/models` and filtered to router-served models only
- Save and chat

---

## Privacy boundary

When you pick a local provider, the chat request bypasses the Thunderbolt backend inference proxy entirely. Check the [architecture diagram](./architecture.md) for the full picture:

- **Ollama / llama.cpp** — requests go over localhost. Nothing leaves your machine.
- **HuggingFace (in-browser)** — requests go through the worker thread, never over the network. Model weights are downloaded once from HuggingFace's CDN.
- **HuggingFace Router** — requests go over HTTPS to `router.huggingface.co` with your token.

The backend inference proxy is only contacted for managed providers (`thunderbolt`, the default set) — Anthropic, OpenAI, OpenRouter, and custom endpoints with a user-supplied key route directly from the client.

---

## Technical details

Under the hood:

- **Provider dispatch** — `src/ai/fetch.ts`'s `createModel()` switch. Ollama, llama.cpp, and HuggingFace Router all use `@ai-sdk/openai-compatible`. HuggingFace (in-browser) uses a custom `LanguageModelV2` adapter in `src/ai/huggingface-local-provider.ts` that forwards to a dedicated worker (`src/ai/llm-inference.worker.ts`).
- **Sidecar management** — `src-tauri/src/local_server.rs` exposes four Tauri commands (`detect_local_binary`, `start_local_server`, `stop_local_server`, `local_server_status`). Spawned children are tracked in `LocalServerState(Mutex<HashMap<String, Child>>)` and killed on `RunEvent::ExitRequested` so processes don't leak.
- **Bundle strategy** — `@mlc-ai/web-llm` is code-split into an `llm-inference` chunk (see `vite.config.ts`'s `manualChunks`). Main bundle only loads the library when the user selects the in-browser provider.
- **CSP** — `src-tauri/tauri.conf.json` allows `connect-src` to `http://localhost:11434`, `http://localhost:8080`, `https://router.huggingface.co`, `https://huggingface.co`, and `https://raw.githubusercontent.com`; `script-src` includes `'wasm-unsafe-eval'` for web-llm's WebAssembly runtime.
- **Seeded defaults** — one disabled-by-default entry per provider ships in `src/defaults/models.ts`. Enable them from Settings → Models.

---

## Troubleshooting

**"binary not found" when starting Ollama** — Thunderbolt couldn't find `ollama` on `PATH`. On Linux AppImages, PATH is sandboxed — install to `~/.local/bin` or `/usr/local/bin`. You can also run `ollama serve` manually and Thunderbolt will detect it as already-running.

**HuggingFace (in-browser) option missing** — The UI hides this provider on browsers without WebGPU. Confirm `navigator.gpu` is defined in DevTools. On Firefox, enable `dom.webgpu.enabled`.

**In-browser model fails with "WebAssembly compilation blocked by CSP"** — Make sure your deployment's CSP includes `'wasm-unsafe-eval'` in `script-src`. The shipped Tauri CSP already does; hosted deployments must replicate this.

**Chat returns empty responses from a small Ollama model** — The model probably doesn't support tool use reliably. Go to the model's detail page and toggle `toolUsage` off.

**Ollama keeps running after I quit Thunderbolt** — Thunderbolt only kills servers *it spawned*. If you started `ollama serve` yourself, stop it yourself. If it's a process Thunderbolt spawned and it's still running, that's a bug — please file an issue.
