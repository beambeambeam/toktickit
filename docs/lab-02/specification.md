# Lab 2 Specification — Requester Ticketing MVP

## Problem Statement

TokTickIT currently proves only the Lab 1 platform foundation and Category reference-data flow. It does not yet let a Requester submit, find, inspect, or manage an IT support Ticket.

Lab 2 needs a complete Requester-facing increment while real authentication is still out of scope. A user must be able to choose a seeded Development Requester as a temporary test context, create a Ticket, find only that Requester's Tickets, open an owned Ticket, and manage permitted Attachments. The increment must be safe, traceable, responsive, accessible, and demonstrable through code, tests, GitHub workflow, documentation, and screenshots.

## Solution

Build a Requester ticketing MVP around a temporary Development Requester selector. The selector loads only active Requesters from PostgreSQL and supplies the selected Requester context to requester-scoped API calls. It is explicitly a testing mechanism, not authentication or authorization.

The increment adds the Ticket, Attachment, Related System, and Development Requester domain concepts; active reference data; ownership-aware REST endpoints; a Zen Green application shell; Create Ticket, My Tickets, and Requester Ticket Detail screens; validation and recovery states; and automated and visual evidence.

The selected Requester is represented by a client-held context and an `X-Development-Requester-Id` request header. The server validates that the referenced Development Requester exists and is active, then applies that context to ownership checks. The header is intentionally not treated as a secure identity. Lab 3 can replace this context with an authenticated identity without changing the Ticket ownership relationship.

## User Stories

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

## Implementation Decisions

### Domain and persistence

- Keep the existing Category concept and extend it with active-state and display-order data needed for reference-data retrieval.
- Add Related System with a stable identifier, name, active-state, display order, and timestamps.
- Add Development Requester with a stable identifier, display name, email, active-state, and timestamps. Email is unique. The model is a development/test context and has no password, token, session, or authentication behavior.
- Add Ticket with an internal identifier, unique backend-generated Ticket Number, Ticket Date, Requester relationship, Category relationship, Related System relationship, Summary, Description, Requested Priority, Current Status, and timestamps.
- Add Attachment with Ticket relationship, original filename, safe storage key, media type, byte size, upload timestamp, removal timestamp, removal reason, and removal-context metadata where useful. `removedAt` is the source of truth for soft removal; an Attachment is active when it is null.
- Use integer database identifiers consistently with the existing Prisma model. Keep the external Ticket Number separate from the internal Ticket identifier.
- Enforce one Requester per Ticket, one Category per Ticket, one Related System per Ticket, and many Attachments per Ticket through foreign keys and non-null relationships.
- Make Ticket Number unique at the database level. Generate it on the server as `TKT-YYYYMMDD-XXXXXX`, where the final six characters are a cryptographically generated uppercase alphanumeric token. Retry on a uniqueness collision; the database constraint remains authoritative and uniqueness is tested.
- Use `RequestedPriority` values `Low`, `Medium`, `High`, and `Urgent`. Use `New` as the only exposed initial Current Status in Lab 2; no status transition endpoint is included.
- Store timestamps in UTC. Display Ticket Date and Last Updated in a documented locale-aware format while preserving the API timestamp.
- Add ownership/list-query indexes covering Requester plus updated time, Ticket Number, status, priority, Category, and Related System as justified by the final query plan.
- Use restrictive foreign-key behavior for Ticket relationships. Do not silently delete Tickets or Attachments through reference-data deletion. Reference data is deactivated instead.
- Use an idempotent seed that contains exactly the four required Categories, at least six realistic Related Systems, at least four active Development Requesters, and at least one inactive Development Requester. Re-running the seed must not duplicate rows.

### Requester context and ownership

- The selector retrieves active Development Requesters from PostgreSQL through a dedicated API endpoint.
- The client retains the selected context for the current browser session and sends its identifier as `X-Development-Requester-Id` on requester-scoped API calls.
- The server rejects missing, malformed, nonexistent, or inactive context values using the documented safe error contract.
- The server derives Ticket ownership from the validated context. A client-provided Requester identifier in a Ticket payload is not trusted to override the context.
- My Tickets, Ticket Detail, Attachment metadata, Attachment download, Attachment upload, and Attachment removal all enforce the same context-to-Ticket ownership check.
- The API may return a safe not-found response for an unowned resource so that direct identifiers do not reveal whether another Requester owns it. The chosen status is consistent across the contract and tests.
- Changing context invalidates requester-scoped client queries and clears visible data until the replacement context has loaded.
- This context mechanism is explicitly a Lab 2 testing substitute. It must be replaceable by authenticated identity mapping in Lab 3 without changing the Ticket-to-Requester relationship.

