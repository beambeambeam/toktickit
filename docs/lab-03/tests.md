# Lab 3 Test Plan and Traceability

Status: #50 authentication/Requester continuity, #51 queue/detail, #52 ownership/IT Priority, #53 workflow/indication, #54 public Ticket comments, #55 private Internal Notes, #56 user administration, and #57 account lifecycle are implemented on `lab3-staging`. The Final column records executed coverage and remaining gaps; the automatable Lab 3 gates now run in the full browser suite, while final-main and external submission gates remain pending under #58. [Specification](./specification.md) defines each AC; [API](./api-spec.md) and [UI](./ui-spec.md) define exact expected behavior. Existing Lab 2 results are not Lab 3 evidence.

## 1. Strategy and seams

Primary seam: Supertest HTTP through composed Express, disposable PostgreSQL databases and temporary Attachment storage, following `server/tests/lab-02/requester-ticketing.test.ts`. Test cookies, CSRF, authorization, persisted outcomes, concurrency and errors via observable behavior. Client uses existing Vitest/React Testing Library for controls, routing/cache boundaries and feedback. Pure unit tests are limited to meaningful password/query/transition rules. No new test framework. Feature slices use red/green at these seams. #50 adapts the selector-dependent cases to real login and removes obsolete context tests while retaining their ownership/recovery intent.

Existing `client/tests/lab-02/`, `server/tests/lab-02/` and `e2e/lab-02/` remain regression inputs. Generalize Playwright discovery to both lab directories; preserve desktop 1440×900, tablet 768×1024, mobile 390×844. Browser runs use a fresh disposable database and Attachment storage fixture per run; no E2E test relies on a mutable application-seed `mustChangePassword` flag. Each vertical slice owns one complete browser journey and negative cases. Final full browser run is required under #58.

## 2. Test register

Final values identify implemented coverage and remaining gaps. Ranges below enumerate exact ACs in the traceability table that follows.

