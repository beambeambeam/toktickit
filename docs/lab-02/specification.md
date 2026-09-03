# Lab 2 Specification — Requester Ticketing MVP

## 1. Sprint Goal

Deliver a safe, traceable, responsive, and accessible Requester-facing TokTickIT increment that lets a selected development context create, find, inspect, and manage owned support Tickets and Attachments.

## 2. Stakeholder Request Interpretation

TokTickIT currently proves only the Lab 1 platform foundation and Category reference-data flow. It does not yet let a Requester submit, find, inspect, or manage an IT support Ticket.

Lab 2 needs a complete Requester-facing increment while real authentication is still out of scope. A user must choose a seeded Development Requester as a temporary test context, create a Ticket, find only that Requester's Tickets, open an owned Ticket, and manage permitted Attachments. The increment adds Ticket, Attachment, Related System, and Development Requester concepts; active reference data; ownership-aware REST endpoints; a Zen Green shell; the Create Ticket, My Tickets, and Requester Ticket Detail screens; validation and recovery states; and automated and visual evidence.

The selected Requester is represented by a client-held context and an `X-Development-Requester-Id` request header. The server validates that the referenced Development Requester exists and is active, then applies that context to ownership checks. The header is intentionally not treated as a secure identity. Lab 3 can replace this context with an authenticated identity without changing the Ticket ownership relationship.

### User Stories

1. As a Requester, I want to choose an active Development Requester, so that I can test requester-specific behavior before authentication exists.
2. As a Requester, I want the selector to explain that it is not a login screen, so that I do not mistake test context for security.
3. As a Requester, I want inactive Development Requesters hidden, so that I cannot create or inspect data through an unavailable test context.
4. As a Requester, I want clear loading, empty, validation, and API-failure states on the selector, so that I know what to do when context loading is incomplete.
5. As a Requester, I want the selected Requester shown in the application shell, so that I know whose data I am viewing.
6. As a Requester, I want to change the selected Requester, so that I can verify that Ticket data is isolated between Requesters.
7. As a Requester, I want changing Requester context to clear or reload requester-specific data, so that another Requester's Tickets are never left on screen.
8. As a Requester, I want active Categories loaded from the database, so that the form uses current reference data.
9. As a Requester, I want active Related Systems loaded from the database, so that I can identify the affected service accurately.
10. As a Requester, I want to choose a Requested Priority, so that support staff can understand the urgency I am requesting.
11. As a Requester, I want to enter a Summary and Description, so that I can communicate the problem clearly.
12. As a Requester, I want required fields and their validation messages clearly identified, so that I can correct an invalid Ticket quickly.
13. As a Requester, I want frontend validation before submission, so that obvious mistakes receive immediate feedback.
14. As a Requester, I want backend validation to remain authoritative, so that invalid or tampered requests cannot create incomplete Tickets.
15. As a Requester, I want the Submit action disabled while a Ticket is being created, so that one click cannot create duplicate Tickets.
16. As a Requester, I want a successful response to show the official Ticket Number, so that I can reference the request later.
17. As a Requester, I want failed creation to preserve my valid form values, so that a temporary API problem does not force me to retype the request.
18. As a Requester, I want to attach supporting files while creating a Ticket, so that I can provide evidence of the problem.
19. As a Requester, I want invalid file types, oversized files, and excess files rejected with useful messages, so that I understand the Attachment rules.
20. As a Requester, I want a Ticket created with status `New`, so that the initial workflow state is predictable.
21. As a Requester, I want My Tickets to show only Tickets owned by my selected context, so that another Requester's data is not exposed.
22. As a Requester, I want to search My Tickets, so that I can find a known request quickly.
23. As a Requester, I want to filter My Tickets by documented fields, so that I can narrow a long list.
24. As a Requester, I want to sort and paginate My Tickets, so that the list remains usable as data grows.
25. As a Requester, I want deterministic ordering and pagination metadata, so that repeated queries behave predictably.
26. As a Requester, I want distinct empty-list and no-results states, so that I can tell whether I have no Tickets or my query found no match.
27. As a Requester, I want a safe list-failure state and retry action, so that I can recover from a temporary API problem.
28. As a Requester, I want to open one of my Tickets, so that I can inspect what was saved.
29. As a Requester, I want Ticket information presented read-only, so that requester workflows cannot silently change system-managed values.
30. As a Requester, I want Attachment metadata visible, so that I know which evidence is available and what happened to removed files.
31. As a Requester, I want to add an Attachment to an owned Ticket, so that I can provide evidence discovered after submission.
32. As a Requester, I want to download active Attachments, so that I can inspect previously submitted evidence.
33. As a Requester, I want to remove an Attachment with confirmation and a reason, so that accidental removal is less likely and the action is explainable.
34. As a Requester, I want removed Attachment metadata retained but its file unavailable, so that the Ticket history remains understandable without allowing access to removed content.
35. As a Requester, I want cross-Requester Ticket and Attachment access rejected or safely hidden, so that changing an identifier cannot bypass ownership.
36. As a Requester, I want the interface usable on desktop, tablet, and mobile, so that I can submit and inspect Tickets from different devices.
37. As a keyboard and assistive-technology user, I want labels, focus indicators, accessible names, and non-color feedback, so that all important states remain understandable.
38. As a maintainer, I want the Zen Green presentation rules documented, so that later labs can extend the interface consistently.
39. As a maintainer, I want API, data, UI, test, AI-use, and review decisions recorded as living documents, so that implementation and evidence remain traceable.
40. As a course reviewer, I want automated tests, screenshots, review records, and a final PDF linked to acceptance criteria, so that completion can be evaluated from evidence rather than claims.

