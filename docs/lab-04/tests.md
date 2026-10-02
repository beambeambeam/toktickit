# Lab 4 Test Plan and Traceability

Status: planned before feature implementation. Every final result remains “Not run” until that check actually runs. The feature issue listed below owns the check, its fixes, and its final result. Contract review belongs to Issue #73. Feature verification is not deferred to a separate hardening ticket.

## 1. Test Strategy

- **Rules/unit:** Exercise field validation, the Action and Ticket transition tables, resolution/cancellation gates, dashboard predicates, interval boundaries, and query-scope mapping without HTTP.
- **API/integration:** Use Supertest against the composed Express app, disposable PostgreSQL fixtures, real sessions/CSRF, and Prisma. Verify stored state, safe errors, roles, ownership, retry, lock/race behavior, and database-backed counts.
- **UI:** Use existing Vitest/React Testing Library patterns. Test visible form/list behavior, validation, loading, empty/error/conflict states, exact filters, focus, and cache isolation.
- **Style/visual:** Inspect the rendered Zen Green screens and record representative screenshots under the owning feature’s evidence directory. Do not treat DOM/CSS snapshots as a substitute for visual inspection.
- **Responsive/accessibility:** Reuse Playwright viewport journeys and axe. Check desktop, tablet, mobile, 320 CSS pixel minimum width, 200% zoom, keyboard order, dialogs, labels, contrast, wrapping, clipping, overlap, and page overflow.
- **Migration/regression:** Use a populated disposable database and Attachment storage. Compare existing record values and Attachment byte hashes before/after migration; rehearse restore; run insert-only seed twice after editing seeded rows. Run Labs 1–3 regression in the feature slices that can affect those paths.
- **Performance-smoke:** Use representative many-Ticket/action fixtures; record local query duration and response size, verify previews cap at five and collections paginate. This is a boundedness/query-plan smoke, not a production SLA.
- **End-to-end:** Use the existing authenticated Playwright app and real PostgreSQL to verify role journeys across API, generated client, UI, and storage.

Test methods assert observable output and persistence invariants. Do not couple checks to repository/controller call order or component internals. Shared fixtures use distinct Requesters, two staff members, an Administrator, active/inactive/demoted accounts, every Ticket status/priority/ownership combination, and zero/one/multiple actions.

## 2. Acceptance-Criterion Crosswalk

Contract criteria AC-01 through AC-09 and product criteria AC-10 through AC-30 are defined in [specification.md](./specification.md). A dash in the coverage column means no separate test category applies; every criterion has at least one planned test. Categories are listed in §3 and detailed test paths in §4.

