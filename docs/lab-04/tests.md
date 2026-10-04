# Lab 4 Test Plan and Traceability

Status: #74 creation and reading are implemented. Recorded #74 results below come from executed checks; unfinished sibling coverage remains “Not run”. The feature issue listed below owns the check, its fixes, and its final result. Contract review belongs to Issue #73. Feature verification is not deferred to a separate hardening ticket.

## 1. Test Strategy

- **Rules/unit:** Exercise field validation, the Action and Ticket transition tables, resolution/cancellation gates, dashboard predicates, interval boundaries, and query-scope mapping without HTTP.
- **API/integration:** Use Supertest against the composed Express app, disposable PostgreSQL fixtures, real sessions/CSRF, and Prisma. Verify stored state, safe errors, roles, ownership, retry, lock/race behavior, and database-backed counts.
- **UI:** Use existing Vitest/React Testing Library patterns. Test visible form/list behavior, validation, loading, empty/error/conflict states, exact filters, focus, and cache isolation.
- **Style/visual:** Inspect the rendered Zen Green screens and record representative screenshots under the owning feature’s evidence directory. Do not treat DOM/CSS snapshots as a substitute for visual inspection.
- **Responsive/accessibility:** Reuse Playwright viewport journeys and axe. Check desktop, tablet, mobile, 320 CSS pixel minimum width, 200% zoom, keyboard order, dialogs, labels, contrast, wrapping, clipping, overlap, and page overflow.
- **Migration/regression:** Use a populated disposable database and Attachment storage. Compare existing record values and Attachment bytes before/after migration; rehearse restore; run insert-only seed twice after editing seeded rows. Run Labs 1–3 regression in the feature slices that can affect those paths.
- **Performance-smoke:** Use representative many-Ticket/action fixtures; record local query duration and response size, verify previews cap at five and collections paginate. This is a boundedness/query-plan smoke, not a production SLA.
- **End-to-end:** Use the existing authenticated Playwright app and real PostgreSQL to verify role journeys across API, generated client, UI, and storage.

Test methods assert observable output and persistence invariants. Do not couple checks to repository/controller call order or component internals. Shared fixtures use distinct Requesters, two staff members, an Administrator, active/inactive/demoted accounts, every Ticket status/priority/ownership combination, and zero/one/multiple actions.

## 2. Acceptance-Criterion Crosswalk

All 25 product acceptance criteria in [specification.md](./specification.md) are observable outcomes. DOC/TRACE rows verify contract quality and ownership; they are engineering checks, not product criteria. Each AC maps to at least one planned test. Categories are listed in §3 and detailed test paths in §4.

| AC | Owning issue | Planned test IDs | Coverage |
| --- | --- | --- | --- |
| AC-01 | #74–#77 | RULE-01, RULE-02, API-01–API-03, API-08–API-19, API-22, API-23, UI-01, UI-02, E2E-01, E2E-02, E2E-03, RWD-01, VIS-01 | Rules, API, UI, E2E, responsive, visual |
| AC-02 | #74–#77 | API-07, API-20, API-32, AUTH-01, REG-02, E2E-01, E2E-04 | API, authorization, regression, E2E |
| AC-03 | #74–#79 | API-01–API-32 | API, concurrency, dashboard |
| AC-04 | #78, #79 | RULE-03, API-29–API-31, UI-03, UI-04, UI-05, PERF-01, PERF-02, E2E-05, E2E-06, RWD-02, VIS-02 | Rules, API, UI, performance, E2E, responsive, visual |
| AC-05 | #74 | RULE-01, API-01, API-02, API-03, UI-01, E2E-01, RWD-01, VIS-01 | Rules, API, UI, E2E, responsive, visual |
| AC-06 | #74 | API-06, API-07, AUTH-01, UI-01, E2E-01 | API, authorization, UI, E2E |
| AC-07 | #74, #75 | API-02, API-09, API-12, API-13, AUTH-01, REG-02, E2E-01, E2E-02 | API, authorization, regression, E2E |
| AC-08 | #74–#76 | RULE-01, API-01, API-05, API-16, UI-01, E2E-01, A11Y-01 | Rules, API, UI, E2E, accessibility |
| AC-09 | #75, #77 | API-11, API-22, API-28, AUTH-01, E2E-02, E2E-04 | API race, authorization, E2E |
| AC-10 | #75 | API-08, API-10, UI-01, E2E-02 | API, UI, E2E |
| AC-11 | #76 | RULE-02, API-12–API-19, UI-02, E2E-03, A11Y-01, VIS-01 | Rules, API, UI, E2E, accessibility, visual |
| AC-12 | #74 | API-04, E2E-01 | API retry, E2E |
| AC-13 | #74–#76 | API-05, API-07, API-13, API-14, AUTH-01, UI-01, E2E-03 | API, authorization, UI, E2E |
| AC-14 | #77 | RULE-02, API-20–API-24, AUTH-01, UI-02, E2E-04 | Rules, API, authorization, UI, E2E |
| AC-15 | #75, #77 | API-10, API-11, API-28, E2E-02, E2E-04 | API concurrency, E2E |
| AC-16 | #77 | API-23, API-25–API-27, REG-02, UI-02, E2E-04 | API, regression, UI, E2E |
| AC-17 | #78 | RULE-03, API-29, AUTH-01, PERF-01, UI-03, E2E-05, RWD-02, A11Y-02, VIS-02 | Rules, API, authorization, performance, UI, E2E, responsive, accessibility, visual |
| AC-18 | #78 | API-29, API-31, UI-03, UI-05, E2E-05 | API parity, UI, E2E |
| AC-19 | #79 | RULE-03, API-30, AUTH-01, PERF-02, UI-04, E2E-06 | Rules, API, authorization, performance, UI, E2E |
| AC-20 | #79 | API-30, API-31, PERF-02, UI-04, UI-05, E2E-06, RWD-02, VIS-02 | API parity, performance, UI, E2E, responsive, visual |
| AC-21 | #78, #79 | API-29, API-30, API-32, UI-03, UI-04, UI-05, AUTH-01, E2E-05, E2E-06, A11Y-02 | API, UI, authorization, E2E, accessibility |
| AC-22 | #74 | MIG-01, MIG-02, REG-01 | Migration, recovery, seed, regression |
| AC-23 | #74–#79 | REG-01, REG-02, REG-03, API-32, AUTH-01, E2E-01, E2E-04 | Regression, API, authorization, E2E |
| AC-24 | #74–#79 | UI-01, UI-02, UI-03, UI-04, API-01, API-05, API-08, API-10, API-12–API-16, E2E-01, E2E-02, E2E-03, A11Y-01 | UI, API failure, E2E, accessibility |
| AC-25 | #74, #75, #76, #77, #78, #79 | STYLE-01, STYLE-02, RWD-01, RWD-02, A11Y-01, A11Y-02, VIS-01, VIS-02 | Style, responsive, accessibility, visual |