### REST API contract

- Reference data endpoints:
  - `GET /api/development-requesters` returns active Requesters for the selector.
  - `GET /api/categories` returns active Categories in display order.
  - `GET /api/related-systems` returns active Related Systems in display order.
- Ticket endpoints:
  - `POST /api/tickets` creates one Ticket for the selected context and accepts multipart form data when creation includes Attachments.
  - `GET /api/tickets` returns only the selected Requester's Tickets.
  - `GET /api/tickets/:ticketId` returns one owned Ticket and its documented Attachment metadata.
- Attachment endpoints:
  - `POST /api/tickets/:ticketId/attachments` adds one or more permitted Attachments to an owned Ticket.
  - `GET /api/tickets/:ticketId/attachments` returns active and documented removed metadata for an owned Ticket.
  - `GET /api/tickets/:ticketId/attachments/:attachmentId/content` downloads an active owned Attachment only.
  - `DELETE /api/tickets/:ticketId/attachments/:attachmentId` records soft removal after a valid reason and ownership check.
- Use a predictable error envelope containing a stable error code, safe human-readable message, and optional field-level details. Do not return stack traces, database messages, local paths, or secrets.
- Use `200` for successful retrieval, metadata, download, and soft-removal responses; `201` for Ticket and Attachment creation; `400` for invalid context, fields, or query parameters; `404` for missing or intentionally hidden resources; `413` for files above 5 MB; `415` for unsupported types; `409` only for documented conflicts; and `500` for safe unexpected failures.
- Ticket-list query parameters are `search`, `categoryId`, `relatedSystemId`, `requestedPriority`, `currentStatus`, `sortBy`, `sortDirection`, `page`, and `pageSize`.
- Search covers Ticket Number, Summary, and Description. Filters cover Category, Related System, Requested Priority, and Current Status. Sorting permits Ticket Number, Ticket Date, Summary, Requested Priority, Current Status, and Last Updated.
- Defaults are `page=1`, `pageSize=10`, `sortBy=updatedAt`, and `sortDirection=desc`. Permitted page sizes are 10, 25, and 50; 50 is the maximum. Default and requested sorts use a secondary immutable Ticket identifier for deterministic ordering.
- List responses include items and `page`, `pageSize`, `totalItems`, and `totalPages` metadata. Invalid values never silently fall back to defaults; they return the documented validation error.
- Ticket creation trims required text fields before validation and persistence. Summary must contain 5–120 characters after trimming. Description must contain 20–4000 characters after trimming. Frontend and backend share these limits, while the backend remains authoritative.
- The client disables the create action while its request is in flight. Backend-generated Ticket Number and status remain authoritative.

### Attachment behavior

- Allowed types are JPG/JPEG, PNG, WEBP, and PDF. Each file is limited to 5 MB. Each Ticket has at most five active Attachments.
- Validate extension, declared media type, byte size, and server-side content signature where practical. Never use the original filename as a storage path or as an authorization decision.
- Normalize displayed filenames for control characters and unsafe markup. Store content under generated opaque keys outside the public static directory. Persist metadata separately from content.
- Stage and validate all creation uploads before committing the Ticket. A rejected or failed upload must not silently report a successful Ticket. Use cleanup/compensation for staged or stored files when a database operation fails.
- For later uploads, check ownership and active-count limits before storing the Attachment. Failed persistence cleans up staged content and returns a safe error.
- Attachment metadata may show `Active` or `Removed`, original filename, type, size, upload time, and removal time/reason according to the UI contract.
- Download and preview are available only for active owned Attachments. Removed content is never streamed or previewed.
- Removal is soft: retain the metadata and mark removal time/reason. Require a confirmation in the UI and a trimmed non-empty removal reason within the documented length limit on the API.

### UI and interaction

