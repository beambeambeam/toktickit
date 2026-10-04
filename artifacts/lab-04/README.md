# Issue #74 visual evidence

The owned Playwright journey writes fresh evidence to `screenshots/actions-taken/` with one real PNG per state and viewport. The capture helper also rewrites `manifest-desktop.json`, `manifest-tablet.json`, and `manifest-mobile.json` at the start of each project run, so a fresh run does not inherit stale entries.

PR #82 review-follow-up production run: **12/12 journeys passed** on 2026-10-03. All 44 PNGs were recaptured from clean, pushed source commit [`6dd2571551464a89c546236c63cb8b43a3e6233d`](https://github.com/beambeambeam/toktickit/commit/6dd2571551464a89c546236c63cb8b43a3e6233d) on `feature/74-create-view-actions-taken`. This source includes the reviewed UI, focus and API fixes. All 15 canonical PNGs and representative narrow, reflow, native-scale, error and uncertain-write captures were visually inspected. Each PNG has exactly one entry, and every canonical state is present at each viewport.

Manifests: [desktop](screenshots/actions-taken/manifest-desktop.json), [tablet](screenshots/actions-taken/manifest-tablet.json), [mobile](screenshots/actions-taken/manifest-mobile.json). Each entry links to [STYLE-01](../../docs/lab-04/tests.md#style-01) and [VIS-01](../../docs/lab-04/tests.md#vis-01), with actual UTC capture time, command, role and provenance. All three report `sourceDirty: false`. Subsequent evidence/record commits retain this reachable source SHA; a capture commit cannot include its own generated images.

The earlier `0ca28d4` SHA was a pre-regroup local commit, unavailable in a fresh clone. The current captures replace that evidence and no longer rely on local history. The final checkpoint passed 134 client tests, 140 server tests and 18 affected earlier-lab browser journeys. Runtime environment and commands are in [the test record](../../docs/lab-04/tests.md#pr-82-review-follow-up-checkpoint--2026-10-03).

```sh
pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-taken-flow.spec.ts
```

## Applicable #74 inventory

The fresh run targets each canonical state at desktop (1440 × 900), tablet (768 × 1024), and mobile (390 × 844).

| State | Stable filename | Provenance and scope |
| --- | --- | --- |
| Requester detail with no actions | `requester-actions-empty-{viewport}.png` | Natural own-Ticket Requester read. |
| Requester detail with multiple actions | `requester-actions-populated-{viewport}.png` | Natural own-Ticket read after real staff/Admin creation; this is a partial populated read because the history API is not available in #74. |
| Staff/Admin action list and attribution | `staff-actions-populated-{viewport}.png` | Natural Administrator read after multiple real action writes. |
| Create form with conditional follow-up validation | `action-create-validation-{viewport}.png` | Natural keyboard submit; blank Description focuses first, then true `Follow-Up Required` validation focuses the missing Follow-up Note. |
| Version conflict with recoverable draft | `action-conflict-draft-{viewport}.png` | Natural concurrent create; the stale draft remains visible before refresh and retry. |

## Supplementary captures

The fresh run also writes these supplementary states; they are not substitutes for the canonical inventory names:

- `actions-taken-loading-{viewport}.png`
- `actions-taken-error-{viewport}.png`
- `actions-taken-forbidden-{viewport}.png`
- `actions-taken-not-found-{viewport}.png`
- `action-create-uncertain-draft-{viewport}.png`
- `action-create-form-minimum-width-320-css-pixels-{viewport}.png`
- `action-create-form-css-reflow-200-percent-{viewport}.png`
- `action-create-form-native-page-scale-200-percent-desktop.png`
- `requester-actions-populated-minimum-width-320-css-pixels-{viewport}.png`
- `requester-actions-populated-css-reflow-200-percent-{viewport}.png`
- `requester-actions-populated-native-page-scale-200-percent-desktop.png`

The 320px entries record the fixed 320 CSS-pixel viewport. The reflow entries record the 720 CSS-pixel proxy used for the 200% check. Native page-scale entries are desktop-only and record Chromium page scale 2. The manifest records the observed viewport, zoom result, scenario, role, branch, full commit SHA, UTC capture time, exact command, provenance, and STYLE-01/VIS-01 links for every entry.

## Visual checklist — Pass for #74

| Check | Observed result |
| --- | --- |
| Zen Green layout and controls | Ticket cards, form controls, status badges and feedback match existing detail screens. |
| Wrapping and spacing | Long descriptions, literal HTML, multiline results and attribution remain inside their cards; no clipping or overlap in reviewed views. Empty and one-line action output no longer inherits the 6rem form-field minimum height. |
| Shared/private content | Requester action reads contain attribution and public fields, without write controls or Internal Notes. Staff private notes remain in a distinct section. |
| Validation and recovery | Conditional follow-up error is visible with field focus; conflict and uncertain-write captures retain the entered draft and expose recovery controls. |
| Responsive layout | Desktop and tablet fields fit their columns; mobile and 320px fields stack with usable controls. Automated overflow checks pass. |
| Accessibility | Opening focuses Description; Cancel and successful Save return focus to Add. Invalid-field focus passes; tested states have zero axe violations. |
| 200% checks | 720 CSS-pixel reflow and desktop Chromium page scale 2 pass; these are documented separately and do not claim browser-toolbar zoom. |

## Unavailable sibling states

This evidence set does not invent or duplicate screenshots for edit/reassign, start confirmation, completion confirmation, cancellation confirmation, terminal event history, or Ticket resolution-gate feedback. Those states belong to the unfinished #75–#77 journeys. The populated Requester image shows shared action fields and attribution only; it does not claim action history coverage because the history API is not present in #74.

## Issue #75 visual evidence

The earlier #74 record above remains historical. Edit/assignment and revision history now have their own evidence under `screenshots/actions-edit/`. The final run on 2026-10-04 passed **6/6 cases** across desktop (1440 × 900), tablet (768 × 1024), and mobile (390 × 844), capturing **28 PNGs** from clean local source commit `f1f7e9cd271903a5f5b3936e16436c72785ff18c` on `feature/75-edit-and-assign-pending-action-taken-safely`. This source commit and the following evidence commit have not been pushed.

Manifests: [desktop](screenshots/actions-edit/manifest-desktop.json), [tablet](screenshots/actions-edit/manifest-tablet.json), [mobile](screenshots/actions-edit/manifest-mobile.json). All report `sourceDirty: false`, the full source SHA, command, actual UTC capture times, scenario, role, viewport/zoom, state provenance, and STYLE-01/VIS-01 references. Each PNG has exactly one manifest entry. Final capture replaced the developmental dirty-source evidence.

| State | Filename | Provenance |
| --- | --- | --- |
| Pending edit/reassignment | `action-edit-reassign-{viewport}.png` | Natural second-worker assignment form. |
| Recoverable edit conflict | `action-conflict-draft-{viewport}.png` | Natural concurrent saved change; draft retained and Save blocked pending explicit refresh/review. |
| Historical ineligible assignee | `action-edit-historical-assignee-{viewport}.png` | Real Administrator account deactivation; original identity retained for pending correction. |
| Assignee loading/failure/empty | `action-edit-assignee-{loading,error,empty}-{viewport}.png` | Controlled lookup responses, declared in each manifest; real edit draft retained. |
| Requester paginated history | `action-edit-requester-history-page-two-{viewport}.png` | Natural own-Ticket read after 21 real revisions; second page shows actor/time and immutable snapshot fields. |
| Minimum width and reflow | `action-edit-minimum-width-320-{viewport}.png`, `action-edit-css-reflow-200-percent-{viewport}.png` | Saved long description at 320 CSS pixels and the 720 CSS-pixel reflow proxy. |
| Native Chromium scale | `action-edit-native-page-scale-200-percent-desktop.png` | Chromium page scale 2; separate from the CSS reflow check, with no browser-toolbar zoom claim. |

### Visual checklist — Pass for #75

All six canonical edit/conflict images and representative history, historical-assignee, failure, 320px, CSS reflow and native-scale images were inspected after final capture.

| Check | Observed result |
| --- | --- |
| Zen Green controls/layout | Cards, buttons, field labels and feedback match existing Ticket Detail. Wide form columns fit; mobile controls stack. |
| Wrapping/spacing | Long saved descriptions and revisions wrap inside cards. Reviewed views show no clipping, overlap or page-wide horizontal overflow. |
| Shared/private boundary | Requester history exposes actor/time and public snapshots, with no edit controls or Internal Notes. |
| Draft recovery | Conflict and lookup failure retain entered text. Save stays blocked until explicit review or successful lookup retry. Historical assignee copy explains reassignment eligibility. |
| Accessibility | Keyboard entry, field errors, Save/Cancel focus return and live feedback pass; tested states have zero axe violations. |
| Responsive/zoom | Three standard viewports, 320px, CSS reflow and native page scale pass their automated checks. |

Start/complete/cancel confirmations, terminal transition history and new Ticket workflow gates remain #76/#77. This evidence does not claim those unavailable endpoints. Commands, regression totals and separate code-review results are in [the #75 verification record](../../docs/lab-04/tests.md#issue-75-verification--2026-10-04).