## 3. Scope

### Included

- Temporary Development Requester selection, active-context loading, switching, and requester-specific data reload.
- Ticket creation with Categories, Related Systems, Requested Priority, validation, backend defaults, and permitted Attachments.
- Requester-owned My Tickets search, filtering, sorting, pagination, deterministic ordering, and safe empty/no-results/failure states.
- Owned Ticket Detail and Attachment metadata, upload, active download, and soft removal.
- Ownership protection, responsive Zen Green UI, accessibility behavior, automated tests, screenshots, review evidence, and final PDF evidence.

### Excluded

- Authentication, login, logout, passwords, password hashing, sessions, tokens, authenticated identities, and secure role-based authorization.
- IT Staff dashboards, queues, claiming, assignment, reassignment, IT Priority changes, and other ticket-owner controls.
- Public Comments, Internal Notes, Actions Taken, collaboration, and ticket discussion.
- Status changes after initial `New`, including resolving, closing, reopening, cancelling, or resolution confirmation.
- Administrator management of Requesters, roles, Categories, or Related Systems.
- Real production object storage, virus scanning, cloud deployment, notifications, email, and unrelated integrations.

The Development Requester selector is a testing mechanism and must never be described or implemented as secure authentication.

## 4. Functional Requirements

- **FR-01 — Requester context:** Load active Development Requesters from PostgreSQL and allow the user to select one before accessing requester workflows. (AC-01, AC-02, AC-04)
- **FR-02 — Selector states:** Show loading, empty, API-failure, validation, success, and keyboard-accessible states on the selector screen. (AC-01, AC-02)
- **FR-03 — Requester switching:** Show the selected Requester in the application shell and provide a Change Requester action that clears or reloads requester-specific data. (AC-03, AC-12)
- **FR-04 — Ticket creation:** Capture all required editable Ticket fields and submit one validated Ticket. (AC-06, AC-07)
- **FR-05 — Ticket defaults:** Generate the official Ticket Number and system values in the backend; new Tickets start with Current Status `New`. (AC-06)
- **FR-06 — Reference data:** Load active Categories and Related Systems from the backend rather than hard-coding them in the UI, with loading, empty, and safe failure states. (AC-04, AC-05, AC-16)
- **FR-07 — Attachments on creation:** Validate permitted file types, signatures, file size, and active Attachment count before upload and persist required metadata safely. (AC-09)
- **FR-08 — My Tickets:** Retrieve only Tickets owned by the selected Requester. (AC-10, AC-12)
- **FR-09 — Ticket-list controls:** Support documented search, filters, sorting, page numbering, page sizes, deterministic ordering, and pagination metadata. (AC-10, AC-11)
- **FR-10 — Ticket Detail:** Retrieve and display one owned Ticket as read-only Ticket information. (AC-13)
- **FR-11 — Attachment lifecycle:** Retrieve Attachment metadata, download active Attachments, add permitted Attachments, and soft-remove owned Attachments. (AC-14, AC-15)
- **FR-12 — Ownership protection:** Reject or safely hide direct access to Tickets and Attachments belonging to another Requester. (AC-13, AC-16)
- **FR-13 — Failure recovery:** Preserve user-entered Ticket form values after a failed submission or Attachment operation whenever recovery is possible. (AC-08, AC-16)
- **FR-14 — UI consistency:** Reuse the documented Zen Green components and field, badge, validation, loading, empty, error, accessibility, and responsive conventions. (AC-17)
- **FR-15 — Evidence:** Trace each requirement to acceptance criteria, planned tests, implementation, and final evidence. (AC-18, AC-19, AC-20)

## 5. Business Rules