| Test ID | Type | Planned file | What it tests / expected result | Final |
| --- | --- | --- | --- | --- |
| UNIT-01 | Unit | server/tests/lab-03/auth-rules.test.ts | Password 14/15/128/129 code points, astral characters, spaces/paste semantics, reuse and normalization: exact contract bounds. | Pass — 2 tests |
| UNIT-02 | Unit/E2E | server/tests/lab-03/workflow-rules.test.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | All 8×8 status edges and owner/confirmation requirements; only matrix edges succeed. | Pass — the live API exercises all 64 current/next pairs and lifecycle confirmation/stale-version edges. |
| API-01 | API/integration | server/tests/lab-03/auth.api.test.ts | Valid/unknown/invalid/inactive login, generic failures, restricted/me/change/logout, rotation, cookie/hash storage, throttling and replay. | Partial — 5 tests pass; exact expiry boundaries remain planned |
| SEC-01 | Security | server/tests/lab-03/auth.api.test.ts | Account/IP throttling, malformed-input reservations, inactive-account throttling, CSRF and safe failures. | Partial — 5 tests pass; full concurrency/origin/expiry matrix remains planned |
| SEC-02 | Security/authorization | server/tests/lab-03/authorization.api.test.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Parameterize every role × API operation, restricted/anonymous, requesterId/header spoofing, foreign Ticket/file/comment, nested-note leakage and identical 403 on note IDs. | Pass — live E2E role/resource checks cover reference data, Ticket lists/detail, owners/users, attachments, comments, private notes, foreign resources and protected writes. |
| REG-01 | Migration/regression | server/tests/lab-03/migration.api.test.ts; server/scripts/check-migration-preservation.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Start at populated Lab 2 schema, snapshot IDs/times/FKs/bytes/removed attribution; upgrade preserves all, collisions abort; repeated deploy/bootstrap/seeds retain edits and fixture counts. | Pass — populated-schema preservation, normalized-email collision abort, and idempotent edited-seed checks pass in the migration gate. |
| REG-02 | Migration/regression | server/tests/lab-02/requester-ticketing.test.ts | Authenticated creation/list/detail/file lifecycle, exact limits, concurrent capacity, failed-write compensation, removal retry and foreign/removed download denial on all statuses. | Pass — the existing Lab 2 API/browser regression suites pass in the full server and browser runs. |
| API-02 | API/integration | server/tests/lab-03/staff-queue.api.test.ts; server/tests/lab-03/ticket-queue-rules.test.ts | Every queue query/default/filter, literal search, severity order, deterministic ties, same-snapshot counts, out-of-range pages, malformed/repeated/unknown/contradictory parameters and read-only admin. | Pass — 5 API tests + 13 parser tests |
| API-03 | API/integration | server/tests/lab-03/staff-ticket-detail.api.test.ts; server/tests/lab-03/ticket-ownership.api.test.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Claim one winner, reassignment/unassignment, eligible admin owner, stale/terminal denial, independent priority, every status edge, timestamps, idempotent indication/reopen and account-change races. | Pass — live E2E covers the claim one-winner race, concurrent comments, complete status matrix, terminal confirmation, stale version and session-revocation edges. |
| API-04 | API/integration | server/tests/lab-03/internal-notes.api.test.ts; server/tests/lab-03/ticket-comments.api.test.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Private-note and public-comment role visibility, backend attribution, empty/1/5000/5001 code points, HTML payload stored as text, stable ordering, bounded public reads, terminal write race, no edit/delete/status side effect or cross-surface metadata leak. | Pass — existing API tests plus live concurrent-comment and private-note isolation checks pass. |
| API-05 | API/integration | server/tests/lab-03/users-admin.api.test.ts; server/tests/lab-03/users-edit.api.test.ts; server/tests/lab-03/users-lifecycle.api.test.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | List/create/edit/reset authorization, CSRF/origin rejection, validation, password secrecy, search/filter, normalized duplicate races, created-account first-login restrictions, revocation, self-deactivation, last-admin protection and owner effects. | Pass — full server suites plus live duplicate-create and concurrent role/deactivation session-revocation checks pass. |
| UI-01 | UI component | client/tests/lab-03/authentication.test.tsx; e2e/lab-03/missing-states.spec.ts | Required inputs, generic credential failure, accessible password visibility and permitted first-login landing, including the IT Staff account destination. | Partial — 7 focused tests pass; three-viewport E2E adds invalid, inactive, busy and rate-limit UI states; backend expiry/role matrix remains planned |
| UI-02 | UI component | client/tests/lab-03/authentication.test.tsx | Password rules, confirmation, successful replacement and contextual 429/Retry-After handling. | Partial — 5 tests pass; reuse/failure/secret-clearing matrix remains planned |
| UI-03 | UI component | client/tests/lab-03/auth-context.test.tsx; authentication.test.tsx | Principal-switch private-cache clearing and requester denial for a non-Requester role. | Partial — identity isolation and role denial covered; full shell matrix remains planned |
| UI-04 | UI component | client/tests/lab-03/staff-ticket-queue.test.tsx | Query controls/reset, numbered pages, empty/no-results/loading/failure/retry, clear filters and detail link. | Pass — 7 tests |
| UI-05 | UI component | client/tests/lab-03/staff-ticket-detail.test.tsx; client/tests/lab-03/internal-notes.test.tsx; client/tests/lab-03/public-comments.test.tsx | Read-only operational detail, active/removed Attachment states, download, invalid-ID and retry failures; ownership/IT Priority, workflow, public-comment and private-note composer states and later operational modes. | Partial — #52 ownership/IT Priority, #53 status workflow, #54 public comments and #55 private notes pass; later operational modes remain planned |
| UI-06 | UI component | client/tests/lab-03/user-management.test.tsx; e2e/lab-03/missing-states.spec.ts | List/search/create, validation, duplicate value retention, loading/empty/no-results/Retry/saving/success, API-forbidden denial/cache clearing and password-required routing. Edit/reset and lifecycle admin-safety states remain planned. | Partial — 18 focused tests pass; three-viewport E2E covers empty, no-results, loading, failure, validation, saving, duplicate, self/last-admin and non-admin states; race/revocation cases remain planned |
| UI-07 | UI component/regression | client/tests/lab-02/create-ticket.test.tsx; my-tickets.test.tsx; ticket-detail.test.tsx; client/tests/lab-03/public-comments.test.tsx | Adapt existing tests to authenticated identity; preserve fields/files, query defaults, ownership/retry; add public comment/indication interactions. | Partial — authenticated requester regressions, public comment states and indication interactions pass |
| STYLE-01 | UI style/accessibility | artifacts/lab-03/visual-checklist.md; e2e/lab-03/accessibility-responsive.spec.ts; e2e/lab-03/axe-accessibility.spec.ts; e2e/lab-03/ticket-workflow.spec.ts | Zen Green tokens, badges/text, read-only/editable fields, labels and visual states are inspected against the UI reference matrix; machine locators cover semantic headings/labels/statuses. | Pass automated — 12 axe scans, keyboard/focus checks and sampled >=4.5:1 contrast checks pass; manual peer WCAG review remains external. |
| RESP-01 | Responsive | artifacts/lab-03/visual-checklist.md; e2e/playwright.config.ts; e2e/lab-03/accessibility-responsive.spec.ts | Major screens at desktop 1440×900, tablet 768×1024 and mobile 390×844; content bounds, long content and practical actions are inspected. | Partial — all three configured viewports plus 320 CSS pixels and a 640 CSS-pixel 200%-zoom reflow proxy pass; manual browser-zoom certification remains open |
| E2E-01 | E2E | e2e/lab-03/authentication.spec.ts; e2e/lab-03/missing-states.spec.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Per-run fixture setup provisions a `mustChangePassword` account; verify initial login/change, logout/replay/direct denial and committed authentication evidence without relying on application seed state. | Pass — the full 84-test run passes the three-view authentication journeys and live CSRF/origin/cookie/error boundaries. |
| E2E-02 | E2E/regression | e2e/lab-02/requester-flow.spec.ts | Real Requester login/create/search/detail/add/download/remove, switch by logout/login, foreign IDs denied; no selector. | Pass — full 15-test browser suite passes across desktop/tablet/mobile |
| E2E-03 | E2E | e2e/lab-03/staff-queue.spec.ts; e2e/lab-03/ticket-workflow.spec.ts; e2e/lab-03/ticket-ownership.spec.ts; e2e/lab-03/public-comments.spec.ts; e2e/lab-03/internal-notes.spec.ts; e2e/lab-03/missing-states.spec.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Queue/detail, claim/priority, status/reopen/indication, public Requester-staff conversation, private staff/admin-only notes and terminal denial. | Pass — 80 passed and 4 expected desktop-only skips in the full 84-test run; live race, privacy and 64-pair status checks are included. |
| E2E-04 | E2E | e2e/lab-03/user-management.spec.ts; e2e/lab-03/missing-states.spec.ts; e2e/lab-03/api-security-and-concurrency.spec.ts | Create-to-first-login, edit access and reset-to-first-login are implemented. Deactivate, revoked access and lifecycle admin guards remain planned. | Pass — UI lifecycle states plus duplicate-account and concurrent role/deactivation session-revocation checks pass. |
| CONTRACT-01 | Integration/contract | server/tests/lab-01/openapi.test.ts; scripts/openapi-check.mjs | OpenAPI validates implemented routes/security/shapes and generated client stays synchronized; both lab suites discovered. | Pass — `pnpm openapi:check` |
| EVIDENCE-01 | Release/visual review | docs/lab-03/reviewer.md; artifacts/lab-03/visual-checklist.md | Inspect actual final-main logs/SHA, PR approvals/merges, Kanban, six documents, prompt/reflection and exactly nine readable PDF parts. No automated peer approval claim. | Partial — 123 Lab 3 PNGs and 3 manifests are generated by the Lab 3 specs; release/peer/reflection/PDF gates remain pending |