| AC | Owning issue | Planned test IDs | Coverage |
| --- | --- | --- | --- |
| AC-01 | #73 | DOC-01 | Contract review |
| AC-02 | #73 | DOC-01, TRACE-01 | Contract review, traceability |
| AC-03 | #73, #74, #75, #76, #77 | DOC-03, RULE-01, RULE-02, API-01, API-03, API-04, UI-01, UI-02, AUTH-01, E2E-01, E2E-02, E2E-03, RWD-01, VIS-01 | Contract, rules, API, UI, authorization, E2E, responsive, visual |
| AC-04 | #73, #74, #75, #77 | DOC-03, API-02, API-05, AUTH-01, REG-02, E2E-01, E2E-04 | Contract, API, authorization, regression, E2E |
| AC-05 | #73, #74, #75, #76, #77, #78, #79 | DOC-03, API-01, API-03, API-04, API-05, API-06, API-07, API-08, API-09 | Contract, API, concurrency, dashboard |
| AC-06 | #73, #78, #79 | DOC-03, RULE-03, API-06, API-07, API-08, UI-03, UI-04, UI-05, PERF-01, PERF-02, E2E-05, E2E-06, RWD-02, VIS-02 | Contract, rules, API, UI, performance, E2E, responsive, visual |
| AC-07 | #73, #74 | DOC-02, DOC-03, MIG-01, MIG-02 | Contract, migration, recovery, seed |
| AC-08 | #73, #74, #75, #76, #77, #78, #79 | DOC-03, UI-01, UI-02, UI-03, UI-04, UI-05, STYLE-01, STYLE-02, RWD-01, RWD-02, A11Y-01, A11Y-02, VIS-01, VIS-02 | Contract, UI, style, responsive, accessibility, visual |
| AC-09 | #73 | TRACE-01 | Feature ownership review |
| AC-10 | #74 | RULE-01, API-01, UI-01, E2E-01, RWD-01, VIS-01 | Rules, API, UI, E2E, responsive, visual |
| AC-11 | #74 | API-02, AUTH-01, UI-01, E2E-01 | API, authorization, UI, E2E |
| AC-12 | #74, #75 | API-01, API-03, AUTH-01, REG-02, E2E-01, E2E-02 | API, authorization, regression, E2E |
| AC-13 | #74, #75 | RULE-01, API-01, API-03, UI-01, E2E-01, A11Y-01 | Rules, API, UI, E2E, accessibility |
| AC-14 | #75, #77 | API-03, API-05, AUTH-01, E2E-02, E2E-04 | API race, authorization, E2E |
| AC-15 | #75 | API-03, UI-01, E2E-02 | API, UI, E2E |
| AC-16 | #76 | RULE-02, API-04, UI-02, E2E-03, A11Y-01, VIS-01 | Rules, API, UI, E2E, accessibility, visual |
| AC-17 | #74 | API-01, E2E-01 | API retry, E2E |
| AC-18 | #74, #76 | API-02, API-04, AUTH-01, UI-01, E2E-03 | API, authorization, UI, E2E |
| AC-19 | #77 | RULE-02, API-05, AUTH-01, UI-02, E2E-04 | Rules, API, authorization, UI, E2E |
| AC-20 | #75, #77 | API-03, API-05, E2E-02, E2E-04 | API concurrency, E2E |
| AC-21 | #77 | API-05, REG-02, UI-02, E2E-04 | API, regression, UI, E2E |
| AC-22 | #78 | RULE-03, API-06, AUTH-01, PERF-01, UI-03, E2E-05, RWD-02, A11Y-02, VIS-02 | Rules, API, authorization, performance, UI, E2E, responsive, accessibility, visual |
| AC-23 | #78 | API-06, API-08, UI-03, UI-05, E2E-05 | API parity, UI, E2E |
| AC-24 | #79 | RULE-03, API-07, AUTH-01, PERF-02, UI-04, E2E-06 | Rules, API, authorization, performance, UI, E2E |
| AC-25 | #79 | API-07, API-08, PERF-02, UI-04, UI-05, E2E-06, RWD-02, VIS-02 | API parity, performance, UI, E2E, responsive, visual |
| AC-26 | #78, #79 | API-09, UI-03, UI-04, UI-05, AUTH-01, E2E-05, E2E-06, A11Y-02 | API, UI, authorization, E2E, accessibility |
| AC-27 | #74 | MIG-01, MIG-02, REG-01 | Migration, recovery, seed, regression |
| AC-28 | #74–#79 | REG-01, REG-02, REG-03, API-09, AUTH-01, E2E-01, E2E-04 | Regression, API, authorization, E2E |
| AC-29 | #74, #75, #76, #78, #79 | UI-01, UI-02, UI-03, UI-04, API-01, API-03, API-04, E2E-01, E2E-02, E2E-03, A11Y-01 | UI, API failure, E2E, accessibility |
| AC-30 | #74, #75, #76, #77, #78, #79 | STYLE-01, STYLE-02, RWD-01, RWD-02, A11Y-01, A11Y-02, VIS-01, VIS-02 | Style, responsive, accessibility, visual |