- **BR-01 — Ticket identity:** The official Ticket Number is generated by the backend, unique at the database level, and formatted as `TKT-YYYYMMDD-XXXXXX`; uniqueness remains authoritative if a generated value collides.
- **BR-02 — Initial workflow state:** A newly created Ticket starts with Current Status `New`; Lab 2 exposes no requester status-transition operation.
- **BR-03 — Test context, not authentication:** The Development Requester selector and `X-Development-Requester-Id` header are Lab 2 testing mechanisms, not authentication or secure identity.
- **BR-04 — Active Requesters only:** A context is valid only when its Development Requester exists and is active; inactive Requesters do not appear in the selector.
- **BR-05 — Context switching:** Changing the selected Requester clears or reloads requester-specific data before the replacement data is shown.
- **BR-06 — Server-derived ownership:** Every Ticket belongs to exactly one Development Requester. The server derives that relationship from the validated context and ignores conflicting client-provided Requester identifiers.
- **BR-07 — Owner-only access:** My Tickets, Ticket Detail, and every Attachment operation use the same ownership check. Missing, invalid, and unowned resources use the documented safe ownership response consistently.
- **BR-08 — Active reference data:** Ticket creation may select only active Categories and Related Systems. Reference data is deactivated instead of silently deleted, and restrictive relationships do not cascade-delete Tickets or Attachments.
- **BR-09 — Text validation:** After trimming, Summary must contain 5–120 characters and Description must contain 20–4000 characters. The same limits apply in the client and server contracts, with the server authoritative.
- **BR-10 — Duplicate submission prevention:** The create action is disabled while a create request is in progress, so one user action cannot create duplicate Tickets.
- **BR-11 — Failure recovery:** Recoverable create and Attachment failures preserve valid form values where possible, clean up failed persistence attempts, and never report success for an incomplete operation.
- **BR-12 — Deterministic listing:** Ticket-list defaults are `page=1`, `pageSize=10`, `sortBy=updatedAt`, and `sortDirection=desc`; permitted page sizes are 10, 25, and 50, and every sort uses the immutable Ticket identifier as a secondary key.
- **BR-13 — Query validation:** Search, filters, sorting, and pagination accept only documented parameters and return the documented safe validation response for invalid values; they never silently fall back to defaults.
- **BR-14 — Empty versus no results:** An empty Ticket list and a valid query with no matches are distinct UI states.
- **BR-15 — Attachment limits:** Only JPG/JPEG, PNG, WEBP, and PDF Attachments are permitted; each file is at most 5 MB and each Ticket has at most five active Attachments.
- **BR-16 — Attachment consistency:** All creation uploads must pass validation and be written to final opaque storage before one Ticket/Attachment database transaction. Any file-write or transaction failure must clean up the attempt and must not report success.
- **BR-17 — Soft removal:** Removing an Attachment requires UI confirmation and a trimmed reason of 3–500 characters, retains its metadata, records removal time, and makes its content unavailable for download or preview.
- **BR-18 — Safe failure contract:** API errors use the documented stable code, safe message, and optional field details; they must not expose stack traces, database messages, local paths, or secrets.
- **BR-19 — Lab 3 evolution:** The Ticket-to-Requester relationship and stable data identifiers remain usable when Lab 3 replaces the test context with authenticated identity mapping; Lab 2 adds no passwords, sessions, roles, or authentication behavior.
- **BR-20 — Safe unavailable states:** Empty or failed active-reference-data loads and failed Ticket or Attachment operations show safe, actionable UI states; they never expose sensitive details, leave stale requester data visible, or report false success.

## 6. UI Specification Summary

The detailed screen contract belongs in `docs/lab-02/ui-spec.md`; this specification fixes the behavior that implementation and visual evidence must satisfy.

- Use a reusable TokTickIT shell with application identity, My Tickets navigation, Create Ticket navigation, current Development Requester display, active-page indication, responsive mobile navigation, and Change Requester action.
- Use the Zen Green tokens: primary `#006B3C`, secondary `#0B7A46`, pale green `#EAF6EF`, quiet near-white page background, white bordered surfaces, charcoal-green text, dark-red validation, amber warnings, and readable non-color success indicators.
- Provide a Requester Selection screen with testing-only explanation, active Requester dropdown, Continue action, keyboard accessibility, loading state, empty state, safe failure state, and responsive layout. A Cancel or Back action is secondary navigation for returning from an existing context; Continue remains the initial-selection action.
- Provide Create Ticket fields for read-only system/context values, Category, Related System, Summary, Requested Priority, Description, and optional Attachments. Labels sit above controls, required fields show a red asterisk plus a message when invalid, and system-generated/read-only values are visually distinct.
- Provide initial, loading, validation failure, submitting, success, API failure, invalid Attachment, and recovery states. Preserve valid form values after recoverable failures. Show the generated Ticket Number and a clear next action on success.
- Provide My Tickets search, filters, sorting, pagination, clear-filters action, Create Ticket action, loading, empty, no-results, failure, and retry states. Desktop may use a table; mobile may use cards or a responsive table if all information and actions remain clear.
- Provide Requester Ticket Detail with read-only Ticket information, Attachment metadata, active/removed state labels, upload, download, removal confirmation/reason, and safe failure recovery. Do not add comments, internal notes, staff actions, or post-creation status controls.
- Meet responsive targets: multi-column desktop at 992 px and above; practical two-column tablet layout from 768–991 px; stacked touch-friendly mobile layout below 768 px; no horizontal page scrolling, clipping, overlap, hidden actions, or unreadable filenames.
- Meet accessibility targets through semantic labels, keyboard-focus visibility, accessible names for icon-only controls, useful status announcements, and non-color indicators for error, warning, success, priority, and status.
- Treat the supplied Ticket Detail, Requester Selection, and My Tickets images as visual direction, not a complete feature list. Their Profile, IT Priority, Ticket Owner, Public Comments, Service Actions, Event Log, Resolution Summary, and later workflow controls are excluded from Lab 2 even when visible in the illustrations. Lab 2 uses Requested Priority and Current Status only.

