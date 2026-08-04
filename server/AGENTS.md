# Server Project Rules

These rules apply to all files under `/server`.

## Structure

- `src/index.ts` is the process entrypoint. It owns environment parsing and the HTTP listener lifecycle.
- `src/app.ts` creates and composes the Express application. It must not start the listener.
- `src/config` owns configuration parsing and defaults.
- `src/middlewares` contains reusable Express middleware.
- `src/routes` composes HTTP routes.
- `src/controllers` translates HTTP requests and responses.
- `src/services` contains framework-independent application logic.
- `src/utils` contains server-only utilities.
- `src/types` contains shared server types.
- `src/db` owns database client configuration and access.
- `src/models` contains domain and persistence models.
- `src/repositories` owns persistence operations.
- `tests` contains API and integration tests.

Create layer directories when implementation needs them. Do not add placeholder files only to make empty directories visible.

## Boundaries

Keep dependency direction flowing from `routes` to `controllers`, then to `services`, and finally to `repositories` or `db`. Controllers adapt HTTP; services must not depend on Express; repositories and database code must not leak into controllers.

## Runtime conventions

- Server uses Node.js ESM.
- Relative imports use explicit `.js` extensions.
- Keep process startup in `src/index.ts` and application composition in `src/app.ts`.
- Run package scripts through pnpm: `dev`, `typecheck`, `build`, and `start`.