The contract-only checks verify that statements and ownership links are complete; runtime product behavior is verified by the assigned feature issues. Migration/recovery and seed checks belong to #74; action field history/concurrency checks belong to #75/#76; Ticket gate and Administrator regression belongs to #77; database parity and boundedness/performance-smoke belongs to #78/#79.

## 3. Coverage by Test Type and Owner

| Type | Planned tests | Owner |
| --- | --- | --- |
| Contract/traceability | DOC-01, DOC-02, TRACE-01 | #73 |
| Rule/unit | RULE-01, RULE-02, RULE-03 | #74–#79 by rule |
| API/integration | API-01–API-32 | #74–#79 by endpoint |
| UI component/interaction | UI-01–UI-05 | #74–#79 by screen |
| Style/visual | STYLE-01, STYLE-02, VIS-01, VIS-02 | Screen-owning feature issue |
| Responsive | RWD-01, RWD-02 | Screen-owning feature issue |
| Authorization | AUTH-01 | #74–#79 by role surface |
| Migration/regression | MIG-01, MIG-02, REG-01, REG-02, REG-03 | Migration: #74; affected legacy flows: #74/#75/#77; complete earlier-lab suite: #74–#79 |
| Performance-smoke | PERF-01, PERF-02 | #78, #79 |
| E2E | E2E-01–E2E-06 | #74–#79 by journey |
| Accessibility | A11Y-01, A11Y-02 | Screen-owning feature issue |

## 4. Planned Test Cases

All rows have Final status “Not run” at contract time.

