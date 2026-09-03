# TokTickit

TokTickit is a pnpm workspace containing the client and server applications.

## Requirements

- Node.js `>=22.18.0`
- pnpm `11.13.0`

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

The web app starts with a testing-only Development Requester selection. After selection, requester-scoped calls use the validated `X-Development-Requester-Id` context to create and view owned Tickets. Authentication is intentionally deferred to Lab 3. Ticket Attachments are written to the server's non-public `ATTACHMENT_STORAGE_DIR` (default: `server/.data/attachments`).

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

Interactive commands:

```sh
pnpm test:e2e:headed
pnpm test:e2e:ui
```

Failure screenshots, traces, videos, and the HTML report are generated under `e2e/test-results/` and `e2e/playwright-report/`; both are ignored by Git. Required course evidence belongs under `artifacts/lab-02/screenshots/` with the comparison record in `artifacts/lab-02/visual-checklist.md`, and is committed separately from temporary Playwright diagnostics.
