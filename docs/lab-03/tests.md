# Lab 3 Test Plan and Traceability

Status: #50 authentication/Requester continuity, #51 queue/detail, #56 user administration and #57 account lifecycle are implemented in the current worktree. The Final column records current coverage; untouched Lab 3 slices remain planned. [Specification](./specification.md) defines each AC; [API](./api-spec.md) and [UI](./ui-spec.md) define exact expected behavior. Existing Lab 2 results are not Lab 3 evidence.

## 1. Strategy and seams

Primary seam: Supertest HTTP through composed Express, disposable PostgreSQL databases and temporary Attachment storage, following `server/tests/lab-02/requester-ticketing.test.ts`. Test cookies, CSRF, authorization, persisted outcomes, concurrency and errors via observable behavior. Client uses existing Vitest/React Testing Library for controls, routing/cache boundaries and feedback. Pure unit tests are limited to meaningful password/query/transition rules. No new test framework. Feature slices use red/green at these seams. #50 adapts the selector-dependent cases to real login and removes obsolete context tests while retaining their ownership/recovery intent.

Existing `client/tests/lab-02/`, `server/tests/lab-02/` and `e2e/lab-02/` remain regression inputs. Generalize Playwright discovery to both lab directories; preserve desktop 1440×900, tablet 768×1024, mobile 390×844. Browser runs use a fresh disposable database and Attachment storage fixture per run; no E2E test relies on a mutable application-seed `mustChangePassword` flag. Each vertical slice owns one complete browser journey and negative cases. Final full browser run is required under #58.

## 2. Test register

Final values identify implemented coverage and remaining gaps. Ranges below enumerate exact ACs in the traceability table that follows.

