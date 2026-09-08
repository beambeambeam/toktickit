# Lab 3 UI Contract — Zen Green

Status: planned under #49. No Lab 3 screenshots or visual pass claimed. [Specification](./specification.md) fixes permissions; [API](./api-spec.md) fixes fields/errors.

## 1. Reference interpretation

The local labsheet and four figures were inspected while preparing this contract. References are identified by section/page because `reports/` is ignored; they are source material, not implementation screenshots.

| Source | Retained direction | Explicit contract adaptation |
| --- | --- | --- |
| §8.1, p.8, Lab_3_sheet_8.png | Green branded header, compact login/change-password cards, labels, inline error, full-width submit. | Use 15–128 code points with spaces/paste and no composition rule; omit image's eight-character rule and forgot-password link. Local Administrator reset is the recovery route. |
| §8.3, p.9, Lab_3_sheet_9.png | Search/filter toolbar, readable rows, labeled badges, numbered pages, detail links. | Shared Ticket Queue label; six primary columns; no staff Create Ticket, Pending status or uncontracted sort fields. |
| §8.4, p.10, Lab_3_sheet_10.png | Grouped Ticket information, owner/priority controls, separate public/private sections and Attachment continuity. | Submitted Category and other fields remain read-only; no Resolution Summary, Service Actions, edit/delete entry menus or note counts visible to Requesters. |
| §8.5, p.12, Lab_3_sheet_12.png | User list with adjacent create/edit form, role/status badges, save/cancel hierarchy. | Include Email and Edit columns; use Administrator-entered initial password, no reset-email checkbox, list pagination or multi-column sorting. |
| Lab 2 §§12.5–12.6, pp.10/2 | My Tickets, read-only Detail, Attachment actions and responsive layout. | Authenticated identity replaces selection; add public conversation and apparent-resolution action. |

## 2. Shared design and navigation

Reuse `client/src/styles.css`, AppShell, FormField, StatusBadge, AttachmentPicker and existing class utilities/query patterns. Tokens: primary #006B3C, secondary #0B7A46, pale #EAF6EF, page #F5F7F6, surface #FFFFFF, border #D8E3DD, text #183128, muted #5F7169, error #9A2F2F, error background #FFF5F5, warning #8A5A00/#FFF8E8, success #166534. Reuse system sans-serif, 4/8px spacing rhythm, 44px minimum controls, 8px control radii and existing focus treatment. Avoid new animations, gradients or decorative effects.

Primary actions are green; secondary Back/Cancel neutral; Clear Filters text; destructive deactivate/reset/terminal confirmations clearly labeled. Busy and disabled are non-activatable and have text feedback. Required editable fields have associated labels, red asterisk and text explanation. Read-only values use labeled static/quiet surfaces; do not present disabled editable controls as the only representation. Each role/priority/status badge contains readable text and a non-color marker; show all eight statuses and four priorities consistently. Owner displays Unassigned or name, with inactive/ineligible annotation on historical terminal assignment.

| Identity | Navigation / landing |
| --- | --- |
| Anonymous | `/login`; protected URLs redirect there with a safe message. |
| Restricted | `/change-password`, name/role and Logout only; any normal route redirects to mandatory change. |
| Requester | `/tickets` My Tickets, `/create` Create Ticket, own `/tickets/:ticketId`, Change Password, Logout. |
| IT Staff | `/staff/tickets` Ticket Queue, shared `/tickets/:ticketId`, Change Password, Logout. |
| Administrator | `/users` User Management, `/staff/tickets` read-only Tickets, shared detail, Change Password, Logout. |