## 3. Acceptance traceability

| AC | Planned tests |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | SEC-01, UI-01 |
| AC-03 | UNIT-01, API-01, SEC-02, UI-02, E2E-01 |
| AC-04 | API-01, SEC-01, E2E-01 |
| AC-05 | SEC-01, SEC-02 |
| AC-06 | SEC-02, UI-03, E2E-01 |
| AC-07 | REG-01 |
| AC-08 | REG-01, E2E-04 |
| AC-09 | REG-02, SEC-02, UI-07, E2E-02 |
| AC-10 | REG-02, UI-07, E2E-02 |
| AC-11 | REG-02, SEC-02, UI-07, E2E-02 |
| AC-12 | SEC-02, API-04, UI-03, E2E-01 |
| AC-13 | API-02, UI-04, E2E-03 |
| AC-14 | API-02, SEC-02, UI-05, E2E-03 |
| AC-15 | API-03, SEC-02, UI-05, E2E-03 |
| AC-16 | API-03, SEC-02, UI-05, E2E-03 |
| AC-17 | UNIT-02, API-03, UI-05, E2E-03 |
| AC-18 | API-03, UI-05, UI-07, E2E-03 |
| AC-19 | API-04, SEC-02, UI-05, UI-07, E2E-03 |
| AC-20 | API-04, SEC-02, UI-03, UI-05, E2E-03 |
| AC-21 | API-05, UI-06, E2E-04 |
| AC-22 | API-05, SEC-02, UI-06, E2E-04 |
| AC-23 | API-05, API-01, SEC-02, UI-06, E2E-04 |
| AC-24 | API-05, API-03, REG-01, UI-05 |
| AC-25 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, E2E-01, E2E-03, E2E-04 |
| AC-26 | STYLE-01, RESP-01 |
| AC-27 | CONTRACT-01, EVIDENCE-01 |
| AC-28 | EVIDENCE-01, E2E-01, E2E-02, E2E-03, E2E-04 |

