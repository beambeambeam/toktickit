# Lab 3 API Contract

Status: planned under #49; executable OpenAPI remains the implemented Lab 2 API until each feature lands. [Specification](./specification.md) owns authorization/business rules; this file fixes wire behavior. All endpoint paths in the tables below are relative to `/api` (for example, `/auth/login` means `/api/auth/login`). JSON except specified multipart/downloads. All objects reject unknown input properties, including requesterId, authorId, createdAt and old identity headers. Timestamps are ISO 8601 UTC. IDs are positive PostgreSQL Int values (1–2147483647); versions positive integers. Malformed path/body/query IDs use 400 VALIDATION_ERROR. Valid missing or unowned resources use 404 RESOURCE_NOT_FOUND; role checks still precede resource lookup.

## 1. Common shapes and errors

The following notation defines required fields, nullable unions and arrays; `?` alone means optional. Responses do not include additional credential or storage fields.

```text
Role = "Requester" | "IT Staff" | "Administrator"
Priority = "Low" | "Medium" | "High" | "Urgent"
Status = "New" | "Open" | "In Progress" | "Waiting for Requester" |
         "Resolved" | "Closed" | "Reopened" | "Cancelled"
Reference = { id: integer, name: string }
User = { id: integer, displayName: string, email: string, role: Role,
         isActive: boolean, mustChangePassword: boolean,
         createdAt: timestamp, updatedAt: timestamp }
Author = { id: integer, displayName: string }
Owner = { id: integer, displayName: string, role: Role,
          isActive: boolean, isEligible: boolean }
Attachment = { id: integer, originalFilename: string, mediaType: string,
  byteSize: integer, uploadedAt: timestamp, state: "Active" | "Removed",
  removedAt: timestamp | null, removalReason: string | null }
TicketSummary = { id: integer, ticketNumber: string, ticketDate: timestamp,
  summary: string, category: Reference, relatedSystem: Reference,
  requestedPriority: Priority, currentStatus: Status, updatedAt: timestamp }
OperationalSummary = TicketSummary & { itPriority: Priority, owner: Owner | null,
  version: integer }
TicketDetail = OperationalSummary & {
  requester: { id: integer, displayName: string, email: string },
  description: string, attachments: Attachment[],
  resolutionIndication: { author: Author, createdAt: timestamp } | null,
  statusChangedAt: timestamp, resolvedAt: timestamp | null,
  reopenedAt: timestamp | null, closedAt: timestamp | null,
  cancelledAt: timestamp | null }
Entry = { id: integer, content: string, author: Author, createdAt: timestamp }
Page<T> = { items: T[], page: integer, pageSize: integer,
            totalItems: integer, totalPages: integer }
Auth = { user: User, csrfToken: string }
Error = { error: { code: string, message: string,
  details?: { field: string, reason: string, fields?: Record<string,string> } } }
```

TicketDetail is safe for all permitted readers: it never embeds comments, notes, note counts or private timestamps. Public/operational data use explicit projections; never serialize raw Prisma records. Private entries are available only through `/internal-notes`. Author names reflect the referenced account's current displayName; author IDs/times are immutable. No role-at-post snapshot or account history is introduced.

| HTTP | Code / situation |
| --- | --- |
| 400 | VALIDATION_ERROR: malformed JSON, unsupported/repeated fields/queries, input bounds, client attribution or obsolete identity header supplied after authentication. |
| 401 | AUTHENTICATION_REQUIRED: missing/expired/revoked session; INVALID_CREDENTIALS: login failure with “Unable to sign in. Check your credentials or contact your administrator.” |
| 403 | FORBIDDEN: role restriction; PASSWORD_CHANGE_REQUIRED: restricted data access; CSRF_INVALID: missing/wrong token; ORIGIN_FORBIDDEN: disallowed/missing mutation Origin. |
| 404 | RESOURCE_NOT_FOUND: missing/unowned Ticket, Attachment, user or unavailable content; removed identity endpoint. |
| 409 | VERSION_CONFLICT, ASSIGNMENT_CONFLICT, INVALID_TRANSITION, OWNER_REQUIRED, OWNER_INELIGIBLE, TICKET_TERMINAL, EMAIL_CONFLICT, SELF_DEACTIVATION, LAST_ADMIN_REQUIRED, ATTACHMENT_LIMIT_EXCEEDED. |
| 413 | PAYLOAD_TOO_LARGE: file/request parser limit. |
| 415 | UNSUPPORTED_MEDIA_TYPE: unsupported upload type or request content type. |
| 429 | RATE_LIMITED: Retry-After integer seconds until relevant rolling window permits retry. |
| 500 | INTERNAL_ERROR: “Unable to complete the request. Please try again.” |

