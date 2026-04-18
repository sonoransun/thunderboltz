# Thunderbolt Architecture

```mermaid
graph TB
  subgraph LOCAL["User Device"]
    subgraph TAURI["Tauri Shell · Desktop · iOS · Android"]
      UI["React Frontend<br/>React 19 · Vite · Radix UI"]
      STATE["State & Data<br/>Zustand · TanStack Query · Drizzle"]
      AI["AI Chat<br/>Vercel AI SDK · MCP Client"]
      CRYPTO["E2E Encryption (optional)"]
      SQLITE[("SQLite<br/>Offline-first")]
      WEBLLM["In-browser inference<br/>WebGPU · @mlc-ai/web-llm"]

      UI --- STATE
      UI --- AI
      STATE --- SQLITE
      STATE --- CRYPTO
      AI -.-> WEBLLM
    end
    subgraph LOCALSERVERS["Local Model Servers (desktop only)"]
      OLLAMA["Ollama<br/>:11434"]
      LLAMACPP["llama.cpp<br/>:8080"]
    end
    TAURI -- "spawn / manage" --> LOCALSERVERS
  end

  subgraph SERVER["Server Infrastructure (self-hostable)"]
    direction LR
    API["Backend API<br/>Elysia on Bun"]
    AUTH["Auth<br/>Better Auth · OTP · OIDC"]
    INFERENCE["Inference Proxy<br/>Rate Limiting · Routing"]
    PS["PowerSync<br/>Sync Engine"]
    PG[("PostgreSQL")]

    API --- AUTH
    API --- INFERENCE
    PS --- PG
    AUTH --- PG
  end

  subgraph EXTERNAL["External Services"]
    direction LR
    LLM["LLM Providers<br/>Anthropic · OpenAI · Mistral · OpenRouter · HuggingFace"]
    OAUTH["OAuth<br/>Google · Microsoft"]
    POSTHOG["PostHog<br/>Analytics"]
    RESEND["Resend<br/>Email"]
  end

  CRYPTO -- "sync (HTTPS)" --> PS
  STATE -- "REST / HTTPS" --> API
  AI -- "SSE streaming" --> INFERENCE
  AI -- "OpenAI-compatible" --> LOCALSERVERS
  UI -- "OAuth redirect" --> AUTH

  INFERENCE --> LLM
  AUTH --> OAUTH
  API --> POSTHOG
  API --> RESEND

  style LOCAL fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#e2e8f0
  style TAURI fill:#1e293b,stroke:#3b82f6,stroke-width:1px,color:#e2e8f0
  style LOCALSERVERS fill:#1e293b,stroke:#10b981,stroke-width:1px,color:#e2e8f0
  style SERVER fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#e2e8f0
  style EXTERNAL fill:#0f172a,stroke:#ec4899,stroke-width:2px,color:#e2e8f0
```

> **Boundary key:** Blue = on-device · Green = local model server · Purple = self-hosted server · Pink = third-party SaaS

## Key Architectural Properties

- **Offline-first**: Local SQLite is the source of truth. The app works without network.
- **Cross-platform**: A single React codebase runs in Tauri on desktop (macOS, Linux, Windows) and mobile (iOS, Android).
- **Model-agnostic**: LLM calls route through the backend inference proxy for managed providers (Claude, GPT, Mistral, OpenRouter), or directly to local/third-party endpoints for Ollama, llama.cpp, HuggingFace, and in-browser WebGPU. See [Local Models](./local-models.md).
- **Zero-data-leaves-device mode**: When the user selects an Ollama, llama.cpp, or in-browser model, inference runs entirely on the user's machine — the backend inference proxy is never called.
- **Self-hostable**: The entire server stack (backend, PostgreSQL, PowerSync, Keycloak) runs via Docker Compose.
- **E2E Encrypted (optional)**: When enabled, data is encrypted before leaving the device and the server stores only ciphertext. See [E2E Encryption](./e2e-encryption.md) for details.

> ⚠️ **Note:** Multi-device sync is under active development and is subject to further refinements.

> ⚠️ **Note:** End-to-end encryption is under active development, has not yet undergone a cryptography audit, and is subject to further refinements.
