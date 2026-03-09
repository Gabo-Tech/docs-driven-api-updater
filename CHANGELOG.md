# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-03-09

### Added
- Initial release of `docs-driven-api-updater`.
- Universal docs-driven update pipeline for third-party API integrations.
- CLI commands:
  - `docs-driven-api-updater init`
  - `docs-driven-api-updater update`
- Provider abstraction for OpenRouter and local Ollama.
- Fallback model chain and retry-aware failover for status codes `402`, `404`, `408`, and `429`.
- Prompt-size and crawl-size controls via environment variables.
- Strict JSON schema validation for LLM-generated plans.
- Safety gate to reject suspicious model outputs before file apply.
- Diff planning for allowlisted targets only.
- CI workflow for scheduled/manual runs with PR artifact generation.
- Example Stripe integration templates.
- Test stubs for schema validation, patch summaries, and safety gate checks.