No secrets, SQL, stack traces, local paths, storage keys or protected resource information in messages/details/logs. Authentication, then required-password/role checks, then ownership/resource checks precede domain validation and file buffering where possible. Origin checks can reject before authentication; valid same-origin unauthorized requests follow 401/403/404 rules. Requester note endpoints always return 403 before looking up any Ticket, including nonexistent IDs. All protected responses and authentication responses use `Cache-Control: no-store`.

## 2. Authentication, cookies, CORS and CSRF

- Session token: 32 cryptographically random bytes encoded base64url. PostgreSQL stores SHA-256(token), never raw token. Cookie `toktickit_session`, HttpOnly, SameSite=Lax, Path=/, no Domain, Secure under HTTPS. Local development may use HTTP on localhost with Secure=false; mixed hostname/cross-site deployment is outside this lab setup. Max-Age is remaining absolute lifetime (28,800 seconds normal, 900 restricted); server expiry remains authoritative.
- Server validates User activation, current role, password-change flag and session expiry on every protected request. Normal idle expiry occurs at `now >= lastSeenAt + 30 minutes`; absolute expiry at `now >= createdAt + 8 hours`. Restricted sessions expire at 15 minutes and do not slide. Successful authorized requests update normal lastSeenAt, never absolute expiry. Denied/failed-auth requests do not extend it.
- Login replaces/revokes any session supplied by that browser and issues a new token. Other sessions survive a normal login. Password change revokes all sessions and issues one new unrestricted session in the same transaction as the hash update. Logout deletes its session and expires the cookie with matching attributes. No browser storage contains credentials.
- CORS allows exactly configured `CORS_ORIGIN` (default `http://localhost:5173`), credentials=true, methods GET/POST/PATCH/PUT/DELETE/OPTIONS, headers Content-Type and X-CSRF-Token; expose Content-Disposition and Retry-After. Never reflect arbitrary origins or use wildcard credentials. Preflight returns 204 for allowed origin/method/header combinations without a session; does not authorize the actual request.
- Every mutation requires an Origin exactly matching configured client origin or configured API origin; reject absent, null or unlisted Origin. Login uses this protection even without a session. Authenticated mutations additionally require X-CSRF-Token equal to a 32-byte random synchronizer secret bound to the current session, constant-time compared. This includes multipart upload, logout and password change.
- Login and GET `/auth/me` return the CSRF token. It is kept in memory, reused for that session and expires/revokes/rotates with it. No CSRF token in URL or cookie; it grants nothing without the session. Refetch me after reload. Do not retry a failed mutation automatically after token/identity changes.
- Failed credential checks are counted for both normalized email and trusted source IP, including unknown/inactive accounts, with equivalent password-hash work for those cases. The first five failed account attempts (or 30 IP attempts) return the generic 401; subsequent attempts during the rolling window return 429 without verifying credentials. Failures older than 15 minutes are excluded from the count; successful login does not reset IP/account history. Atomic reservation/counting must prevent concurrent attempts exceeding the limits. Malformed login input gets 400 and remains subject to the IP abuse limit. Do not trust arbitrary X-Forwarded-For.

| Method / path | Body | Success |
| --- | --- | --- |
| POST /auth/login | `{email: string, password: string}` | 200 Auth and new cookie; restricted user remains mustChangePassword=true. |
| GET /auth/me | None | 200 Auth; works for restricted sessions. |
| POST /auth/change-password | `{currentPassword: string, newPassword: string}` | 200 Auth and rotated cookie; wrong current password = 400 field validation; BR-07 applies. UI confirmation is checked before sending. |
| POST /auth/logout | `{}` | 204, cookie cleared and server token revoked. Missing/expired session = 401 with cookie cleared; invalid CSRF on valid session = 403, session retained. |

