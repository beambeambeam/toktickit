# Sprint 4 Engineering Contract

Status: approved product contract for feature implementation under Issues #74–#79. This document resolves the implementation choices left open by [Issue #72](https://github.com/beambeambeam/toktickit/issues/72). It does not claim that any feature or planned check is complete.

## 1. Sprint Goal

Track planned and performed work under each Ticket, enforce the final Ticket lifecycle on the server, and give Requesters and service-desk staff concise dashboards with exact links to matching detail lists. Preserve the earlier application behavior and verify each feature slice before it is done.

## 2. Stakeholder Request

Staff need to assign, perform, record, and retain work on a Ticket without changing the primary Ticket Owner. Requesters need to read the shared work history and see the progress on only their own Tickets. Staff and Administrators need operational summaries that lead to the same results in the detailed Ticket Queue or Action list. A Requester’s resolution indication remains advisory; authorized staff review and resolve the Ticket.

## 3. Scope

### Included

- Actions Taken creation, listing, pending edits and assignment, lifecycle, attribution, immutable history, safe retries, and authorization.
- The Ticket status transition matrix, resolution gate, cancellation gate, version conflicts, and advisory resolution indication.
- Requester and staff/Administrator dashboards with exact predicates, bounded previews, role-aware navigation, and drill-down.
- A data-preserving Prisma/PostgreSQL migration, insert-only demonstration seeds, API/OpenAPI/client changes, UI, regression, accessibility, responsive, visual, and performance-smoke verification.
- Preservation of authentication, Ticket creation/ownership, Attachments, Public Comments, Internal Notes, and Administrator account management, subject to the explicit Administrator permissions in this contract.
- The Lab 4 reviewer record and AI-use record required by the handout.

### Excluded

SLA timers, escalations, on-call scheduling, external notifications, inventory or cost accounting, timesheets/payroll, approval chains, electronic signatures, custom BI/export tools, multi-tenancy, new file upload models, Requester action writes, deleting actions, optional Administrator account metrics, release management, report/PDF preparation, and submission evidence.

## 4. Functional Requirements

- **FR-01 — Action history:** Each Ticket has a stable, paginated Actions Taken list. Requesters read every action on their own Tickets; staff and Administrators can read actions on any accessible Ticket. Ticket detail remains the parent view.
- **FR-02 — Create:** IT Staff and Administrators create an Action Taken in Planned state. The server sets the Ticket, creator, creation time, initial version, and request identity. The authenticated actor is the default assignee; a different active eligible assignee may be selected.
- **FR-03 — Edit and assign:** Staff and Administrators may replace mutable fields on a Planned or In Progress action. Parent Ticket, creator, creation time, status timestamps, performer attribution, and history are server-controlled. A successful edit records an immutable revision.
- **FR-04 — Action lifecycle:** Staff and Administrators may move Planned to In Progress or Cancelled, and In Progress to Completed or Cancelled. Completed and Cancelled actions cannot be edited, reassigned, transitioned, or deleted.
- **FR-05 — Attribution:** The server records the actor for creation, each edit, start, completion, and cancellation. The actor starting work is the action’s Performed by. Completion and cancellation actor/time remain separately available in the action and event history.
- **FR-06 — Ticket lifecycle:** Staff and Administrators may make only the transitions in BR-09–BR-13. The server requires a current Ticket version, active eligible owner where required, confirmation for Resolved/Closed/Cancelled, and the resolution or cancellation gate.
- **FR-07 — Resolution indication:** A Requester can indicate that an owned, nonterminal Ticket appears resolved. This records advice only. It never changes Ticket status or bypasses the staff resolution gate.
- **FR-08 — Requester dashboard:** Return requester-scoped active, waiting, recently updated, and recently resolved counts plus bounded recent previews. The server derives identity from the session; a client cannot supply requester scope.
- **FR-09 — Staff dashboard:** Return active unassigned and current-user-owned counts, counts for every Ticket status, active counts by IT Priority, recently updated and urgent active Ticket previews, and the current user’s assigned pending Actions Taken.
- **FR-10 — Exact drill-down:** Dashboard cards preserve their server-generated time bounds and link to list filters that implement the same predicate as the card. Preview rows open the associated Ticket or Action.
- **FR-11 — Safe feedback:** Forms and lists expose loading, empty, validation, success, forbidden, not-found, conflict, and recoverable failure feedback. Prevent duplicate in-flight writes and retain drafts after recoverable failures.
- **FR-12 — Preserved behavior:** Keep earlier authentication, ownership, Ticket, Attachment, comment, note, and account-management behavior. Internal Notes remain private and do not change requester-visible update time.
- **FR-13 — Final product quality:** Use Zen Green components and role navigation; preserve keyboard use, visible focus, labels, contrast, small-screen usability, and clear non-color status cues. Each feature ticket owns its implementation and verification.
- **FR-14 — Durable data:** Preserve existing rows and Attachment bytes through migration. Do not fabricate Actions Taken for legacy Tickets. Seed examples by stable identity and insert-only behavior.
- **FR-15 — Concurrency:** Serialize mutations that affect a Ticket’s Actions Taken or lifecycle on the parent Ticket, compare expected versions, and recheck user eligibility in the transaction. A stale write changes no data.