- Use a reusable TokTickIT shell with identity, My Tickets navigation, Create Ticket navigation, current Development Requester display, active-page indication, responsive mobile navigation, and Change Requester action.
- Use the Zen Green tokens: primary `#006B3C`, secondary `#0B7A46`, pale green `#EAF6EF`, quiet near-white page background, white bordered surfaces, charcoal-green text, dark-red validation, amber warnings, and readable non-color success indicators.
- Provide a Requester Selection screen with testing-only explanation, active Requester dropdown, Continue action, keyboard accessibility, loading state, empty state, safe failure state, and responsive layout.
- Provide Create Ticket fields for read-only system/context values, Category, Related System, Summary, Requested Priority, Description, and optional Attachments. Labels sit above controls, required fields show a red asterisk plus a message when invalid, and system-generated/read-only values are visually distinct.
- Provide initial, loading, validation failure, submitting, success, API failure, invalid Attachment, and recovery states. Preserve valid form values after recoverable failures. Show the generated Ticket Number and a clear next action on success.
- Provide My Tickets search, filters, sorting, pagination, clear-filters action, Create Ticket action, loading, empty, no-results, failure, and retry states. Desktop may use a table; mobile may use cards or a responsive table if all information and actions remain clear.
- Provide Requester Ticket Detail with read-only Ticket information, Attachment metadata, active/removed state labels, upload, download, removal confirmation/reason, and safe failure recovery. Do not add comments, internal notes, staff actions, or post-creation status controls.
- Meet responsive targets: multi-column desktop at 992 px and above; practical two-column tablet layout from 768–991 px; stacked touch-friendly mobile layout below 768 px; no horizontal page scrolling, clipping, overlap, hidden actions, or unreadable filenames.
- Meet accessibility targets through semantic labels, keyboard-focus visibility, accessible names for icon-only controls, useful status announcements, and non-color indicators for error, warning, success, priority, and status.

### Documentation and workflow

