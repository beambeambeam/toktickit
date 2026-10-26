# Lab 4 Visual and Accessibility Checklist

Status: consolidated record of the Lab 4 screenshot evidence, written on 2026-10-26 at release. It summarizes the per-issue visual reviews in [README.md](./README.md) and the results in [tests.md](../../docs/lab-04/tests.md). I did not inspect the PNGs again for this record. It is not a peer approval.

## Evidence basis

| Issue | Folder | PNGs | Source commit in manifests | `sourceDirty` |
| --- | --- | --- | --- | --- |
| #74 Create and view Actions Taken | `screenshots/actions-taken/` | 44 | `6dd2571` | false |
| #75 Edit and assign | `screenshots/actions-edit/` | 28 | `a5abb9b` | false |
| #76 Action lifecycle | `screenshots/actions-taken/lifecycle/` | 19 | `9c8ceb7` | false |
| #77 Resolution gate | `screenshots/actions-taken/` (`ticket-resolution-gate-*`) | 5 | `25137f3` | not recorded |
| #78 Requester dashboard | `screenshots/requester-dashboard/` | 21 | `7de0c70` | true |
| #79 Staff and Administrator dashboard | `screenshots/staff-dashboard/` | 33 | `41d87c7` | false |

Every capture ran in Chromium at 1440×900 (desktop), 768×1024 (tablet) and 390×844 (mobile). Each folder has one manifest per viewport that records the command, the source commit and the scenario for each PNG. The release run on 2026-10-26 did not change any evidence file.

Provenance notes:

- **#78:** the PR #85 follow-up recaptured the Requester screenshots from `7de0c70` before the evidence files were committed, so the manifests say `sourceDirty: true`. The README and tests.md describe this.
- **#79:** the manifests record `41d87c7`, the commit after the rebase onto `lab4-staging`. Some tests.md rows cite `dd04239`, the same change before the rebase. The screenshots did not change.
- **#77:** the gate manifests record the source commit but have no `sourceDirty` field.

## Screen review

| Area | Captured evidence | Recorded verdict | Remaining evidence gap |
| --- | --- | --- | --- |
| Actions Taken create and read (#74) | Requester empty and populated, staff populated, validation, conflict draft, loading, error, forbidden, not found | Pass. Zen Green controls and layout, shared and private sections stay apart, conditional follow-up error has field focus. | None recorded. |
| Edit, reassign and history (#75) | Edit and reassign, conflict, historical assignee, lookup loading, error and empty, Requester history page two | Pass. Drafts are kept on conflict and lookup failure. | None recorded. |
| Action lifecycle (#76) | Start ready, completion and cancellation confirmation, terminal history | Pass at all three viewports. Dialogs keep both choices visible. | None recorded. |
| Resolution gate (#77) | Gate feedback at desktop, tablet and mobile, 320 px and 720 px reflow | Pass. | None recorded. |
| Requester dashboard (#78) | Populated, empty, loading, forbidden, API failure, recent drill-down | Pass. The card grid goes from four columns to two to one by viewport. | None recorded. |
| Staff and Administrator dashboard (#79) | Populated dashboard, Active Unassigned Queue, My Actions, 320 px, 720 px reflow, dashboard error | Pass after the duplicate `(Asia/Bangkok)` label was fixed in `8b5633f`. | **No screenshots for the staff loading, empty and forbidden states.** They have UI tests (UI-04) only. |

## Cross-cutting checklist

| Check | Result |
| --- | --- |
| Zen Green palette, surfaces and badges | Pass by the per-issue visual reviews. No new gradient or animation. |
| Shared versus private content | Pass. Requester screens show actor, time and public fields, with no lifecycle controls and no Internal Notes. |
| Text wrapping, clipping and overlap | Pass in the reviewed views. Narrow Queue tables scroll inside their card; this is earlier-lab layout. |
| Keyboard focus, dialog focus and Escape | Pass for the #74 to #76 forms and dialogs and the #78 dashboard (visible focus). |
| Automated WCAG scan (axe) | Pass with zero violations on the tested screens. #77 has axe and focus checks only; there is no keyboard-only Ticket status journey (A11Y-01 is Partial). |
| 320 px, 200% reflow and page scale | Pass. The 320 px check uses a 320 CSS px viewport. The 200% reflow check uses a 720 CSS px proxy. Native Chromium page scale 2 runs on desktop only. No browser toolbar zoom is claimed. |
| Screenshot provenance | Pass with the three notes above. Each PNG has one manifest entry. |

## Known gaps

- Staff loading, empty and forbidden states: UI tests only, no screenshots.
- The #78 manifests record a dirty source tree (see the provenance notes).
- The release run on 2026-10-26 re-ran the browser tests at all three viewports (142 passed, 8 skipped, 0 failed), but it did not regenerate or re-inspect the screenshots.