## 4. Boundary and concurrency execution

The remaining boundary plan is now executed through `e2e/lab-03/api-security-and-concurrency.spec.ts` and `server/scripts/check-migration-preservation.ts`. The browser tests use independent real sessions and observable HTTP outcomes: every role/resource read and protected write in scope, CSRF/origin/cookie/error boundaries, foreign-resource isolation, one-winner claims, concurrent comments, the full 64-pair status matrix, terminal confirmation and stale versions, private-note privacy, duplicate-email serialization, and role/deactivation session revocation.

The migration gate starts from a populated pre-user schema, preserves IDs/times/relationships/Attachment metadata and bytes, rejects normalized-email collisions, and runs edited seed fixtures repeatedly without replacing edits or changing counts. Each temporary database is uniquely named and dropped by the script. Attachment capacity and exact session-expiry clock cases remain covered by the existing server suites rather than duplicated in the browser file.

## 5. Commands and evidence provenance

Feature development: run focused `pnpm --filter @toktickit/server exec vitest run <path>` or corresponding client command after each behavior change; run `pnpm run check-types` regularly. Full completion checks: `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm run build`, `pnpm openapi:check`, `pnpm test:e2e`. Review formatter diff and do not retain unrelated rewrites. Browser runs use disposable test data/storage, never overwrite prior lab evidence accidentally.

The #56 API suites require `TOKTICKIT_TEST_DATABASE_URL` to explicitly identify a disposable PostgreSQL test server with database-creation permission. They refuse to fall back to `DATABASE_URL`, create a uniquely named database, apply migrations only there, and clean up that database afterward. Run `pnpm --filter @toktickit/server exec vitest run tests/lab-03/users-admin.api.test.ts tests/lab-03/users-lifecycle.api.test.ts` only with that test-server configuration. The existing Playwright global setup seeds and resets its configured database, so the new create-to-first-login test must also run with an isolated API/database/storage environment, never the shared local project database.

