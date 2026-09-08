# Lab 3 Test Plan and Traceability

Status: planned before implementation under #49. All Lab 3 paths below are planned, not existing tests or passing results. [Specification](./specification.md) defines each AC; [API](./api-spec.md) and [UI](./ui-spec.md) define exact expected behavior. Existing Lab 2 results are not Lab 3 evidence.

## 1. Strategy and seams

Primary seam: Supertest HTTP through composed Express, disposable PostgreSQL databases and temporary Attachment storage, following `server/tests/lab-02/requester-ticketing.test.ts`. Test cookies, CSRF, authorization, persisted outcomes, concurrency and errors via observable behavior. Client uses existing Vitest/React Testing Library for controls, routing/cache boundaries and feedback. Pure unit tests are limited to meaningful password/query/transition rules. No new test framework. Feature slices use red/green at these seams; this docs-only contract does not add executable feature tests.

Existing `client/tests/lab-02/`, `server/tests/lab-02/` and `e2e/lab-02/` remain regression inputs. #50 adapts the selector-dependent cases to real login and removes obsolete context tests while retaining their ownership/recovery intent. Generalize Playwright discovery to both lab directories; preserve desktop 1440×900, tablet 768×1024, mobile 390×844. Each vertical slice owns one complete browser journey and negative cases. Final full browser run is required under #58.

## 2. Planned test register

All Final values are **Planned**. Replace planned path with actual path only after the test exists; record run provenance separately. Ranges below enumerate exact ACs in the traceability table that follows.

| Test ID | Type | Planned file | What it tests / expected result | Final |
| --- | --- | --- | --- | --- |
| UNIT-01 | Unit | server/tests/lab-03/auth-rules.test.ts | Password 14/15/128/129 code points, astral characters, spaces/paste semantics, reuse and normalization: exact contract bounds. | Planned |
| UNIT-02 | Unit | server/tests/lab-03/workflow-rules.test.ts | All 8×8 status edges and owner/confirmation requirements; only matrix edges succeed. | Planned |
| API-01 | API/integration | server/tests/lab-03/auth.api.test.ts | Valid/unknown/invalid/inactive login, restricted/me/change/logout, rotation, cookie/hash storage, 30m/8h/15m exact expiry boundaries; replay denied. | Planned |
| SEC-01 | Security | server/tests/lab-03/auth.api.test.ts | Five-account/30-IP limit and concurrent attempts, expiry/retry; missing/wrong/session-mismatched CSRF, disallowed/null/missing origin and multipart; safe failures and no secret exposure. | Planned |
| SEC-02 | Security/authorization | server/tests/lab-03/authorization.api.test.ts | Parameterize every role × API operation, restricted/anonymous, requesterId/header spoofing, foreign Ticket/file/comment, nested-note leakage and identical 403 on note IDs. | Planned |
| REG-01 | Migration/regression | server/tests/lab-03/migration.api.test.ts | Start at populated Lab 2 schema, snapshot IDs/times/FKs/bytes/removed attribution; upgrade preserves all, collisions abort; repeated deploy/bootstrap/seeds retain edits and fixture counts. | Planned |
| REG-02 | Migration/regression | server/tests/lab-02/requester-ticketing.test.ts | Authenticated creation/list/detail/file lifecycle, exact limits, concurrent capacity, failed-write compensation, removal retry and foreign/removed download denial on all statuses. | Planned |
| API-02 | API/integration | server/tests/lab-03/staff-queue.api.test.ts | Every queue query/default/filter, literal search, severity order, deterministic ties, same-snapshot counts, out-of-range pages, malformed/repeated/unknown/contradictory parameters and read-only admin. | Planned |
| API-03 | API/integration | server/tests/lab-03/staff-ticket-detail.api.test.ts | Claim one winner, reassignment/unassignment, eligible admin owner, stale/terminal denial, independent priority, every status edge, timestamps, idempotent indication/reopen and account-change races. | Planned |
| API-04 | API/integration | server/tests/lab-03/comments-notes.api.test.ts | Role visibility, backend attribution, empty/1/5000/5001 code points, HTML payload stored as text, stable ordering, terminal write race, no edit/delete/status side effect or private metadata leak. | Planned |
| API-05 | API/integration | server/tests/lab-03/users-admin.api.test.ts | User list/search/filter/create/edit/reset, normalized duplicate races, role array rejection, self-deactivation, concurrent last-admin guards, revocation and owner effects. | Planned |
| UI-01 | UI component | client/tests/lab-03/Login.test.tsx | Required inputs, generic inactive/invalid, throttle/retry, busy, safe failure and permitted landing. | Planned |
| UI-02 | UI component | client/tests/lab-03/ChangePassword.test.tsx | Exact rules, confirmation, current/reused password error, first-login bypass denial, busy/success and secret clearing. | Planned |
| UI-03 | UI component | client/tests/lab-03/AuthenticatedShell.test.tsx | Role navigation, direct route denial, me loading/failure, logout/role loss cancellation and clearing all private caches/drafts. | Planned |
| UI-04 | UI component | client/tests/lab-03/StaffTicketQueue.test.tsx | Query controls/reset, numbered pages, empty/no-results/loading/failure/retry, clear filters and detail link. | Planned |
| UI-05 | UI component | client/tests/lab-03/StaffTicketDetail.test.tsx | Separate operations/composers, confirmations, conflict refresh, retained drafts, indication, admin read-only, terminal states and private note absence for Requester. | Planned |
| UI-06 | UI component | client/tests/lab-03/UserManagement.test.tsx | List/create/edit/reset modes, field/duplicate/admin-safety errors, one-role select, busy/success, no secret redisplay or excluded controls. | Planned |
| UI-07 | UI component/regression | client/tests/lab-02/create-ticket.test.tsx; my-tickets.test.tsx; ticket-detail.test.tsx | Adapt existing tests to authenticated identity; preserve fields/files, query defaults, ownership/retry; add public comment/indication interactions. | Planned |
| STYLE-01 | UI style/accessibility | e2e/lab-03/ui-evidence.spec.ts | Computed Zen Green tokens, badges/text, readonly/editable fields, contrast, labels, keyboard/focus/dialog behavior and screenshots compared against UI reference matrix. | Planned |
| RESP-01 | Responsive | e2e/lab-03/ui-evidence.spec.ts | All major screens at three viewports plus 320px/200% zoom checks; document/content bounds, long content, no clipping/overlap/hidden actions. | Planned |
| E2E-01 | E2E | e2e/lab-03/authentication.spec.ts | Initial login/change, all role landings, logout/replay/direct denial and identity-cache isolation. | Planned |
| E2E-02 | E2E/regression | e2e/lab-02/requester-flow.spec.ts | Real Requester login/create/search/detail/add/download/remove, switch by logout/login, foreign IDs denied; no selector. | Planned |
| E2E-03 | E2E | e2e/lab-03/staff-ticket-flow.spec.ts | Queue/detail, claim/priority, status/reopen/indication, public Requester-staff conversation, private staff/admin-only notes and terminal denial. | Planned |
| E2E-04 | E2E | e2e/lab-03/user-administration.spec.ts | Create-to-first-login and reset-to-first-login; edit access, deactivate, revoked access and admin guards. | Planned |
| CONTRACT-01 | Integration/contract | server/tests/lab-01/openapi.test.ts; scripts/openapi-check.mjs | OpenAPI validates implemented routes/security/shapes and generated client stays synchronized; both lab suites discovered. | Planned |
| EVIDENCE-01 | Release/visual review | docs/lab-03/reviewer.md; artifacts/lab-03/visual-checklist.md | Inspect actual final-main logs/SHA, PR approvals/merges, Kanban, six documents, prompt/reflection and exactly nine readable PDF parts. No automated peer approval claim. | Planned |

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