### Component states and visual evidence

- Use a readable system sans-serif stack, a consistent 4/8 px spacing rhythm, and one control-height token across screens; give Summary and Description the widest available form space.
- Define button hierarchy as primary (green submit/continue/create), secondary (neutral cancel/back), tertiary (text clear-filters), destructive (remove Attachment), disabled, and busy. Disabled and busy buttons remain visibly distinct and cannot be activated.
- Distinguish editable, read-only, invalid, disabled, and focused controls with more than color alone. Required markers are red asterisks; field messages appear immediately below the associated control.
- Represent Attachments with explicit `Active`, `Uploading`, `Invalid`, `Removed`, and `Unavailable` states. Show invalid-file explanations beside the selection control; never offer download or preview for Removed or Unavailable content.
- Use readable text/icon labels with badges for Requested Priority and Current Status. Lab 2 exposes Requested Priority and `New` Current Status only; each badge includes a text label and non-color indicator.
- Use these My Tickets fields unless a later approved `ui-spec.md` decision changes them: Ticket Number, Ticket Date, Summary, Category, Requested Priority, Current Status, and Last Updated. Preserve the same identifying information in mobile cards or a responsive table.
- The visual checklist compares Create Ticket, My Tickets, and Ticket Detail at desktop, tablet, and mobile sizes against this summary and `ui-spec.md`; check colors, editable/read-only fields, validation placement, hierarchy, clipping, overlap, and horizontal overflow.
- Store screenshot evidence under `artifacts/lab-02/screenshots/create-ticket/`, `artifacts/lab-02/screenshots/my-tickets/`, and `artifacts/lab-02/screenshots/ticket-detail/`, with desktop, tablet, mobile, failure, and ownership cases recorded in the final checklist.

## 7. Data Changes

### Models and fields

| Model | Required fields and types | Constraints and relationships |
| --- | --- | --- |
| `Category` | `id Int`, `name String`, `isActive Boolean`, `displayOrder Int`, `createdAt DateTime`, `updatedAt DateTime` | Primary key `id`; unique `name`; active/display-order index; referenced by many Tickets |
| `RelatedSystem` | `id Int`, `name String`, `isActive Boolean`, `displayOrder Int`, `createdAt DateTime`, `updatedAt DateTime` | Primary key `id`; unique `name`; active/display-order index; referenced by many Tickets |
| `DevelopmentRequester` | `id Int`, `displayName String`, `email String`, `isActive Boolean`, `createdAt DateTime`, `updatedAt DateTime` | Primary key `id`; unique `email`; no password, token, session, or authentication fields |
| `Ticket` | `id Int`, `ticketNumber String`, `ticketDate DateTime`, `requesterId Int`, `categoryId Int`, `relatedSystemId Int`, `summary String`, `description String`, `requestedPriority RequestedPriority`, `currentStatus CurrentStatus`, `createdAt DateTime`, `updatedAt DateTime` | Primary key `id`; unique backend-generated `ticketNumber`; non-null foreign keys to Requester, Category, and RelatedSystem; one Requester/Category/System per Ticket; many Attachments |
| `Attachment` | `id Int`, `ticketId Int`, `originalFilename String`, `storageKey String`, `mediaType String`, `byteSize Int`, `uploadedAt DateTime`, `removedAt DateTime?`, `removalReason String?`, `removedByRequesterId Int?` | Primary key `id`; unique opaque `storageKey`; non-null Ticket foreign key; optional removal metadata and removal-actor foreign key to `DevelopmentRequester`; active when `removedAt` is null |

Use integer auto-increment identifiers consistently with the existing Prisma model. `RequestedPriority` has `Low`, `Medium`, `High`, and `Urgent`; `CurrentStatus` has `New` as the only Lab 2-created/exposed value. Store timestamps in UTC and display Ticket Date and Last Updated using a documented locale-aware format while preserving API timestamps.

### Relationships, indexes, and migration

