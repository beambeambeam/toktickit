# Lab 4 UI Contract

Status: approved UI behavior for Issues #74–#79. Reuse the existing React/TanStack Router, TanStack Query, app shell, Zen Green surfaces, form fields, buttons, badges, error feedback, and authentication context. This file defines visible behavior; API authorization remains authoritative.

## 1. Navigation and Landing

- Add a Dashboard link for each authenticated role. A Requester’s signed-in landing is Dashboard; IT Staff and Administrators also land on Dashboard.
- Keep the existing Requester links to My Tickets and Create Ticket; keep IT Staff/Admin links to Ticket Queue; keep Administrator User Management.
- Add a My Actions destination for IT Staff and Administrators. It opens the paginated list for the signed-in account.
- Dashboard, My Actions, Ticket Queue, My Tickets, Ticket Detail, and User Management show a visible active navigation state. Do not show Requester-only create controls in a staff/Admin workspace.
- Suggested routes are /dashboard, /staff/actions, /tickets, /staff/tickets, /tickets/:ticketId, and /users. Apply role guards at the route and server API. A direct URL must show the existing safe Access Denied or sign-in state.
- Cache keys include account identity and role. Clear account-specific dashboards and action data on logout/account change; never flash one user’s cached data to another user.

## 2. Requester Dashboard

Show four compact metric cards:

1. Active Tickets.
2. Waiting for You.
3. Recently Updated.
4. Recently Resolved.

Each card displays its label, numeric value including zero, and an accessible link to My Tickets using the exact scope returned by the API. Recently Updated and Recently Resolved links retain the dashboard’s generated UTC from/through bounds. The preview lists show at most five compact Ticket rows and link to Ticket Detail. Recently Updated sorts updatedAt descending; Recently Resolved sorts resolvedAt descending; both use Ticket ID descending for ties.

The dashboard contains no copy of the full My Tickets table and no private-note snippets or requester-id filter. A zero count remains visible as 0. An empty preview has a short, named empty state with a link to My Tickets. Show the time window and visible Asia/Bangkok timezone for displayed dates. Refreshing the dashboard obtains one new generatedAt and replaces its links and previews together.

## 3. IT Staff and Administrator Dashboard

Show:

- Active Unassigned and Active Owned counts.
- A count for each of the eight Ticket statuses.
- Active Ticket counts for Low, Medium, High, and Urgent IT Priority.
- My Actions count and a preview of at most five assigned Planned/In Progress actions on active Tickets.
- Recently Updated and Urgent active Ticket previews, each capped at five rows.

All count cards link to the shared Ticket Queue with exact scope/currentStatus/priority/owner filters. My Actions links to the full paginated /staff/actions list. Preview rows link to the correct Ticket detail and, for My Actions, to the matching Action within that Ticket. Do not add fabricated trend percentages, SLA clocks, account metrics, or Create Ticket buttons.

The dashboard handles loading, refresh, zero values, empty previews, forbidden access, session expiry, and recoverable API failure as separate states. Failure feedback offers retry; it does not display stale counts as if current. Requester and staff endpoints do not fall back to one another.

## 4. Ticket Detail and Actions Taken

Keep Ticket summary, status, ownership, Attachments, Public Comments, and staff-only Internal Notes in their existing sections. Add an Actions Taken section to both Requester and IT Staff/Admin Ticket Detail.

### Shared read view

- Show action creation date/time, status, Action Description, Result, assigned staff member, Performed by, Follow-Up Required, Follow-up Note when required, and Attachment Notes when present.
- Display backend-created time in Asia/Bangkok and label the timezone. Show a clear empty state when the Ticket has no Actions Taken.
- Sort by createdAt ascending then Action ID ascending. Paginate without reordering. A longer history shows its page controls and total count.
- Display staff account ineligibility without erasing historical attribution. Plain-text fields preserve line breaks and are rendered as escaped text; do not render HTML or imply Attachment Notes create a file.
- A concise action history view shows each create/edit/start/complete/cancel event in createdAt/ID order, with actor and event time. Ticket status history shows every transition in the same stable order.

### Requester view

Requesters may read all action and history fields on their own Ticket. The section is read-only and has no create, edit, assign, transition, or delete controls. Ticket, action, status, comments, and attachment visibility continue to follow ownership rules. Internal Notes and any fields derived from them are never shown.

### Staff/Admin create mode

Show an Add Action Taken button only when the Ticket is not Resolved, Closed, or Cancelled. The form includes Description, Result, Assignee, Follow-Up Required, conditional Follow-up Note, and Attachment Notes. Default Assignee to the current user. Assignee options include only active eligible IT Staff and Administrators. Keep action creation time, creator, Performed by, status, and version out of editable controls.

Trim fields using server validation rules. Show field errors beside their fields and focus the first invalid field on submit. Follow-Up Note appears and becomes required when Follow-Up Required is checked; clearing the flag clears the note. Disable repeat submission while the request is in flight. On uncertain failure, retain the request ID and draft for safe retry. A deliberate new action receives a new request ID. On success, show the saved Planned action and refreshed Ticket metadata.

### Staff/Admin edit mode

Planned and In Progress actions expose Edit and Assign controls to eligible staff/Admin. Edit mode changes only Description, Result, Assignee, Follow-Up Required, Follow-up Note, and Attachment Notes. Save and Cancel are explicit. Do not provide an action delete control. Completed/Cancelled actions display history only.