## 5. Business Rules

- **BR-01 — Parent:** An Action Taken belongs to exactly one Ticket. Its parent is immutable. Parent deletion is restricted.
- **BR-02 — Ownership and assignment:** Ticket Owner coordinates the whole Ticket. Action assignee is separate and is required for a newly created action. Creating, editing, starting, or completing an action never changes Ticket Owner. Any eligible staff/Admin may collaborate regardless of Ticket Owner or action assignee.
- **BR-03 — Automatic identities and dates:** All timestamps are server-generated UTC instants. Action Date/Time is createdAt; it is not editable or backdated. Clients cannot submit createdBy, performedBy, completedBy, cancelledBy, actor IDs, or lifecycle timestamps.
- **BR-04 — Text validation:** Trim edge whitespace before storing plain text; preserve internal line breaks and render as escaped text. Description is required, nonblank, and at most 5,000 Unicode code points. Optional Result and Attachment Notes normalize blank-after-trim values to null; Result is at most 5,000 code points and must be nonblank to complete. Follow-up Note is 1–5,000 code points when Follow-Up Required is true and null otherwise; a blank optional note normalizes to null. Attachment Notes are at most 2,000 code points and refer to existing files; they do not upload files.
- **BR-05 — Follow-up:** An action with Follow-Up Required=true cannot be completed. A staff member must finish or correct the follow-up while the action is still pending, set the flag false, and clear its note before completing it. The pending edit appends a snapshot event so history retains the prior flag and note. A later action does not silently clear an earlier action’s follow-up flag.
- **BR-06 — Action states:** The only action states are Planned, In Progress, Completed, and Cancelled. Allowed edges are Planned → In Progress, Planned → Cancelled, In Progress → Completed, and In Progress → Cancelled. There are no self-transitions or transitions out of Completed/Cancelled. The client confirms completion and cancellation before sending confirmed=true; the API rejects missing or false confirmation. Completion also requires a nonblank Result and no required follow-up.
- **BR-07 — Action history:** Pending field edits and each state change append an immutable event with actor, UTC time, action version, event type, and a field snapshot where applicable. Events are ordered by createdAt ascending, then ID ascending. Actions are never physically deleted. Completed/Cancelled action records are immutable.
- **BR-08 — Assignee eligibility:** An assignee must be an active IT Staff or Administrator. Eligibility is rechecked transactionally on assignment and before starting/completing. When an assigned account becomes inactive or loses an eligible role, retain the historical identity and mark it ineligible; require reassignment before starting/completing. Do not rewrite or delete history.
- **BR-09 — Ticket transitions:** Only the following edges are valid. Requesters never formally transition Ticket status.

  | Current status        | Allowed next status                           |
  | --------------------- | --------------------------------------------- |
  | New                   | Open, Cancelled                               |
  | Open                  | In Progress, Waiting for Requester, Cancelled |
  | In Progress           | Waiting for Requester, Resolved, Cancelled    |
  | Waiting for Requester | In Progress, Resolved, Cancelled              |
  | Resolved              | Closed, Reopened                              |
  | Reopened              | Open, In Progress, Cancelled                  |
  | Closed                | None                                          |
  | Cancelled             | None                                          |