| Test ID | Type | Planned file | What it tests / expected result | Final |
| --- | --- | --- | --- | --- |
| UNIT-01 | Unit | server/tests/lab-03/auth-rules.test.ts | Password 14/15/128/129 code points, astral characters, spaces/paste semantics, reuse and normalization: exact contract bounds. | Pass — 2 tests |
| UNIT-02 | Unit | server/tests/lab-03/workflow-rules.test.ts | All 8×8 status edges and owner/confirmation requirements; only matrix edges succeed. | Planned |
| API-01 | API/integration | server/tests/lab-03/auth.api.test.ts | Valid/unknown/invalid/inactive login, generic failures, restricted/me/change/logout, rotation, cookie/hash storage, throttling and replay. | Partial — 5 tests pass; exact expiry boundaries remain planned |
| SEC-01 | Security | server/tests/lab-03/auth.api.test.ts | Account/IP throttling, malformed-input reservations, inactive-account throttling, CSRF and safe failures. | Partial — 5 tests pass; full concurrency/origin/expiry matrix remains planned |
| SEC-02 | Security/authorization | server/tests/lab-03/authorization.api.test.ts | Parameterize every role × API operation, restricted/anonymous, requesterId/header spoofing, foreign Ticket/file/comment, nested-note leakage and identical 403 on note IDs. | Planned |
| REG-01 | Migration/regression | server/tests/lab-03/migration.api.test.ts | Start at populated Lab 2 schema, snapshot IDs/times/FKs/bytes/removed attribution; upgrade preserves all, collisions abort; repeated deploy/bootstrap/seeds retain edits and fixture counts. | Planned |
| REG-02 | Migration/regression | server/tests/lab-02/requester-ticketing.test.ts | Authenticated creation/list/detail/file lifecycle, exact limits, concurrent capacity, failed-write compensation, removal retry and foreign/removed download denial on all statuses. | Planned |
| API-02 | API/integration | server/tests/lab-03/staff-queue.api.test.ts; server/tests/lab-03/ticket-queue-rules.test.ts | Every queue query/default/filter, literal search, severity order, deterministic ties, same-snapshot counts, out-of-range pages, malformed/repeated/unknown/contradictory parameters and read-only admin. | Pass — 5 API tests + 13 parser tests |
| API-03 | API/integration | server/tests/lab-03/staff-ticket-detail.api.test.ts | Claim one winner, reassignment/unassignment, eligible admin owner, stale/terminal denial, independent priority, every status edge, timestamps, idempotent indication/reopen and account-change races. | Planned |
| API-04 | API/integration | server/tests/lab-03/comments-notes.api.test.ts | Role visibility, backend attribution, empty/1/5000/5001 code points, HTML payload stored as text, stable ordering, terminal write race, no edit/delete/status side effect or private metadata leak. | Planned |
| API-05 | API/integration | server/tests/lab-03/users-admin.api.test.ts; server/tests/lab-03/users-lifecycle.api.test.ts | Implemented list/create authorization, CSRF/origin rejection, validation, password secrecy, search/filter, normalized duplicate races and created-account first-login restrictions. Edit/reset, self-deactivation, concurrent last-admin guards, revocation and owner effects remain planned. | Partial — #56/#57 integration tests added; database execution pending on an explicitly configured disposable test server |
| UI-01 | UI component | client/tests/lab-03/authentication.test.tsx | Required inputs, generic credential failure, accessible password visibility and permitted first-login landing, including the IT Staff account destination. | Partial — 7 tests pass; inactive/throttle/busy matrix remains planned |
| UI-02 | UI component | client/tests/lab-03/authentication.test.tsx | Password rules, confirmation, successful replacement and contextual 429/Retry-After handling. | Partial — 5 tests pass; reuse/failure/secret-clearing matrix remains planned |
| UI-03 | UI component | client/tests/lab-03/auth-context.test.tsx; authentication.test.tsx | Principal-switch private-cache clearing and requester denial for a non-Requester role. | Partial — identity isolation and role denial covered; full shell matrix remains planned |
| UI-04 | UI component | client/tests/lab-03/staff-ticket-queue.test.tsx | Query controls/reset, numbered pages, empty/no-results/loading/failure/retry, clear filters and detail link. | Pass — 7 tests |
| UI-05 | UI component | client/tests/lab-03/staff-ticket-detail.test.tsx | Read-only operational detail, active/removed Attachment states, download, invalid-ID and retry failures; later operational composers remain planned. | Partial — 3 tests pass; later operational modes remain planned |
| UI-06 | UI component | client/tests/lab-03/user-management.test.tsx | List/search/create, validation, duplicate value retention, loading/empty/no-results/Retry/saving/success, API-forbidden denial/cache clearing and password-required routing. Edit/reset and lifecycle admin-safety states remain planned. | Partial — #56/#57 user-management coverage passes: 18 tests; lifecycle modes remain planned |
| UI-07 | UI component/regression | client/tests/lab-02/create-ticket.test.tsx; my-tickets.test.tsx; ticket-detail.test.tsx | Adapt existing tests to authenticated identity; preserve fields/files, query defaults, ownership/retry; add public comment/indication interactions. | Partial — authenticated requester regressions covered; comments/indication remain planned |
| STYLE-01 | UI style/accessibility | e2e/lab-03/ui-evidence.spec.ts | Computed Zen Green tokens, badges/text, readonly/editable fields, contrast, labels, keyboard/focus/dialog behavior and screenshots compared against UI reference matrix. | Planned |
| RESP-01 | Responsive | e2e/lab-03/ui-evidence.spec.ts | All major screens at three viewports plus 320px/200% zoom checks; document/content bounds, long content, no clipping/overlap/hidden actions. | Planned |
| E2E-01 | E2E | e2e/lab-03/authentication.spec.ts | Per-run fixture setup provisions a `mustChangePassword` account; verify initial login/change, logout/replay/direct denial and committed authentication evidence without relying on application seed state. | Partial — 3 projects pass; all-role landing/cache matrix remains planned |
| E2E-02 | E2E/regression | e2e/lab-02/requester-flow.spec.ts | Real Requester login/create/search/detail/add/download/remove, switch by logout/login, foreign IDs denied; no selector. | Pass — full 15-test browser suite passes across desktop/tablet/mobile |
| E2E-03 | E2E | e2e/lab-03/staff-ticket-flow.spec.ts; e2e/lab-03/staff-queue.spec.ts | Queue/detail, claim/priority, status/reopen/indication, public Requester-staff conversation, private staff/admin-only notes and terminal denial. | Partial — #51 queue-to-detail journey passes; later operational actions remain planned |
| E2E-04 | E2E | e2e/lab-03/user-management.spec.ts | Create-to-first-login, edit access and reset-to-first-login are implemented. Deactivate, revoked access and lifecycle admin guards remain planned. | Partial — #56/#57 lifecycle journey is covered; browser/database execution pending |
| CONTRACT-01 | Integration/contract | server/tests/lab-01/openapi.test.ts; scripts/openapi-check.mjs | OpenAPI validates implemented routes/security/shapes and generated client stays synchronized; both lab suites discovered. | Pass — `pnpm openapi:check` |
| EVIDENCE-01 | Release/visual review | docs/lab-03/reviewer.md; artifacts/lab-03/visual-checklist.md | Inspect actual final-main logs/SHA, PR approvals/merges, Kanban, six documents, prompt/reflection and exactly nine readable PDF parts. No automated peer approval claim. | Partial — Lab 3 auth manifests are now generated by the Lab 3 spec; release/peer gates remain planned |

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