| Test ID | Type | What it verifies | Expected result | Planned file or evidence | Owner | Final |
| --- | --- | --- | --- | --- | --- | --- |
| DOC-01 | Contract review | Six handout-required documents; exact fields, statuses, role rules, routes, and excluded report deliverables | All six docs agree and cover #73 acceptance | docs/lab-04/*.md | #73 | Not run |
| DOC-02 | Contract review | Numbered FR/BR/AC statements and data decisions | IDs are stable and at least two database choices have reasons | docs/lab-04/specification.md | #73 | Not run |
| DOC-03 | Contract review | Cross-check action fields, workflows, role matrix, API shapes, dashboard predicates, migration/recovery, UI behavior, and verification assignments across all six docs | Shared rules are identical wherever referenced; all #73 deliverables are present | docs/lab-04/*.md | #73 | Not run |
| TRACE-01 | Traceability | Every AC, test category, and migration/regression/E2E/performance/accessibility/visual check has an owning feature ticket | Every criterion links to a planned test and #74–#79 or #73 owner | docs/lab-04/tests.md | #73 | Not run |
| RULE-01 | Unit | Trim/count Unicode code points; optional Result; conditional Follow-up Note; Attachment Notes; action completion prerequisites | Valid input normalizes; invalid input is rejected without writes | server/tests/lab-04/action-rules.test.ts | #74–#76 | Pass: #74 creation validation; completion prerequisites remain #76 |
| RULE-02 | Unit | Action transition matrix, Ticket transition matrix, owner and resolution/cancellation gates | Only specified edges pass; all gate boundaries are exact | server/tests/lab-04/workflow-rules.test.ts | #76, #77 | Not run |
| RULE-03 | Unit | Active population, priority/status grouping, requester ownership, UTC inclusive bounds, Bangkok display conversion | Predicates include both interval endpoints and exclude out-of-scope rows | server/tests/lab-04/dashboard-rules.test.ts | #78, #79 | Not run |
| API-01 | API/integration | Create an Action Taken with required fields, normalization, initial Planned state, and default/selected eligible assignee | Valid data creates one normalized Planned action assigned as requested or to the authenticated actor | server/tests/lab-04/actions.api.test.ts | #74 | Pass: #74 API suite |
| API-02 | API/integration | Server sets the created action's Ticket, creator, creation time, and initial version | Stored parent, actor, and time come from the request context/server; the creation updates parent version and public updatedAt once | server/tests/lab-04/actions.api.test.ts | #74 | Pass: atomic metadata and initial event |
| API-03 | API/authorization | Reject client-supplied creator, actor, parent, lifecycle timestamps, status, or version | Server-controlled fields cannot be spoofed and no write occurs | server/tests/lab-04/actions.api.test.ts | #74 | Pass: strict fields, no spoofed writes |
| API-04 | API/idempotency | Replay a create request with the same requestId/payload and reuse it with changed normalized payload | Same payload returns the existing action without another event/version change; changed payload returns REQUEST_ID_CONFLICT | server/tests/lab-04/actions.api.test.ts | #74 | Pass: replay, normalized payload conflicts and scoped keys |
| API-05 | API/integration | Create, edit, assign, or transition an action on a Resolved/Closed/Cancelled Ticket | Every disallowed action write returns a safe terminal error and changes no data | server/tests/lab-04/actions.api.test.ts | #74–#76 | Pass after PR review correction: #74 new create rejects Resolved/Closed/Cancelled with no action or parent-version write; saved requests still replay; edit/transition not run |
| API-06 | API/integration | Paginated Action Taken and history collection reads | Pages include all matching rows without duplication or omission | server/tests/lab-04/actions.api.test.ts | #74 | Pass: #74 stable bounded action pages, empty/maximal out-of-range; history reads not run |
| API-07 | API/authorization | Requester own/foreign Ticket action reads, staff/Admin reads, and Requester write denial | Own authorized reads succeed; foreign reads are 404 and Requester writes are 403 | server/tests/lab-04/actions.api.test.ts | #74 | Pass: requester own read, staff/Admin collaboration and inactive-assignee race |
| API-08 | API/integration | Edit mutable fields on a Planned or In Progress action | Allowed fields save and append one immutable snapshot event; server-owned fields remain unchanged | server/tests/lab-04/actions-edit.api.test.ts | #75 | Pass: #75 complete normalized replacements, one snapshot revision, immutable identities, Planned/In Progress edits and normalized no-op |
| API-09 | API/integration | Reassign a pending action to another eligible user | Assignee changes and Ticket Owner remains unchanged | server/tests/lab-04/actions-edit.api.test.ts | #75 | Pass: #75 reassignment to eligible staff/Admin leaves Ticket Owner and performer unchanged |
| API-10 | API/concurrency | Stale action or Ticket version on edit or transition | Stale writes return VERSION_CONFLICT with no partial mutation or history event | server/tests/lab-04/actions-edit.api.test.ts | #75 | Pass for #75 edits: one concurrent winner, stale action/Ticket versions reject atomically; lifecycle transitions remain #76 |
| API-11 | API/concurrency | Inactive/demoted actor or assignee and account-eligibility changes racing an action write | Ineligible writes fail atomically; historical identity remains intact | server/tests/lab-04/actions-edit.api.test.ts | #75 | Pass for #75 edits: inactive/demoted assignee selection rejected, historical identity retained, actor and assignee lock races reject without writes; start/completion eligibility remains #76 |
| API-12 | API/integration | Planned to In Progress start edge and start attribution | A valid start stores the authenticated performer/time and one event; invalid edges write nothing | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-13 | API/integration | In Progress to Completed edge and completion attribution | A valid completion stores its actor/time and one immutable completion event | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-14 | API/integration | Planned/In Progress to Cancelled edges and cancellation attribution | A valid cancellation stores its actor/time and one immutable cancellation event | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-15 | API/validation | Missing, false, and true confirmation for action completion/cancellation | Missing or false returns CONFIRMATION_REQUIRED without a write; true confirmation permits only a valid edge | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-16 | API/validation | Result and required Follow-up rules on completion | Empty Result or unresolved follow-up blocks completion; valid completion has a Result and cleared follow-up requirement | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-17 | API/integration | Immutability of Completed/Cancelled actions and repeated terminal writes | Terminal actions cannot change; repeat writes conflict and create no event | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-18 | API/integration | Action event history ordering | Events are returned by createdAt ascending then ID ascending, independent of pagination | server/tests/lab-04/actions.api.test.ts | #76 | Not run |
| API-19 | API/integration | Parent Ticket version and public updatedAt for action edit/lifecycle writes | Each successful mutation increments parent metadata once; rejected writes and idempotent replay do not | server/tests/lab-04/actions-edit.api.test.ts | #75, #76 | Pass for #75 edits: parent timestamp/version advances once; rejected/no-op writes preserve metadata; lifecycle writes remain #76 |
| API-20 | API/integration | Allowed and disallowed Ticket status transition matrix | Every valid edge succeeds under its other requirements; unlisted edges return INVALID_TRANSITION without a write | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-21 | API/validation | Missing, false, and true confirmation for Resolved, Closed, and Cancelled Tickets | Missing/false returns CONFIRMATION_REQUIRED; true permits only a valid terminal transition | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-22 | API/authorization | Active eligible Ticket Owner requirement for In Progress and Resolved | Missing/ineligible owners block the transition; permitted owners allow it when other gates pass | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-23 | API/integration | Resolution gate with no completed action, pending actions, and combined blockers | A Resolved transition returns one RESOLUTION_GATE_FAILED with every reason in the specified order | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-24 | API/integration | Cancellation gate with Planned or In Progress actions | Cancellation returns TICKET_HAS_PENDING_ACTIONS until all actions are completed or cancelled | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-25 | API/integration | Reopen clears the current indication/resolvedAt and records a status event | Reopen succeeds from Resolved and clears current resolution fields while retaining event history | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-26 | API/migration | Legacy terminal Tickets remain valid and receive no synthetic status history | Existing terminal rows remain readable; history contains only transitions recorded after migration | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-27 | API/authorization | Requester resolution indication is advisory and idempotent | Own active Ticket may be indicated without changing status; repeat is a no-op and foreign writes are denied | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-28 | API/concurrency | Action/account eligibility writes racing Ticket resolution | Parent locking and transactional eligibility checks prevent a Resolved Ticket with pending work or an ineligible owner | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-29 | API/integration | Requester dashboard aggregates, seven-day boundaries, resolution status, ownership/note isolation, and zero results | Counts/previews match only own public Tickets and exact UTC predicates; zero is numeric and previews are empty | server/tests/lab-04/requester-dashboard.api.test.ts | #78 | Not run |
| API-30 | API/integration | Staff/Admin status, priority, unassigned, owned, My Actions, recent, and Urgent metrics | Counts and bounded previews equal independent queries with My Actions scoped to assigned actions on active Tickets | server/tests/lab-04/staff-dashboard.api.test.ts | #79 | Not run |
| API-31 | API/parity | Dashboard card scopes and paginated Ticket/Action lists with identical predicates/time bounds | Card totals equal matching list totals for the same fixture and snapshot | server/tests/lab-04/requester-dashboard.api.test.ts; server/tests/lab-04/staff-dashboard.api.test.ts | #78, #79 | Not run |
| API-32 | API/authorization regression | Administrator operational permissions; Requester-only create/Attachment writes; private-note and session boundaries | Admin receives staff capabilities; earlier protected paths remain protected | server/tests/lab-04/authorization.api.test.ts | #77 | Not run |
| MIG-01 | Migration/recovery | Apply the deployed migration to a populated disposable DB, rerun it, and compare User/Ticket/Attachment/comment/note/session rows and Attachment bytes after both runs; rehearse restore | Existing values/bytes are identical after the first and second runs; no synthetic actions; backup/restore recovers a consistent pair | server/tests/lab-04/migration-recovery.ts; server/tests/check-migration-preservation.ts | #74 | Pass: populated rows and bytes, Sessions, rollback, deploy rerun and backup restoration |
| MIG-02 | Seed/regression | Seed twice, edit seeded rows between runs, inspect lifecycle and dashboard examples | Stable-key insert-only rerun preserves edits and covers zero/nonzero examples | server/tests/lab-04/migration-recovery.ts | #74 | Pass: three seed runs preserve edits and zero/one/multiple Planned actions; lifecycle/dashboard examples not run |
| REG-01 | Regression | Requester login/password flow, Ticket creation/list/detail, ownership, Attachment upload/read/remove, Public Comments, resolution indication | Existing Requester journeys still pass with dashboard and actions present | Existing client/server labs 1–2 tests; e2e/lab-02/requester-flow.spec.ts | #74 | Pass: earlier-lab API/UI suites plus requester browser journey at all three sizes; dashboards not run |
| REG-02 | Regression | Staff queue/ownership/status/priority, Public Comments, Internal Notes privacy, Administrator user management | Earlier behavior passes; approved Administrator operational access works | Existing client/server labs 3 tests; e2e/lab-03/user-management.spec.ts; e2e/lab-03/internal-notes.spec.ts | #75, #77 | Pass for #75: earlier-lab API/UI suites and 47 earlier-lab browser journeys; #77 additions remain unavailable |
| REG-03 | Regression | Run the complete existing earlier-lab client/server test suite in each feature issue's final verification, as applicable | Each feature records and fixes regressions it causes; the combined suite is green at the final integration checkpoint | pnpm run test; existing client/server labs 1–3 test suites | #74–#79 | Pass for #75: 150 client and 147 server tests, OpenAPI parity; includes earlier-lab regressions |
| UI-01 | UI | Action empty/list/read, create/edit modes, assignee choices, conditional validation, draft retention, replay, pending/terminal controls | Visible states match the contract; invalid/recoverable save keeps entered values | client/tests/lab-04/actions-taken-ui.test.tsx; client/tests/lab-04/actions-edit-ui.test.tsx | #74, #75 | Pass: #74 create/read and #75 edit/assign/conflict, draft retention, validation/focus, busy state, no eligible choices, historical assignees, Requester history and late account response isolation |
| UI-02 | UI | Action lifecycle and Ticket workflow controls, permitted choices, confirmation, version conflict, gate feedback, refreshed status | Controls match current state; failures retain draft and saved state | client/tests/lab-04/TicketWorkflow.test.tsx | #76, #77 | Not run |
| UI-03 | UI | Requester dashboard counts, previews, exact bounds, empty/loading/error/forbidden/retry | Shows real zero/empty and exact link parameters; never leaks other users’ data | client/tests/lab-04/RequesterDashboard.test.tsx | #78 | Not run |
| UI-04 | UI | Staff/Admin dashboard cards, action preview, zero/empty/error, exact links | Counts and links agree with API response and role | client/tests/lab-04/StaffDashboard.test.tsx | #79 | Not run |
| UI-05 | UI | My Tickets/Queue scope filters, retained from/through bounds, My Actions link and pagination | List result scope matches the selected dashboard metric | client/tests/lab-04/DashboardDrillDown.test.tsx | #78, #79 | Not run |
| STYLE-01 | Style/visual | Ticket Detail action list/forms/history and lifecycle dialogs against Zen Green conventions | No clipping, overlap, confusing private/shared content, or inconsistent controls | docs/lab-04/ui-spec.md §8 inventory; artifacts/lab-04/screenshots/actions-taken/{state}-{viewport}.png; artifacts/lab-04/screenshots/actions-edit/{state}-{viewport}.png | #74–#77 | Pass: #74 create/read and #75 edit/conflict/history Zen Green screenshots inspected; lifecycle remains #76 |
| STYLE-02 | Style/visual | Requester and staff dashboards, My Actions and list drill-down | Cards, labels, counts, links, empty states, and navigation are coherent | docs/lab-04/ui-spec.md §8 inventory; artifacts/lab-04/screenshots/requester-dashboard/{state}-{viewport}.png; artifacts/lab-04/screenshots/staff-dashboard/{state}-{viewport}.png | #78, #79 | Not run |
| RWD-01 | Responsive | Action detail with zero/one/many entries, create/edit forms, lifecycle and history | Works at 1440×900, 768×1024, 390×844, 320 CSS px and 200% zoom | e2e/lab-04/actions-taken-flow.spec.ts; e2e/lab-04/actions-edit-flow.spec.ts | #74–#77 | Pass: #74/#75 desktop/tablet/mobile, 320px, 200% CSS reflow and native Chromium page scale; lifecycle remains #76 |
| RWD-02 | Responsive | Both dashboards, My Tickets, Ticket Queue, and My Actions | Usable cards/lists; no page-wide horizontal overflow at all required sizes | e2e/lab-04/accessibility-responsive.spec.ts | #78, #79 | Not run |
| AUTH-01 | Authorization | Full role matrix, foreign Ticket/action/history, requesterId spoof, route direct access, account/cache switch | Server denies unauthorized operations and client displays a safe role state | server/tests/lab-04/actions.api.test.ts; client/tests/lab-04/actions-taken-ui.test.tsx; e2e/lab-04/actions-taken-flow.spec.ts; e2e/lab-04/actions-edit-flow.spec.ts | #74–#79 | Pass: #74/#75 API role/ownership matrix, safe history, UI identity isolation and browser foreign-owner denial; sibling endpoints not run |
| PERF-01 | Performance-smoke | Requester dashboard and recent/resolved lists with representative Tickets | Counts are snapshot-consistent, previews ≤5, list page bounded, response size/query time recorded | server/tests/lab-04/requester-dashboard.api.test.ts | #78 | Not run |
| PERF-02 | Performance-smoke | Staff dashboard and My Actions with representative Tickets/actions | Counts are accurate, previews ≤5, page bounded, response size/query time recorded | server/tests/lab-04/staff-dashboard.api.test.ts | #79 | Not run |
| E2E-01 | E2E | Staff creates multiple actions with different workers; owning Requester reads fields; non-owner cannot read | One shared, attributed action list; ownership and read-only rules hold | e2e/lab-04/actions-taken-flow.spec.ts | #74 | Pass: staff, second staff and Admin create; own Requester reads; foreign denial; uncertain replay and real version conflict |
| E2E-02 | E2E/concurrency | Two staff edit/reassign pending action; stale draft and account eligibility changes | Fresh edit saves; stale draft is retained and shown as conflict; Ticket Owner stays unchanged | e2e/lab-04/actions-edit-flow.spec.ts | #75 | Pass: 6 cases at three viewports; two-worker edits, reassignment, eligibility changes, conflict/review/retry, owner retention and Requester history |
| E2E-03 | E2E | On each supported viewport, create/assign actions then start, complete, and cancel valid/invalid cases | Actions progress only on valid edges; completion/cancellation confirm; terminal history retains actor/time/order | e2e/lab-04/action-lifecycle.spec.ts | #76 | Not run |
| E2E-04 | E2E | Full Ticket transitions, resolution gate, advisory indication, reopen, cancel and concurrency | Ticket status remains valid after direct and competing writes | e2e/lab-04/ticket-resolution.spec.ts | #77 | Not run |
| E2E-05 | E2E | Requester dashboard landing, counts, bounds, My Tickets drill-down, Ticket detail, cache switch | Only authenticated user’s Tickets appear; preview/card links match details | e2e/lab-04/dashboards.spec.ts | #78 | Not run |
| E2E-06 | E2E | Staff/Admin landing, all cards, Queue filters, My Actions, parent/action links | Staff/Admin metrics and links match current-user assigned work | e2e/lab-04/dashboards.spec.ts | #79 | Not run |
| A11Y-01 | Accessibility | Keyboard-only create/edit/workflow journeys, labels, field errors, live updates, dialogs, focus return | All action and workflow tasks are operable and announced | e2e/lab-04/actions-taken-flow.spec.ts; e2e/lab-04/actions-edit-flow.spec.ts; axe checks | #74–#77 | Pass: #74/#75 keyboard forms, invalid-field/save/cancel focus, labels/live feedback and zero axe violations in tested states; sibling dialogs not run |
| A11Y-02 | Accessibility | Dashboard/card/list navigation, heading order, labels, focus, contrast and empty states | axe has no new serious/critical finding; keyboard flow remains clear | e2e/lab-04/accessibility-responsive.spec.ts; axe checks | #78, #79 | Not run |
| VIS-01 | Visual review | Action and Ticket Detail states across desktop/tablet/mobile | Checklist passes and reviewed screenshots show real, complete states | docs/lab-04/ui-spec.md §8 inventory; artifacts/lab-04/screenshots/actions-taken/{state}-{viewport}.png; artifacts/lab-04/screenshots/actions-edit/{state}-{viewport}.png | #74–#77 | Pass: #74/#75 canonical and representative screenshots inspected; checklists in artifacts/lab-04/README.md; lifecycle remains #76 |
| VIS-02 | Visual review | Requester/staff dashboard and drill-down states across desktop/tablet/mobile | Checklist passes for counts, layouts, links, errors, empties, and overflow | docs/lab-04/ui-spec.md §8 inventory; artifacts/lab-04/screenshots/requester-dashboard/{state}-{viewport}.png; artifacts/lab-04/screenshots/staff-dashboard/{state}-{viewport}.png | #78, #79 | Not run |