- **BR-10 — Ticket owner and terminal confirmation:** In Progress and Resolved require an active eligible Ticket Owner. Entering Resolved, Closed, or Cancelled requires confirmed=true. Closing is allowed only from Resolved. Closing retains resolution timestamps. Closed and Cancelled are terminal.
- **BR-11 — Resolution gate:** Entering Resolved requires at least one Completed Action Taken, zero Planned or In Progress actions, and an active eligible Ticket Owner. The requester indication is not evidence of completed work. Apply this gate to every transition into Resolved, including after a reopen.
- **BR-12 — Cancellation gate:** Entering Cancelled requires zero Planned or In Progress actions. Staff must explicitly complete or cancel pending actions first. Cancelled actions do not satisfy the resolution gate.
- **BR-13 — Reopen and legacy data:** Reopening clears the current resolution indication and current resolvedAt value; the status event retains history. Existing Resolved, Closed, and Cancelled Tickets remain readable and valid. Legacy Tickets receive no synthetic action. An active legacy Ticket must meet the new action gate before later resolution.
- **BR-14 — Role matrix:** Authorization is enforced by the API. “Own” means the authenticated Requester’s Ticket.

  | Capability | Requester | IT Staff | Administrator |
  | --- | --- | --- | --- |
  | Create Ticket and write requester Attachments | Own/requester flows | No | No |
  | Read Ticket, Attachments, Public Comments, Actions Taken | Own | All | All |
  | Read Internal Notes | No | All | All |
  | Create Public Comment / Internal Note | Own public comments | Yes / Yes | Yes / Yes |
  | Create, edit, assign, progress Actions Taken | No | Yes | Yes |
  | Claim/change Ticket Owner, IT Priority, or status | No | Yes | Yes |
  | Indicate apparent resolution | Own, nonterminal | No | No |
  | Requester or staff dashboard / My Actions | Own dashboard | Staff dashboard / own actions | Staff dashboard / own actions |
  | Manage user accounts | No | No | Yes |

  Requesters never read Internal Notes. Dashboard, Action, and Ticket responses must not expose note-derived data or foreign-Ticket data.

- **BR-15 — Public update and versions:** A successful action creation, edit, or transition increments the parent Ticket version and public updatedAt once in the same transaction. It increments the Action version once for an action mutation. Public comments, status and other public workflow changes continue to affect public update metadata; Internal Notes do not. An idempotent replay does not increment either version.
- **BR-16 — Stale writes and actor races:** Every action edit/transition supplies both current action and Ticket versions. New action creation supplies the current Ticket version. A stale value returns 409 VERSION_CONFLICT and writes nothing. If a mutation needs an assignee/owner ID from a row not yet locked, read that ID as a nonlocking snapshot; lock the acting and target User rows in ascending ID order, then Ticket, then Action; reload all records, compare expected versions and snapshot identity, and recheck eligibility before writing. Existing account role/activity changes first take the account lifecycle advisory transaction lock, then lock actor/target Users in ascending ID order, then affected Tickets in ascending ID order. Shared User row locks serialize eligibility changes with action/Ticket writes while preserving the existing lock order. This prevents demotion/deactivation racing assignment, start, completion, or Ticket resolution.
- **BR-17 — Idempotent creation:** A client creates one UUID requestId per intentional create and retains it through uncertain transport failure. Scope the key to Ticket, actor, and requestId; store the hash of normalized business fields. Same key and same payload returns the existing action without a second write. Same key with changed payload returns 409 REQUEST_ID_CONFLICT. A new intentional action uses a new key.
- **BR-18 — Dashboard population:** “Active Ticket” means New, Open, In Progress, Waiting for Requester, or Reopened; it excludes Resolved, Closed, and Cancelled. All status counts include all Tickets. Priority counts include active Tickets only. Unassigned/My Owned count active Tickets with ownerId null/current session ID.
- **BR-19 — Dashboard recent interval:** Each dashboard uses one generatedAt UTC instant and the inclusive rolling interval [generatedAt − 7 days, generatedAt]. Store and transmit UTC timestamps. Display dates in Asia/Bangkok with the timezone named. No local-day cutoff, trend comparison, or SLA inference is shown.
- **BR-20 — Requester dashboard:** Counts and previews are restricted to the authenticated requesterId. Waiting for You means status Waiting for Requester. Recently Updated uses public Ticket updatedAt in the interval. Recently Resolved means current status Resolved or Closed and resolvedAt in the interval. Internal Notes do not change this population.
- **BR-21 — Staff dashboard:** Use all shared Tickets. My Actions means actions assigned to the authenticated user, in Planned or In Progress state, whose parent Ticket is active. Creator and Ticket Owner do not affect this count. Return all eight status counts, all four active priority counts, and at most five items in each preview.
- **BR-22 — Snapshot and empties:** Dashboard metrics and previews come from one consistent read snapshot. Return numeric zero and empty preview arrays when no rows match. Never replace empty results with failure or placeholder counts.
- **BR-23 — Safe response:** Reject unknown input fields and unsupported query shapes. Use the existing safe error envelope; do not expose SQL, credentials, stack traces, storage keys, private notes, or protected resource existence.

