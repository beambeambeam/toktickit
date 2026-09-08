# Lab 3 Specification — Sprint 3 Engineering Contract

Status: prepared for external review under [Issue #49](https://github.com/beambeambeam/toktickit/issues/49), implementing the planning baseline in [Issue #48](https://github.com/beambeambeam/toktickit/issues/48). This is a contract, not evidence that the application is implemented or approved. Baseline: `ad5640b`, shared by `main` and `origin/lab3-staging` when work began on 2026-09-08.

Sources: local `reports/lab03/labsheet.md` §§1–14 and its page images; preserved [Lab 2 contract](../lab-02/specification.md). The report source is local and ignored by Git. The six tracked documents here contain the implementable decisions. Companion contracts: [API](./api-spec.md), [UI](./ui-spec.md), [tests](./tests.md), [reviewer](./reviewer.md), [AI use](./ai-use.md).

## 1. Sprint Goal

Give existing Requesters secure accounts and continuity of their Tickets and Attachments, give IT Staff a shared queue and controlled operational workflow, and give Administrators simple account management, with demonstrable authorization and release evidence.

## 2. Stakeholder Request

Replace the testing selector with email/password authentication and mandatory replacement of issued passwords. Preserve submitted requests while adding assignment, independent IT Priority, status transitions, public conversation, and private notes. Account administration remains small and role boundaries remain enforced by the server.

## 3. Scope

Included: authentication and session lifecycle; data-preserving migration and local bootstrap; authenticated Lab 2 flows; queue/detail; owner, priority and status operations; requester resolution indication; append-only comments/notes; user create/edit/deactivate/reset; responsive Zen Green UI; tests and submission evidence.

Excluded: email delivery/invitations/reset links, MFA, social login, SSO, self-registration, multiple roles, user deletion, bulk/import/export, profile extensions, account history/unlock/approval workflows, Actions Taken, resolution-summary editing, SLA/escalation/notifications, analytics beyond queue totals, production infrastructure, and entry edit/delete. No old identity compatibility path survives migration.

## 4. Functional Requirements

| ID | Required behavior | Acceptance |
| --- | --- | --- |
| FR-01 | Authenticate active users and reject unsafe login attempts consistently. | AC-01, AC-02 |
| FR-02 | Enforce initial-password replacement and authenticated session lifecycle. | AC-03, AC-04, AC-05 |
| FR-03 | Show current identity, permitted navigation, and protected routes; clear identity-specific caches. | AC-06 |
| FR-04 | Preserve existing identities, submitted Tickets, Attachments and reference data through migration. | AC-07 |
| FR-05 | Supply repeatable local bootstrap and non-destructive example seeds. | AC-08 |
| FR-06 | Preserve authenticated Requester creation, discovery, detail and Attachment lifecycle. | AC-09, AC-10, AC-11 |
| FR-07 | Enforce the full authorization matrix and safe resource boundaries. | AC-12 |
| FR-08 | Provide strict shared queue queries and operational detail. | AC-13, AC-14 |
| FR-09 | Claim, assign, unassign and independently set IT Priority with conflict detection. | AC-15, AC-16 |
| FR-10 | Apply explicit status transitions and requester apparent-resolution indication. | AC-17, AC-18 |
| FR-11 | Provide public conversation and separate private notes. | AC-19, AC-20 |
| FR-12 | List/search users and create one-role accounts. | AC-21, AC-22 |
| FR-13 | Edit account access and reset credentials with transactional safeguards. | AC-23, AC-24 |
| FR-14 | Deliver accessible responsive screens and meaningful recovery states. | AC-25, AC-26 |
| FR-15 | Maintain synchronized contracts, test traceability and truthful release evidence. | AC-27, AC-28 |

## 5. Business Rules

- **BR-01:** Only active users with valid credentials authenticate; invalid, unknown and inactive accounts share one failure message.
- **BR-02:** A password-change-required session accesses only current user, password change and logout.
- **BR-03:** Authenticated identity determines submitted ownership; client identity overrides are rejected.
- **BR-04:** Public Comments are visible to the owning Requester, IT Staff and Administrator; Internal Notes only to IT Staff and Administrator.
- **BR-05:** Requester indication never changes formal status; only IT Staff formally progress Tickets under the matrix below.
- **BR-06:** Each User has exactly one role and normalized unique email. Accounts are deactivated, never deleted.
- **BR-07:** Passwords contain 15–128 Unicode code points, without trimming, normalization or composition requirements. Spaces and paste work. Replacement differs from the current password. Use Argon2id, independent random salts, memory at least 19 MiB, iterations at least two, parallelism one; verify runtime/package support in #50.
- **BR-08:** Opaque sessions and CSRF follow the API contract. Normal lifetime is 30 minutes idle/eight hours absolute; restricted lifetime is 15 minutes absolute. Login and password change rotate session identity. Logout revokes it.
- **BR-09:** Role change, deactivation and password replacement/reset revoke all existing sessions. Name/email-only edits retain sessions and are reflected by current-user retrieval. Reactivation does not revive revoked sessions. Every protected request checks current User state.
- **BR-10:** Five failed attempts per normalized account and 30 per IP in a rolling 15-minute window cause throttling, with no permanent lock. See API rules for exact boundary behavior.
- **BR-11:** Preserve Ticket numbers, dates, requested priorities, ownership and reference relationships. New IT Priority copies Requested Priority; subsequent changes are independent.
- **BR-12:** One nullable primary owner is allowed: an active IT Staff or Administrator. Eligibility grants no extra operation permissions. Claim requires unassigned state. Reassignment and unassignment do not change status.
- **BR-13:** Owner/priority/status changes use atomic version checks. Stale updates conflict without partial writes. Any IT Staff may operate a Ticket, regardless of assignment.
- **BR-14:** Resolved, Closed and Cancelled are terminal for owner/priority mutations and new requester indications. Only Resolved can leave that set, through Reopened. Closed and Cancelled have no outgoing transitions.
- **BR-15:** Entering In Progress or Resolved requires an active eligible owner. Resolved, Closed and Cancelled require explicit confirmation. Actions Taken do not gate resolution.
- **BR-16:** An owning Requester may indicate apparent resolution on a nonterminal Ticket. Record backend actor/time; repetition preserves them without another write. Reopening clears the indication.
- **BR-17:** Comments and notes are append-only, backend-attributed, trimmed to 1–5,000 Unicode code points and rendered as escaped plain text with line breaks. Order by creation time then ID ascending. Reads work on all statuses; Closed/Cancelled reject new entries. Posting does not change status.
- **BR-18:** Losing owner eligibility atomically unassigns nonterminal Tickets and advances their version/time. Terminal assignments remain historical and visibly inactive/ineligible. Submitted ownership and historical authorship never move when a role changes. A former Requester regains access to their original submissions if restored to Requester.
- **BR-19:** User name is trimmed, 1–100 Unicode code points; email is trimmed, lowercase, syntactically validated, at most 254 characters. Initial passwords follow BR-07. Never return or redisplay submitted credentials.
- **BR-20:** Block self-deactivation and any demotion/deactivation that removes the last active Administrator, including concurrent requests. Self-demotion is permitted only with another active Administrator and ends existing access immediately.
- **BR-21:** Preserve Lab 2 summary (5–120), description (20–4,000) and removal-reason (3–500) trimmed JavaScript string-length limits. Attachments allow JPEG/PNG/WEBP/PDF with signature validation, at most 5 × 1024 × 1024 bytes each and five active per Ticket. Requester upload/removal remains permitted on all statuses under these rules.
- **BR-22:** Preserve atomic creation, opaque non-public file storage, compensation on failed writes, serialized active-file limits, retained removal metadata and blocked removed downloads. Preserve Lab 2 My Tickets query defaults separately from the queue.
- **BR-23:** Errors are safe and role/ownership checks precede protected resource disclosure. No note content, field, count or note-derived timestamp leaks into Requester responses or caches.
- **BR-24:** Seeds insert missing fixtures only; reruns do not reset credentials, reactivate edited users, overwrite Tickets or restore removed Attachments. Bootstrap fills only missing credentials after explicit local invocation.
- **BR-25:** Required tests and evidence must be actual and traceable. Agent review does not constitute student or peer approval.

### Authorization matrix

All Yes cells require active, unrestricted authentication. “Own” means submitted requesterId equals the session User ID, not the primary Ticket Owner.

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Current user, own password, logout | Yes (also restricted) | Yes (also restricted) | Yes (also restricted) |
| Active reference data | Yes | Yes | Yes |
| Create Ticket / My Tickets | Own | No | No |
| Ticket detail / Attachment metadata and active content | Own | All | All, read-only |
| Upload/remove Attachment | Own, BR-21 | No | No |
| Shared queue / eligible-owner list | No | Yes | Read-only |
| Claim/reassign/unassign / IT Priority / formal status | No | Yes | No |
| Read Public Comments | Own | All | All |
| Post Public Comments | Own | All | No |
| Read Internal Notes | No | All | All |
| Create Internal Notes | No | All | No |
| Indicate apparent resolution | Own | No | No |
| List/get/create/edit users / reset initial password | No | No | Yes |

### Status-transition matrix

Wire values and visible labels are identical, including spaces. All other edges, including self-transitions, are rejected.

| Current               | Allowed next for IT Staff                     |
| --------------------- | --------------------------------------------- |
| New                   | Open, Cancelled                               |
| Open                  | In Progress, Waiting for Requester, Cancelled |
| In Progress           | Waiting for Requester, Resolved, Cancelled    |
| Waiting for Requester | In Progress, Resolved, Cancelled              |
| Resolved              | Closed, Reopened                              |
| Reopened              | Open, In Progress, Cancelled                  |
| Closed                | None                                          |
| Cancelled             | None                                          |

## 6. UI Specification Summary

[ui-spec.md](./ui-spec.md) fixes Login, mandatory/optional Change Password, role-aware shell, preserved Requester screens, queue, operational/read-only detail and user list/create/edit/reset modes. Reuse existing tokens/primitives, distinguish public/private composers and editable/read-only fields, preserve drafts after recoverable failures, and cover desktop/tablet/mobile with keyboard access and visible feedback.

## 7. Data Changes

| Concept | Target fields and integrity |
| --- | --- |
| User | Rename/evolve DevelopmentRequester preserving integer ID, displayName, email, isActive, createdAt, updatedAt. Add role enum Requester/ITStaff/Administrator (wire IT Staff), nullable passwordHash for unbootstrapped accounts, mustChangePassword boolean default true. Unique normalized email; index isActive/displayName. |
| Session | ID; unique tokenHash; User FK; CSRF secret; createdAt, lastSeenAt, absoluteExpiresAt; restricted boolean. SHA-256 of 32 random token bytes only; index User and expiry. Revocation deletes rows. Never return hashes/secrets. |
| LoginAttempt | Normalized-account or IP key, failedAt; indexed key/time; expiry cleanup. Counters must be shared/atomic across requests. No passwords or session tokens. |
| Ticket | Existing fields retained; add itPriority enum, ownerId nullable User FK, version integer default 1, resolutionIndicatedAt/byUserId nullable pair, statusChangedAt, resolvedAt, closedAt, reopenedAt, cancelledAt nullable UTC timestamps. Initial statusChangedAt = ticketDate; others null. Index updatedAt/id, ownerId, currentStatus, itPriority and queue relationship filters. |
| Attachment | Preserve IDs, bytes, storageKey and removal metadata. Rename removedByRequesterId to removedByUserId, keeping the User FK values; retain requesterId on Ticket as submitted ownership. |
| PublicComment / InternalNote | Separate tables: integer ID, Ticket FK, authorId User FK, content text, createdAt default backend time. Index ticketId/createdAt/id. Restrictive historical FKs; no cascade deletion of domain records. |

Status writes update statusChangedAt and the destination-specific timestamp when applicable; resolvedAt/reopenedAt record the latest occurrence. Reopening clears current resolvedAt and the requester indication; closedAt/cancelledAt stay null until entered. Public Ticket mutations advance updatedAt/version; Internal Note creation changes only its separate table, preventing note-derived metadata leakage and unrelated Ticket conflicts. Public Comments and Attachment changes advance Ticket version/time atomically. Idempotent indication repeat does neither.

Seed identity is persisted as nullable unique `seedKey` text on User, Category, RelatedSystem, Ticket, PublicComment and InternalNote; normal application writes never accept or change it. Keys are fixed source-controlled names such as `lab3:user:staff-1` and `lab3:ticket:waiting-example`, independent of editable fields. The initial migration tags only known Lab 2 canonical reference/requester fixtures matched by exact original unique name/email; unmatched rows remain untagged. Thereafter seed lookup uses seedKey only, and a missing key colliding with an existing unique email/name aborts for operator resolution. Keys remain on edited/inactive rows, so reruns skip them. Lab 3 seeds create no Attachment fixtures; removal records/content are therefore never recreated by seeds. Tests create files in disposable storage.

Migration sequence (implemented in #50/#51 and owning feature slices):

1. Run preflight against populated Lab 2 data: report IDs and normalized-email collision groups, invalid emails/names, missing relationships or missing active Attachment content. Abort before mutation; an operator resolves collisions explicitly, never merge accounts silently.
2. Back up the development database and Attachment directory before actual upgrade. In disposable regression fixtures, snapshot IDs, values and file hashes instead. Do not use reset commands against existing data.
3. Apply reviewed Prisma SQL that renames/evolves identities and removal attribution, preserves IDs/sequences/FKs and all preexisting timestamps, normalizes emails, assigns Requester role, and leaves credentials null. No plaintext credential in SQL. Add session storage and later workflow/entry schema in the owning slices; copy requestedPriority into non-null itPriority before enforcing the constraint. Existing Tickets remain New, unassigned, version 1.
4. Run explicit local bootstrap for credential-less accounts. Planned command: `pnpm --filter @toktickit/server db:bootstrap -- --email <email>`. Hidden terminal entry and confirmation supply an initial password; command arguments, logs and output never contain it. Conditional update only where passwordHash is null; repeats report skipped and retain credentials/account state. Inactive users can receive credentials but cannot log in. Deliver locally in person through the lab operator; no email service.
5. Seed missing demo accounts/reference records and examples using stable fixture keys and insert-only transactions. Existing four active/one inactive Requesters are retained; add three active/one inactive IT Staff and one active Administrator. Store a stable seed identity separate from mutable email so editing a seeded account does not recreate it. On fixture-key/email collision, abort/report instead of adopting an unrelated account. No minimum-count repair may reactivate edited rows.
6. Bootstrap new fixture credentials through the same local procedure. Document fixture emails and local-only issuance instructions in README when implemented. Insert at least one realistic Ticket per status, all four priorities, assigned/unassigned examples, eligible owners, safe public/private entries. Reruns preserve all user changes; deterministic fixture keys prevent duplicates. No Attachment fixture may recreate removed content.
7. Verify deploy rerun is a no-op, bootstrap/seed reruns preserve edits, and all recorded data/hashes survive. Remove selector, Change Requester, browser selection storage, old endpoint, header middleware and generated identity APIs in #50. Clear the obsolete browser key; never use it as identity.

## 8. API Contract

[api-spec.md](./api-spec.md) defines exact routes, fields, query defaults, safe errors, cookies, CSRF and concurrency. Preserve Express routes/controllers → framework-independent services → Prisma repositories and PostgreSQL; keep generated OpenAPI SDK/TanStack Query and React primitives. Each feature updates `server/openapi.yaml`, regenerates the client, and proves observable HTTP behavior. #49 does not advertise unimplemented endpoints in executable OpenAPI.

## 9. Acceptance Criteria

| ID | Observable completion criterion |
| --- | --- |
| AC-01 | Valid active login creates a rotated session and returns safe user state; unknown/invalid/inactive login returns the same safe failure. |
| AC-02 | Account/IP attempt boundaries throttle concurrently with 429 and retry guidance, then recover after the window. |
| AC-03 | Initial sessions cannot reach normal data; valid matching replacement obeys inclusive Unicode limits, rejects current-password reuse and rotates/revokes sessions. |
| AC-04 | Missing, idle-expired, absolute-expired, restricted-expired, logged-out and revoked sessions cannot be replayed. Cookie flags and server hash-only token storage match contract. |
| AC-05 | Disallowed origins and absent/wrong CSRF tokens fail, including multipart mutations; same-origin approved flows work. |
| AC-06 | Each role sees its name, role and only allowed navigation; direct protected URLs and identity changes clear cached data, including private notes. |
| AC-07 | Populated Lab 2 upgrade preserves identities, Tickets, active/removed Attachment records, attribution, bytes and reference data; normalization collisions abort without partial changes. |
| AC-08 | Required demo fixtures and explicit bootstrap work repeatedly without overwriting edited accounts, passwords, Tickets or removed Attachments. |
| AC-09 | Authenticated Requester creates a validated Ticket with existing defaults/files; spoofed identity fails and recoverable errors retain input. |
| AC-10 | My Tickets retains owned search/filter/sort/pagination and empty/no-results/retry behavior, with expanded status filtering. |
| AC-11 | Owned Detail and Attachment upload/download/removal retain Lab 2 limits, safe cleanup, concurrency and retained history on every status. |
| AC-12 | Every role × operation boundary is enforced directly; cross-Requester resources are hidden and Requester responses contain no note-derived information. |
| AC-13 | Queue search, each filter, business-severity sorting, tie-breaks, defaults, page metadata and strict malformed/repeated/unknown query rejection match API contract. |
| AC-14 | Staff/Admin can open all Tickets and active files with submitted fields read-only; Admin detail exposes no mutation powers. |
| AC-15 | Claim/reassign/unassign requires eligible owners and version checks; simultaneous claims have one winner; terminal changes fail without changing status. |
| AC-16 | IT Priority changes independently, rejects stale/terminal/unauthorized writes, and never overwrites Requested Priority. |
| AC-17 | Every allowed/forbidden status edge, required owner, confirmation and stale version is enforced atomically with correct timestamps. |
| AC-18 | Own nonterminal indication records backend actor/time once, leaves formal status intact, repeats idempotently and clears on reopening. |
| AC-19 | Public entries enforce role/ownership, attribution, 1–5,000 code-point bounds, plain-text rendering, stable order and Closed/Cancelled denial without changing status. |
| AC-20 | Private notes enforce separate staff-write/admin-read capabilities; no note data/metadata leaks through public responses or stale caches. |
| AC-21 | Administrator list displays Name/Email/Role/Status/Edit, searches name/email and supports one optional role filter with safe states. |
| AC-22 | Administrator creates exactly one-role accounts, rejects normalized duplicates concurrently, never returns secrets, and newly issued credentials require change. |
| AC-23 | Editing/reset enforces uniqueness, self-deactivation and concurrent last-admin safety; role/reset/deactivation revoke sessions and reset requires change. |
| AC-24 | Eligibility loss unassigns nonterminal work atomically, retains labeled terminal history, and preserves submitted ownership/authors. |
| AC-25 | All screen modes expose meaningful loading/saving/validation/success/conflict/retry/access failures with preserved recoverable drafts and duplicate-submit prevention. |
| AC-26 | Major screens meet Zen Green, keyboard/accessible-name/focus/non-color feedback and three-viewport rules without clipping, overlap or horizontal overflow. |
| AC-27 | All ACs map to planned tests before features; owning slices synchronize contracts/OpenAPI/client and retain both Lab 2 and Lab 3 discovery. |
| AC-28 | Reviewed feature-to-staging-to-main flow, final-main checks, accurate Kanban, real review/AI records and one standalone nine-part PDF satisfy the Definition of Done. |

## 10. Definition of Done

The contract may be prepared under #49 while external approval remains pending. Feature implementation starts after the contract is reviewed/approved; product completion requires every item below.

- Approved numbered contracts and every AC evidenced by actual tests; no claimed result for a planned test.
- Data-preserving upgrade and repeatable bootstrap/seeds demonstrated on disposable populated Lab 2 fixtures; old identity paths removed.
- Required application behavior, direct authorization and authenticated Requester regression pass; OpenAPI and generated SDK match implementation.
- Run formatting/lint, types, full tests, OpenAPI check, build and complete browser suite on final `main`; record full commit SHA, UTC run time, commands, totals, environment and log/artifact paths. A later code change invalidates earlier final-main evidence.
- Feature PRs target `lab3-staging`; a reviewed release PR targets `main`. Record actual reviewer identity, comments, responses, approval and merge actor/commit. Do not self-assert peer approval.
- Project statuses are Backlog, Ready, In progress, In review, Done. Ready means specified/unblocked; In progress includes fixes; In review means PR review; Done requires accepted merged work and evidence. Published tickets use `ready-for-agent`; dependency blockers still control execution.
- Keep README setup, local credential issuance, environment examples, `.gitignore`, directory inventory, six living documents, responsive screenshots and completed visual checklist current. Preserve `backup/`.
- Record 6–10 actual selected AI prompts and the student's own “My Reflection”; do not invent either.
- Submit exactly one concise PDF, with `Answer Part 1:` through `Answer Part 9:` in order. Keep workflow links in Part 1, including an index to supporting contracts; Parts 2–9 must stand alone as prose/rendered evidence with numbered figures and descriptive captions. Links must work but cannot substitute for readable evidence.

| PDF part | Required content |
| --- | --- |
| 1 | Branch/merge history through final main, Done Kanban, rendered reviewer record, README, .gitignore, directory structure and working evidence links. |
| 2 | Rendered specification with FR/BR/AC, authorization, migration, DoD and proof contract predates feature completion. |
| 3 | Planned-to-actual test traceability and complete passing main output, including authorization/regression/E2E. |
| 4 | Named AI tool/model, 6–10 selected prompts and genuine My Reflection. |
| 5 | Login failures/success, inactive handling, password replacement, busy/failure states, identity/role, logout and direct denial. |
| 6 | Realistic queue, queries/pagination, ownership/status/priority, detail navigation and responsive empty/no-results/failure states. |
| 7 | Owner/priority/status, comments/notes, Attachments, indication, validation, failure and direct role-authorization evidence. |
| 8 | Minimal user list/search/filter/create/edit/reset, first-login continuation, duplicates, admin safeguards and responsive failures. |
| 9 | Rendered UI contract, three-viewport major-screen captures and completed visual/accessibility checklist. |

## 11. Assumptions and Decisions

The issue's proposed numeric authentication limits are adopted as the contract. Owner eligibility includes Administrators while mutation permission remains IT Staff only. This resolves the labsheet's optional administrative ticket powers using the explicit parent matrix. Preserve My Tickets page sizes 10/25/50; queue uses 10/20/50. Attachment mutation retains Lab 2 status-independent rules, while comments/notes close on Closed/Cancelled. Local bootstrap avoids committed real credentials. Authentication library selection is deferred to #50's runtime/type check; the security behavior is fixed here.

Delivery slices: #49 contract; #50 authentication/migration/Requester continuity; #51 queue/detail; #52 owner/priority; #53 status/indication; #54 comments; #55 notes; #56 user list/create; #57 edit/reset; #58 integrated evidence. Use `feature/<issue>-<description>` from current `lab3-staging`, reviewed back into staging, then release to main. #52–55 depend on #51; #56 depends on #50; #57 depends on #56 and #51; #58 depends on completed operational/admin slices. External approval and final submission remain explicit gates in [reviewer.md](./reviewer.md).
