# Lab 2 Visual Checklist — Final Evidence

This checklist compares the implementation against `docs/lab-02/ui-spec.md` and the labsheet figures: Requester Ticket Detail (§12.6, `Lab_02_labsheet_2.png`, p. 2), Development Requester Selection (§12.3, `Lab_02_labsheet_9.png`, p. 9), and My Tickets (§12.5, `Lab_02_labsheet_10.png`, p. 10). The figures are visual direction only: Lab 2 keeps Requested Priority and Current Status `New`; Profile, IT Priority, Ticket Owner, Public Comments, Service Actions, Event Log, and Resolution Summary stay excluded.

Final evidence was generated on 2026-09-03 by `e2e/lab-02/requester-flow.spec.ts` with `pnpm test:e2e` across desktop, tablet, and mobile Chromium projects. The run contains 72 unique PNGs: 6 Requester Selection, 21 Create Ticket, 24 My Tickets, and 21 Ticket Detail captures. Each `manifest-<project>.json` lists 24 files for one viewport. `Basis` distinguishes executable checks from screenshot review; no screenshot is reused under multiple state names.

## Requester Selection — `screenshots/requester-selection/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Initial active-Requester selector and testing-only context notice | `desktop-chromium-initial.png` | `tablet-chromium-initial.png` | `mobile-chromium-initial.png` | Screenshot review; UI-01 active-only test |
| Selected Requester and enabled Continue action | `desktop-chromium-selected.png` | `tablet-chromium-selected.png` | `mobile-chromium-selected.png` | Screenshot review; UI-01 context-persistence test |
| Selector excludes inactive Requesters and never presents as login | Pass | Pass | Pass | Machine-asserted UI-01 and route contract |

## Create Ticket — `screenshots/create-ticket/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Initial layout, Zen Green shell/tokens, labels above controls | `desktop-chromium-initial.png` | `tablet-chromium-initial.png` | `mobile-chromium-initial.png` | Screenshot review; header-token assertion |
| Required asterisks with messages below invalid controls | `desktop-chromium-validation.png` | `tablet-chromium-validation.png` | `mobile-chromium-validation.png` | Screenshot review; UI-03 validation test |
| Invalid Attachment feedback blocks submission | `desktop-chromium-invalid-attachment.png` | `tablet-chromium-invalid-attachment.png` | `mobile-chromium-invalid-attachment.png` | Screenshot review; UI-02/UI-03 |
| Filled reference-data selects, Summary/Description width | `desktop-chromium-filled.png` | `tablet-chromium-filled.png` | `mobile-chromium-filled.png` | Screenshot review |
| API failure preserves entered values and shows safe error | `desktop-chromium-api-failure.png` | `tablet-chromium-api-failure.png` | `mobile-chromium-api-failure.png` | Screenshot review; UI-03 |
| Busy state disables duplicate submission | `desktop-chromium-busy.png` | `tablet-chromium-busy.png` | `mobile-chromium-busy.png` | Screenshot review; UI-03 |
| Success Ticket Number and next action | `desktop-chromium-success.png` | `tablet-chromium-success.png` | `mobile-chromium-success.png` | Screenshot review; machine-asserted Ticket Number format |
| No horizontal page overflow on the complete form | Pass | Pass | Pass | Machine-asserted E2E overflow check |