Email normalization/validation matches user creation. Passwords are untrimmed 15–128 Unicode code points; over-limit input is rejected before expensive hashing. Normal sessions may change their own password through the same operation. Failures of current-password verification use the account/IP rate limits as well. Password replacement transaction rechecks credential/session state so a concurrent reset/deactivation cannot resurrect access.

## 3. Preserved Requester and shared read endpoints

All business endpoints require unrestricted authentication. R=Requester, S=IT Staff, A=Administrator; ownership and status rules are in the specification matrix. Health remains public liveness (`200 {status:"ok",service:"TokTickIT API"}`); API documentation remains development documentation and grants no business access. `/development-requesters` is removed and returns 404.

| Method / path | Roles | Input | Success |
| --- | --- | --- | --- |
| GET /categories | R/S/A | None | 200 `{items: Reference[]}`, active records in display order then ID. |
| GET /related-systems | R/S/A | None | 200 `{items: Reference[]}`, active records in display order then ID. |
| POST /tickets | R | Multipart categoryId, relatedSystemId, summary, description, requestedPriority; optional repeated attachments file parts | 201 `{ticket: TicketDetail}`. |
| GET /tickets | R | My Tickets query below | 200 `Page<TicketSummary>`, own submissions only. |
| GET /tickets/:ticketId | R own / S/A all | None | 200 TicketDetail. |
| GET /tickets/:ticketId/attachments | R own / S/A all | None | 200 `{attachments: Attachment[]}`, upload time/ID ascending. |
| POST /tickets/:ticketId/attachments | R own | Multipart repeated attachments file parts (1–5 files) | 201 `{attachments: Attachment[]}` for added files. |
| GET /tickets/:ticketId/attachments/:attachmentId/content | R own / S/A all | None | 200 bytes, validated Content-Type, safe attachment Content-Disposition, nosniff. |
| DELETE /tickets/:ticketId/attachments/:attachmentId | R own | `{reason: string}` | 200 `{attachment: Attachment}` in Removed state. UI requires confirmation. |

Creation sets official `TKT-YYYYMMDD-XXXXXX`, backend time/identity, New, unassigned, itPriority=requestedPriority and version=1. Active category/system required; absent/inactive reference = 404. Text/file limits follow BR-21. Validate extension, declared media type and signature; malformed signature = 400, unsupported type = 415, file >5 MiB =413. Zero files on add =400; more than five files in a request =409 ATTACHMENT_LIMIT_EXCEEDED; existing-plus-added active count >5 =409 ATTACHMENT_LIMIT_EXCEEDED. JSON body maximum 1 MiB; multipart parser permits at most five 5-MiB files, five scalar create fields with fieldSize 16 KiB and rejects unexpected parts. Do not apply the JSON limit to multipart.

Keep Lab 2 validate/store/transaction/compensate creation and add behavior, capacity row locking and removal cleanup-before-metadata-commit. Failed cleanup is retryable; removed content never streams. Repeated removal returns 404. A successful file mutation advances Ticket version/time under the same lock, but requires no client version (preserved API). File IDs must belong to the named Ticket. Removed metadata remains readable on every status.

Preserved Attachment wire details: the multipart field is `attachments` repeated per file (not the literal `attachments[]`). Normalize filenames by removing directory components, replacing control/unsafe markup characters, collapsing whitespace, trimming and limiting to 255 JavaScript string units, with `attachment` as the empty/dots-only fallback. Never use the display name as a storage key. Preserve error codes: 413 ATTACHMENT_TOO_LARGE, 415 UNSUPPORTED_ATTACHMENT_TYPE, 400 INVALID_ATTACHMENT for invalid signatures/metadata, 400 INVALID_ATTACHMENT_FIELD for unexpected file fields, and 400 INVALID_MULTIPART_REQUEST for scalar/part limits. These specialize the common error table without changing its envelope.

### My Tickets query

