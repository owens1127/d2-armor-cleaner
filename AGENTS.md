# Agent guidance

Global conventions for AI agents working in this repo.

## Punctuation and copy

- Do not use em dashes (U+2014, `—`) in user-facing copy, comments meant for users, or docs.
- Prefer short sentences, commas, hyphens, or middle dots (`·`) for labels and list-like phrases.
- Keep UI and doc text concise and plain.

## Code changes

- Match existing naming, imports, and patterns. Minimize scope.
- No git commits or pushes unless the user asks.
- Before finishing: run `npm test` and `npm run build`.

## Tests

- Prefer integration/flow tests over trivial unit tests.
- Assert behavior and outcomes, not implementation strings.
- See `.cursor/rules/testing.mdc` for details.