## 6. UI Specification Summary

Requesters land on their dashboard and retain Create Ticket, My Tickets, and Ticket Detail navigation. IT Staff and Administrators land on the shared staff dashboard and retain the Ticket Queue, My Actions, and Administrator account-management routes. Ticket Detail remains the parent view: requesters can read their own Actions Taken and status history, while staff/Admin can create, edit, assign, and progress actions when allowed. Dashboard cards and previews link to lists and details using the same server predicates and time bounds. All screens include role-aware loading, empty, validation, success, forbidden, conflict, and recoverable-failure behavior; responsive, keyboard, accessibility, and visual requirements are detailed in [ui-spec.md](./ui-spec.md).

## 7. Data Changes

### Action Taken persistence

Add an ActionTaken model with these fields:

- id, ticketId, createdByUserId, assigneeId, performedByUserId?, completedByUserId?, cancelledByUserId?: PostgreSQL Int; IDs are auto-incremented and user/Ticket references are foreign keys.
- description, result?, followUpNote?, attachmentNotes?: PostgreSQL text.
- followUpRequired: Boolean, default false.
- status: ActionStatus enum with Planned, InProgress mapped to “In Progress”, Completed, Cancelled; default Planned.
- version: Int, default 1.
- createdAt, updatedAt, startedAt?, completedAt?, cancelledAt?: UTC timestamp with timezone. createdAt/updatedAt are backend-owned.
- requestId: UUID and payloadHash: 64-character SHA-256 identity of normalized business fields.
- seedKey?: unique nullable string for stable insert-only demo identity.

Create a unique constraint on (ticketId, createdByUserId, requestId). Parent Ticket, creator, createdAt, status history, and lifecycle fields are server-controlled; user and Ticket history references use restrictive deletion behavior. API-created and seeded Actions Taken both have requestId/payloadHash and seedKey is set only for seeded records.

Add append-only ActionTakenEvent rows with Action Taken, actor, action version, event type, from/to status, timestamp, and a complete mutable-field snapshot for create/edit events. Event types are ActionCreated, ActionEdited, ActionStarted, ActionCompleted, and ActionCancelled. Add append-only TicketStatusEvent rows with Ticket, actor, from/to CurrentStatus, Ticket version, timestamp, and confirmation. Stable ordering uses timestamp then integer ID. Add unique (actionId, actionVersion) and (ticketId, ticketVersion) constraints to prevent duplicate revision events.

### Indexes