## 5. Per-Issue Verification Ownership

| Issue | Verification that must finish inside the issue |
| --- | --- |
| #73 Contract | DOC-01, DOC-02, DOC-03, TRACE-01. No feature implementation or runtime behavior is claimed here. |
| #74 Create/view actions | API-01–API-07, MIG-01/02, REG-01/03, UI-01 create/read, AUTH-01 action ownership, E2E-01, RWD-01, A11Y-01, VIS-01. |
| #75 Edit/assign actions | API-05, API-08–API-11, API-19, REG-03, UI-01 edit/conflict, E2E-02, existing Ticket ownership and account-management regression, relevant RWD/a11y/visual checks. |
| #76 Action lifecycle | RULE-01/02 action rules, API-05, API-12–API-19, REG-03, UI-02 action controls, create/assign/start/complete/cancel E2E-03 on supported viewports, terminal history and confirmation keyboard/a11y/visual checks. |
| #77 Ticket workflow | RULE-02 workflow rules, API-20–API-28, API-32, REG-02/03, UI-02 Ticket controls, E2E-04, advisory/reopen/cancellation/account races and visual/a11y checks. |
| #78 Requester dashboard | RULE-03 requester predicates, API-29, API-31, REG-01/03 requester regression, UI-03/05, PERF-01, E2E-05, RWD-02, A11Y-02, VIS-02. |
| #79 Staff dashboard | RULE-03 staff predicates, API-30/31, REG-02/03 staff/Admin integration, UI-04/05, PERF-02, E2E-06, RWD-02, A11Y-02, VIS-02. |

