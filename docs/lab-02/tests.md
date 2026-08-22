# Lab 2 Test Plan — Requester Ticketing MVP

## 1. Status

This is the pre-implementation test contract required by the Lab 2 labsheet. Planned paths below are target paths, not claims that Lab 2 tests already exist. Replace Pending with actual commands, results, and evidence as each vertical slice lands.

Current baseline before Lab 2 implementation:

- Existing Lab 1 client tests: pass.
- Existing OpenAPI check: pass.
- Existing Lab 1 server tests: pass when the repository database is available with the configured test connection.
- Lab 2 automated tests, screenshots, and E2E evidence: Pending.

## 2. Strategy

Test observable behavior at the highest practical seam:

- Unit: pure Ticket Number, validation, query, Attachment, filename, and ordering rules.
- API/integration: PostgreSQL persistence, ownership, reference data, query behavior, safe errors, and Attachment compensation.
- UI: form/context state, field feedback, busy/duplicate-submit prevention, list states, Detail, and Attachment controls.
- Style/accessibility: labels, required markers, focus, badges, non-color feedback, and Zen Green tokens.
- Responsive/visual: desktop, tablet, and mobile layout plus screenshot checklist.
- E2E: one complete browser flow from Requester selection through creation, discovery, Detail, and Attachment lifecycle.

Do not assert private component structure, query syntax, database implementation details, or incidental CSS. Every test must map to an acceptance criterion and a concrete evidence path.

## 3. Planned automated tests

| ID | Level | Planned file path | Coverage |
| --- | --- | --- | --- |
| API-01 | API/integration | server/tests/lab-02/create-ticket.api.test.ts | Active reference data, valid creation, backend defaults, validation, duplicate prevention, safe errors, and creation Attachment compensation |
| API-02 | API/integration | server/tests/lab-02/my-tickets.api.test.ts | Requester ownership, search, filters, sorting, pagination, deterministic ordering, invalid queries, empty data, and safe errors |
| API-03 | API/integration | server/tests/lab-02/ticket-detail.api.test.ts | Owned Detail, read-only response shape, missing/unowned resource behavior, and context switching isolation |
| API-04 | API/integration | server/tests/lab-02/attachments.api.test.ts | Type/size/count limits, metadata, upload compensation, active download, soft removal, reason boundaries, removed download blocking, and cross-Requester protection |
| UI-01 | UI | client/tests/lab-02/RequesterSelection.test.tsx | Active/inactive Requesters, loading, empty, failure, validation, Continue, keyboard access, shell display, and context switching |
| UI-02 | UI | client/tests/lab-02/CreateTicket.test.tsx | Reference-data loading, required fields, validation, busy state, duplicate-submit prevention, success Ticket Number, preserved values, and create Attachment states |
| UI-03 | UI | client/tests/lab-02/MyTickets.test.tsx | Search, filters, sorting, pagination, clear filters, loading, empty, no-results, failure/retry, badges, and responsive representation |
| UI-04 | UI | client/tests/lab-02/RequesterTicketDetail.test.tsx | Read-only Detail, Attachment metadata, upload/download/remove actions, confirmation, reason validation, and safe failure recovery |
| UI-05 | Style/a11y | client/tests/lab-02/AttachmentSection.test.tsx | Attachment state labels, accessible names, focus, non-color status, disabled/busy actions, and removed-content action blocking |
| E2E-01 | Browser E2E | e2e/lab-02/requester-ticket-flow.spec.ts | Requester A selection, creation, official Number, My Tickets, switch to B, ownership isolation, Detail, add/download/remove Attachment, and failure states |
| VIS-01 | Manual/visual | artifacts/lab-02/visual-checklist.md | Desktop/tablet/mobile Create Ticket, My Tickets, Detail, clipping, overlap, overflow, colors, field states, and button hierarchy |

If implementation needs additional test files, add them here before implementation is marked complete. Do not delete a required path without recording the replacement.

## 4. Acceptance-criterion traceability

| Acceptance criteria | Planned tests |
| --- | --- |
| AC-01, AC-02 | UI-01, E2E-01 |
| AC-03, AC-12 | UI-01, UI-03, API-02, API-03, E2E-01 |
| AC-04, AC-05 | API-01, UI-01, UI-02 |
| AC-06, AC-07, AC-08 | API-01, UI-02, E2E-01 |
| AC-09 | API-01, API-04, UI-02 |
| AC-10, AC-11 | API-02, UI-03, E2E-01 |
| AC-13 | API-03, API-04, UI-04, E2E-01 |
| AC-14, AC-15 | API-04, UI-04, UI-05, E2E-01 |
| AC-16 | API-01, API-02, API-03, API-04, UI-02, UI-04 |
| AC-17 | UI-03, UI-04, UI-05, VIS-01 |
| AC-18 | API-01, API-02, API-03, API-04, UI-01, UI-02, UI-03, UI-04, UI-05, E2E-01, VIS-01 |
| AC-19 | This document plus ui-spec.md, api-spec.md, reviewer.md, and ai-use.md |
| AC-20 | VIS-01 plus final repository/PDF evidence |

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
| pnpm run fix | CI formatting/lint write step | Pending final implementation |
| pnpm run check-types | Client/server type checking | Pending final implementation |
| pnpm run test | Client, OpenAPI, and server tests | Pending final implementation |
| pnpm run build | Client/server production build | Pending final implementation |
| pnpm openapi:check | API contract synchronization | Pending final implementation |
| Browser E2E command | Full requester flow and screenshots | Pending E2E setup |

Update this table with date, exact command, result, and environment after each vertical slice. Record database setup and any limitation; do not hide skipped or flaky tests.

## 7. Evidence locations

- Automated output: repository PR/CI checks and this result log.
- Screenshots: artifacts/lab-02/screenshots/create-ticket/, my-tickets/, and ticket-detail/.
- Visual checklist: artifacts/lab-02/visual-checklist.md.
- Final PDF: report area using the exact Part 1 through Part 9 headings from the labsheet.
- Review traceability: reviewer.md.