- Enforce one Requester per Ticket, one Category per Ticket, one Related System per Ticket, and many Attachments per Ticket through non-null foreign keys.
- Use restrictive foreign-key behavior for Ticket relationships. Do not silently delete Tickets or Attachments through reference-data deletion; deactivate reference data instead.
- Add Ticket indexes for `(requesterId, updatedAt)`, `(requesterId, currentStatus)`, `(requesterId, requestedPriority)`, `(requesterId, categoryId)`, and `(requesterId, relatedSystemId)`; add Attachment `(ticketId, removedAt)` for active/removed metadata retrieval.
- Add a Prisma migration that preserves existing Category rows, backfills their active/display-order values, and adds RelatedSystem, DevelopmentRequester, Ticket, and Attachment tables plus the enums, foreign keys, unique constraints, and indexes above. No destructive migration is allowed.
- Use an idempotent seed containing exactly the four required Categories, at least six realistic Related Systems, at least four active Development Requesters, and at least one inactive Development Requester. Re-running the seed must not duplicate rows, and the inactive Requester must not appear in the selector.

## 8. API Contract

### Requester context and ownership

- `GET /api/development-requesters` retrieves only active Development Requesters from PostgreSQL.
- The client retains the selected context for the current browser session and sends its identifier as `X-Development-Requester-Id` on requester-scoped API calls.
- The server rejects missing, malformed, nonexistent, or inactive context values using the documented safe error contract.
- The server derives Ticket ownership from the validated context. A client-provided Requester identifier in a Ticket payload is not trusted to override the context.
- My Tickets, Ticket Detail, Attachment metadata, Attachment download, Attachment upload, and Attachment removal all enforce the same context-to-Ticket ownership check.
- The API returns a safe not-found response for an unowned resource so that direct identifiers do not reveal whether another Requester owns it. The chosen status is consistent across the contract and tests.
- Changing context invalidates requester-scoped client queries and clears visible data until the replacement context has loaded.

### Endpoints and shapes

- Reference data: `GET /api/categories` and `GET /api/related-systems` return active records in display order.
- `POST /api/tickets` accepts multipart form data containing `categoryId`, `relatedSystemId`, `summary`, `description`, `requestedPriority`, and optional `attachments[]`. It does not trust a payload `requesterId`. A successful response is `201` with `{ "ticket": TicketDetail }`.
- `GET /api/tickets` returns `{ "items": TicketSummary[], "page": number, "pageSize": number, "totalItems": number, "totalPages": number }` for the selected Requester only.
- `GET /api/tickets/:ticketId` returns `200` with one owned read-only Ticket and its active and documented removed Attachment metadata.
- `POST /api/tickets/:ticketId/attachments` adds permitted files to an owned Ticket and returns `201` with the created Attachment metadata.
- `GET /api/tickets/:ticketId/attachments` returns active and documented removed metadata for an owned Ticket.
- `GET /api/tickets/:ticketId/attachments/:attachmentId/content` streams an active owned Attachment only.
- `DELETE /api/tickets/:ticketId/attachments/:attachmentId` accepts `{ "reason": string }`, records soft removal after the ownership and 3–500 character trimmed-reason checks, and returns `200` with the retained metadata.
- Use an error envelope `{ "error": { "code": string, "message": string, "details"?: object } }`. Do not return stack traces, database messages, local paths, or secrets.

The response shapes use these fields:

- `TicketSummary`: `id`, `ticketNumber`, `ticketDate`, `summary`, `category`, `relatedSystem`, `requestedPriority`, `currentStatus`, and `updatedAt`.
- `TicketDetail`: `TicketSummary` plus `requester`, `description`, and `attachments`.
- `AttachmentMetadata`: `id`, `originalFilename`, `mediaType`, `byteSize`, `uploadedAt`, `state` (`Active` or `Removed`), and removal time/reason when removed. Removed metadata never contains downloadable content.

### Query, validation, and status decisions

- Ticket-list query parameters are `search`, `categoryId`, `relatedSystemId`, `requestedPriority`, `currentStatus`, `sortBy`, `sortDirection`, `page`, and `pageSize`.
- Search covers Ticket Number, Summary, and Description. Filters cover Category, Related System, Requested Priority, and Current Status. Sorting permits Ticket Number, Ticket Date, Summary, Requested Priority, Current Status, and Last Updated.
- Defaults are `page=1`, `pageSize=10`, `sortBy=updatedAt`, and `sortDirection=desc`. Permitted page sizes are 10, 25, and 50; 50 is the maximum. Default and requested sorts use a secondary immutable Ticket identifier for deterministic ordering.
- List responses include items and `page`, `pageSize`, `totalItems`, and `totalPages` metadata. Invalid values never silently fall back to defaults; they return the documented validation error.
- Ticket creation trims required text fields before validation and persistence. Summary must contain 5–120 characters after trimming. Description must contain 20–4000 characters after trimming. Frontend and backend share these limits, while the backend remains authoritative.
- Use `200` for successful retrieval, metadata, download, and soft-removal responses; `201` for Ticket and Attachment creation; `400` for invalid context, fields, or query parameters; `404` for missing or intentionally hidden resources; `413` for files above 5 MB; `415` for unsupported types; `409` only for documented conflicts; and `500` for safe unexpected failures.