`/` resolves to permitted landing after current-user retrieval. An authenticated forbidden route shows Access denied with permitted Back/Home action; hidden navigation does not replace API guards. During identity loading show a neutral shell, never previous-user content. Cancel in-flight queries and clear all user-specific cache/drafts on logout, identity change, expired/revoked authentication or role loss; also clear obsolete selector storage. Refetch current-user state on window focus/navigation and after account changes. On 401, remove protected content and sign in; on password-required 403 use mandatory change; on role 403 remove the affected cached data and show denial. No session/CSRF credential in browser storage. Header user display uses name and role; no extended profile workflow.

## 3. Screen modes

| Screen / mode | Controls and observable result |
| --- | --- |
| Login | Email/password, accessible show/hide password toggle, Sign in. Client required/format validation; retain email after failure; generic credential/inactive message; 429 retry countdown from Retry-After; busy and network retry feedback. Success chooses mandatory change or role landing. |
| Change Password: mandatory / voluntary edit | Current password, new password, confirmation, exact password guidance, Save/Continue. Allow spaces/paste/password manager autocomplete. Mismatch, bounds, current-password error and reuse error sit beside fields. Busy prevents duplicates. Success clears secrets and replaces session/cache. Mandatory mode has Logout, no bypass/cancel into application; voluntary mode may Cancel to landing. |
| Create Ticket: create / success | Preserve Lab 2 reference data, requested priority, summary, description, file picker and rules. Show authenticated Requester read-only. Failed reference loads block submission with retry; preserve valid text/files on recoverable save failure. Success shows backend Ticket Number and View Ticket/My Tickets actions. |
| My Tickets: list | Preserve search over number/summary/description, documented filters/sorts and 10/25/50 pages. Expanded statuses. Numbered navigation/current page, draft-aware Clear Filters, Create Ticket. Distinct no Tickets, no matches, loading and retry. |
| Requester Detail: view | Read-only submitted and operational information, active/removed files and permitted upload/download/removal, public conversation/composer, Problem Appears Resolved on nonterminal status. After indication show recorded time and explanation that staff formally resolve. Hide note section/count/composer entirely. |
| Queue: list | Search, all API filters, four sorts, direction, 10/20/50 pages (20 default), numbered pagination, totals and clear filters. Primary columns: Ticket Number, Summary, Current Status, IT Priority, Ticket Owner, Last Updated. Keep Category/Requested Priority/Created Date in detail/secondary presentation to maintain scan width. Owner filters include me/unassigned/eligible user. |
| Staff Detail: view / operational edit | Submitted values read-only. Separate Claim, owner select + Save, IT Priority + Save, next-status select + Apply; show only allowed next edges. Show requester indication, author/time. Resolved/Closed/Cancelled confirmation names action and consequence; no Actions Taken gate. Refresh/reselect after 409; never silently overwrite. |
| Administrator Detail: read-only | Same Ticket information, active downloads, public/private read sections; no claim, assignment, priority, status, comment/note composer, Attachment writes or requester indication action. |
| User Management: list | Name, Email, Role, Status, Edit; search name/email and one optional role filter; Create User. No mandatory pagination or advanced profile controls. |
| User Management: create | Required name/email/one role/activation/initial password. Exact API validation; safe duplicate-email feedback; save/cancel. Success refreshes list and clears password without redisplaying it. |
| User Management: edit / reset | Edit name/email/role/activation; separate confirmed Set new initial password. Show self-deactivation and last-admin denial without losing other form values. Reset explanation says all sessions end and next login requires replacement. Successful self-demotion/reset clears access and returns to login. |

Public Comments and Internal Notes use separate labeled sections and separate drafts/actions (“Post Public Comment”, “Add Internal Note”). Private section explicitly says “Visible only to IT Staff and Administrators” with icon plus text and distinct quiet surface. Render escaped plain text with line breaks, backend author/time and deterministic ordering. Never share a composer with a hidden visibility switch. Closed/Cancelled show conversation read-only explanation; Resolved still permits entries. Do not retry posts automatically; keep draft after recoverable failure and refetch before user retries uncertain submissions.

