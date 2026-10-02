# Lab 4 REST API Contract

Status: approved contract for Issues #74–#79. Paths below are relative to /api. The existing Express error middleware, sessions, CSRF protection, role checks, no-store response policy, PostgreSQL/Prisma, OpenAPI document, and generated Hey API client remain canonical. Lab 4 adds no new package or authentication mechanism.

## 1. Wire Conventions

- JSON is used except where an existing route explicitly uses multipart upload or streams an Attachment.
- All request objects reject unknown properties. Do not accept actor IDs, creator IDs, timestamps, requester scope IDs, versions hidden in headers, or unrecognized filter values.
- IDs are canonical positive PostgreSQL Int values. Versions are positive integers. Timestamps are RFC 3339 UTC strings ending in Z.
- Enum wire values use the existing display values: Ticket statuses include “In Progress” and “Waiting for Requester”; action status values are “Planned”, “In Progress”, “Completed”, and “Cancelled”; priorities are “Low”, “Medium”, “High”, and “Urgent”.
- Every business response uses Cache-Control: no-store. Authentication, required-password, role, and ownership checks follow the rules below. Mutating cookie-authenticated requests require same-origin checks and a valid CSRF token.
- Errors use the established shape:

  ```json
  {
    "error": {
      "code": "VERSION_CONFLICT",
      "message": "This record changed. Refresh and review the latest values.",
      "details": {
        "field": "version",
        "reason": "The supplied version is stale."
      }
    }
  }
  ```

  Details are omitted when there are no safe field details. No response exposes SQL, credentials, stack traces, local paths, storage keys, internal note content, or another Requester’s protected data.

## 2. Shared Types

UserRef has id, displayName, and role label. Action responses also include isActive and isEligible on the assignee so historical ineligibility can be explained. Page<T> is:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

ActionTaken is:

```json
{
  "id": 41,
  "ticketId": 120,
  "description": "Replace the damaged network cable.",
  "result": null,
  "assignee": {
    "id": 9,
    "displayName": "Alex Staff",
    "role": "IT Staff",
    "isActive": true,
    "isEligible": true
  },
  "createdBy": {
    "id": 9,
    "displayName": "Alex Staff",
    "role": "IT Staff"
  },
  "performedBy": null,
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": null,
  "status": "Planned",
  "version": 1,
  "createdAt": "2026-09-30T04:00:00.000Z",
  "updatedAt": "2026-09-30T04:00:00.000Z",
  "startedAt": null,
  "completedAt": null,
  "completedBy": null,
  "cancelledAt": null,
  "cancelledBy": null
}
```

TicketDetail remains the shared Lab 3 Ticket detail shape, including its current version, public fields, and requester-visible resolution indication. It never embeds Internal Notes for a Requester. ActionMutationResult is { action: ActionTaken, ticket: TicketDetail }, so the client receives the current parent version after each successful write.

ActionEvent has id, actionId, actor: UserRef, eventType, actionVersion, fromStatus, toStatus, createdAt, and snapshot. eventType is ActionCreated, ActionEdited, ActionStarted, ActionCompleted, or ActionCancelled. Assignment changes use ActionEdited. Snapshot is null for state-only events and otherwise has description, result, assigneeId, followUpRequired, followUpNote, attachmentNotes, and status. TicketStatusEvent has id, ticketId, actor, fromStatus, toStatus, ticketVersion, confirmed, and createdAt. Both event resources sort by createdAt ascending and then ID ascending.

## 3. Action Taken Endpoints

| Method and path | Roles | Request | Success |
| --- | --- | --- | --- |
| GET /tickets/:ticketId/actions | Requester own; IT Staff/Admin all | page, pageSize | 200 Page<ActionTaken> |
| POST /tickets/:ticketId/actions | IT Staff/Admin | Create body below | 201 ActionMutationResult; identical retry is 200 |
| PUT /tickets/:ticketId/actions/:actionId | IT Staff/Admin | Complete pending-edit body below | 200 ActionMutationResult |
| POST /tickets/:ticketId/actions/:actionId/transition | IT Staff/Admin | Transition body below | 200 ActionMutationResult |
| GET /tickets/:ticketId/actions/:actionId/history | Requester own; IT Staff/Admin all | page, pageSize | 200 Page<ActionEvent> |
| GET /tickets/:ticketId/status-history | Requester own; IT Staff/Admin all | page, pageSize | 200 Page<TicketStatusEvent> |