The contract-only checks verify that statements and ownership links are complete; runtime product behavior is verified by the assigned feature issues. Migration/recovery and seed checks belong to #74; action field history/concurrency checks belong to #75/#76; Ticket gate and Administrator regression belongs to #77; database parity and boundedness/performance-smoke belongs to #78/#79.

## 3. Coverage by Test Type and Owner

| Type | Planned tests | Owner |
| --- | --- | --- |
| Contract/traceability | DOC-01, DOC-02, TRACE-01 | #73 |
| Rule/unit | RULE-01, RULE-02, RULE-03 | #74–#79 by rule |
| API/integration | API-01–API-09 | #74–#79 by endpoint |
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
| DOC-01 | Contract review | Required engineering, API, UI, and test sections; exact fields, statuses, role rules, routes, and no report deliverables | All four docs agree and cover #73 acceptance | docs/lab-04/*.md | #73 | Not run |
| DOC-02 | Contract review | Numbered FR/BR/AC statements and data decisions | IDs are stable and at least two database choices have reasons | docs/lab-04/specification.md | #73 | Not run |
| DOC-03 | Contract review | Cross-check action fields, workflows, role matrix, API shapes, dashboard predicates, migration/recovery, UI behavior, and verification assignments across all four docs | Shared rules are identical wherever referenced; all #73 deliverables are present | docs/lab-04/*.md | #73 | Not run |
| TRACE-01 | Traceability | Every AC, test category, and migration/regression/E2E/performance/accessibility/visual check has an owning feature ticket | Every criterion links to a planned test and #74–#79 or #73 owner | docs/lab-04/tests.md | #73 | Not run |
| RULE-01 | Unit | Trim/count Unicode code points; optional Result; conditional Follow-up Note; Attachment Notes; action completion prerequisites | Valid input normalizes; invalid input is rejected without writes | server/tests/lab-04/action-rules.test.ts | #74–#76 | Not run |
| RULE-02 | Unit | Action transition matrix, Ticket transition matrix, owner and resolution/cancellation gates | Only specified edges pass; all gate boundaries are exact | server/tests/lab-04/workflow-rules.test.ts | #76, #77 | Not run |
| RULE-03 | Unit | Active population, priority/status grouping, requester ownership, UTC inclusive bounds, Bangkok display conversion | Predicates include both interval endpoints and exclude out-of-scope rows | server/tests/lab-04/dashboard-rules.test.ts | #78, #79 | Not run |
| API-01 | API/integration | Create defaults/selected assignee, actor/date spoof rejection, parent version, normalized idempotency replay/conflict, terminal Ticket, validation | One planned action/event persists; identical retry creates none; changed payload conflicts | server/tests/lab-04/actions-taken.api.test.ts | #74 | Not run |
| API-02 | API/authorization | Action list/history pagination, stable order, Requester own Ticket, foreign Ticket, staff/Admin reads, no requester write | Own authorized reads succeed; foreign reads are 404; Requester writes are 403 | server/tests/lab-04/actions-taken.api.test.ts | #74 | Not run |
| API-03 | API/concurrency | Pending edit, reassignment, two workers, stale action/Ticket versions, ineligible actor/assignee and account-change race | Exactly one current write succeeds; stale/ineligible writes change nothing | server/tests/lab-04/actions-taken.api.test.ts | #75 | Not run |
| API-04 | API/integration | Start/complete/cancel edges, result/follow-up gate, terminal immutability, event ordering, ticket public version/update time | Valid lifecycle persists attributed events; invalid or repeated terminal write conflicts | server/tests/lab-04/actions-taken.api.test.ts | #76 | Not run |
| API-05 | API/concurrency | Every Ticket transition, confirmation, owner requirement, resolution/cancellation gates, reopen, advisory indication, concurrent action/account writes, legacy status history | Matrix/gates hold through direct API calls and competing transactions; legacy Tickets have no fabricated transition events | server/tests/lab-04/ticket-workflow.api.test.ts | #77 | Not run |
| API-06 | API/integration | Requester aggregate query against fixture SQL, seven-day boundaries, resolution status, requester isolation, note isolation, zero results | Counts and previews match own public Tickets; no foreign/private data | server/tests/lab-04/requester-dashboard.api.test.ts | #78 | Not run |
| API-07 | API/integration | Staff/Admin status, priority, unassigned, owned, My Actions, recent and Urgent metrics | Counts/previews equal independently queried database results | server/tests/lab-04/staff-dashboard.api.test.ts | #79 | Not run |
| API-08 | API/parity | Dashboard card scopes and paginated Ticket/Action lists use identical predicates and time bounds | Card totals equal list totals for matching snapshot/fixture | server/tests/lab-04/requester-dashboard.api.test.ts; server/tests/lab-04/staff-dashboard.api.test.ts | #78, #79 | Not run |
| API-09 | API/authorization regression | Administrator operational permissions; Requester-only create/Attachment writes; private-note and session boundaries | Admin receives staff capabilities; earlier protected paths remain protected | server/tests/lab-04/authorization.api.test.ts | #77 | Not run |
| MIG-01 | Migration/recovery | Apply the deployed migration to a populated disposable DB, rerun it, and compare User/Ticket/Attachment/comment/note/session rows and Attachment byte hashes after both runs; rehearse restore | Existing values/bytes are identical after the first and second runs; no synthetic actions; backup/restore recovers a consistent pair | server/tests/lab-04/migration-preservation.test.ts; server/tests/check-migration-preservation.ts | #74 | Not run |
| MIG-02 | Seed/regression | Seed twice, edit seeded rows between runs, inspect lifecycle and dashboard examples | Stable-key insert-only rerun preserves edits and covers zero/nonzero examples | server/tests/lab-04/seed-preservation.test.ts | #74 | Not run |
| REG-01 | Regression | Requester login/password flow, Ticket creation/list/detail, ownership, Attachment upload/read/remove, Public Comments, resolution indication | Existing Requester journeys still pass with dashboard and actions present | Existing client/server labs 1–2 tests; e2e/lab-02/requester-flow.spec.ts | #74 | Not run |
| REG-02 | Regression | Staff queue/ownership/status/priority, Public Comments, Internal Notes privacy, Administrator user management | Earlier behavior passes; approved Administrator operational access works | Existing client/server labs 3 tests; e2e/lab-03/user-management.spec.ts; e2e/lab-03/internal-notes.spec.ts | #75, #77 | Not run |
| REG-03 | Regression | Run the complete existing earlier-lab client/server test suite in each feature issue's final verification, as applicable | Each feature records and fixes regressions it causes; the combined suite is green at the final integration checkpoint | pnpm run test; existing client/server labs 1–3 test suites | #74–#79 | Not run |
| UI-01 | UI | Action empty/list/read, create/edit modes, assignee choices, conditional validation, draft retention, replay, pending/terminal controls | Visible states match the contract; invalid/recoverable save keeps entered values | client/tests/lab-04/ActionsTaken.test.tsx | #74, #75 | Not run |
| UI-02 | UI | Action lifecycle and Ticket workflow controls, permitted choices, confirmation, version conflict, gate feedback, refreshed status | Controls match current state; failures retain draft and saved state | client/tests/lab-04/TicketWorkflow.test.tsx | #76, #77 | Not run |
| UI-03 | UI | Requester dashboard counts, previews, exact bounds, empty/loading/error/forbidden/retry | Shows real zero/empty and exact link parameters; never leaks other users’ data | client/tests/lab-04/RequesterDashboard.test.tsx | #78 | Not run |
| UI-04 | UI | Staff/Admin dashboard cards, action preview, zero/empty/error, exact links | Counts and links agree with API response and role | client/tests/lab-04/StaffDashboard.test.tsx | #79 | Not run |
| UI-05 | UI | My Tickets/Queue scope filters, retained from/through bounds, My Actions link and pagination | List result scope matches the selected dashboard metric | client/tests/lab-04/DashboardDrillDown.test.tsx | #78, #79 | Not run |
| STYLE-01 | Style/visual | Ticket Detail action list/forms/history and lifecycle dialogs against Zen Green conventions | No clipping, overlap, confusing private/shared content, or inconsistent controls | docs/lab-04/ui-spec.md §8; artifacts/lab-04/screenshots/actions-taken/ | #74–#77 | Not run |
| STYLE-02 | Style/visual | Requester and staff dashboards, My Actions and list drill-down | Cards, labels, counts, links, empty states, and navigation are coherent | docs/lab-04/ui-spec.md §8; artifacts/lab-04/screenshots/requester-dashboard/; artifacts/lab-04/screenshots/staff-dashboard/ | #78, #79 | Not run |
| RWD-01 | Responsive | Action detail with zero/one/many entries, create/edit forms, lifecycle and history | Works at 1440×900, 768×1024, 390×844, 320 CSS px and 200% zoom | e2e/lab-04/accessibility-responsive.spec.ts | #74–#77 | Not run |
| RWD-02 | Responsive | Both dashboards, My Tickets, Ticket Queue, and My Actions | Usable cards/lists; no page-wide horizontal overflow at all required sizes | e2e/lab-04/accessibility-responsive.spec.ts | #78, #79 | Not run |
| AUTH-01 | Authorization | Full role matrix, foreign Ticket/action/history, requesterId spoof, route direct access, account/cache switch | Server denies unauthorized operations and client displays a safe role state | server/tests/lab-04/authorization.api.test.ts; e2e/lab-04/role-access.spec.ts | #74–#79 | Not run |
| PERF-01 | Performance-smoke | Requester dashboard and recent/resolved lists with representative Tickets | Counts are snapshot-consistent, previews ≤5, list page bounded, response size/query time recorded | server/tests/lab-04/requester-dashboard.api.test.ts | #78 | Not run |
| PERF-02 | Performance-smoke | Staff dashboard and My Actions with representative Tickets/actions | Counts are accurate, previews ≤5, page bounded, response size/query time recorded | server/tests/lab-04/staff-dashboard.api.test.ts | #79 | Not run |
| E2E-01 | E2E | Staff creates multiple actions with different workers; owning Requester reads fields; non-owner cannot read | One shared, attributed action list; ownership and read-only rules hold | e2e/lab-04/actions-taken-flow.spec.ts | #74 | Not run |
| E2E-02 | E2E/concurrency | Two staff edit/reassign pending action; stale draft and account eligibility changes | Fresh edit saves; stale draft is retained and shown as conflict; Ticket Owner stays unchanged | e2e/lab-04/action-assignment-collaboration.spec.ts | #75 | Not run |
| E2E-03 | E2E | On each supported viewport, create/assign actions then start, complete, and cancel valid/invalid cases | Actions progress only on valid edges; completion/cancellation confirm; terminal history retains actor/time/order | e2e/lab-04/action-lifecycle.spec.ts | #76 | Not run |
| E2E-04 | E2E | Full Ticket transitions, resolution gate, advisory indication, reopen, cancel and concurrency | Ticket status remains valid after direct and competing writes | e2e/lab-04/ticket-resolution.spec.ts | #77 | Not run |
| E2E-05 | E2E | Requester dashboard landing, counts, bounds, My Tickets drill-down, Ticket detail, cache switch | Only authenticated user’s Tickets appear; preview/card links match details | e2e/lab-04/dashboards.spec.ts | #78 | Not run |
| E2E-06 | E2E | Staff/Admin landing, all cards, Queue filters, My Actions, parent/action links | Staff/Admin metrics and links match current-user assigned work | e2e/lab-04/dashboards.spec.ts | #79 | Not run |
| A11Y-01 | Accessibility | Keyboard-only create/edit/workflow journeys, labels, field errors, live updates, dialogs, focus return | All action and workflow tasks are operable and announced | e2e/lab-04/accessibility-responsive.spec.ts; axe checks | #74–#77 | Not run |
| A11Y-02 | Accessibility | Dashboard/card/list navigation, heading order, labels, focus, contrast and empty states | axe has no new serious/critical finding; keyboard flow remains clear | e2e/lab-04/accessibility-responsive.spec.ts; axe checks | #78, #79 | Not run |
| VIS-01 | Visual review | Action and Ticket Detail states across desktop/tablet/mobile | Checklist passes and reviewed screenshots show real, complete states | docs/lab-04/ui-spec.md §8; artifacts/lab-04/screenshots/actions-taken/ | #74–#77 | Not run |
| VIS-02 | Visual review | Requester/staff dashboard and drill-down states across desktop/tablet/mobile | Checklist passes for counts, layouts, links, errors, empties, and overflow | docs/lab-04/ui-spec.md §8; artifacts/lab-04/screenshots/requester-dashboard/; artifacts/lab-04/screenshots/staff-dashboard/ | #78, #79 | Not run |

