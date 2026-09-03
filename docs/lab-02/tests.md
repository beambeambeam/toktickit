# Lab 2 Test Plan — Requester Ticketing MVP

## 1. Status

The Lab 2 implementation now has focused unit, API/integration, UI, and browser E2E tests. The larger boundary matrix below remains the contract for future coverage expansion; unautomated visual and human-review evidence is marked explicitly.

Current implementation status:

- Existing Lab 1 client and server tests: pass.
- Lab 2 client rules, Requester-selection, and Create Ticket UI tests: pass.
- Lab 2 server rules and PostgreSQL integration tests: pass.
- OpenAPI synchronization check: pass.
- Local browser flow: manually checked through Requester selection, Ticket creation, My Tickets, Detail, and Attachment lifecycle at desktop and mobile viewport sizes.
- Browser E2E flow: pass across desktop, tablet, and mobile Chromium projects.
- Screenshot artifacts: captured under all three required Lab 2 evidence directories.
- Issue #37 focused list/API suites: pass; client 7 files/40 tests and server 6 files/38 tests after the human-review test split.
- Issue #38 Ticket Detail UI suite: `client/tests/lab-02/ticket-detail.test.tsx` with 10 interaction tests covering read-only detail, active/removed states, upload validation, removal confirmation and reason boundaries, download, and loading/failure/hidden-resource/invalid states. Full suite after Issue #38: client 8 files/50 tests, server 6 files/38 tests, OpenAPI check pass.
- Visual comparison record: `artifacts/lab-02/visual-checklist.md` maps every required screen and viewport to its E2E screenshot evidence.
- Final PDF and human approval: Pending.

## 2. Strategy

Test observable behavior at the highest practical seam:

- Unit: pure Ticket Number, validation, query, Attachment, filename, and ordering rules.
- API/integration: PostgreSQL persistence, ownership, reference data, query behavior, safe errors, and Attachment compensation.
- UI: form/context state, field feedback, busy/duplicate-submit prevention, list states, Detail, and Attachment controls.
- Style/accessibility: labels, required markers, focus, badges, non-color feedback, and Zen Green tokens.
- Responsive/visual: desktop, tablet, and mobile layout plus screenshot checklist.
- E2E: one complete browser flow from Requester selection through creation, discovery, Detail, and Attachment lifecycle.

Do not assert private component structure, query syntax, database implementation details, or incidental CSS. Every test must map to an acceptance criterion and a concrete evidence path.

## 3. Implemented automated tests

| ID | Level | File path | Coverage |
| --- | --- | --- | --- |
| API-01 | Unit | server/tests/lab-02/rules.test.ts | Ticket Number format, field trimming/validation, list-query defaults, filename normalization, signed-file limits, and active-Attachment count |
| API-02 | API/integration | server/tests/lab-02/requester-ticketing.test.ts | Active reference data, active-context enforcement, server-derived ownership, valid creation/defaults, validation, list isolation/query errors, Detail isolation, Attachment upload/download/removal, concurrent active-limit enforcement, cleanup retry recovery, and safe failures |
| API-03 | API/integration | server/tests/lab-02/requester-ticketing.test.ts | Issue #37 list search fields, all documented filters, deterministic sort/pagination metadata, page-size boundaries, and repeated/nested/malformed/unsupported query rejection |
| UI-01 | UI | client/tests/lab-02/requester-selection.test.tsx | Active Requester loading, inactive exclusion, Continue/context persistence, navigation, and recoverable empty state |
| UI-02 | Unit | client/tests/lab-02/ticket-rules.test.ts | Form validation, Attachment type/count/size validation, and safe API field-error mapping |
| UI-03 | UI | client/tests/lab-02/create-ticket.test.tsx | Empty-reference blocking, field-level validation without submission, invalid Attachment feedback, preserved values after API failure, busy duplicate-submit prevention, and saved Ticket Number display |
| UI-04 | UI | client/tests/lab-02/my-tickets.test.tsx | Issue #37 draft clearing, numbered pagination, empty/no-results distinction, retry, and requester-context switching |
| UI-05 | Client API boundary | client/tests/lab-02/requester-api.test.ts | Issue #37 malformed Ticket-list response rejection |
| UI-06 | UI | client/tests/lab-02/ticket-detail.test.tsx | Issue #38 read-only Detail, active/removed Attachment states, upload validation, five-active disablement, removal confirmation and 3–500 character reason boundaries, active download, and loading/failure/invalid-Ticket states |
| E2E-01 | Browser E2E | e2e/lab-02/requester-flow.spec.ts | Three-viewport requester selection, Ticket creation with Attachment, generated Ticket Number, My Tickets discovery, direct cross-Requester Ticket access rejection, Detail, active download, soft removal, blocked removed download, and cross-Requester ownership isolation; captures required screenshots |

