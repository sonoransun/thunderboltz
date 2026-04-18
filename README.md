# Thunderboltz!

**A fork of AI You Control: Choose your models. Own your data. Experiment with capabilities and providers.**

![Thunderbolt Main Dashboard](./docs/screenshots/main.png)

Thunderbolt is an open-source, cross-platform AI client that can be deployed on-prem anywhere.

- 🌐 Available on all major desktop and mobile platforms: web, iOS, Android, Mac, Linux, and Windows.
- 🧠 Compatible with frontier, local, and on-prem models.
- 🖥️ First-class support for local inference via [Ollama, llama.cpp, HuggingFace Router, and in-browser WebGPU](./docs/local-models.md) — no data leaves your machine when you use these providers. See the [task → model guide](./docs/local-models.md#choosing-a-model-for-your-task) for which models to pair with Chat, Search, Research, and Automations.
- 🙋 Enterprise features, support, and FDEs available.

**Thunderbolt is under active development, currently undergoing a security audit, and preparing for enterprise production readiness.**

## Documentation

- [FAQ](./docs/faq.md) - Frequently asked questions
- [Deployment](./deploy/README.md) - Self-host with Docker Compose or Kubernetes
- [Development](./docs/development.md) - Quick start, setup, and testing
- [Architecture](./docs/architecture.md) - System architecture and diagrams
- [Local Models](./docs/local-models.md) - Run inference locally via Ollama, llama.cpp, HuggingFace, or in-browser WebGPU
- [Features and Roadmap](./docs/roadmap.md) - Platform and feature status
- [Claude Code Skills](./docs/claude-code.md) - Slash commands, automation, and subtree syncing
- [Storybook](./docs/storybook.md) - Build, test, and document components
- [Vite Bundle Analyzer](./docs/vite-bundle-analyzer.md) - Analyze frontend bundle size
- [Tauri Signing Keys](./docs/tauri-signing-keys.md) - Generate and manage signing keys for releases
- [Release Process](./RELEASE.md) - Instructions for creating and publishing new releases
- [Telemetry](./TELEMETRY.md) - Information about data collection and privacy policy

## Code of Conduct

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md). All participants in the Thunderbolt community agree to follow these guidelines and [Mozilla's Community Participation Guidelines](https://www.mozilla.org/about/governance/policies/participation/).

## Security

If you discover a security vulnerability, please report it responsibly via our [vulnerability reporting form](https://github.com/thunderbird/thunderbolt/security/advisories/new). Please do **not** file public GitHub issues for security vulnerabilities.

## License

Thunderbolt is licensed under the [Mozilla Public License 2.0](./LICENSE).