### Attachment behavior

- Allowed types are JPG/JPEG, PNG, WEBP, and PDF. Each file is limited to 5 MB. Each Ticket has at most five active Attachments.
- Validate extension, declared media type, byte size, and server-side content signature where practical. Never use the original filename as a storage path or as an authorization decision.
- Normalize displayed filenames for control characters and unsafe markup. Store content under generated opaque keys outside the public static directory. Persist metadata separately from content.
- Validate every creation upload before any persistence. Write each accepted file to a generated opaque key in non-public final storage before starting the database transaction. If a file write fails, delete every file written for that attempt and do not create the Ticket.
- Create the Ticket and all Attachment metadata in one database transaction, referencing the already-written opaque keys. If the transaction fails, delete every file written for that attempt and return a safe failure; never report a Ticket success with incomplete Attachment metadata.
- Do not perform a post-commit file move. After the transaction commits, the files referenced by the committed metadata are already in their final non-public storage locations.
- For later uploads, check ownership and active-count limits before storing the Attachment, use the same file-write/database-compensation ordering, and return a safe error when persistence fails.
- Attachment metadata may show `Active` or `Removed`, original filename, type, size, upload time, and removal time/reason according to the UI contract.
- Download and preview are available only for active owned Attachments. Removed content is never streamed or previewed.
- Removal is soft: retain the metadata and mark removal time/reason. Require UI confirmation and a removal reason containing 3–500 characters after trimming; the API rejects values outside this inclusive range.

## 8.1 Supplemental Testing Decisions

- Test observable behavior at the highest practical seam. Prefer a complete browser flow for user outcomes, API integration for persistence/ownership/query contracts, and focused client tests for local field and feedback behavior. Do not assert private implementation details, component structure, database query syntax, or incidental CSS implementation.
- Reuse the existing server Vitest + Supertest boundary for HTTP behavior and the existing client Vitest + React Testing Library boundary for UI behavior. Extend the current OpenAPI validation coverage for the new contract. Add a browser E2E runner only for the required full flow, viewport checks, and screenshots.
- Unit tests cover Ticket Number generation, trimming/validation helpers, query parsing, Attachment rules, filename normalization, and deterministic ordering helpers.
- API/integration tests cover seeded reference data, active/inactive Requesters, valid and invalid Ticket creation, backend defaults, validation, safe errors, list ownership, query behavior, invalid query parameters, Ticket Detail ownership, Attachment limits/types/sizes, concurrent active-limit enforcement, removal-reason boundaries, upload failure compensation ordering, cleanup retry recovery, active download, soft removal, removed download blocking, and cross-Requester access.
- Client UI tests cover selector states and context switching, reference-data loading, required fields and field-level errors, busy/duplicate-submit prevention, successful Ticket Number display, preserved form values after failure, Attachment validation, My Tickets filters/pagination/empty/no-results/error states, read-only Detail, and Attachment controls.
- Style/accessibility tests cover required labels and asterisks, accessible names, visible focus, non-color feedback, badge states, disabled/busy controls, read-only field styling, and the required Zen Green tokens.
- Responsive tests and manual visual inspection cover desktop, tablet, and mobile Create Ticket, My Tickets, and Ticket Detail layouts, including no clipping, overlap, horizontal overflow, or hidden Attachment names/actions.
- E2E covers selecting Requester A, creating a Ticket with database-backed reference data, seeing the backend Ticket Number, finding the Ticket in My Tickets, switching to Requester B, verifying isolation, opening owned Detail, adding/downloading/removing an Attachment, and proving removed/unauthorized access is blocked.
- Every Acceptance Criterion maps to at least one planned test. The test plan records the actual test path, command, result, limitation, and evidence location after implementation.

## 9. Acceptance Criteria

