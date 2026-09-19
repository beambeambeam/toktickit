# TokTickit

TokTickit is a pnpm workspace containing the client and server applications.

## Requirements

- Node.js `>=22.18.0`
- pnpm `11.25.0`

Check installed versions:

```sh
node --version
pnpm --version
```

## Installation

Install workspace dependencies from repository root:

```sh
pnpm install
```

Create local environment files. These files are ignored by Git and must not contain committed secrets:

```sh
cp client/.env.example client/.env
cp server/.env.example server/.env
```

The server environment file contains PostgreSQL credentials, `DATABASE_URL`, and optional `ATTACHMENT_STORAGE_DIR`. Use local development values or your own uncommitted values.

## Database setup

Start and initialize PostgreSQL through root database scripts:

```sh
pnpm db:start
pnpm db:status
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

Open Prisma Studio with `pnpm db:studio`. Stop PostgreSQL with `pnpm db:stop`. For full database and Prisma instructions, see [server/README.md](server/README.md).

## Development

Start client and server together:

```sh
pnpm dev
```

Start one application independently:

```sh
pnpm --filter @toktickit/client dev
pnpm --filter @toktickit/server dev
```

Other useful commands:

```sh
pnpm --filter @toktickit/client preview
pnpm db:studio
pnpm db:stop
```

Start PostgreSQL before starting the server. The server verifies its Prisma connection before opening the HTTP listener.

The web app uses the Lab 3 email/password session flow. Requester-scoped calls use the authenticated User from the HttpOnly session cookie; mutating calls also send the in-memory CSRF token. First-login accounts must replace their issued password before opening the workspace. Ticket Attachments are written to the server's non-public `ATTACHMENT_STORAGE_DIR` (default: `server/.data/attachments`).

## Verification

Format and autofix lint issues:

```sh
pnpm run fix
```

Check formatting and lint without changing files:

```sh
pnpm run check
```

Run type checks, tests, and production builds:

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

## Browser E2E setup

Playwright tests live separately from client and server tests under `e2e/`. Install the Chromium browser once after installing workspace dependencies:

```sh
pnpm e2e:install
```

E2E uses the real client and API. Start PostgreSQL and apply the current database setup before running it:

```sh
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm test:e2e
```

Playwright starts the client and API automatically. Override their addresses with `E2E_BASE_URL` and `E2E_API_URL` when those services already run elsewhere. The E2E global setup removes tickets created by previous E2E runs (E2E-pattern summaries only) so the empty-state evidence holds on every run; it never touches reference data.

For Lab 3 evidence, use a fresh disposable PostgreSQL database and temporary Attachment directory; do not point the browser suite at a shared development database. The global setup provisions local-only fixture accounts in `server/scripts/prepare-e2e.ts`. Their password is `correct horse battery staple` and is test data only; never reuse it outside local E2E:

| Role | Fixture email |
| --- | --- |
| Requester | `e2e-desktop@example.test`, `e2e-tablet@example.test`, `e2e-mobile@example.test` |
| First-login Requester | `e2e-first-login-desktop@example.test`, `e2e-first-login-tablet@example.test`, `e2e-first-login-mobile@example.test` |
| IT Staff | `e2e-staff@example.test` |
| Administrator | `e2e-admin@example.test` |

Run the committed Lab 3 browser journeys with the direct filter used by the evidence manifests:

```sh
pnpm --filter @toktickit/e2e exec playwright test e2e/lab-03
```

Committed visual evidence is under `artifacts/lab-03/screenshots/`, with per-viewport manifests and the inspection record at `artifacts/lab-03/visual-checklist.md`. Temporary reports remain ignored under `e2e/test-results/` and `e2e/playwright-report/`.

Interactive commands:

```sh
pnpm test:e2e:headed
pnpm test:e2e:ui
```

Failure screenshots, traces, videos, and the HTML report are generated under `e2e/test-results/` and `e2e/playwright-report/`; both are ignored by Git. Lab 2 evidence remains under `artifacts/lab-02/`; Lab 3 integrated evidence belongs under `artifacts/lab-03/` and is committed separately from temporary Playwright diagnostics.
