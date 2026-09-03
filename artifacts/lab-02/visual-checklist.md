# Lab 2 Visual Checklist — Create Ticket, My Tickets, Ticket Detail

Compares each screen against `docs/lab-02/ui-spec.md` and the labsheet figures: Requester Ticket Detail (§12.6, `Lab_02_labsheet_2.png`, p. 2), Development Requester Selection (§12.3, `Lab_02_labsheet_9.png`, p. 9), and My Tickets (§12.5, `Lab_02_labsheet_10.png`, p. 10). The figures are visual direction only: Lab 2 keeps Requested Priority and Current Status `New`; Profile, IT Priority, Ticket Owner, Public Comments, Service Actions, Event Log, and Resolution Summary stay excluded.

Evidence is captured by `e2e/lab-02/requester-flow.spec.ts` (`pnpm test:e2e`) across desktop, tablet, and mobile Chromium projects. Viewport widths follow the UI contract: desktop 992px and above, tablet 768–991 px, mobile below 768 px. Each run writes `screenshots/manifest-<project>.json` listing the timestamp and every screenshot file that run produced, so a partial run cannot be mistaken for a clean one. The `Basis` column marks each row as machine-asserted (an executable check) or human-judged (screenshot review).

## Create Ticket — `screenshots/create-ticket/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Initial layout, Zen Green shell/tokens, labels above controls | `desktop-chromium-initial.png` | `tablet-chromium-initial.png` | `mobile-chromium-initial.png` | Human-judged, plus header-token assertion below |
| Required asterisks with messages below invalid controls | `desktop-chromium-validation.png` | `tablet-chromium-validation.png` | `mobile-chromium-validation.png` | Human-judged |
| Filled reference-data selects, Summary/Description width | `desktop-chromium-filled.png` | `tablet-chromium-filled.png` | `mobile-chromium-filled.png` | Human-judged |
| Success Ticket Number with next action | `desktop-chromium-success.png` | `tablet-chromium-success.png` | `mobile-chromium-success.png` | Machine-asserted Ticket Number format |
| No horizontal page overflow on the filled form | Pass | Pass | Pass | Machine-asserted overflow check |

## My Tickets — `screenshots/my-tickets/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Owned list, search/filter/sort/pagination controls | `desktop-chromium-owned.png` | `tablet-chromium-owned.png` | `mobile-chromium-owned.png` | Human-judged, plus header-token assertion |
| Empty owned list versus valid no-results query, distinct text/actions | `desktop-chromium-empty.png` / `desktop-chromium-no-results.png` | `tablet-chromium-empty.png` / `tablet-chromium-no-results.png` | `mobile-chromium-empty.png` / `mobile-chromium-no-results.png` | Machine-asserted empty/no-results text |
| Isolation Requester shows a populated list with none of Requester A's numbers | `desktop-chromium-ownership.png` | `tablet-chromium-ownership.png` | `mobile-chromium-ownership.png` | Machine-asserted presence/absence of Ticket links |
| Table-to-card switch below 768 px with identifying info retained | Table | Table | Cards | Human-judged |
| No horizontal page overflow on the owned list | Pass | Pass | Pass | Machine-asserted overflow check |

Each viewport isolates against its own seeded Requester (desktop 2, tablet 3, mobile 4) holding two API-seeded Tickets, so the ownership capture is a populated list visibly free of Requester A's numbers rather than a second copy of the empty capture.

## Ticket Detail — `screenshots/ticket-detail/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Read-only Ticket information visually distinct from Attachment actions | `desktop-chromium-active.png` | `tablet-chromium-active.png` | `mobile-chromium-active.png` | Human-judged |
| Active state label with non-color indicator plus Download/Remove | `desktop-chromium-active.png` | `tablet-chromium-active.png` | `mobile-chromium-active.png` | Machine-asserted state-label text |
| Removed metadata with reason, no download or preview action | `desktop-chromium-removed.png` | `tablet-chromium-removed.png` | `mobile-chromium-removed.png` | Machine-asserted state-label text and removed-download 404 |
| Cross-Requester attachment read rejected before removal | Pass | Pass | Pass | Machine-asserted foreign-header 404 |
| Removed content request rejected; unowned Ticket safely hidden | `desktop-chromium-removed.png` / `desktop-chromium-unauthorized.png` | `tablet-chromium-removed.png` / `tablet-chromium-unauthorized.png` | `mobile-chromium-removed.png` / `mobile-chromium-unauthorized.png` | Machine-asserted 404 responses |
| Stacked fields and full-width Attachment actions below 768 px | N/A | Two-column grid | Stacked | Human-judged |
| No horizontal page overflow on the active Detail | Pass | Pass | Pass | Machine-asserted overflow check |

## Cross-screen checks

- Zen Green primary header token resolves to `rgb(0, 107, 60)`: machine-asserted computed-style check on the My Tickets screen. Remaining token, contrast, spacing, and hierarchy review: human-judged against the screenshots.
- Visible keyboard focus, accessible names, status announcements, non-color error/warning/success/priority/status indicators: human-judged from the screenshots; interaction coverage in `client/tests/lab-02/*.test.tsx`.
- Removed/unavailable Attachments never offer download or preview: Pass; enforced in `$ticketId.tsx` and proven by the machine-asserted removed-download and foreign-read 404 responses.

Final human visual approval is pending and will be recorded in `docs/lab-02/reviewer.md`.