## 5. Per-Issue Verification Ownership

| Issue | Verification that must finish inside the issue |
| --- | --- |
| #73 Contract | DOC-01, DOC-02, DOC-03, TRACE-01. No feature implementation or runtime behavior is claimed here. |
| #74 Create/view actions | API-01/02, MIG-01/02, REG-01/03, UI-01 create/read, AUTH-01 action ownership, E2E-01, RWD-01, A11Y-01, VIS-01. |
| #75 Edit/assign actions | API-03, REG-03, UI-01 edit/conflict, E2E-02, existing Ticket ownership and account-management regression, relevant RWD/a11y/visual checks. |
| #76 Action lifecycle | RULE-01/02 action rules, API-04, REG-03, UI-02 action controls, create/assign/start/complete/cancel E2E-03 on supported viewports, terminal history and confirmation keyboard/a11y/visual checks. |
| #77 Ticket workflow | RULE-02 workflow rules, API-05/09, REG-02/03, UI-02 Ticket controls, E2E-04, advisory/reopen/cancellation/account races and visual/a11y checks. |
| #78 Requester dashboard | RULE-03 requester predicates, API-06/08, REG-01/03 requester regression, UI-03/05, PERF-01, E2E-05, RWD-02, A11Y-02, VIS-02. |
| #79 Staff dashboard | RULE-03 staff predicates, API-07/08, REG-02/03 staff/Admin integration, UI-04/05, PERF-02, E2E-06, RWD-02, A11Y-02, VIS-02. |

Each feature verifies integration with completed prerequisites and features already present in its checkout. Every feature issue #74–#79 owns its applicable earlier-lab regression checks, including the full-suite checkpoint in REG-03; no regression is deferred to a release or hardening issue. If a sibling is unfinished, run independent assigned checks, record unavailable integration coverage accurately, and stop at the assigned issue. No feature issue takes over another issue’s implementation.

## 6. Test and Product Completion Notes

- Record command, fixture/environment, result, and any failure in the Final cell or linked concise test evidence after running it. Never mark a check Pass by plan or source inspection alone.
- Run focused rules/API/UI tests while implementation is active, then the complete existing client/server suite at the final integration checkpoint. Run affected Playwright journeys and full CI checks when shared configuration, dependency, or build behavior changes.
- Keep performance-smoke measurements tied to fixture size and local environment; do not infer a production throughput guarantee.
- Use migration recovery only on disposable database and Attachment storage. Do not reset a preserved environment.
- Changes to an earlier-lab expectation are allowed only when this contract explicitly supersedes it, notably Administrator IT Staff capabilities and the new action resolution gate. Update the old expectation in the feature issue that changes that behavior.