The earlier #56 note about unavailable database execution is superseded by the #58 isolated-database run below. It remains in the historical record only as prior state; it is not used as final evidence.

#49 verification checks documentation formatting, local links, unique FR/BR/AC IDs, complete test references and cross-contract consistency, followed by types/full existing test suite per implement workflow. No new feature or screenshot test is claimed from this documentation change.

| Run | Basis / command | Result |
| --- | --- | --- |
| #49 contract | 2026-09-08, feature/49-sprint-3-engineering-contract; baseline ad5640b plus six documentation additions | Formatting and local-link checks pass; 15 unique FR, 25 BR, 28 AC; every AC mapped. |
| #49 types | pnpm run check-types | Pass for client, server and E2E. |
| #49 formatting/lint | pnpm run check | Pass across the repository. |
| #49 full suite | pnpm run test, isolated PostgreSQL 17 with process-only DATABASE_URL override; 2026-09-08 11:12 UTC | 50 client + 38 server tests pass (14 files); OpenAPI check passes. |
| #50 focused client auth | 2026-09-10, `pnpm --filter @toktickit/client exec vitest run tests/lab-03/authentication.test.tsx tests/lab-03/auth-context.test.tsx` | 6 tests pass across 2 files. |
| #50 focused server auth | 2026-09-10, isolated PostgreSQL 17 on loopback port 55432; `pnpm --filter @toktickit/server exec vitest run tests/lab-03/auth.api.test.ts` | 5 tests pass. |
| #50 authentication E2E/evidence | 2026-09-10, disposable PostgreSQL 17; Playwright `lab-03/authentication.spec.ts` across desktop/tablet/mobile | 3 projects pass; each run writes its two authentication screenshots and manifest from the Lab 3 spec. |
| #50 full suite | 2026-09-10, isolated PostgreSQL 17 with process-only `DATABASE_URL` override; `pnpm run test` | 55 client + 46 server tests pass (17 files); OpenAPI check passes. |
| #50 checks | 2026-09-10, `pnpm run check`, `pnpm run check-types`, `pnpm run build` | Formatting/lint, client/E2E/server typecheck and production builds pass. |
| #50 authentication | Actual paths above; disposable PostgreSQL and Playwright runs | Verified; remaining Lab 3 slices are not implemented |
| #51 API/rules | 2026-09-15, disposable PostgreSQL; `staff-queue.api.test.ts` and `ticket-queue-rules.test.ts` | 5 API tests and 13 parser tests pass, including role boundaries, all queue filters, literal search, business sorting/ties, pagination and strict query rejection. |
| #51 client | 2026-09-15, `pnpm --filter @toktickit/client test` | 7 queue tests and 3 read-only detail tests pass; full client suite passes. |
| #51 browser | 2026-09-15, `pnpm test:e2e` with local PostgreSQL 17 and three Playwright viewports | 15 tests pass, including the Requester regression and queue-to-detail journey. |
| #54 client | 2026-09-16, `pnpm --filter @toktickit/client exec vitest run tests/lab-03/public-comments.test.tsx` | 5 tests pass, including Ticket-boundary reset, validation focus and public conversation states. |
| #54 browser discovery | 2026-09-16, `pnpm --filter @toktickit/e2e exec playwright test lab-03/public-comments.spec.ts --list` | 3 viewport tests discovered; database-backed execution remains pending on an explicitly configured disposable E2E server. |
| #51 checks | 2026-09-15, `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm run build`, `pnpm openapi:check` | Formatting/lint, typecheck, 80-client/89-server tests, OpenAPI synchronization and production builds pass. |
| #55 client | 2026-09-16, `pnpm --filter @toktickit/client exec vitest run tests/lab-03/internal-notes.test.tsx` | 6 tests pass, including Ticket-boundary reset, validation focus and private-note states. |
| #55 browser discovery | 2026-09-16, `pnpm --filter @toktickit/e2e exec playwright test lab-03/internal-notes.spec.ts --list` | 3 viewport tests discovered; database-backed execution remains pending on an explicitly configured disposable E2E server. |
| #57 client | 2026-09-16, `pnpm --filter @toktickit/client exec vitest run tests/lab-03/user-management.test.tsx` | 18 tests pass, including fetched-detail initialization and accessible reset confirmation. |
| #57 browser discovery | 2026-09-16, `pnpm --filter @toktickit/e2e exec playwright test lab-03/user-management.spec.ts --list` | 6 viewport tests discovered; database-backed execution remains pending on an available disposable PostgreSQL server. |
| #58 focused UI | 2026-09-19, `pnpm --filter @toktickit/client exec vitest run tests/lab-03/user-management.test.tsx` | 18 tests pass. |
| #58 full API/client | 2026-09-19, `pnpm run test` with local PostgreSQL 17 and explicit `TOKTICKIT_TEST_DATABASE_URL` for disposable server fixtures | 107 client tests + 120 server tests pass; OpenAPI check passes. Two Lab 1 seed tests now have explicit 30s limits because their subprocess work exceeds Vitest's 5s default. |
| #58 format/types | 2026-09-19, `pnpm run fix`, `pnpm run check-types` | Pass after evidence capture, lifecycle assertions and tablet button-wrap fix. |
| #58 Lab 3 browser | 2026-09-19, `pnpm --filter @toktickit/e2e exec playwright test e2e/lab-03` with disposable PostgreSQL 17, temporary Attachment storage, `CI=1`, desktop/tablet/mobile projects | 24 tests pass; 16 manifest-listed captures per project, 48 PNGs total. |
| #58 E2E/accessibility follow-up | 2026-09-19, `CI=1 pnpm --filter @toktickit/e2e exec playwright test lab-03` with local PostgreSQL 17, committed migrations, seeded E2E fixtures and desktop/tablet/mobile projects | 48 tests pass in 6.3 minutes; 41 manifest-listed captures per project, 123 PNGs total. Added intercepted auth/queue/detail/user states, keyboard/dialog checks, sampled contrast >=4.5:1, 320 CSS-pixel layout and 640 CSS-pixel 200%-zoom reflow proxy. |
| #58 full browser | 2026-09-19, isolated API/client ports, local PostgreSQL 17, `CI=1`, desktop/tablet/mobile projects, `pnpm --filter @toktickit/e2e exec playwright test lab-03` | 80 passed and 4 expected desktop-only skips from 84 tests in 8.4 minutes. The run refreshed 41 manifest-listed captures per project, 123 PNGs total. |
| #58 browser boundary gates | 2026-09-19, same full run; `e2e/lab-03/api-security-and-concurrency.spec.ts` and `e2e/lab-03/axe-accessibility.spec.ts` | Live authorization/concurrency/lifecycle/account/migration checks pass; 12 axe scans pass. Four skips are the desktop-only status-matrix and migration checks on tablet/mobile. |
| Final main | Full SHA/time/environment/commands/totals/logs/screenshots required under #58 | Pending release integration |

Final-main evidence must identify exact source commit and dirty-state status. If captures use injected failures, label them. Distinguish machine assertions, agent visual inspection and human peer review. Never copy Lab 2 pass totals as Lab 3 results or mark external review complete from automated checks.

The initial #49 full-suite attempt against configured local PostgreSQL failed credential authentication: 50 client and 21 server tests passed, 17 database cases were skipped by failed setup, and an existing teardown error followed. A fresh PostgreSQL 17 container on an ephemeral loopback port allowed all 88 tests to pass; it was stopped/removed afterward. No local credentials or application code changed. The current runs still emit the existing pg concurrent-query deprecation warning. Final-main build/browser provenance remains pending under #58; the staging results above are not final-main acceptance.