Only these parameters, each at most once. Search is trimmed, maximum 200 JavaScript string units, blank means no search; case-insensitive literal substring of number, summary or description. SQL wildcard characters are literal. Filters combine with AND.

| Parameter | Values | Default |
| --- | --- | --- |
| search | Text as above | None |
| categoryId, relatedSystemId | Positive decimal integer | None |
| requestedPriority | Priority | None |
| currentStatus | Any expanded Status | None |
| sortBy | ticketNumber, ticketDate, summary, requestedPriority, currentStatus, updatedAt | updatedAt |
| sortDirection | asc, desc | desc |
| page | Decimal integer 1–2147483647 | 1 |
| pageSize | 10, 25, 50 | 10 |

Preserve Lab 2 ordering for retained fields; requestedPriority sorts Low < Medium < High < Urgent, currentStatus follows the declared Status order. ID tie-break uses requested direction. Search/filter changes reset UI page to one; out-of-range valid page returns empty items and accurate totals.

## 4. Shared queue and operational mutations

| Method / path | Roles | Input | Success |
| --- | --- | --- | --- |
| GET /staff/tickets | S/A | Queue query below | 200 `Page<OperationalSummary>`. |
| GET /staff/owners | S/A | None | 200 `{items: Owner[]}` active eligible users, displayName then ID ascending. |
| POST /tickets/:ticketId/claim | S | `{version: integer}` | 200 TicketDetail; assigns current user only if unassigned. |
| PUT /tickets/:ticketId/owner | S | `{ownerId: integer \| null, version: integer}` | 200 TicketDetail. |
| PATCH /tickets/:ticketId/it-priority | S | `{itPriority: Priority, version: integer}` | 200 TicketDetail. |
| POST /tickets/:ticketId/status | S | `{currentStatus: Status, version: integer, confirmed?: boolean}` | 200 TicketDetail. confirmed=true required for Resolved/Closed/Cancelled; missing/false =400. |
| PUT /tickets/:ticketId/resolution-indication | R own | `{}` | 200 `{resolutionIndication:{author:Author,createdAt:timestamp}}`. |

Detail uses the shared GET `/tickets/:ticketId`; there is no duplicate staff detail projection containing notes. Mutations lock/recheck Ticket, current actor and target owner eligibility transactionally. Lock ordering must be consistent with administrator account changes. Verify supplied version before domain update; stale version =409 VERSION_CONFLICT. Already claimed at current version =409 ASSIGNMENT_CONFLICT. Missing/inactive/ineligible owner =409 OWNER_INELIGIBLE. Unchanged owner/priority at current version returns current Detail without advancing version/time. Other successful operational changes increment version and update time once. Terminal owner/priority/indication attempts =409 TICKET_TERMINAL. Unsupported edge =409 INVALID_TRANSITION; missing eligible owner =409 OWNER_REQUIRED. No automatic replay after 409; refresh, reselect and confirm again.

Indication needs no client version: lock Ticket and evaluate its current status. Existing indication on a nonterminal Ticket returns original actor/time unchanged. Terminal status always returns 409 even if previously indicated. Staff reopening clears indication atomically. Workflow timestamps follow specification §7.

### Queue query

| Parameter | Values | Default |
| --- | --- | --- |
| search | Trimmed text ≤200 JavaScript string units; literal case-insensitive substring of ticketNumber or summary only | None |
| currentStatus | Status | None |
| categoryId, relatedSystemId | Positive decimal integer | None |
| requestedPriority, itPriority | Priority | None |
| owner | Positive eligible User ID, me, unassigned | None |
| sortBy | ticketDate, updatedAt, itPriority, ticketNumber | updatedAt |
| sortDirection | asc, desc | desc |
| page | Decimal integer 1–2147483647 | 1 |
| pageSize | 10, 20, 50 | 20 |

