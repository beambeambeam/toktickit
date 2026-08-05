# Agent Guidance

## Scope

These instructions apply to the repository. `client/AGENTS.md` and `server/AGENTS.md` adds guidance for indiviual apps

## Project

Use pnpm. Keep changes scoped to the requested work and inspect existing patterns before adding new abstractions.

CI runs `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, then `pnpm run build`. Run relevant checks before handoff; run full CI checks when changes affect shared configuration, dependencies, or build behavior.

## Change Workflow

1. Read the nearest applicable AGENTS.md and inspect related code.
2. Reuse existing components, utilities, state patterns, and tests.
3. Make the smallest complete change; do not rewrite unrelated code.
4. Run formatting/checks appropriate to changed files.
5. Report checks run and any known limitation.