On 409 version conflict, preserve the draft, identify that the saved record changed, and offer Refresh and Review. Refresh updates the saved values but does not silently submit the old draft. If a former assignee is inactive/ineligible, show the historical identity as the current value and list only active eligible users as new choices. Other pending fields may still be edited while retaining that identity, but require an eligible reassignment before starting/completing. Do not change Ticket Owner during reassignment.

### Action lifecycle controls

Show only permitted action transitions. Planned offers Start and Cancel; In Progress offers Complete and Cancel. Complete and Cancel require a keyboard-accessible confirmation dialog that explains the action becomes terminal and immutable. Completion requires a nonblank Result and Follow-Up Required=false. If follow-up remains, explain that it must be completed or corrected before the action can be completed. Confirmation or validation failure leaves the action and Ticket unchanged.

## 5. Ticket Workflow

Status controls show only the allowed next statuses from specification.md BR-09. Requesters never receive staff status controls. Staff and Administrators see the same operational controls, including owner, IT Priority, status, Public Comments, and Internal Notes. Requester creation and Attachment writes remain Requester-only.

Require a current Ticket version on staff status/owner/priority mutations. Confirm Resolved, Closed, and Cancelled through the existing AlertDialog pattern; cancellation first explains that all Planned/In Progress actions must be completed or cancelled. Display disabled or explanatory resolution feedback when there is no completed action, pending actions remain, follow-up remains, or no eligible owner exists. The server still checks all gates. After success, refetch Ticket detail, status history, action data, dashboards, and affected queues.

The Requester resolution indication stays an advisory action on the own-Ticket page. Its copy states that IT Staff must review and resolve the Ticket. It never changes the status badge. On reopen, remove the current indication from the summary and display its status event in history.

## 6. Lists and Drill-Down

- My Tickets cards and filters retain existing search, category, system, priority, status, sorting, and pagination. Add the documented scope and UTC bounds needed for dashboard parity.
- Ticket Queue uses the same exact staff scope predicates as dashboard cards, existing owner/status/priority filters, and server pagination.
- My Actions lists only the current user’s assigned pending actions on active Tickets. Each row shows action summary/status, parent Ticket number/summary/status, assignment and update time; opening a row focuses the action on Ticket Detail.
- Changing or combining filters resets the page to one. Empty filter results show a no-matches state and a way to clear filters.

## 7. Feedback and Accessibility

- Use semantic headings, table headers on wide action/queue layouts, and stacked labeled action cards on narrow screens. Keep field labels visible; placeholder text is not a label.
- Keep status and priority text labels with badges; color is supplementary. Public/Requester-visible Actions Taken and staff-only Internal Notes are labeled distinctly.
- Announce async success/error through an appropriate live region. Use role=alert for blocking failure, validation beside its field, and visible loading status. Preserve drafts for retryable errors.
- All links/buttons work by keyboard; focus is visible and returns sensibly after a dialog closes. Confirmation dialogs trap focus, have an accessible name, explain the action, and support Escape/cancel. Do not move focus unexpectedly after a refresh.
- Maintain readable contrast and text resizing. Long action text, names, Ticket numbers, and dates wrap without overlapping controls. Do not use color alone for state or error.

## 8. Responsive and Visual Checks

Verify affected Requester dashboard, staff/Admin dashboard, Ticket Detail with zero/one/multiple actions, create/edit forms, lifecycle dialogs/history, My Tickets filters, Ticket Queue filters, and My Actions at:

| View                | Viewport       |
| ------------------- | -------------- |
| Desktop             | 1440 × 900     |
| Tablet              | 768 × 1024     |
| Mobile              | 390 × 844      |
| Minimum-width check | 320 CSS pixels |
| Zoom check          | 200%           |

Use one column for dashboard cards on narrow screens and a readable multi-column grid on wide screens. Allow action tables to become stacked cards before they force page-wide horizontal scrolling. Check clipping, overlap, long strings, focus order, visible active navigation, empty/error states, dialogs, color contrast, and the separation between shared actions and private notes. No page-level horizontal overflow is allowed.

Run axe/automated accessibility checks on the major new screens and inspect representative desktop/tablet/mobile screenshots. These visual, responsive, and accessibility checks are owned by the action or dashboard/workflow issue that changes each screen; they are not deferred to a separate hardening ticket. Record actual results under the matching test IDs in tests.md.

## 9. Feature Completion Checklist

The issue implementing a screen also owns its verification:

- API and OpenAPI behavior matches api-spec.md; generated client is synchronized.
- Authorized and forbidden roles, ownership, empty/loading/error/conflict states, and cache isolation are verified.
- Forms preserve drafts, prevent duplicate in-flight writes, and show validation in context.
- Relevant unit, API/integration, UI, regression, and E2E checks pass inside the owning feature issue. Issues #74–#79 own the full earlier-lab suite checkpoint recorded by REG-03 in tests.md.
- Affected screen is checked at desktop, tablet, mobile, 320px minimum width, and 200% zoom with keyboard, axe, and visual inspection as applicable.
- tests.md records truthful outcomes and known unavailable integration coverage. No screenshot, test, or acceptance status is marked complete before verification runs.