`me` resolves to session ID, including Administrator read-only queue. Specific owner must currently be eligible or returns 400; historical ineligible ownership remains visible in unfiltered queue. Nonexistent positive category/system filter returns an empty result; deactivated reference IDs can filter historical Tickets. Filters combine with AND. Unknown, repeated (even identical), nested, array, malformed, unsupported or contradictory query forms return 400; no separate ownerId/assigned flags. Numbers require canonical positive decimal digits with no sign, exponent, decimal point or leading zeros. Blank search is omitted; other blank values are invalid. IT Priority sorts by business severity, never lexical text. Every sort uses ID in the same direction for ties. Fetch totals/items from one consistent database snapshot. `totalPages=ceil(totalItems/pageSize)`, zero when empty. Valid out-of-range pages return empty items with accurate totals; offset arithmetic must not overflow.

## 5. Communication

| Method / path | Roles | Input | Success |
| --- | --- | --- | --- |
| GET /tickets/:ticketId/comments | R own / S/A all | None | 200 `{comments: Entry[]}`. |
| POST /tickets/:ticketId/comments | R own / S | `{content:string}` | 201 `{comment:Entry}`. |
| GET /tickets/:ticketId/internal-notes | S/A | None | 200 `{internalNotes:Entry[]}`. |
| POST /tickets/:ticketId/internal-notes | S | `{content:string}` | 201 `{internalNote:Entry}`. |

Trim edge whitespace then validate inclusive 1–5,000 Unicode code points. Backend attribution only; plain text with preserved line breaks. Ascending createdAt/ID ordering; no pagination or edit/delete endpoints in this increment. Closed/Cancelled writes return 409 TICKET_TERMINAL; Resolved accepts entries. Serialize entry writes with status checks so a concurrent closure cannot accept a later write. Public entries advance Ticket version/time; private writes do not change public projections. No optimistic version required for append operations. UI prevents duplicate in-flight submissions; uncertain transport failure requires user confirmation/refetch before resubmission, not blind automatic retry.

## 6. Administrator accounts

| Method / path | Input | Success |
| --- | --- | --- |
| GET /users | Optional search (trimmed ≤200 code points, literal case-insensitive name/email substring), role (Role), each once | 200 `{items:User[]}`, displayName then ID ascending, no pagination. |
| GET /users/:userId | None | 200 User, for edit form. |
| POST /users | `{displayName:string,email:string,role:Role,isActive:boolean,initialPassword:string}` | 201 `{user:User}` with mustChangePassword=true. |
| PATCH /users/:userId | One or more of `{displayName,email,role,isActive}` | 200 `{user:User}`; empty/unknown fields =400. |
| POST /users/:userId/initial-password | `{initialPassword:string,confirmed:true}` | 200 `{user:User}` with mustChangePassword=true. |

All require Administrator. Only displayName/email/role/isActive are editable; no credential returned anywhere. Trim name 1–100 Unicode code points. Validate trimmed lowercase email (single mailbox, no display-name syntax, ≤254 characters); database unique normalized email is authoritative. Role is one exact string, never array. Boolean must be JSON boolean. Password policy is identical to authentication. Duplicate creates/edits, including races, return 409 EMAIL_CONFLICT. Invalid roles/input return 400 field details. No user deletion endpoint.

User edits/reset and authorization/owner side effects commit atomically. Serialize administrator safety decisions under one database transaction lock, then lock affected users/Tickets consistently; count active Administrators inside the protected transaction so concurrent demotions/deactivations cannot both pass. Recheck acting Administrator's current authority in that transaction. Self-deactivation =409 SELF_DEACTIVATION; last-admin loss =409 LAST_ADMIN_REQUIRED. Self-demotion/reset returns the safe success response, expires the browser cookie, and forces login. Name/email-only edit keeps sessions; role change/deactivation/reset deletes all target sessions. Eligibility loss unassigns only nonterminal Tickets, increments their version/time and preserves terminal owner IDs. Concurrent assignment must serialize with eligibility removal. There is no generic account audit history or required user optimistic-version API.

## 7. Implementation synchronization

#50 owns authentication/migration and preserved routes, #51 queue/read models, #52–55 operations and entries, #56–57 accounts. Each adds exact OpenAPI schemas/security/operation IDs, removes replaced definitions and regenerates `client/src/generated/hey-api/` via `pnpm openapi:generate`. Use credentialed SDK requests and explicit projections. Verify `pnpm openapi:check` and HTTP cases from [tests.md](./tests.md). No new package is chosen by this documentation ticket.