Action and status history pages default to page=1, pageSize=20; allowed sizes are 10, 20, and 50. Action list ordering is createdAt ascending, then ID ascending. Valid out-of-range pages return an empty items array and accurate totals. A Requester’s foreign Ticket returns 404 RESOURCE_NOT_FOUND on reads; a Requester action write returns 403 FORBIDDEN before Ticket lookup. IT Staff/Admin may act on any nonterminal Ticket regardless of Ticket Owner or action assignee.

### Create

```json
{
  "requestId": "a5726990-c560-45d5-ae76-2f75659bb540",
  "version": 7,
  "description": "Replace the damaged network cable.",
  "result": null,
  "assigneeId": 9,
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": null
}
```

requestId, version, description, and followUpRequired are required. result, assigneeId, followUpNote, and attachmentNotes may be omitted and normalize to null/default values. Optional text is trimmed; blank Result and Attachment Notes normalize to null. If assigneeId is omitted, the actor is assigned. The created status is always Planned. The server sets Ticket ID, actor/creator, createdAt, updatedAt, and version. assigneeId must name an active IT Staff or Administrator. Description is 1–5,000 Unicode code points after trim. Result is nullable and at most 5,000 code points. Follow-up Note is required and 1–5,000 code points when followUpRequired=true; when false, it must be null or blank and normalizes to null. Attachment Notes are nullable and at most 2,000 code points. Text is plain text.

Creation locks the parent Ticket and checks authorization and Ticket ownership/existence. It then looks up the idempotency key before current Ticket status or version: the same actor/Ticket/requestId and normalized business payload returns the existing action plus a fresh TicketDetail, even if a later request resolved the Ticket, without incrementing versions. A key with changed business fields returns 409 REQUEST_ID_CONFLICT. Only a new key checks that the Ticket is nonterminal and that its supplied version is current, then writes the action, initial event, parent public updatedAt, and parent version atomically. The server stores a unique key scoped to Ticket, actor, and requestId. payloadHash is lowercase SHA-256 over canonical JSON with fixed field order: trimmed description, normalized Result, resolved assigneeId, followUpRequired, normalized Follow-up Note, and normalized Attachment Notes. requestId, Ticket/actor IDs, and version are outside the hash. A new key on a terminal Ticket returns 409 TICKET_TERMINAL; a stale version returns 409 VERSION_CONFLICT.

### Edit and assignment

PUT replaces all mutable fields on a pending action:

```json
{
  "actionVersion": 2,
  "ticketVersion": 8,
  "description": "Replace the damaged network cable and test both ports.",
  "result": null,
  "assigneeId": 12,
  "followUpRequired": true,
  "followUpNote": "Confirm connectivity with the requester.",
  "attachmentNotes": "See photo attached to the Ticket."
}
```

Every body field above is required. Null is used to clear optional text; optional blank Result and Attachment Notes normalize to null. Follow-up Note must be nonblank when required and null/blank when not required. Parent Ticket, creator, creation time, performedBy, lifecycle timestamps, action status, requestId, and history cannot be changed through this endpoint. Only Planned/In Progress actions on nonterminal Tickets may be edited. A changed assignee must be active and eligible at commit. The current now-ineligible assignee may be retained while editing other fields, but the action cannot start or complete until reassigned to an eligible user. A successful edit appends an immutable snapshot event and increments action and parent versions once. A semantically unchanged replacement returns the current ActionMutationResult without writing an event or advancing versions.

### Action transition

```json
{
  "actionVersion": 2,
  "ticketVersion": 9,
  "toStatus": "Completed",
  "confirmed": true
}
```

