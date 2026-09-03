# Lab 2 Visual Checklist — Create Ticket, My Tickets, Ticket Detail

Compares each screen against `docs/lab-02/ui-spec.md` and the supplied illustrations (`reports/lab02/tickets/02.png`, `09.png`, `11.png`). The illustrations are visual direction only: Lab 2 keeps Requested Priority and Current Status `New`; Profile, IT Priority, Ticket Owner, Public Comments, Service Actions, Event Log, and Resolution Summary stay excluded.

Evidence is captured by `e2e/lab-02/requester-flow.spec.ts` (`pnpm test:e2e`) across desktop, tablet, and mobile Chromium projects. Viewport widths follow the UI contract: desktop 992px and above, tablet 768–991px, mobile below 768px.

## Create Ticket — `screenshots/create-ticket/`

| Check | desktop | tablet | mobile |
| --- | --- | --- | --- |
| Initial layout, Zen Green shell/tokens, labels above controls | `desktop-chromium-initial.png` | `tablet-chromium-initial.png` | `mobile-chromium-initial.png` |
| Required asterisks with messages below invalid controls | `desktop-chromium-validation.png` | `tablet-chromium-validation.png` | `mobile-chromium-validation.png` |
| Filled reference-data selects, Summary/Description width | `desktop-chromium-filled.png` | `tablet-chromium-filled.png` | `mobile-chromium-filled.png` |
| Success Ticket Number with next action | `desktop-chromium-success.png` | `tablet-chromium-success.png` | `mobile-chromium-success.png` |
| No clipping, overlap, horizontal overflow, or hidden actions | Pass | Pass | Pass |

## My Tickets — `screenshots/my-tickets/`

| Check | desktop | tablet | mobile |
| --- | --- | --- | --- |
| Owned list, search/filter/sort/pagination controls | `desktop-chromium-owned.png` | `tablet-chromium-owned.png` | `mobile-chromium-owned.png` |
| Empty owned list versus valid no-results query, distinct text/actions | `desktop-chromium-empty.png` / `desktop-chromium-no-results.png` | `tablet-chromium-empty.png` / `tablet-chromium-no-results.png` | `mobile-chromium-empty.png` / `mobile-chromium-no-results.png` |
| Requester B isolation (no Requester A rows or links) | `desktop-chromium-ownership.png` | `tablet-chromium-ownership.png` | `mobile-chromium-ownership.png` |
| Table-to-card switch below 768px with identifying info retained | Table | Table | Cards |
| No clipping, overlap, horizontal overflow, or hidden actions | Pass | Pass | Pass |

## Ticket Detail — `screenshots/ticket-detail/`

| Check | desktop | tablet | mobile |
| --- | --- | --- | --- |
| Read-only Ticket information visually distinct from Attachment actions | `desktop-chromium-active.png` | `tablet-chromium-active.png` | `mobile-chromium-active.png` |
| Active state label with non-color indicator plus Download/Remove | `desktop-chromium-active.png` | `tablet-chromium-active.png` | `mobile-chromium-active.png` |
| Removed metadata with reason, no download or preview action | `desktop-chromium-removed.png` | `tablet-chromium-removed.png` | `mobile-chromium-removed.png` |
| Removed content request rejected; unowned Ticket safely hidden | `desktop-chromium-removed.png` / `desktop-chromium-unauthorized.png` | `tablet-chromium-removed.png` / `tablet-chromium-unauthorized.png` | `mobile-chromium-removed.png` / `mobile-chromium-unauthorized.png` |
| Stacked fields and full-width Attachment actions below 768px | N/A | Two-column grid | Stacked |
| No clipping, overlap, horizontal overflow, or unreadable filenames | Pass | Pass | Pass |

## Cross-screen checks

- Zen Green tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`), readable contrast, button hierarchy (primary/secondary/tertiary/destructive/disabled/busy): Pass on all screens and viewports.
- Visible keyboard focus, accessible names, status announcements, non-color error/warning/success/priority/status indicators: Pass; covered by `client/tests/lab-02/*.test.tsx` and the E2E keyboard-operable flow.
- Removed/unavailable Attachments never offer download or preview: Pass; enforced in `$ticketId.tsx` and proven by the E2E removed-download 404 assertion.

Final human visual approval is pending and will be recorded in `docs/lab-02/reviewer.md`.
