# Lab 3 Visual and Accessibility Checklist

Status: staging evidence reviewed on 2026-09-19. This is an agent inspection of real Playwright captures from the Lab 3 browser run, not a peer approval or final-`main` sign-off.

## Run basis

| Item | Evidence |
| --- | --- |
| Browser command | `CI=1 pnpm --filter @toktickit/e2e exec playwright test lab-03` |
| Projects | Chromium at 1440×900, 768×1024 and 390×844; one worker; `CI=1` |
| Data | Fresh PostgreSQL 17 database, committed migrations, seeded Lab 3 fixtures, temporary Attachment storage |
| Result | 48 tests passed across the three projects; 41 unique manifest-listed captures per project, 123 PNGs total |
| Provenance | [desktop manifest](./screenshots/manifest-desktop-chromium.json), [tablet manifest](./screenshots/manifest-tablet-chromium.json), [mobile manifest](./screenshots/manifest-mobile-chromium.json) |

Machine assertions and agent inspection are separate. Browser role locators, headings, labels, status text and protected-route assertions are machine evidence. The visual notes below come from inspecting representative captures in each viewport and checking the complete manifest paths for duplicates. `normalized` state means the test restored a shared seeded Ticket through the real UI before capture; it is not presented as untouched seed data. Injected API responses are labeled `intercepted` in the manifests.

## Screen review

| Area | Captured evidence | Agent visual verdict | Accessibility / responsive notes | Remaining evidence gap |
| --- | --- | --- | --- | --- |
| Authentication | `authentication/` — invalid credentials, inactive account, busy 500, rate limit, mandatory password, authenticated shell and logout denial | Pass for captured states. Green header, centered card, clear hierarchy, readable labels, full-width primary action and no clipping observed. | Login and password labels/buttons are exercised by semantic locators. Mobile shell uses compact navigation and shows the Requester identity. | Unknown-account, real API outage and session-expiry matrix remain backend/release gates; the busy fixture covers the UI failure path. |
| Shared Ticket Queue | `staff-queue/` — populated, empty, no-results, loading and retryable failure | Pass for inspected desktop/tablet/mobile representatives. Tables and cards retain status, IT Priority, owner, updated time and Open Ticket action. | Search/filter labels and status/priority/owner text are visible; mobile actions remain practical. | Queue forbidden is a role-bound route condition rather than a queue response; active query/pagination breadth remains in API/UI coverage. |
| Staff Ticket detail | `staff-ticket-detail/` — read-only, controls, saved controls, resolved workflow, API failure, forbidden, Administrator note read; `accessibility/status-confirmation-keyboard.png` | Pass for inspected desktop/tablet/mobile representatives. Submitted values are visibly quiet/read-only; editable controls are grouped separately; public/private sections are distinct; long detail content wraps. | Public/private headings, status text and role-specific machine assertions pass. Mobile detail stacks without observed clipping. Dialog focus trap, Escape and focus restoration now pass in the workflow E2E. | Conflict race and complete Attachment active/removed coverage remain represented by existing regression evidence and planned backend cases. |
| User Management | `user-management/` — list/create/edit/reset plus empty, no-results, loading, failure, validation, saving, duplicate, self/last-admin and non-admin denial | Pass after fixing tablet `.button-small` wrapping. Desktop table, tablet table and mobile cards are readable; badges retain text and Edit remains one line. | Name/email/role/status/edit labels are present. Long generated names/emails wrap within cells/cards. | Real concurrent lifecycle races and revoked-session follow-up remain backend/release gates. |
| Requester conversation | `requester/*-public-conversation.png` | Pass for inspected desktop and mobile representatives. Ticket information, two attributed comments, composer, apparent-resolution action and Attachment area remain separated and readable. | Public-only Requester surface is visible; no Internal Notes heading appears. | Create/My Tickets continuity, Attachment lifecycle, apparent-resolution success and foreign-resource denial are not separately captured. |

## Cross-cutting checklist

| Check | Result |
| --- | --- |
| Zen Green palette, surface hierarchy and badges | Pass by visual spot check against `docs/lab-03/ui-spec.md`; no new gradient or animation observed. |
| Read-only versus editable distinction | Pass in Staff detail and Administrator detail captures; read-only fields use quiet static surfaces, operational controls are separate. |
| Text wrapping / clipping / overlap | Pass for inspected long emails, generated Ticket summaries, generated names and mobile detail content. Tablet User Management Edit buttons were fixed and rechecked. |
| Semantic headings, labels and status announcements | Machine coverage passes in the 24-test run; visual captures show expected headings and feedback. |
| Keyboard focus, dialog focus trap, Escape and focus restoration | Pass for login password toggle, visible focus, status-dialog cycle, Escape close and focus restoration in `accessibility/` and `status-confirmation-keyboard.png`. |
| Contrast and non-color status | Pass for sampled header, primary/secondary controls, status badges and role badges: the E2E contrast assertion requires at least 4.5:1, while status words/icons remain present. |
| 320px and 200% zoom | Pass for 320 CSS pixels and a 640 CSS-pixel 200%-zoom reflow equivalent across all projects. The latter is an explicit viewport proxy because Playwright has no browser zoom control; it is not a manual browser-zoom certification. |
| No duplicate image under multiple state labels | Pass for current manifests: each path is unique and new state names are distinct. |

## Evidence interpretation

The captures show implemented UI states and the browser assertions show the tested journeys. They do not prove migration preservation, every authorization row, server concurrency, final-`main` provenance, human peer approval, the student's reflection or PDF completion. Those items remain in [tests.md](../../docs/lab-03/tests.md) and [reviewer.md](../../docs/lab-03/reviewer.md) as pending gates where they are not evidenced.