For Completed and Cancelled, confirmed must be true; missing or false returns 400 CONFIRMATION_REQUIRED with field=confirmed and no write. For In Progress, omit confirmed. No other properties are accepted. Valid transitions are Planned to In Progress/Cancelled and In Progress to Completed/Cancelled. Completion requires a nonblank stored Result, followUpRequired=false, and an active eligible assignee. Starting stores performedBy and startedAt from the authenticated actor and backend clock. Completion/cancellation stores its actor and backend timestamp separately. Cancellation sets cancelledBy/cancelledAt. Each transition appends an immutable event and increments both versions once. Repeated terminal transitions return 409 ACTION_TERMINAL; invalid edges return 409 INVALID_TRANSITION.

## 4. Ticket Workflow and Existing Operational Routes

The existing POST /tickets/:ticketId/status remains { currentStatus: Status, version: integer, confirmed?: true } and returns 200 TicketDetail. IT Staff and Administrators may call it. confirmed=true is required for Resolved, Closed, and Cancelled. The complete matrix and gates are in specification.md BR-09–BR-13.

The transaction locks the Ticket parent, compares version, rechecks actor/owner eligibility, verifies the transition, and applies its gate. Entering In Progress or Resolved requires an active eligible owner. Entering Resolved additionally requires at least one Completed action and no Planned/In Progress actions. Entering Cancelled requires no Planned/In Progress actions. Closing is allowed only from Resolved and retains resolvedAt. Reopening clears the current resolution indication and resolvedAt, records the event, and increments version. No action mutation, resolution, cancellation, or account eligibility change may race past the gate.

Operational methods previously limited to IT Staff now allow Administrator too: POST /tickets/:ticketId/claim, PUT /tickets/:ticketId/owner, PATCH /tickets/:ticketId/it-priority, and POST /tickets/:ticketId/status. Preserve their existing request bodies and version behavior. The Requester resolution indication remains PUT /tickets/:ticketId/resolution-indication with {} and has no version input; it is idempotent for an already-indicated active Ticket and never changes currentStatus.

Use the existing GET /staff/owners for assignee selection; it returns active eligible IT Staff/Admin users sorted by displayName then ID. Administrator also receives the existing IT Staff write permissions for POST /tickets/:ticketId/comments and POST /tickets/:ticketId/internal-notes. Requester-only Ticket creation and Attachment writes remain Requester-only. Internal Notes remain unavailable to Requesters, including dashboard query and response data.

Status transition events append in the same transaction as the Ticket change. GET /tickets/:ticketId/status-history returns recorded events in paginated, stable order to authorized Ticket readers. The migration does not synthesize events for legacy Tickets; transitions before the Lab 4 rollout cannot be reconstructed.

## 5. Dashboard and Drill-Down Endpoints

| Method and path | Roles | Query | Success |
| --- | --- | --- | --- |
| GET /requester/dashboard | Requester | None | 200 RequesterDashboard |
| GET /staff/dashboard | IT Staff/Admin | None | 200 StaffDashboard |
| GET /staff/actions | IT Staff/Admin | page, pageSize | 200 Page<MyActionRow> |

RequesterDashboard:

```json
{
  "generatedAt": "2026-09-30T04:00:00.000Z",
  "window": {
    "from": "2026-09-23T04:00:00.000Z",
    "through": "2026-09-30T04:00:00.000Z"
  },
  "counts": {
    "activeTickets": 2,
    "waitingForRequester": 1,
    "recentlyUpdated": 1,
    "recentlyResolved": 0
  },
  "previews": {
    "recentlyUpdated": [],
    "recentlyResolved": []
  }
}
```

RequesterDashboard has exactly generatedAt, window { from, through }, counts { activeTickets, waitingForRequester, recentlyUpdated, recentlyResolved }, and previews { recentlyUpdated, recentlyResolved }. Its TicketPreview contains id, ticketNumber, summary, currentStatus, requestedPriority, updatedAt, and resolvedAt.

StaffDashboard has exactly generatedAt, window { from, through }, counts { activeUnassigned, activeOwned, byStatus, activeByPriority, myActions }, and previews { recentlyUpdatedTickets, urgentActiveTickets, myActions }. byStatus has one numeric property for each of the eight Ticket statuses. activeByPriority has one numeric property for each of the four priorities. Staff TicketPreview contains id, ticketNumber, summary, currentStatus, requestedPriority, itPriority, owner, updatedAt, and resolvedAt. MyActionPreview contains an ActionSummary { id, ticketId, description, status, followUpRequired, assignee, updatedAt } and a compact parent TicketPreview.