Use deterministic clocks for exact session/attempt boundaries rather than long sleeps. Include independent browser sessions for reset/role-change revocation. Queue fixture ties must cross a page boundary; verify every filter independently then a combined query. Exercise literal `%`/`_`, empty values, invalid IDs/enums, repeated identical values, arrays, unsupported page sizes and large valid page offsets.

Run concurrent claims, owner assignment versus deactivation/role loss, status closure versus entry post, dual last-admin demotions/deactivations, password replacement versus reset, duplicate-email creates/edits and Attachment capacity writes with barriers; assert observable one-winner/no-partial-write outcomes. Parameterize all 64 status pairs and all operation-role rows. Check note leaks in Detail/list/error/metadata and after switching from staff to Requester in one browser.

Migration fixtures begin before the User migration, include active and removed Attachments with removal actor, normalization collision variants, preserved timestamps/sequence allocation and edited seeded email/role/password. Hash active bytes before/after; removed content stays unavailable. Never use a live database reset or default-home linker. Cleanup only uniquely named disposable database/storage resources owned by the test.

## 5. Commands and evidence provenance

Feature development: run focused `pnpm --filter @toktickit/server exec vitest run <path>` or corresponding client command after each behavior change; run `pnpm run check-types` regularly. Full completion checks: `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm run build`, `pnpm openapi:check`, `pnpm test:e2e`. Review formatter diff and do not retain unrelated rewrites. Browser runs use disposable test data/storage, never overwrite prior lab evidence accidentally.

The #56 API suites require `TOKTICKIT_TEST_DATABASE_URL` to explicitly identify a disposable PostgreSQL test server with database-creation permission. They refuse to fall back to `DATABASE_URL`, create a uniquely named database, apply migrations only there, and clean up that database afterward. Run `pnpm --filter @toktickit/server exec vitest run tests/lab-03/users-admin.api.test.ts tests/lab-03/users-lifecycle.api.test.ts` only with that test-server configuration. The existing Playwright global setup seeds and resets its configured database, so the new create-to-first-login test must also run with an isolated API/database/storage environment, never the shared local project database.

On 2026-09-14, #56 client verification passed all 70 client tests (including 13 user-management tests), client typechecking, production client/server builds, and OpenAPI synchronization. New API and E2E coverage is not claimed as executed: the configured database belongs to another project and no running disposable Docker server was available. Issue #56 acceptance remains pending integration/E2E execution and reviewer confirmation.

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
| #51 checks | 2026-09-15, `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm run build`, `pnpm openapi:check` | Formatting/lint, typecheck, 80-client/89-server tests, OpenAPI synchronization and production builds pass. |
| #57 client | 2026-09-16, `pnpm --filter @toktickit/client exec vitest run tests/lab-03/user-management.test.tsx` | 18 tests pass, including fetched-detail initialization and accessible reset confirmation. |
| #57 browser discovery | 2026-09-16, `pnpm --filter @toktickit/e2e exec playwright test lab-03/user-management.spec.ts --list` | 6 viewport tests discovered; database-backed execution remains pending on an available disposable PostgreSQL server. |
| Final main | Full SHA/time/environment/commands/totals/logs/screenshots required under #58 | Pending |

Final-main evidence must identify exact source commit and dirty-state status. If captures use injected failures, label them. Distinguish machine assertions, agent visual inspection and human peer review. Never copy Lab 2 pass totals as Lab 3 results or mark external review complete from automated checks.

The initial #49 full-suite attempt against configured local PostgreSQL failed credential authentication: 50 client and 21 server tests passed, 17 database cases were skipped by failed setup, and an existing teardown error followed. A fresh PostgreSQL 17 container on an ephemeral loopback port allowed all 88 tests to pass; it was stopped/removed afterward. No local credentials or application code changed. An existing pg concurrent-query deprecation warning remains. Build/browser execution was not required for these six Markdown additions; final-main build/browser evidence remains pending under #58. Results above are contract-branch baseline checks, not Lab 3 feature acceptance.