Each feature verifies integration with completed prerequisites and features already present in its checkout. Every feature issue #74–#79 owns its applicable earlier-lab regression checks, including the full-suite checkpoint in REG-03; no regression is deferred to a release or hardening issue. If a sibling is unfinished, run independent assigned checks, record unavailable integration coverage accurately, and stop at the assigned issue. No feature issue takes over another issue’s implementation.

## 6. Test and Product Completion Notes

- Record command, fixture/environment, result, and any failure in the Final cell or linked concise test evidence after running it. Never mark a check Pass by plan or source inspection alone.
- Run focused rules/API/UI tests while implementation is active, then the complete existing client/server suite at the final integration checkpoint. Run affected Playwright journeys and full CI checks when shared configuration, dependency, or build behavior changes.
- Keep performance-smoke measurements tied to fixture size and local environment; do not infer a production throughput guarantee.
- Use migration recovery only on disposable database and Attachment storage. Do not reset a preserved environment.
- Changes to an earlier-lab expectation are allowed only when this contract explicitly supersedes it, notably Administrator IT Staff capabilities and the new action resolution gate. Update the old expectation in the feature issue that changes that behavior.

## Reproduce MIG-01 and MIG-02

The evidence for MIG-01 rollback, deploy rerun, populated snapshots, Session preservation, Attachment-byte backup/restore and timestamp invariance is `server/tests/lab-04/migration-recovery.ts`. MIG-02 seed-edit preservation is exercised by the same script. It creates two uniquely named disposable databases, creates temporary Attachment storage, and removes both on exit. It requires a PostgreSQL role allowed to create databases.

Run from the repository root after `pnpm install`. Docker supplies PostgreSQL 17 and matching `pg_dump`/`pg_restore`; no host installation of those tools is required:

```sh
pnpm db:generate
docker run --name toktickit-lab4-recovery \
  -e POSTGRES_USER=toktickit -e POSTGRES_PASSWORD=toktickit \
  -p 127.0.0.1:55475:5432 -d postgres:17-alpine
until docker exec toktickit-lab4-recovery pg_isready -U toktickit; do sleep 1; done
TOKTICKIT_TEST_DATABASE_URL=postgresql://toktickit:toktickit@localhost:55475/postgres \
  MIGRATION_POSTGRES_CONTAINER=toktickit-lab4-recovery \
  pnpm --filter @toktickit/server exec tsx tests/lab-04/migration-recovery.ts
DATABASE_URL=postgresql://toktickit:toktickit@localhost:55475/postgres \
  pnpm --filter @toktickit/server exec tsx tests/check-migration-preservation.ts
docker rm -f toktickit-lab4-recovery
```