Attachment confirmation retains the Lab 2 3–500-unit reason and states that metadata remains. Active, Uploading, Invalid, Removed and Unavailable states show filename/type/size/time with wrap-safe actions. Removed content has no download. These rules remain on all statuses. Terminal owner/priority/indication controls explain the restriction; Resolved offers both Close (with confirmation) and Reopen to staff; Closed/Cancelled offer no transitions.

## 4. Feedback and access states

Loading has meaningful text/status region; saving disables only affected controls and prevents duplicate in-flight work. Success announces the saved result. Validation focuses first invalid field and uses aria-describedby; preserve safe nonsecret values after failure. Empty describes no data; no-results offers Clear Filters. 403 explains denied capability, 404 uses a neutral unavailable message, 409 requests Refresh, network/500 offers Retry. Failed refetch must not continue presenting stale data as current. Password secrets clear on success, navigation and identity loss; no success toast prints submitted secret.

## 5. Responsive and accessibility contract

Desktop ≥992px: centered multi-column layouts and queue/user tables. Tablet 768–991px: two-column forms when readable, wrapping toolbars; detail text retains width. Mobile <768px: stacked forms, queue/user cards retaining all primary fields, full-width practical actions and collapsed usable navigation. Long summaries, emails, filenames, reasons and pagination wrap. Test 1440×900, 768×1024 and 390×844; also check 320px minimum and 200% zoom. No clipped content, overlap or horizontal document scrolling; hiding overflow is not proof.

Use semantic landmarks/headings, explicit labels, accessible icon names, logical keyboard order, visible focus, non-color status, readable contrast, 44px touch actions and accessible current-page/sort state. Confirmation AlertDialog traps focus, supports Escape/Cancel, restores trigger focus and focuses the safe choice first. Announce loading, errors and successful actions without stealing focus unnecessarily. Password visibility toggle has an accessible state. Inspect text contrast (4.5:1 normal text, 3:1 large text) and controls/focus (3:1) with the final colors. No inaccessible animation is required.

## 6. Screenshot and visual checklist

Capture real implementation evidence under `artifacts/lab-03/screenshots/`; per-viewport manifests record unique file paths, scenario, role, branch/full SHA, UTC capture time, command and whether state was seeded/intercepted or naturally reached. Record comparison in `artifacts/lab-03/visual-checklist.md` when implementation exists. Each row below requires desktop/tablet/mobile captures; split long screens into readable figures rather than unreadable whole-page thumbnails.

| Directory | Required scenarios |
| --- | --- |
| authentication/ | Login initial, invalid/inactive generic failure, busy/API failure, throttled; mandatory password rules/validation/busy/success; authenticated name/role; logout direct-access denial. |
| staff-queue/ | Populated assigned/unassigned data, active query/sort/pagination, loading, empty, no-results, forbidden and retryable failure. |
| staff-ticket-detail/ | Read-only submitted data, claim/reassignment/priority, stale conflict, status confirmation, resolved/reopened/closed, apparent-resolution indication, public composer/entries, separate private composer/entries, active/removed Attachments, admin read-only and forbidden access. |
| user-management/ | List/search/role filter, empty/no-results/loading/failure, create/edit, duplicate/invalid fields, saving/success, reset confirmation and first-login result, self/last-admin denial, non-admin denial. |
| requester/ | Authenticated Create/My Tickets/Detail continuity, public comment, apparent-resolution indication and foreign resource denial; no selector/private-note UI. |

For each screen/viewport record: source figure/section, actual image, tokens/contrast, hierarchy, role navigation, badges, editable/read-only distinction, field-error placement, busy/disabled state, keyboard focus/names, long-text wrapping, clipping/overlap/overflow and verdict. Label DOM/computed-style/HTTP assertions separately from visual judgement. Screenshots cannot prove backend authorization, session invalidation or migration; link those rows to actual tests. No duplicated image under multiple state labels. All checklist verdicts remain pending until captures are inspected.
