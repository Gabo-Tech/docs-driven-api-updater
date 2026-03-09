# Changelog

All notable changes to this project are documented in this file.

## [1.0.2] - 2026-03-09

### Fixed
- Removed duplicate shebang injection in CLI build output by stopping `tsup` banner shebang usage.
- Restored executable CLI behavior so `npx docs-driven-api-updater --help` works on modern Node versions.

## [1.0.1] - 2026-03-09

### Fixed
- Corrected published `bin` metadata to ensure `npx docs-driven-api-updater` resolves properly.
- Added release hardening docs (`CONTRIBUTING.md`) and prepublish quality gate in package scripts.

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