Choose an unused container name and port. Set `MIGRATION_POSTGRES_CONTAINER` to that same container. With host PostgreSQL instead, omit that variable and put compatible `pg_dump` and `pg_restore` on PATH.

`server/tests/check-migration-preservation.ts` is a separate earlier-lab regression: it applies historical migrations and verifies insert-only seeds. The expected seeded Ticket count increased from 9 to 12 because #74 adds three dedicated zero/one/multiple-action fixture Tickets. The populated recovery script additionally verifies preserved legacy rows and bytes; the count change is not the evidence for that requirement.

PR #82 follow-up reran both scripts on 2026-10-03 against disposable PostgreSQL 17 container `toktickit-pr82-review`, port 55474: both passed. The recovery output confirmed populated rows, bytes, transaction rollback, backup restore, zero legacy actions and insert-only seed reruns. The historical check confirmed legacy preservation and normalized-email collision rejection.

These external recovery scripts are explicit checks, outside Vitest and `pnpm test`. They require database creation and PostgreSQL backup tools; keep running both commands at the feature migration checkpoint rather than silently claiming CI coverage. A CI job can use the commands above with a dedicated service/container. The normal client/server suites remain the separate REG-03 checkpoint.

## 7. Initial Issue #74 execution evidence — 2026-10-03

Historical implementation checkpoint before PR #82 follow-up. Current results and reachable capture provenance are in the PR #82 checkpoint below.

Environment: Node/pnpm workspace, disposable PostgreSQL 17 container `toktickit-issue74-check` on port 55474, separate temporary Attachment storage, production API on port 3004 (fresh `toktickit_review` database for final captures), and production client preview on port 5174. Existing port 5432 was occupied and its credentials differed; no existing database or `.env` was changed. For database checks, both `DATABASE_URL` and `TOKTICKIT_TEST_DATABASE_URL` point at the disposable database because earlier-lab suites use the former.

| Executed check | Result |
| --- | --- |
| `pnpm run fix`, `pnpm run check`, `pnpm run check-types`, `pnpm run build` | Pass: formatting/lint, all three TypeScript projects, both production builds. OpenAPI generation parity also passes. |
| `pnpm run test` with disposable database environment | Pass: 132 client tests and 137 server tests across Labs 1–4. The first attempt used only the newer test database variable, leaving three older suites on wrong local credentials; their 23 tests passed after both variables were supplied. After review corrections, the full server rerun passed 135 tests but hit a seed timeout and ECONNRESET in two earlier-lab checks; both affected suites passed on rerun (10 tests) without changing expectations. |
| Focused `tests/lab-04` client rules/API/UI and server rules/authenticated API suites | Pass: 25 client and 17 server checks, including normalized validation, role/ownership matrix, scoped request IDs, replay/conflicts, atomic event/parent metadata, stale Ticket versions, inactive-assignee lock race, UI draft/pagination/focus/identity behavior and late-response isolation. |
| `pnpm --filter @toktickit/server exec tsx tests/check-migration-preservation.ts` | Pass: preserved earlier-lab migration data and insert-only seeds with new fixtures. |
| `TOKTICKIT_TEST_DATABASE_URL=… MIGRATION_POSTGRES_CONTAINER=toktickit-issue74-check pnpm --filter @toktickit/server exec tsx tests/lab-04/migration-recovery.ts` | Pass: populated old-schema User/Ticket/Attachment/PublicComment/InternalNote/Session snapshots and Attachment bytes; deliberate failed-migration transaction rollback; migrate deploy twice; no fabricated legacy actions; three seed runs preserve edited records; pre-migration DB and byte backup restored into a second disposable database; all six action/event timestamp columns use timestamptz and reads preserve the same instant under UTC/Asia-Bangkok settings. |
| `pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-taken-flow.spec.ts` with API/client/storage environment above | Pass: 12 journeys across desktop/tablet/mobile; real multi-staff/Admin creation, own/foreign Requester reads, lost-response replay without duplicates, and real stale-Ticket conflict/refresh/retry. Controlled list loading/503/403/404 states also pass. |
| Playwright `lab-02/requester-flow.spec.ts` and lab-03 public-comments, internal-notes, ticket-ownership, ticket-workflow, staff-queue specs | Pass: 18 earlier-lab journeys across all three projects. Existing screenshots were restored rather than replacing earlier-lab evidence. |
| Visual, responsive and accessibility review | Pass for #74: representative screenshots visually inspected; zero axe violations and no page overflow in tested states; 320px, 200% CSS reflow and native Chromium page scale covered. See [visual checklist](../../artifacts/lab-04/README.md). |

Initial browser failures exposed zoom cleanup and a test locator that matched assignee options while Save was still finishing. Explicitly restoring Chromium page scale to 1 and waiting for the form to close corrected those checks. The final browser run uses the settled production build. The initial server interpretation incorrectly allowed creation on Resolved and did not meet API-05/AC-13. PR review correction `e39e7b7` rejects new actions on Resolved/Closed/Cancelled with `409 TICKET_TERMINAL`; all nine API checks passed, including no-write assertions and saved-request replay after each status. The API and UI now share the same new-create restriction. Edit, assignment after creation, lifecycle/history endpoints, new Ticket gates, dashboards and their integration checks remain owned by #75–#79 and are not claimed complete here.

### STYLE-01

Pass for #74 after review corrections: all 15 canonical desktop/tablet/mobile images and representative supplementary captures were inspected. Zen Green controls, wrapping, shared/private boundaries, field focus and recoverable drafts passed the [visual checklist](../../artifacts/lab-04/README.md#visual-checklist--pass-for-74). No clipping or overlap was observed.

### VIS-01

Pass after PR #82 follow-up: 12 production browser journeys recaptured all 44 PNGs from clean, pushed source commit [`6dd2571551464a89c546236c63cb8b43a3e6233d`](https://github.com/beambeambeam/toktickit/commit/6dd2571551464a89c546236c63cb8b43a3e6233d) on `feature/74-create-view-actions-taken`. The previous SHA was a pre-regroup local-only commit; the new manifests replace that provenance. All 15 canonical states are present, inspected, and mapped once in the [desktop](../../artifacts/lab-04/screenshots/actions-taken/manifest-desktop.json), [tablet](../../artifacts/lab-04/screenshots/actions-taken/manifest-tablet.json), and [mobile](../../artifacts/lab-04/screenshots/actions-taken/manifest-mobile.json) manifests. Each entry records actual role, branch, SHA, UTC time, command, state provenance, viewport/zoom and review links. The 18 affected earlier-lab browser regressions also passed on the corrected build. The populated read inventory covers #74 action fields; history/lifecycle/gate states remain unavailable siblings.