Add indexes for ActionTaken by (ticketId, createdAt, id), (ticketId, status), and (assigneeId, status, ticketId). Add a unique (ticketId, createdByUserId, requestId) key and index event tables by parent, createdAt, ID. Confirm existing indexes support requester updated/status, staff owner/status/priority/update, and event history reads; add only the missing query indexes.

### Migration, recovery, and seed rules

- Migration adds tables, enums, fields and indexes without rebuilding or rewriting existing Users, Tickets, Attachments, Public Comments, Internal Notes, or Sessions. It does not synthesize TicketStatusEvent rows for legacy Tickets; earlier status transitions cannot be reconstructed.
- Before/after migration verification compares populated row identities and values, Attachment metadata and file-byte hashes, then proves rerunning the deployed migration is safe. No legacy Actions Taken are backfilled.
- Recovery means restoring a matched database backup and Attachment storage backup; exercise the procedure against disposable populated data. Never run destructive reset commands against preserved data.
- Extend existing seeds using stable seed keys and insert-only semantics. Include all Ticket states/priorities, assigned and unassigned owners, Tickets with zero/one/multiple actions, multiple workers on one Ticket, action lifecycle/follow-up examples, and zero/nonzero dashboards. Reruns do not update user-edited records, inactive users, credentials, or removed Attachments. Document how date-dependent seeded records age.

## 8. API Contract

The exact REST methods, paths, request/response shapes, authorization, validation, status and error contracts, expected versions, idempotency, and locking rules are in [api-spec.md](./api-spec.md). The test plan and AC-to-owner/test traceability are in [tests.md](./tests.md).

## 9. Acceptance Criteria

- **AC-01:** Given an authorized staff/Admin user and a nonterminal Ticket, when they create, edit, assign, start, complete, or cancel Actions Taken, then server-owned identities and dates, assignment rules, allowed transitions, immutable terminal records, ordered history, follow-up behavior, and the resolution gate are enforced.
- **AC-02:** Given a Requester, IT Staff member, or Administrator, when they read or mutate Tickets, Actions Taken, comments, notes, or dashboards, then the API and UI apply the role matrix and preserve Internal Note isolation.
- **AC-03:** Given an authenticated role and a versioned API request, when it calls an action, Ticket-workflow, or dashboard endpoint, then documented schemas, status/error responses, parent locking, idempotency, and eligibility races are enforced without partial writes.
- **AC-04:** Given Tickets, actions, and updates within and outside the seven-day window, when a dashboard is retrieved, then its snapshot, UTC bounds, Bangkok display values, five-item previews, zero values, and drill-down predicates match the stored data.
- **AC-05:** Given a valid create request, when staff submit it for a nonterminal Ticket, then one Planned action is stored under that Ticket with server creation time/creator and the default or selected eligible assignee.
- **AC-06:** Given an authenticated Requester, when they read Actions Taken for their own Ticket or attempt a foreign read/write, then own actions are visible and unauthorized operations fail safely.
- **AC-07:** Given two eligible staff working on the same Ticket, when one is assigned an action and another starts or completes it, then actor attribution is automatic and the primary Ticket Owner remains unchanged.
- **AC-08:** Given invalid action text or a missing required follow-up note, when the API validates the write, then it rejects the request without partial changes and recoverable UI drafts remain.
- **AC-09:** Given an inactive or ineligible assignee or a concurrent account eligibility change, when an action is assigned or started/completed, then the write is rejected atomically and historical identity is retained.
- **AC-10:** Given a pending action with a current version, when staff edit it, then fresh changes save and stale edits conflict without partial writes or lost drafts.
- **AC-11:** Given a pending action, when staff start, complete, or cancel it, then only valid edges succeed, terminal transitions require confirmation, completion requires a Result, and terminal history remains available.
- **AC-12:** Given a create request ID and normalized payload, when the same request is retried, then it returns the original action without duplication; a changed payload under that key conflicts.
- **AC-13:** Given a Resolved, Closed, or Cancelled Ticket, when a user attempts an action mutation, then the write fails while role-authorized reads remain available.
- **AC-14:** Given a Ticket and its current actions, when staff request a Ticket transition, then only allowed transitions pass and owner, resolution, cancellation, and Administrator operation rules are enforced by the API.
- **AC-15:** Given concurrent action, account-eligibility, and resolution writes, when transactions commit, then no Resolved Ticket has pending actions, lacks a completed action, or lacks an eligible owner.
- **AC-16:** Given a Requester resolution indication or a resolved legacy Ticket, when staff reopen or continue the workflow, then the indication/current resolution timestamp clears, existing terminal Tickets remain valid, and active legacy Tickets meet the new resolution gate.
- **AC-17:** Given a Requester with matching and nonmatching Tickets, when their dashboard is retrieved, then counts and previews include only their public data under the exact UTC predicates.
- **AC-18:** Given a Requester dashboard card, when the Requester opens its list link, then the same ownership/status/time predicate is applied and zero/empty results are shown truthfully.
- **AC-19:** Given mixed Ticket statuses, priorities, owners, and assigned actions, when the staff/Admin dashboard is retrieved, then authoritative counts include the current user's pending assigned actions on active Tickets.
- **AC-20:** Given a staff dashboard card or Action preview, when staff open its link, then the destination uses matching queue/action predicates and bounded pages.
- **AC-21:** Given each permitted role and dashboard state, when a user navigates or encounters loading, empty, forbidden, or failure states, then role navigation, cache isolation, focus, labels, and recovery remain clear.
- **AC-22:** Given populated existing data, when migrations, recovery, or repeated seeds run, then prior rows and Attachment bytes survive, legacy Tickets receive no synthetic actions, and user edits are preserved.
- **AC-23:** Given earlier authentication, ownership, Attachment, comment, note, and account-management journeys, when Labs 1–3 regression checks run, then existing behavior passes with only the explicit Administrator permission changes.
- **AC-24:** Given a slow, invalid, or recoverably failed form submission, when the user retries or corrects input, then duplicate in-flight submissions are prevented, drafts are preserved, and safe errors are shown.
- **AC-25:** Given the major Lab 4 screens at supported desktop, tablet, and mobile sizes, when keyboard, accessibility, and visual checks run, then screens remain usable and follow Zen Green without clipping or horizontal overflow.