Each preview array is capped at five rows. The full queue/action list remains paginated. Requester recentlyUpdated and staff recentlyUpdatedTickets sort updatedAt descending then Ticket ID descending; recentlyResolved sorts resolvedAt descending then Ticket ID descending; urgentActiveTickets sort updatedAt descending then Ticket ID descending; myActions sort action updatedAt descending then action ID descending. The time-scope list defaults use the same date field and tie-break. The recently-resolved requester scope also permits sortBy=resolvedAt. All responses contain numeric zeroes and empty arrays for no matches.

Metrics are read from one repeatable-read PostgreSQL snapshot. The API’s generatedAt value is the snapshot’s database UTC timestamp. from is exactly generatedAt minus seven days; through equals generatedAt. Both bounds are inclusive. Timestamps are serialized as UTC.

### Exact Ticket list filters

The existing requester GET /tickets and staff GET /staff/tickets gain a single optional scope plus from/through for time scopes. Existing search, category, system, priority, status, owner, sort, and pagination filters remain supported; filters combine with AND. Requester identity always comes from the session. User-supplied requesterId is rejected. Unknown, duplicate, malformed, or unsupported filters return 400 VALIDATION_ERROR.

| List | Scope | Exact additional predicate |
| --- | --- | --- |
| GET /tickets | active | currentStatus is New, Open, In Progress, Waiting for Requester, or Reopened |
| GET /tickets | waiting-for-requester | currentStatus is Waiting for Requester |
| GET /tickets | recently-updated | updatedAt is inclusively between supplied from and through |
| GET /tickets | recently-resolved | currentStatus is Resolved or Closed and resolvedAt is inclusively between supplied from and through; default ordering is resolvedAt descending then ID descending |
| GET /staff/tickets | active | currentStatus is New, Open, In Progress, Waiting for Requester, or Reopened |
| GET /staff/tickets | recently-updated | updatedAt is inclusively between supplied from and through; default ordering is updatedAt descending then ID descending |
| GET /staff/tickets | urgent-active | active status and itPriority=Urgent; default ordering is updatedAt descending then ID descending |

For time scopes, both from and through are required, must be UTC Z timestamps, and from must not exceed through. Other scopes reject from/through. Dashboard links preserve the returned bounds exactly. Existing filters add AND predicates; incompatible filters can validly return zero results. Staff card links use owner=unassigned, owner=me, currentStatus, itPriority, and the scopes above to reproduce counts.

### My Actions list

GET /staff/actions always means actions assigned to the authenticated user, with status Planned or In Progress, whose parent Ticket is active. There is no requesterId, assigneeId, creator, owner, or arbitrary status query parameter. Results include a Ticket summary and action detail link; sort updatedAt descending, then ID descending. Page defaults to 1 and 20; allowed sizes are 10, 20, and 50. Its totalItems must equal StaffDashboard counts.myActions for the same database state.

## 6. Validation, Status Codes, and Concurrency

| Status | Contract |
| --- | --- |
| 200 | Successful read or update, idempotent create replay, or already-indicated advisory request. |
| 201 | New Action Taken created. |
| 400 | Malformed JSON, path, body, version, or query; invalid text; unsupported property; missing Ticket/action confirmation. |
| 401 | AUTHENTICATION_REQUIRED for missing/expired session. |
| 403 | FORBIDDEN for role restriction; ACCOUNT_INACTIVE for inactive account; PASSWORD_CHANGE_REQUIRED for restricted data; CSRF_INVALID or ORIGIN_FORBIDDEN for rejected mutation. Requester action write returns FORBIDDEN. |
| 404 | NOT_FOUND for unknown route; RESOURCE_NOT_FOUND for missing resource or a Requester’s foreign Ticket/action/history. |
| 409 | Stale version; invalid transition; terminal Ticket/action; missing eligible owner/assignee; unresolved follow-up/resolution/cancellation gate; idempotency key with changed payload; active-action/account eligibility conflict. |
| 500 | Safe generic error for unexpected service/database failure. |

