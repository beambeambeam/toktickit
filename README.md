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
| IT Staff | `e2e-staff@example.test`, `e2e-staff-second@example.test` |
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

## Lab 4 Actions Taken

Apply the committed additive migration with `pnpm --filter @toktickit/server exec prisma migrate deploy`, then run `pnpm db:generate` and `pnpm db:seed`. Existing Tickets receive no synthetic actions. Dedicated Lab 4 fixtures demonstrate zero, one, and multiple Planned actions; seed reruns preserve edited records.

On Ticket Detail, IT Staff and Administrators can add a Planned Action Taken with a description, optional result, eligible assignee, follow-up fields, and Attachment Notes. Assignment defaults to the signed-in user and does not change Ticket Owner. Requesters read the full action list on their own Tickets. Dates show Asia/Bangkok. Creation controls are hidden on Resolved, Closed, and Cancelled Tickets. The API also rejects new actions on those statuses with `409 TICKET_TERMINAL`; an identical saved request still replays without a second write. Staff and Administrators can edit or assign Planned and In Progress actions with explicit Save/Cancel. Completed and Cancelled actions remain read-only; lifecycle transitions belong to #76.

Keep the create form open after a connection failure and retry its original request. The client retains the request ID and payload, so a saved action with a lost response can be recovered without duplication. After a version conflict, refresh and review the latest Ticket before submitting the retained draft again.

Edits submit both the Action and Ticket versions captured when the form opens. A conflict preserves the draft and disables Save until **Refresh and review** loads the latest saved values; review them before explicitly saving again. Refresh never submits the draft. Assignment is independent of Performed by and Ticket Owner. An inactive or demoted current assignee remains visible and may be retained while correcting pending fields; selecting a different assignee requires active staff/Admin eligibility. Starting/completing work with an ineligible assignee is reserved for the lifecycle slice (#76).

Use **View history** on each action for paginated actor/time revisions and saved field snapshots. Requesters can read this history only on their own Tickets. Successful pending changes advance both versions and append one revision; a normalized no-op leaves versions and history unchanged. No additional migration or seed reset is required for edit/history support.

Run focused browser checks against a disposable database and Attachment directory:

```sh
pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-taken-flow.spec.ts lab-04/actions-edit-flow.spec.ts
```

API integration tests require an explicit `TOKTICKIT_TEST_DATABASE_URL`; fixtures create and remove isolated databases using that server. The migration/recovery check also requires PostgreSQL `pg_dump` and `pg_restore` on PATH, or `MIGRATION_POSTGRES_CONTAINER` naming the Docker container for that test server:

```sh
TOKTICKIT_TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:PORT/postgres' \
  pnpm --filter @toktickit/server exec tsx tests/lab-04/migration-recovery.ts
```

The check creates disposable databases, populates all earlier resources, verifies failed-migration rollback, successful migration, insert-only seed reruns, database backup restoration, and Attachment byte recovery. Before migrating any preserved environment, stop writes and back up both PostgreSQL and `ATTACHMENT_STORAGE_DIR`. Restore both together for recovery; do not drop the new tables after accepting live actions.