These 25 criteria are observable product outcomes and provide the AC-to-test keys in [tests.md](./tests.md). Contract completeness, numbering, and verification ownership are engineering DoD checks, not product acceptance criteria.

## 10. Definition of Done

Contract DoD: Before feature coding starts, Issue #73 has all six handout-required documents (`specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, and `ai-use.md`) with reviewed contracts and recorded decisions; all FR/BR/product AC statements are numbered, each product AC maps to planned tests, and every migration, regression, E2E, performance-smoke, accessibility, and visual check has an owning feature issue. Feature DoD: An owning feature issue is complete only when its assigned API, data, UI, tests, and verification are delivered; its planned tests have truthful final outcomes recorded in tests.md; its expected role and error paths work; it has been checked against available completed dependencies; responsive, accessibility, and visual checks for affected screens pass; and failures caused by the feature are fixed. A missing sibling feature is reported as unavailable integration coverage and is not implemented by this ticket.

## 11. Assumptions and Decisions

The handout leaves the exact work-attribution and persistence strategy open. The existing application remains single-tenant and uses the current PostgreSQL/Prisma, Express, role, cache, and UI foundations. Stored timestamps are UTC and displayed in Asia/Bangkok.

1. Assignee and performer are separate identities: assignee says who owns the work now; performer says who actually started it. Completion/cancellation actors are separate immutable events. This supports team work without changing primary Ticket ownership or losing attribution.
2. The parent Ticket row is the serialization point for action and Ticket mutations. Action work affects public Ticket update/version data and the resolution/cancellation gate; locking one parent lets those decisions commit atomically and makes stale writes explicit.
3. Idempotency identity is stored on the ActionTaken under a unique Ticket/creator/request key. This prevents a retry from creating duplicate work without adding an expiring cache or a second transactionally coupled store.
4. Legacy rows receive no invented work or status transitions. Restrictive foreign keys preserve historical Tickets and people, and append-only event rows preserve auditable changes.