## My Tickets — `screenshots/my-tickets/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Initial requester-scoped list | `desktop-chromium-initial.png` | `tablet-chromium-initial.png` | `mobile-chromium-initial.png` | Screenshot review |
| Owned list, search/filter/sort/pagination controls | `desktop-chromium-owned.png` | `tablet-chromium-owned.png` | `mobile-chromium-owned.png` | Screenshot review; header-token assertion |
| List API failure with retry action | `desktop-chromium-failure.png` | `tablet-chromium-failure.png` | `mobile-chromium-failure.png` | Screenshot review; UI-04 retry test |
| Loading/refetch state | `desktop-chromium-loading.png` | `tablet-chromium-loading.png` | `mobile-chromium-loading.png` | Screenshot review; UI-04 loading semantics |
| Filter-data failure with retry action | `desktop-chromium-filter-failure.png` | `tablet-chromium-filter-failure.png` | `mobile-chromium-filter-failure.png` | Screenshot review; API failure path |
| Valid no-results query versus empty owned list | `desktop-chromium-no-results.png` / `desktop-chromium-empty.png` | `tablet-chromium-no-results.png` / `tablet-chromium-empty.png` | `mobile-chromium-no-results.png` / `mobile-chromium-empty.png` | Machine-asserted distinct text/actions; screenshot review |
| Requester isolation shows no other Requester's Ticket links | `desktop-chromium-ownership.png` | `tablet-chromium-ownership.png` | `mobile-chromium-ownership.png` | Machine-asserted presence/absence of Ticket links |
| Table-to-card switch below 768 px with identifying info retained | Table | Table | Cards | Screenshot review |
| No horizontal page overflow on the complete list | Pass | Pass | Pass | Machine-asserted E2E overflow check |

Each viewport isolates against its own seeded Requester (desktop 2, tablet 3, mobile 4) holding two API-seeded Tickets. The ownership capture is therefore a populated list visibly free of Requester A's numbers, not a duplicate empty state.

## Ticket Detail — `screenshots/ticket-detail/`

| Check | desktop | tablet | mobile | Basis |
| --- | --- | --- | --- | --- |
| Read-only Ticket information with active Attachment actions | `desktop-chromium-active.png` | `tablet-chromium-active.png` | `mobile-chromium-active.png` | Screenshot review |
| Invalid Attachment feedback stays beside the picker | `desktop-chromium-invalid-attachment.png` | `tablet-chromium-invalid-attachment.png` | `mobile-chromium-invalid-attachment.png` | Screenshot review; UI-06 |
| Uploading state shows busy/disabled action | `desktop-chromium-uploading.png` | `tablet-chromium-uploading.png` | `mobile-chromium-uploading.png` | Screenshot review; UI-06 |
| Upload success shows the new active metadata row | `desktop-chromium-uploaded.png` | `tablet-chromium-uploaded.png` | `mobile-chromium-uploaded.png` | Screenshot review; E2E lifecycle |
| Removal confirmation explains retained metadata and requires a reason | `desktop-chromium-removal-confirmation.png` | `tablet-chromium-removal-confirmation.png` | `mobile-chromium-removal-confirmation.png` | Screenshot review; UI-06 |
| Removed metadata remains without download/remove action | `desktop-chromium-removed.png` | `tablet-chromium-removed.png` | `mobile-chromium-removed.png` | Screenshot review; removed-download 404 |
| Cross-Requester Ticket Detail is safely unavailable | `desktop-chromium-unauthorized.png` | `tablet-chromium-unauthorized.png` | `mobile-chromium-unauthorized.png` | Machine-asserted 404; screenshot review |
| Cross-Requester Attachment read is rejected before removal | Pass | Pass | Pass | Machine-asserted foreign-header 404 |
| Stacked fields and full-width Attachment actions below 768 px | N/A | Two-column grid | Stacked | Screenshot review |
| No horizontal page overflow on the complete Detail | Pass | Pass | Pass | Machine-asserted E2E overflow check |

## Cross-screen checks

- Zen Green primary header token resolves to `rgb(0, 107, 60)`: machine-asserted computed-style check on My Tickets. Remaining token, contrast, spacing, and hierarchy review: screenshot review.
- Visible keyboard focus, accessible names, status announcements, and non-color error/warning/success/priority/status indicators: screenshot review plus `client/tests/lab-02/*.test.tsx` interaction coverage.
- Removed/unavailable Attachments never offer download or preview: machine-asserted in the client and proven by removed-download and foreign-read `404` responses.
- The generated captures contain no development overlay or renderer footer.

Final visual review record: completed against the full generated capture set on 2026-09-03. The report uses distinct representative images once each; the manifests remain the complete evidence index. Student submission sign-off is a separate ownership action, not an unverified test result.