The implementation also contains the Requester Ticket Detail flow; its interaction coverage is represented by the API integration suite, UI-06, and E2E-01. Issue #37 adds focused My Tickets UI and client-boundary coverage.

If implementation needs additional test files, add them here before implementation is marked complete. Do not delete a required path without recording the replacement.

## 4. Acceptance-criterion traceability

| Acceptance criteria | Planned tests |
| --- | --- |
| AC-01, AC-02 | UI-01, manual browser pass |
| AC-03, AC-12 | UI-01, API-02, manual browser pass |
| AC-04, AC-05 | API-01, API-02, UI-01, UI-02 |
| AC-06, AC-07, AC-08 | API-01, API-02, UI-02, UI-03, manual browser pass |
| AC-09 | API-01, API-02, UI-02 |
| AC-10, AC-11 | API-01, API-02, manual browser pass |
| AC-13 | API-02, UI-06, E2E-01 |
| AC-14, AC-15 | API-01, API-02, UI-02, UI-06, E2E-01 |
| AC-16 | API-01, API-02, UI-02 |
| AC-17 | E2E-01, UI-06, screenshot artifacts, visual-checklist.md; final human visual approval Pending |
| AC-18 | API-01, API-02, UI-01, UI-02, UI-03, UI-06, E2E-01, manual browser pass |
| AC-19 | This document plus ui-spec.md, api-spec.md, reviewer.md, and ai-use.md |
| AC-20 | Repository checks and screenshot artifacts pass; final PDF and human approval Pending |

## 5. Boundary and failure matrix

The final tests must include:

- Missing, whitespace-only, minimum, maximum, and over-limit Summary and Description.
- Invalid reference IDs, inactive reference records, malformed requester context, and conflicting client requester IDs.
- One create request while another is still processing.
- File types at and beyond the allowed set, content-signature mismatch, exactly 5 MB, over 5 MB, exactly five active files, and a sixth active file.
- File-write failure, database-transaction failure, cleanup, and no false-success behavior.
- Concurrent Attachment additions to the same Ticket at the five-active limit.
- Removal reasons of 2, 3, 500, and 501 trimmed characters.
- Missing, invalid, unowned, removed, and already-removed resource access.
- Search/filter/sort/page boundary values and invalid query parameters.
- Empty owned list versus valid no-results query.
- Loading, API failure, retry, success, and preserved-form-value states.
- Desktop 992 px and above, tablet 768–991 px, and mobile below 768 px.
- Keyboard navigation, focus visibility, accessible names, and non-color feedback.

## 6. Commands and result log

Expected repository commands:

| Command | Purpose | Result |
| --- | --- | --- |
| `2026-09-02` — `pnpm run fix` | CI formatting/lint write step | Pass |
| `2026-09-02` — `pnpm run check-types` | Client/server type checking | Pass |
| `2026-09-02` — `pnpm run test` | Client, OpenAPI, and server tests | Pass: client 40, server 34, OpenAPI check pass |
| `2026-09-02` — `pnpm run build` | Client/server production build | Pass |
| `2026-09-02` — local T3 preview | Desktop/mobile manual flow | Pass for selection, creation, list, Detail, upload/download/remove |
| `2026-09-02` — `pnpm test:e2e` | Full requester flow and smoke test across desktop/tablet/mobile Chromium | Pass: 6/6 tests; 30 PNG evidence artifacts captured; direct unauthorized Ticket and removed-download requests rejected |
| `2026-09-03` — `pnpm --filter @toktickit/server exec vitest run tests/lab-02/requester-ticketing.test.ts --reporter=dot` | Human-review follow-up: independent list search, filter, sort, pagination, and validation cases | Pass: 12 tests in the requester Ticket API file |
| `2026-09-03` — `pnpm test:e2e` | Human-review follow-up: empty and no-results screenshot evidence plus mobile pagination layout | Pass: 6/6 tests; 36 PNG evidence artifacts present; direct unauthorized Ticket and removed-download requests rejected |
| `2026-09-03` — `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm run build`, `pnpm test:e2e` | Issue #38 full verification on `feature/38-ticket-detail-attachments-evidence` | Pass: lint clean; types pass; client 8 files/50 tests; server 6 files/38 tests; OpenAPI check pass; build pass; E2E 6/6 with 36 PNGs present (27 regenerated, 9 byte-identical static states) |

Update this table with date, exact command, result, and environment after each vertical slice. Record database setup and any limitation; do not hide skipped or flaky tests.

## 7. Evidence locations

- Automated output: repository PR/CI checks and this result log.
- Screenshots: artifacts/lab-02/screenshots/create-ticket/, my-tickets/, and ticket-detail/.
- E2E source: e2e/lab-02/smoke.spec.ts and e2e/lab-02/requester-flow.spec.ts.
- Visual checklist: artifacts/lab-02/visual-checklist.md.
- Final PDF: report area using the exact Part 1 through Part 9 headings from the labsheet.
- Review traceability: reviewer.md.

## 8. Issue #37 result record

| Command | Result |
| --- | --- |
| `pnpm --filter @toktickit/client test -- --run` | Pass: 7 files, 40 tests |
| `pnpm --filter @toktickit/server test -- --run` | Pass: 6 files, 34 tests |
| `pnpm --filter @toktickit/client exec vitest run tests/lab-02/requester-api.test.ts` | Pass: malformed response guard |
| `pnpm --filter @toktickit/client exec vitest run tests/lab-02/my-tickets.test.tsx --reporter=dot` | Pass: 7 My Tickets interaction tests |
| `pnpm --filter @toktickit/server exec vitest run tests/lab-02/requester-ticketing.test.ts --testNamePattern 'supports documented list' --reporter=dot` | Pass: Issue #37 list contract integration test |

Issue #37 tests run against the repository's jsdom client harness and PostgreSQL-backed server harness. `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm run build`, and `pnpm test:e2e` pass on this branch; the two-axis code-review record is appended in `reviewer.md`. Peer/human approval remains pending.

## 9. Issue #38 result record

| Command | Result |
| --- | --- |
| `pnpm run fix` | Pass: oxfmt/oxlint clean on 110 files |
| `pnpm run check-types` | Pass: client, e2e, and server `tsc --noEmit` |
| `pnpm run test` | Pass: client 8 files/50 tests, OpenAPI check pass, server 6 files/38 tests |
| `pnpm --filter @toktickit/client exec vitest run tests/lab-02/ticket-detail.test.tsx` | Pass: 10 Ticket Detail interaction tests |
| `pnpm run build` | Pass: client and server production build |
| `2026-09-03` — `pnpm test:e2e` | Pass: 6/6 tests across desktop/tablet/mobile Chromium; 36 PNG evidence artifacts present (27 regenerated, 9 byte-identical static states); direct unauthorized Ticket and removed-download requests rejected |

Issue #38 tests run against the repository's jsdom client harness and PostgreSQL-backed server harness (local PostgreSQL 17 via Docker). No test was skipped, disabled, or commented out. Peer review of this slice is pending in `reviewer.md`. The final PDF under `reports/lab02/` already uses the exact Answer Part 1 through Part 9 headings but is git-ignored build output; regenerating it from the finalized sources and human approval remain pending.
