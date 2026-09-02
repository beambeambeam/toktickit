# Lab 2 Test Plan — Requester Ticketing MVP

## 1. Status

The Lab 2 implementation now has focused unit, API/integration, and UI tests. The larger boundary matrix below remains the contract for future coverage expansion; unautomated visual and human-review evidence is marked explicitly.

Current implementation status:

- Existing Lab 1 client and server tests: pass.
- Lab 2 client rules and Requester-selection tests: pass.
- Lab 2 server rules and PostgreSQL integration tests: pass.
- OpenAPI synchronization check: pass.
- Local browser flow: manually checked through Requester selection, Ticket creation, My Tickets, Detail, and Attachment lifecycle at desktop and mobile viewport sizes.
- Screenshot artifacts, browser E2E harness, final PDF, and human approval: Pending.

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
| API-02 | API/integration | server/tests/lab-02/requester-ticketing.test.ts | Active reference data, active-context enforcement, server-derived ownership, valid creation/defaults, validation, list isolation/query errors, Detail isolation, Attachment upload/download/removal, and safe failures |
| UI-01 | UI | client/tests/lab-02/requester-selection.test.tsx | Active Requester loading, inactive exclusion, Continue/context persistence, navigation, and recoverable empty state |
| UI-02 | Unit | client/tests/lab-02/ticket-rules.test.ts | Form validation, Attachment type/count/size validation, and safe API field-error mapping |

The implementation also contains the My Tickets and Requester Ticket Detail flows; their interaction coverage is currently represented by the API integration suite and the manual browser pass. A dedicated browser E2E harness and the expanded UI/style suites remain follow-up work.

If implementation needs additional test files, add them here before implementation is marked complete. Do not delete a required path without recording the replacement.

## 4. Acceptance-criterion traceability

| Acceptance criteria | Planned tests |
| --- | --- |
| AC-01, AC-02 | UI-01, manual browser pass |
| AC-03, AC-12 | UI-01, API-02, manual browser pass |
| AC-04, AC-05 | API-01, API-02, UI-01, UI-02 |
| AC-06, AC-07, AC-08 | API-01, API-02, UI-02, manual browser pass |
| AC-09 | API-01, API-02, UI-02 |
| AC-10, AC-11 | API-01, API-02, manual browser pass |
| AC-13 | API-02, manual browser pass |
| AC-14, AC-15 | API-01, API-02, UI-02, manual browser pass |
| AC-16 | API-01, API-02, UI-02 |
| AC-17 | manual browser pass; expanded visual checklist Pending |
| AC-18 | API-01, API-02, UI-01, UI-02, manual browser pass |
| AC-19 | This document plus ui-spec.md, api-spec.md, reviewer.md, and ai-use.md |
| AC-20 | Repository checks pass; final PDF and human evidence Pending |

## 5. Boundary and failure matrix

The final tests must include:

- Missing, whitespace-only, minimum, maximum, and over-limit Summary and Description.
- Invalid reference IDs, inactive reference records, malformed requester context, and conflicting client requester IDs.
- One create request while another is still processing.
- File types at and beyond the allowed set, content-signature mismatch, exactly 5 MB, over 5 MB, exactly five active files, and a sixth active file.
- File-write failure, database-transaction failure, cleanup, and no false-success behavior.
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
| `2026-09-02` — `pnpm run test` | Client, OpenAPI, and server tests | Pass: client 27, server 31, OpenAPI check pass |
| `2026-09-02` — `pnpm run build` | Client/server production build | Pending final run |
| `2026-09-02` — local T3 preview | Desktop/mobile manual flow | Pass for selection, creation, list, Detail, upload/download/remove; no evidence artifact committed |
| Browser E2E command | Full requester flow and screenshots | Pending E2E setup |

Update this table with date, exact command, result, and environment after each vertical slice. Record database setup and any limitation; do not hide skipped or flaky tests.

## 7. Evidence locations

- Automated output: repository PR/CI checks and this result log.
- Screenshots: artifacts/lab-02/screenshots/create-ticket/, my-tickets/, and ticket-detail/.
- Visual checklist: artifacts/lab-02/visual-checklist.md.
- Final PDF: report area using the exact Part 1 through Part 9 headings from the labsheet.
- Review traceability: reviewer.md.