| Code | Status | Meaning |
| --- | --- | --- |
| VALIDATION_ERROR / INVALID_JSON | 400 | Invalid path, JSON, body, text, version, or query. Include safe field/reason details where useful. |
| CONFIRMATION_REQUIRED | 400 | Ticket cancellation/resolution/closure or Action Taken completion/cancellation was requested without confirmed=true. |
| AUTHENTICATION_REQUIRED | 401 | Missing/expired session. |
| FORBIDDEN / ACCOUNT_INACTIVE / PASSWORD_CHANGE_REQUIRED / CSRF_INVALID / ORIGIN_FORBIDDEN | 403 | Existing role, account, restricted-flow, or mutation-security rejection. |
| NOT_FOUND | 404 | Unknown route. |
| RESOURCE_NOT_FOUND | 404 | Missing resource, or a foreign Ticket/action/history hidden from a Requester. |
| VERSION_CONFLICT | 409 | Action/Ticket version is stale; do not write. details.field names the stale version field (version, actionVersion, or ticketVersion); details.reason says the supplied version is stale. |
| INVALID_TRANSITION | 409 | Requested action or Ticket state edge is not in its matrix. |
| ACTION_TERMINAL / TICKET_TERMINAL | 409 | Action is Completed/Cancelled or Ticket is Resolved/Closed/Cancelled and mutation is disallowed. |
| OWNER_REQUIRED / OWNER_INELIGIBLE | 409 | Ticket has no active eligible owner where required, or requested owner is not eligible. |
| ACTION_ASSIGNEE_INELIGIBLE | 409 | Selected or retained action assignee is not active and eligible. |
| FOLLOW_UP_UNRESOLVED | 409 | Action completion is blocked while required follow-up remains. |
| RESULT_REQUIRED | 409 | Action completion is blocked while Result is empty. |
| RESOLUTION_GATE_FAILED | 409 | Ticket has no completed Action Taken. |
| TICKET_HAS_PENDING_ACTIONS | 409 | Ticket resolution or cancellation is blocked while Planned/In Progress actions remain. |
| REQUEST_ID_CONFLICT | 409 | An idempotency key is reused with changed normalized business fields. |
| INTERNAL_ERROR | 500 | Unexpected failure; safe generic message only. |

Error codes and messages are stable enough for UI branching; field details support validation placement. A conflict includes no data changes and instructs refresh/review; clients never blindly replay a stale mutation.

Every action edit/transition has actionVersion and ticketVersion. Create has Ticket version and requestId. Existing Ticket operational writes keep their version field. If a mutation needs an assignee/owner ID from a row not yet locked, read that ID as a nonlocking snapshot; lock the acting and target User rows in ascending ID order, then Ticket, then Action; reload all records, compare expected versions and snapshot identity, and recheck eligibility before writing. Existing account role/activity changes first take the account lifecycle advisory transaction lock, then lock actor/target Users in ascending ID order, then affected Tickets in ascending ID order. Shared User row locks serialize eligibility changes with action and Ticket writes while preserving the existing lock order. The parent Ticket lock serializes action create/edit/transition, Ticket status, owner, and priority decisions. Create retry checks its normalized idempotency key under the parent lock before comparing the prior Ticket version. All writes and their events, version increments, and timestamps commit or roll back together.

## 7. OpenAPI and Client Requirements

- Extend server/openapi.yaml as the canonical contract before implementation API work. Document all paths, role/security requirements, exact schemas, validation bounds, error responses, and status codes above.
- Generate client types/SDK from the OpenAPI document; do not hand-edit generated files. Add typed request/query wrappers and invalidate/refetch Ticket, Action, dashboard, and list queries after successful writes.
- Keep dashboard/action cache keys scoped by authenticated account and role. Clear or isolate those caches on logout and account change.
- Verify the checked-in generated code matches OpenAPI. No feature endpoint is complete while its API, OpenAPI, generated client, tests, and role guards disagree.
