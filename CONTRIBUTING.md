# Contributing

Thanks for contributing to `docs-driven-api-updater`.

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build:
   ```bash
   npm run build
   ```
3. Typecheck:
   ```bash
   npm run typecheck
   ```
4. Test:
   ```bash
   npm run test
   ```

## Coding Guidelines

- TypeScript-first, ESM-only.
- Keep changes minimal and focused.
- Add JSDoc for exported functions.
- Avoid introducing heavy dependencies.
- Preserve safety constraints in update flow.

## Pull Requests

- Use descriptive PR titles.
- Explain why the change is needed.
- Include manual verification steps.
- Keep generated artifacts out of commits when possible.

## Release Process

1. Update version in `package.json`.
2. Update `CHANGELOG.md`.
3. Run:
   ```bash
   npm run build && npm run typecheck && npm run test
   ```
4. Publish:
   ```bash
   npm publish --access public
   ```