- **AC-01:** The selector loads only active Development Requesters from PostgreSQL and provides loading, empty, failure, validation, Continue, and keyboard-accessible states.
- **AC-02:** The selector clearly states that it is a Lab 2 testing context and not authentication.
- **AC-03:** The shell displays the selected Requester and Change Requester clears/reloads all requester-specific data.
- **AC-04:** The seed is idempotent and contains the four required Categories, at least six Related Systems, at least four active Requesters, and at least one inactive Requester that is absent from the selector.
- **AC-05:** Active Categories and Related Systems are loaded through APIs and are not hard-coded into the Ticket form.
- **AC-06:** A valid Ticket creates exactly one persisted Ticket with the selected Requester, backend Ticket Number, Ticket Date, required relationships, trimmed requester fields, Requested Priority, and Current Status `New`.
- **AC-07:** Frontend and backend validation reject missing, whitespace-only, over-limit, invalid, or mismatched values; invalid submission creates no partial Ticket and shows field-level messages.
- **AC-08:** Create submission is disabled and visibly busy while processing; a recoverable failure preserves valid entered values and reports a safe error.
- **AC-09:** Creation Attachments obey allowed types, 5 MB per-file limit, five active-file limit, and safe metadata/storage behavior. All files are validated and written to opaque storage before one Ticket/Attachment database transaction; any write or transaction failure cleans up the attempt and cannot report success.
- **AC-10:** My Tickets returns only Tickets owned by the selected Requester and provides documented search, filters, sorting, pagination, deterministic ordering, and pagination metadata.
- **AC-11:** Invalid Ticket-list parameters return the documented safe validation response; an empty Ticket list is visually distinct from a valid no-results query.
- **AC-12:** Switching between two seeded Requesters removes the first Requester's Tickets from view and loads the second Requester's data.
- **AC-13:** Owned Ticket Detail displays read-only Ticket information and Attachment metadata. Missing, unowned, or invalid resources return the documented safe ownership response.
- **AC-14:** An owned Requester can add a permitted Attachment, download an active Attachment, and soft-remove an Attachment with confirmation and a 3–500 character trimmed reason.
- **AC-15:** Removed Attachment metadata remains available as documented, while removed content cannot be downloaded or previewed.
- **AC-16:** All API errors are predictable and safe; they do not expose stack traces, database details, local paths, or secrets.
- **AC-17:** Create Ticket, My Tickets, and Ticket Detail satisfy the Zen Green visual contract, accessible naming/focus rules, non-color feedback rules, and desktop/tablet/mobile layout requirements.
- **AC-18:** Unit, API/integration, UI, style/accessibility, responsive, and E2E tests cover success, loading, validation, failure, empty, no-results, boundary, ownership, and Attachment state transitions without skipped required tests.
- **AC-19:** The six required Lab 2 documents are updated incrementally across the three Issues and contain consistent requirements, decisions, actual tests, review evidence, and AI-use reflection.
- **AC-20:** The repository contains readable screenshots and one final PDF using the exact Part 1 through Part 9 headings; final `main` passes formatting, type checks, tests, and build.

## 10. Definition of Done

- Approved scope and acceptance criteria are implemented and demonstrated.
- Data schema, migrations, seed, APIs, UI, validation, ownership, responsive, accessibility, and Attachment behavior match the living contract.
- Required tests pass on the final `main` branch. No required test is skipped, disabled, commented out, or unrelated to the claimed behavior.
- The six Lab 2 documents are current, rendered where required, and traceable to implementation and evidence.
- README setup and verification instructions are current.
- Screenshots cover Create Ticket, My Tickets, and Ticket Detail on required viewports plus required failure and ownership cases.
- GitHub Issues use the required Kanban statuses. Feature branches enter `lab2-staging` through peer-reviewed PRs, and a release PR enters `main`.
- Reviewer identity, PR links, review comments, responses, and approvals are recorded.
- AI-use record contains the selected prompts and a personal reflection; generated work has been reviewed and approved by the student.
- Final repository checks are green: formatting/lint, type checking, tests, and production build.
- Final PDF is concise, has exactly the required Part 1 through Part 9 headings, contains working links and readable screenshots, and does not replace the repository as the source of truth.

## 11. Assumptions and Decisions