### Review corrections

The separate Standards and Spec reviews against `ab279fa` found six Standards items and two Spec items. Corrections add complete Ticket mutation response narrowing, semantic ordered action lists, typed conflict state, separated create/retry/list responsibilities, shared Action payload/hash/snapshot helpers and positive-ID parsing, timezone-aware Action/event storage, and canonical visual provenance capture. Focused checks, the client suite, server regressions, and migration recovery passed after these changes. Fresh browser evidence passed. Standards follow-up confirmed all six findings resolved, with zero unresolved. Spec follow-up confirmed both original findings resolved against committed evidence `f6f2f5f`, with zero unresolved. No clear defect caused by either set of fixes was found. The fixed review base is `ab279fa`.

## Standards

Follow-up of the six original findings: all resolved.

- Complete TicketDetail response validation now guards cache writes, including nested fields; malformed responses have focused tests.
- Action collections use semantic ordered lists with scoped styles.
- Action payload/hash/snapshot helpers are shared by persistence and seed paths.
- Ticket and Action controllers share positive-ID parsing.
- Version conflicts use a typed failure kind.
- Create/retry state and list rendering live in separate focused components.

No clear defect introduced by these fixes. Unresolved Standards findings: **0**.

## Spec

Follow-up of the two original findings: both resolved.

- All six Action/event timestamps use `TIMESTAMPTZ(3)` and Prisma `@db.Timestamptz(3)`, matching the UTC timestamp contract. Recovery checks verify stored types and invariant instants under UTC and Asia/Bangkok database settings.
- Canonical screenshot inventory and three linked viewport manifests record scenario, role, clean source SHA, UTC capture time, command and state provenance. The actual source capture commit remains recorded through later evidence-only commits.

No clear defect caused by either fix found in this bounded review. Unresolved Spec findings: **0**.

Review totals: Standards 0 unresolved (6 fixed); Spec 0 unresolved (2 fixed).

## Commit regrouping — 2026-10-03

The verified implementation was regrouped from the preserved local history into `feature/74-create-view-actions-taken`, based on `ab279fa`. At the regrouping checkpoint, source and browser-test files were identical to the then-reviewed snapshot `3ddb6a1`. PR #82 follow-up subsequently changed that source; the current verification and freshly captured evidence below supersede that checkpoint.

| Focused commit | Checks rerun before commit |
| --- | --- |
| Planned action storage and validation | Prisma generation, server typecheck, 8 rule tests, populated migration/rollback/backup/restore/seed recovery |
| Authenticated action creation and reads | 9 API tests, server/client typechecks, OpenAPI generation parity |
| Ticket action creation and reading UI | 25 client tests, client typecheck and production build |
| Browser journeys and verification evidence | E2E typecheck, discovery of all 12 feature journeys, 44-PNG/3-manifest provenance validation, repository format/lint |

Each focused staged diff was inspected and compared with the reviewed snapshot. Repository hooks and commitlint remained enabled. No published history was rewritten.

## PR #82 review follow-up checkpoint — 2026-10-03

Environment: disposable PostgreSQL 17 container `toktickit-pr82-review` on port 55474. Both database variables pointed to this container for the full test run. Browser checks used the separate migrated/seeded `toktickit_review` database, temporary Attachment storage, production API port 3004, and client production preview port 5174. No existing database or environment file was changed.

| Command/check | Current result |
| --- | --- |
| `pnpm run check`, `pnpm run check-types`, `VITE_API_URL=http://localhost:3004 pnpm run build` | Pass: format/lint, three TypeScript projects and both builds. |
| `DATABASE_URL=postgresql://toktickit:toktickit@localhost:55474/toktickit TOKTICKIT_TEST_DATABASE_URL=postgresql://toktickit:toktickit@localhost:55474/toktickit pnpm run test` | Pass in one final run: 134 client tests, OpenAPI parity and 140 server tests. |
| Focused Lab 4 checks | 27 client checks and 20 server checks are included in the full suite. Added regressions for blank Assignee, open/cancel/save focus, E2E user reference preservation, safe unexpected API errors and canonical SHA-256. Existing API tests now reject new actions on all three closed statuses and verify saved-request replay. |
| Both migration scripts under Reproduce MIG-01 and MIG-02 | Pass after review fixes: populated preservation, rollback, DB/byte restore, timestamp invariance, insert-only seed reruns, historical rows and email collision rejection. |
| `pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-taken-flow.spec.ts` | Pass: all 12 journeys across desktop/tablet/mobile; fresh capture with browser focus assertions. |
| `pnpm --filter @toktickit/e2e exec playwright test lab-02/requester-flow.spec.ts lab-03/public-comments.spec.ts lab-03/internal-notes.spec.ts lab-03/ticket-ownership.spec.ts lab-03/ticket-workflow.spec.ts lab-03/staff-queue.spec.ts` | Pass: 18 affected earlier-lab journeys; earlier-lab artifacts restored after verification. |
| Visual/provenance inspection | Pass: all 15 canonical images and representative supplementary images inspected. Verified 44 unique PNG paths, three manifests, all canonical states, role/provenance metadata and clean reachable source SHA. Compact read output, focus, no overflow and zero axe violations in tested browser states. |

Browser command environment:

```sh
DATABASE_URL=postgresql://toktickit:toktickit@localhost:55474/toktickit_review \
  ATTACHMENT_STORAGE_DIR=/path/to/disposable/storage \
  VITE_API_URL=http://localhost:3004 E2E_API_URL=http://localhost:3004 \
  E2E_BASE_URL=http://localhost:5174 E2E_CLIENT_PORT=5174 PORT=3004 \
  pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-taken-flow.spec.ts
```

Use the same disposable database/storage for the running production API, with `CORS_ORIGIN=http://localhost:5174` and `API_ORIGIN=http://localhost:3004`; build the client with that VITE API URL and serve it on port 5174. The recovery section above supplies disposable PostgreSQL setup. The browser capture helper records its command and current Git metadata; start from committed source.