#49 verification checks documentation formatting, local links, unique FR/BR/AC IDs, complete test references and cross-contract consistency, followed by types/full existing test suite per implement workflow. No new feature or screenshot test is claimed from this documentation change.

| Run | Basis / command | Result |
| --- | --- | --- |
| #49 contract | 2026-09-08, feature/49-sprint-3-engineering-contract; baseline ad5640b plus six documentation additions | Formatting and local-link checks pass; 15 unique FR, 25 BR, 28 AC; every AC mapped. |
| #49 types | pnpm run check-types | Pass for client, server and E2E. |
| #49 formatting/lint | pnpm run check | Pass across the repository. |
| #49 full suite | pnpm run test, isolated PostgreSQL 17 with process-only DATABASE_URL override; 2026-09-08 11:12 UTC | 50 client + 38 server tests pass (14 files); OpenAPI check passes. |
| Lab 3 features | Planned tests above | Not implemented |
| Final main | Full SHA/time/environment/commands/totals/logs/screenshots required under #58 | Pending |

Final-main evidence must identify exact source commit and dirty-state status. If captures use injected failures, label them. Distinguish machine assertions, agent visual inspection and human peer review. Never copy Lab 2 pass totals as Lab 3 results or mark external review complete from automated checks.

The initial #49 full-suite attempt against configured local PostgreSQL failed credential authentication: 50 client and 21 server tests passed, 17 database cases were skipped by failed setup, and an existing teardown error followed. A fresh PostgreSQL 17 container on an ephemeral loopback port allowed all 88 tests to pass; it was stopped/removed afterward. No local credentials or application code changed. An existing pg concurrent-query deprecation warning remains. Build/browser execution was not required for these six Markdown additions; final-main build/browser evidence remains pending under #58. Results above are contract-branch baseline checks, not Lab 3 feature acceptance.
