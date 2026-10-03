# Issue #74 visual evidence

The owned Playwright journey writes fresh evidence to `screenshots/actions-taken/` with one real PNG per state and viewport. The capture helper also rewrites `manifest-desktop.json`, `manifest-tablet.json`, and `manifest-mobile.json` at the start of each project run, so a fresh run does not inherit stale entries.

Final production-build run: **12/12 journeys passed** on 2026-10-03. Captures record clean source commit `0ca28d4cc1bfd289557ed317cc12321967353ea8` on `lab4-staging`. The root agent inspected all 15 canonical PNGs and representative narrow, reflow, native-scale, error and uncertain-write captures. Metadata validation verified all 44 PNGs exist, each has exactly one manifest entry, and every canonical state is present at each viewport.

Manifests: [desktop](screenshots/actions-taken/manifest-desktop.json), [tablet](screenshots/actions-taken/manifest-tablet.json), [mobile](screenshots/actions-taken/manifest-mobile.json). Each entry links to the [STYLE-01](../../docs/lab-04/tests.md#style-01) and [VIS-01](../../docs/lab-04/tests.md#vis-01) results. Later evidence-only commits retain this actual capture source SHA. The verified work was subsequently regrouped into focused commits on `feature/74-create-view-actions-taken`; capture metadata retains its original branch and SHA rather than claiming a new capture. Implementation and browser-test files are identical to the reviewed snapshot `3ddb6a1`, which remains in the preserved original local history.

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
| Wrapping and spacing | Long descriptions, literal HTML, multiline results and attribution remain inside their cards; no clipping or overlap in reviewed views. |
| Shared/private content | Requester action reads contain attribution and public fields, without write controls or Internal Notes. Staff private notes remain in a distinct section. |
| Validation and recovery | Conditional follow-up error is visible with field focus; conflict and uncertain-write captures retain the entered draft and expose recovery controls. |
| Responsive layout | Desktop and tablet fields fit their columns; mobile and 320px fields stack with usable controls. Automated overflow checks pass. |
| Accessibility | Keyboard create and invalid-field focus pass; tested states have zero axe violations. |
| 200% checks | 720 CSS-pixel reflow and desktop Chromium page scale 2 pass; these are documented separately and do not claim browser-toolbar zoom. |

## Unavailable sibling states

This evidence set does not invent or duplicate screenshots for edit/reassign, start confirmation, completion confirmation, cancellation confirmation, terminal event history, or Ticket resolution-gate feedback. Those states belong to the unfinished #75–#77 journeys. The populated Requester image shows shared action fields and attribution only; it does not claim action history coverage because the history API is not present in #74.
