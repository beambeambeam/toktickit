# Lab 3 Visual and Accessibility Checklist

Status: staging evidence reviewed on 2026-09-19. This is an agent inspection of real Playwright captures from `lab3-staging`, not a peer approval or final-`main` sign-off.

## Run basis

| Item | Evidence |
| --- | --- |
| Browser command | `pnpm --filter @toktickit/e2e exec playwright test e2e/lab-03` |
| Projects | Chromium at 1440×900, 768×1024 and 390×844; one worker; `CI=1` |
| Data | Fresh PostgreSQL 17 database, committed migrations, seeded Lab 3 fixtures, temporary Attachment storage |
| Result | 24 tests passed across the three projects; 16 unique manifest-listed captures per project, 48 PNGs total |
| Provenance | [desktop manifest](./screenshots/manifest-desktop-chromium.json), [tablet manifest](./screenshots/manifest-tablet-chromium.json), [mobile manifest](./screenshots/manifest-mobile-chromium.json) |

Machine assertions and agent inspection are separate. Browser role locators, headings, labels, status text and protected-route assertions are machine evidence. The visual notes below come from inspecting representative captures in each viewport and checking the complete manifest paths for duplicates. `normalized` state means the test restored a shared seeded Ticket through the real UI before capture; it is not presented as untouched seed data. No axe, computed-contrast tool or keyboard recording was run; those gaps stay explicit.

## Screen review

| Area | Captured evidence | Agent visual verdict | Accessibility / responsive notes | Remaining evidence gap |
| --- | --- | --- | --- | --- |
| Authentication | `authentication/` — login initial/filled, mandatory password, authenticated shell, logout denial in all three manifests | Pass for captured states. Green header, centered card, clear hierarchy, readable labels, full-width primary action and no clipping observed. | Login and password labels/buttons are exercised by semantic locators. Mobile shell uses compact navigation and shows the Requester identity. | Invalid/unknown, inactive, busy, API failure and throttled views are not captured. Focus and contrast still need automated/manual measurement. |
| Shared Ticket Queue | `staff-queue/*-populated.png` | Pass for captured populated state. Desktop/tablet table keeps primary columns readable; mobile cards retain status, IT Priority, owner, updated time and Open Ticket action. | Search/filter labels and status/priority/owner text are visible; mobile actions remain practical. | Loading, empty, no-results, forbidden, retryable failure and active query/pagination captures are not present. |
| Staff Ticket detail | `staff-ticket-detail/` — read-only, controls, saved controls, resolved workflow, Administrator note read | Pass for inspected desktop/tablet/mobile representatives. Submitted values are visibly quiet/read-only; editable controls are grouped separately; public/private sections are distinct; long detail content wraps. | Public/private headings, status text and role-specific machine assertions pass. Mobile detail stacks without observed clipping. | Conflict, terminal confirmation, Attachment active/removed, requester indication and forbidden states need dedicated captures. |
| User Management | `user-management/` — list/create/edit/reset in all three manifests | Pass after fixing tablet `.button-small` wrapping. Desktop table, tablet table and mobile cards are readable; badges retain text and Edit remains one line. | Name/email/role/status/edit labels are present. Long generated names/emails wrap within cells/cards. | Empty, no-results, loading, failure, duplicate/invalid, saving, self/last-admin and non-admin denial states are not captured. |
| Requester conversation | `requester/*-public-conversation.png` | Pass for inspected desktop and mobile representatives. Ticket information, two attributed comments, composer, apparent-resolution action and Attachment area remain separated and readable. | Public-only Requester surface is visible; no Internal Notes heading appears. | Create/My Tickets continuity, Attachment lifecycle, apparent-resolution success and foreign-resource denial are not separately captured. |

## Cross-cutting checklist

| Check | Result |
| --- | --- |
| Zen Green palette, surface hierarchy and badges | Pass by visual spot check against `docs/lab-03/ui-spec.md`; no new gradient or animation observed. |
| Read-only versus editable distinction | Pass in Staff detail and Administrator detail captures; read-only fields use quiet static surfaces, operational controls are separate. |
| Text wrapping / clipping / overlap | Pass for inspected long emails, generated Ticket summaries, generated names and mobile detail content. Tablet User Management Edit buttons were fixed and rechecked. |
| Semantic headings, labels and status announcements | Machine coverage passes in the 24-test run; visual captures show expected headings and feedback. |
| Keyboard focus, dialog focus trap, Escape and focus restoration | Not measured in this evidence run. Existing component tests cover selected dialog/validation behavior; a complete keyboard audit remains pending. |
| Contrast and non-color status | Text badges include readable status/priority/role words and icons. Exact WCAG contrast ratios were not measured; pending. |
| 320px and 200% zoom | Not captured; pending. |
| No duplicate image under multiple state labels | Pass for current manifests: each path is unique; obsolete `initial`/`filled` auth duplicates were removed from Lab 3 evidence. |

## Evidence interpretation

The captures show implemented UI states and the browser assertions show the tested journeys. They do not prove migration preservation, every authorization row, server concurrency, final-`main` provenance, human peer approval, the student's reflection or PDF completion. Those items remain in [tests.md](../../docs/lab-03/tests.md) and [reviewer.md](../../docs/lab-03/reviewer.md) as pending gates where they are not evidenced.