- Treat the six Lab 2 documents as living contract/evidence artifacts: specification, tests, UI specification, API specification, reviewer record, and AI-use record.
- Establish the contract before main implementation work. Update it after each vertical slice with resolved decisions, actual test paths/results, changed acceptance traceability, review evidence, and AI-use reflection.
- Keep required automated tests and screenshots in the repository. Keep the final concise PDF under the Lab 2 report area with the exact Part 1 through Part 9 headings required by the labsheet.
- Use the three approved vertical slices: requester creation, My Tickets discovery, and Ticket Detail/Attachment lifecycle plus final evidence. Each slice must include its own end-to-end behavior, relevant tests, and document updates.
- Use GitHub Issues and the required statuses `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, and `Done`. Implement on feature branches, merge reviewed PRs into `lab2-staging`, then release to `main`. Do not develop directly on `main` or `lab2-staging`.

## Testing Decisions

- Test observable behavior at the highest practical seam. Prefer a complete browser flow for user outcomes, API integration for persistence/ownership/query contracts, and focused client tests for local field and feedback behavior. Do not assert private implementation details, component structure, database query syntax, or incidental CSS implementation.
- Reuse the existing server Vitest + Supertest boundary for HTTP behavior and the existing client Vitest + React Testing Library boundary for UI behavior. Extend the current OpenAPI validation coverage for the new contract. Add a browser E2E runner only for the required full flow, viewport checks, and screenshots.
- Unit tests cover Ticket Number generation, trimming/validation helpers, query parsing, Attachment rules, filename normalization, and deterministic ordering helpers.
- API/integration tests cover seeded reference data, active/inactive Requesters, valid and invalid Ticket creation, backend defaults, validation, safe errors, list ownership, query behavior, invalid query parameters, Ticket Detail ownership, Attachment limits/types/sizes, upload failure compensation, active download, soft removal, removed download blocking, and cross-Requester access.
- Client UI tests cover selector states and context switching, reference-data loading, required fields and field-level errors, busy/duplicate-submit prevention, successful Ticket Number display, preserved form values after failure, Attachment validation, My Tickets filters/pagination/empty/no-results/error states, read-only Detail, and Attachment controls.
- Style/accessibility tests cover required labels and asterisks, accessible names, visible focus, non-color feedback, badge states, disabled/busy controls, read-only field styling, and the required Zen Green tokens.
- Responsive tests and manual visual inspection cover desktop, tablet, and mobile Create Ticket, My Tickets, and Ticket Detail layouts, including no clipping, overlap, horizontal overflow, or hidden Attachment names/actions.
- E2E covers selecting Requester A, creating a Ticket with database-backed reference data, seeing the backend Ticket Number, finding the Ticket in My Tickets, switching to Requester B, verifying isolation, opening owned Detail, adding/downloading/removing an Attachment, and proving removed/unauthorized access is blocked.
- Every Acceptance Criterion maps to at least one planned test. The test plan records the actual test path, command, result, limitation, and evidence location after implementation.

## Acceptance Criteria

- **AC-01:** The selector loads only active Development Requesters from PostgreSQL and provides loading, empty, failure, validation, Continue, and keyboard-accessible states.
- **AC-02:** The selector clearly states that it is a Lab 2 testing context and not authentication.
- **AC-03:** The shell displays the selected Requester and Change Requester clears/reloads all requester-specific data.
- **AC-04:** The seed is idempotent and contains the four required Categories, at least six Related Systems, at least four active Requesters, and at least one inactive Requester that is absent from the selector.
- **AC-05:** Active Categories and Related Systems are loaded through APIs and are not hard-coded into the Ticket form.
- **AC-06:** A valid Ticket creates exactly one persisted Ticket with the selected Requester, backend Ticket Number, Ticket Date, required relationships, trimmed requester fields, Requested Priority, and Current Status `New`.
- **AC-07:** Frontend and backend validation reject missing, whitespace-only, over-limit, invalid, or mismatched values; invalid submission creates no partial Ticket and shows field-level messages.
- **AC-08:** Create submission is disabled and visibly busy while processing; a recoverable failure preserves valid entered values and reports a safe error.
- **AC-09:** Creation Attachments obey allowed types, 5 MB per-file limit, five active-file limit, safe metadata/storage behavior, and documented compensation on failure.
- **AC-10:** My Tickets returns only Tickets owned by the selected Requester and provides documented search, filters, sorting, pagination, deterministic ordering, and pagination metadata.
- **AC-11:** Invalid Ticket-list parameters return the documented safe validation response; an empty Ticket list is visually distinct from a valid no-results query.
- **AC-12:** Switching between two seeded Requesters removes the first Requester's Tickets from view and loads the second Requester's data.
- **AC-13:** Owned Ticket Detail displays read-only Ticket information and Attachment metadata. Missing, unowned, or invalid resources return the documented safe ownership response.
- **AC-14:** An owned Requester can add a permitted Attachment, download an active Attachment, and soft-remove an Attachment with confirmation and a valid reason.
- **AC-15:** Removed Attachment metadata remains available as documented, while removed content cannot be downloaded or previewed.
- **AC-16:** All API errors are predictable and safe; they do not expose stack traces, database details, local paths, or secrets.
- **AC-17:** Create Ticket, My Tickets, and Ticket Detail satisfy the Zen Green visual contract, accessible naming/focus rules, non-color feedback rules, and desktop/tablet/mobile layout requirements.
- **AC-18:** Unit, API/integration, UI, style/accessibility, responsive, and E2E tests cover success, loading, validation, failure, empty, no-results, boundary, ownership, and Attachment state transitions without skipped required tests.
- **AC-19:** The six required Lab 2 documents are updated incrementally across the three Issues and contain consistent requirements, decisions, actual tests, review evidence, and AI-use reflection.
- **AC-20:** The repository contains readable screenshots and one final PDF using the exact Part 1 through Part 9 headings; final `main` passes formatting, type checks, tests, and build.

## Definition of Done

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

## Out of Scope

- Authentication, login, logout, passwords, password hashing, sessions, tokens, authenticated identities, or secure role-based authorization.
- IT Staff dashboards, queues, claiming, assignment, reassignment, IT Priority changes, or staff-only controls.
- Public Comments, Internal Notes, Actions Taken, collaboration, or ticket discussion.
- Status changes after initial `New`, including resolving, closing, reopening, cancelling, or resolution confirmation.
- Administrator management of Requesters, roles, Categories, or Related Systems.
- Real production object storage, virus scanning, cloud deployment, notifications, email, or integrations not required for this local MVP.
- Backward-compatibility layers for obsolete Lab 1-only UI paths. The Lab 2 flow becomes the current requester experience.

## Further Notes

- This specification is the baseline contract produced from the Lab 2 labsheet and repository state. Any implementation ambiguity discovered during an Issue must be resolved in the contract before the Issue is considered complete.
- Required documents are deliberately incremental. The initial contract establishes scope and planned tests; each Issue records its own resolved decisions, actual test paths/results, UI/API changes, review evidence, and AI-use notes; the final Issue closes traceability and submission evidence.
- The approved ticket breakdown is intentionally smaller than Lab 1: three vertical slices, each independently demonstrable and ordered by genuine dependency.
- Primary test seam is the browser flow; API and client seams exist to make failures, ownership, validation, and feedback deterministic and fast.
- The development selector must never be described as a login screen in the UI, API, documentation, screenshots, or final PDF.
- The repository and final `main` branch remain the source of truth. GitHub Issues, PRs, rendered documents, test output, screenshots, and the final PDF provide traceable evidence of the work.