One intermediate 10-case API run encountered a fixture login 404; all 10 cases passed on immediate rerun and the final full 140-test server run passed without retries. The PostgreSQL client emits an existing concurrent-query deprecation warning. No test expectations were relaxed.

Current capture source: [`6dd2571551464a89c546236c63cb8b43a3e6233d`](https://github.com/beambeambeam/toktickit/commit/6dd2571551464a89c546236c63cb8b43a3e6233d). The evidence-only commit follows this source commit. Human review responses and commit mapping are recorded in [reviewer.md](reviewer.md); automated green checks do not imply peer approval.

## Issue #75 verification — 2026-10-04

Scope: pending edits, reassignment, and Action Taken history integrate with completed #74. The source branch began at `4da687a88ec34576c2a194231581a11e7c60561e`. The `reports/lab04/lab-sheet/markdown.md` stakeholder/engineering context was read. No report deliverable is changed.

The test seams were explicitly confirmed: authenticated Supertest against disposable PostgreSQL, React Testing Library against the HTTP boundary, and authenticated Playwright two-worker collaboration. Early failing UI checks exposed missing save-trigger focus, empty-assignee feedback, and a lost historical draft selection after refresh; their corrections pass the focused suite. Backend writes preserve the original creation payload identity, immutable parent/creator/time/performer, and primary Ticket Owner. Historical assignees are retained while correcting pending fields; new selections require current eligibility. History uses safe field projection and stable bounded pages.

Environment: disposable PostgreSQL 17 container `toktickit-issue75`, port 55475. Both `DATABASE_URL` and `TOKTICKIT_TEST_DATABASE_URL` point to `postgresql://toktickit:toktickit@localhost:55475/toktickit`; API fixtures create and remove separate databases. Browser checks use the same container's seeded disposable main database, API port 3005, client port 5175, and `/tmp/toktickit-issue75-attachments`. No existing database or environment file was changed.

| Executed check | Result |
| --- | --- |
| Focused `tests/lab-04/actions-edit-ui.test.tsx` | Pass: 16 cases, complete payload/CSRF, captured versions, explicit review/retry, save/cancel/error focus, 400/403/404/409/503 drafts, duplicate-write prevention, terminal Ticket controls, Requester snapshots, principal change, historical/empty assignee states. |
| Focused `tests/lab-04/actions-edit.api.test.ts` | Pass: 7 cases covering normalized full replacement, immutable identities/owner, semantic no-op, In Progress edits, protected/terminal writes, strict fields, stale/concurrent updates, account eligibility/lock races, safe chronological history and pagination. |
| `pnpm run test` | Pass in one final combined run: 150 client tests, OpenAPI generation parity, 147 server tests across Labs 1–4. Existing PostgreSQL concurrent-query deprecation warnings remain. |
| `VITE_API_URL=http://localhost:3005 pnpm run build` | Pass: both production builds. |
| `pnpm run fix`, `pnpm run check`, `pnpm run check-types` | Pass: format/lint and all three TypeScript projects. |
| `pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-edit-flow.spec.ts` | Pass: 6 cases at desktop/tablet/mobile, real role contexts, stale edits and eligibility changes, failure/draft recovery, history pagination, zero axe violations and no overflow. |
| Earlier-lab and #74 browser regression | Pass: 59 journeys, 4 existing desktop-only skips, no failures. Includes 12 #74 journeys and 47 earlier-lab journeys for Requester Attachments, authentication, ownership/workflow, queue, comments, Internal Notes, user management, API security and concurrency. Earlier evidence restored after verification. |
| Visual inspection | Pass: all 6 canonical edit/conflict images and representative supplementary images. No clipping/overlap or private-content leak observed; consistent Zen Green controls. |

Lifecycle starting/completion/cancellation and Ticket workflow gates are not present in this checkout. Their implementation and end-to-end eligibility gate checks remain #76/#77. The #75 API tests seed an In Progress action to verify edits retain performer/start attribution; they do not claim to test an unavailable transition endpoint. No sibling feature, delete route, compatibility path, migration, or seed rewrite is added.

Browser reproduction environment:

```sh
DATABASE_URL=postgresql://toktickit:toktickit@localhost:55475/toktickit \
  ATTACHMENT_STORAGE_DIR=/tmp/toktickit-issue75-attachments \
  VITE_API_URL=http://localhost:3005 E2E_API_URL=http://localhost:3005 \
  E2E_BASE_URL=http://localhost:5175 E2E_CLIENT_PORT=5175 PORT=3005 \
  pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-edit-flow.spec.ts
```

The Playwright configuration starts the API and Vite development server on dedicated ports. Production builds are verified separately. Browser evidence records its actual source SHA and command; final capture runs after the source commit.

### Issue #75 code review

Fixed base: `4da687a`. Independent Standards and Spec agents reviewed the staged implementation, tests and documentation before the source commit. Automated reviews do not imply peer approval.

**Standards:** one possible duplicated-code finding in create/edit field normalization and follow-up validation. Shared `validateEditableFields` resolves it; bounded follow-up found no residual defect. After the fix, all 25 focused rules/create/edit API checks and server typecheck passed. No documented-standard breach found; 0 unresolved findings.

**Spec:** no missing/incorrect behavior or scope creep found in the #75 edit/assignment/history slice. The review verified strict replacement, dual-version atomicity, immutable identity/hash, no-op/event behavior, safe ordered history, eligibility handling, and explicit conflict review. Starting/completing eligibility gates remain explicitly unavailable under #76; 0 findings in the implemented #75 slice.

Review totals: Standards 1 fixed, 0 unresolved; Spec 0 findings, with the #76 lifecycle limitation recorded above.

### Issue #75 final capture checkpoint

Final browser capture: 6/6 cases passed from clean source [`f1f7e9cd271903a5f5b3936e16436c72785ff18c`](https://github.com/beambeambeam/toktickit/commit/f1f7e9cd271903a5f5b3936e16436c72785ff18c). All three manifests report `sourceDirty: false`; 28 unique real PNGs match their entries, with all six canonical edit/conflict states present. All six canonical images and representative supplementary images were visually inspected again. See [the #75 evidence checklist](../../artifacts/lab-04/README.md#visual-checklist--pass-for-75). The evidence commit follows the recorded source commit.

One capture attempt stopped in global setup because the disposable database container was no longer present (`ECONNREFUSED`), before any test ran. Recreating that owned container and applying all existing migrations restored the environment; the complete final capture passed without retries. No code or expectations changed for this recovery.