- `X-Development-Requester-Id` is the temporary Lab 2 context boundary. Lab 3 can map an authenticated identity to the existing `DevelopmentRequester` relationship without changing Ticket ownership.
- A safe `404` is used for missing or unowned Ticket and Attachment resources to avoid leaking whether another Requester owns a supplied identifier.
- Attachment content uses local non-public opaque storage for this MVP. Production object storage, virus scanning, and cloud deployment remain outside scope.
- The supplied illustrations are visual references only. Where an image shows later-lab or IT Staff concepts, the explicit scope and API/UI contract take precedence.
- The specification is the baseline contract produced from the Lab 2 labsheet and repository state. Any implementation ambiguity discovered during an Issue must be resolved here before the Issue is considered complete.
- Treat the six Lab 2 documents as living contract/evidence artifacts: specification, tests, UI specification, API specification, reviewer record, and AI-use record. Update them after each vertical slice with resolved decisions, actual test paths/results, changed acceptance traceability, review evidence, and AI-use reflection.
- Keep required automated tests and screenshots in the repository. Keep the final concise PDF under the Lab 2 report area with the exact Part 1 through Part 9 headings required by the labsheet.
- Use the three approved vertical slices: requester creation, My Tickets discovery, and Ticket Detail/Attachment lifecycle plus final evidence. Each slice includes its own end-to-end behavior, relevant tests, and document updates.
- Use GitHub Issues and the required statuses `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, and `Done`. Implement on feature branches, merge reviewed PRs into `lab2-staging`, then release to `main`. Do not develop directly on `main` or `lab2-staging`.
- The primary test seam is the browser flow; API and client seams make failures, ownership, validation, and feedback deterministic and fast.
- The development selector must never be described as a login screen in the UI, API, documentation, screenshots, or final PDF.
- The repository and final `main` branch remain the source of truth. GitHub Issues, PRs, rendered documents, test output, screenshots, and the final PDF provide traceable evidence of the work.

## 12. Issue #37 implementation addendum — My Tickets discovery

Issue #37 hardens the existing requester-scoped My Tickets slice. The selected Development Requester remains the temporary context boundary; switching context clears the visible list and reloads it under the new requester before any replacement rows are shown.

Resolved implementation decisions:

- `GET /api/tickets` searches Ticket Number, Summary, and Description; filters Category, Related System, Requested Priority, and Current Status; supports the documented sort fields and directions; and returns page, page size, total item count, and total page count.
- The server rejects repeated, nested, malformed, unsupported, and out-of-range query values with the safe validation envelope. Ownership is applied in the database query, not by client-side filtering.
- The client validates the list response at the API boundary and refuses malformed payloads as safe errors. Failed refetches do not leave stale rows or stale pagination metadata visible.
- The UI provides draft-aware Clear Filters, numbered pagination with a current-page indicator, empty versus no-results messaging, retryable list/filter-data failures, and responsive table/card presentation aligned to the supplied My Tickets reference. IT Priority and Ticket Owner remain outside Lab 2 scope.

Traceability: Issue #37 acceptance is covered by `server/tests/lab-02/requester-ticketing.test.ts`, `client/tests/lab-02/requester-api.test.ts`, and `client/tests/lab-02/my-tickets.test.tsx`. These tests cover ownership isolation, search/filter/sort/pagination, invalid queries, malformed responses, draft clearing, empty/no-results states, retry, and requester-context switching.

## 13. Issue #38 implementation addendum — Ticket Detail, Attachments, and submission evidence

Issue #38 completes the requester slice with owned Ticket Detail, the Attachment lifecycle, and the final Lab 2 evidence. The API and screens for this slice already existed from Issue #36; Issue #38 hardens their coverage and finishes the submission artifacts.

Resolved implementation decisions:

- `GET /api/tickets/:ticketId` returns one owned Ticket with active and removed Attachment metadata. Missing, malformed, or unowned identifiers receive the safe `404 RESOURCE_NOT_FOUND` response, so direct identifiers never reveal another Requester's data.
- Attachment writes follow validate-then-store-then-commit: every file is validated, written under a generated opaque key in non-public final storage, then committed with its metadata in one database transaction. Any write or transaction failure deletes the staged files and never reports success. No post-commit file move exists.
- Later uploads check ownership and the five-active limit before storing content; the repository re-checks the limit inside the write so concurrent additions cannot exceed five active Attachments.
- Removal deletes file content before committing removal metadata, so a cleanup failure stays retryable and never leaves metadata claiming removal while content remains. A second removal of the same Attachment returns the safe not-found response.
- Removal requires UI confirmation and a trimmed reason of 3–500 characters on both client and server. The dialog states that metadata remains in Ticket history.
- Download streams active owned Attachments only; removed, missing, or unowned content returns the safe not-found response and has no download or preview action in the UI.
- The Detail screen follows the labsheet Requester Ticket Detail figure (§12.6, `Lab_02_labsheet_2.png`, p. 2) as visual direction while keeping only the Lab 2 contract fields; comments, service actions, event log, resolution, IT Priority, and Ticket Owner remain excluded.
- Responsive behavior reuses the app breakpoints: two-column detail grid on tablet (768–991 px), stacked fields with full-width Attachment actions on mobile (below 768 px), no horizontal page scrolling or hidden actions.
- Submission evidence comprises 72 unique E2E-captured PNGs under `artifacts/lab-02/screenshots/` (Requester Selection, Create Ticket, My Tickets, and Ticket Detail across desktop/tablet/mobile), three per-viewport manifests, the `artifacts/lab-02/visual-checklist.md` comparison record, the six living documents, and the final PDF using exactly the Answer Part 1 through Part 9 headings.

Final evidence record: the captures and report are generated on `docs/lab02-final-report`, based on merged `lab2-staging` commit `e5b8612`. The local `main` ref remains the Lab 1 baseline; the report labels this branch boundary explicitly while preserving the release-to-`main` requirement as the repository contract.

Traceability: Issue #38 acceptance is covered by `server/tests/lab-02/requester-ticketing.test.ts` (detail isolation, active download, soft removal, removed-download blocking, concurrent limit, cleanup retry), `client/tests/lab-02/ticket-detail.test.tsx` (read-only detail, active/removed states, upload validation, removal confirmation and reason boundaries, download, loading/failure/invalid states), and `e2e/lab-02/requester-flow.spec.ts` (complete Requester A/B path with screenshot evidence).
