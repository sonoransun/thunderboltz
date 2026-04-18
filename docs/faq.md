# Frequently Asked Questions

### How is Thunderbolt funded?

Thunderbolt is funded through a grant from Mozilla.

### What is Thunderbolt's relationship to Thunderbird?

Thunderbolt is a separate product developed under the same entity, MZLA Technologies. It is not part of Thunderbird's existing products.

### Is there going to be a hosted version if I don't want to deploy it myself?

Yes, we are planning to launch Thunderbolt for regular users but we do not have a release date yet.

### I have a bug / suggestion / feature request - how can I contribute?

Please [submit an issue](https://github.com/thunderbird/thunderbolt/issues) or open a pull request.

### Can I run models locally without talking to any cloud service?

Yes. Thunderbolt ships with four providers designed for local inference:

- **Ollama** and **llama.cpp** — spawn a user-installed binary on desktop; inference stays on your machine.
- **HuggingFace (in-browser)** — runs the model in your browser tab via WebGPU; weights are downloaded once and cached.
- **HuggingFace Router** — cloud inference for open-weight models (not local, but a one-click upgrade when a model is too big for your hardware).

See [Local Models](./local-models.md) for setup, the provider comparison, and a **"Choosing a model for your task"** table matching each built-in mode (Chat, Search, Research, Automations) to the models most likely to work well.

### Which local model should I use for Search or Research mode?

Search and Research use tool calling (`fetch_content`, `search_web`, etc.). Small local models (1B–7B) frequently emit malformed tool JSON. Use a larger model (Qwen 2.5 14B+ via Ollama, or route through HuggingFace Router / Anthropic / OpenAI). Chat mode works fine with small local models. Full guidance in [Local Models: Choosing a model for your task](./local-models.md#choosing-a-model-for-your-task).
