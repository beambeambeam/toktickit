# Lab 4 Reviewer Record

## Earlier review — PR #80

[PR #80 — Sprint 4 engineering contract](https://github.com/beambeambeam/toktickit/pull/80) is open against `lab4-staging`. On 2026-10-02, @Kiatisakk and the Greptile review bot left ten inline review threads. Each finding was addressed in its own commit, answered in its thread, and resolved.

| Reviewer | Finding | Response |
| --- | --- | --- |
| Greptile | Document that legacy Ticket status history cannot be reconstructed from the new event table. | Added the migration boundary and user-facing history note. [Commit](https://github.com/beambeambeam/toktickit/commit/b40d193); replied and resolved. |
| Greptile | Require server confirmation for terminal Action Taken transitions. | Required and documented server confirmation. [Commit](https://github.com/beambeambeam/toktickit/commit/4788a73); replied and resolved. |
| @Kiatisakk | Align specification headings with the Lab 4 handout. | Added all 11 sections and moved decisions to §11. [Commit](https://github.com/beambeambeam/toktickit/commit/c7dbf4f); replied and resolved. |
| @Kiatisakk | Remove the follow-up completion condition made unreachable by BR-05. | Removed the unreachable condition. [Commit](https://github.com/beambeambeam/toktickit/commit/54f1fd9); replied and resolved. |
| @Kiatisakk | Use observable Given/When/Then product acceptance criteria. | Replaced process criteria with 25 product outcomes and moved contract checks to DoD. [Commit](https://github.com/beambeambeam/toktickit/commit/f17e655); replied and resolved. |
| @Kiatisakk | Add the required reviewer and AI-use records. | Added both handout-required files and updated scope/DoD. [Commit](https://github.com/beambeambeam/toktickit/commit/34a14c3); replied and resolved. |
| @Kiatisakk | Mark the contract as proposed until peer review approves it. | Marked specification, API, and UI docs proposed. [Commit](https://github.com/beambeambeam/toktickit/commit/0eb58ce); replied and resolved. |
| @Kiatisakk | Specify deterministic error precedence for the resolution gate. | Returned all gate reasons in a fixed order under one error code. [Commit](https://github.com/beambeambeam/toktickit/commit/01ddb40); replied and resolved. |
| @Kiatisakk | List stable screenshot names and states for each evidence folder. | Added per-folder desktop/tablet/mobile state filenames. [Commit](https://github.com/beambeambeam/toktickit/commit/5bbb7c0); replied and resolved. |
| @Kiatisakk | Split bundled API test cases into separately verifiable rows. | Split the plan into focused API test IDs and updated traceability. [Commit](https://github.com/beambeambeam/toktickit/commit/8cde49e); replied and resolved. |

No reviewer approval has been received for PR #80 as of 2026-10-02. Do not treat an automated check as peer approval.

## PR #82 — Issue #74 create/view Actions Taken

[PR #82](https://github.com/beambeambeam/toktickit/pull/82) targets `lab4-staging` and closes #74. On 2026-10-03, @Kiatisakk requested changes at `7e96a8a`. The review included 12 human inline threads and two Greptile threads. The general findings requested the `lab-04` label and current AI-use/reviewer records. The label is applied and [ai-use.md](ai-use.md) records actual #74 prompts and models.

All 14 inline findings have responses. Thirteen changed findings have separate commits; the duplicate Resolved test finding was already addressed by the earlier status fix and received a reply without an empty commit. All commits are pushed. Threads remain open for reviewer verification and resolution. No human approval has been received; automated checks are not peer approval. Review request and approval state are tracked on the PR.

| Reviewer | Finding | Change | Thread reply / state |
| --- | --- | --- | --- |
| Greptile | [Generated-user action references](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172471972) | [`597a3e3`](https://github.com/beambeambeam/toktickit/commit/597a3e3) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173509149); open. |
| Greptile | [Saved action outside pagination](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172471975) | [`77e72f9`](https://github.com/beambeambeam/toktickit/commit/77e72f9) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173516560); open. |
| @Kiatisakk | [Resolved Ticket creation restriction](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671851) | [`e39e7b7`](https://github.com/beambeambeam/toktickit/commit/e39e7b7) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173536121); open. |
| @Kiatisakk | [Resolved Ticket API test](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671856) | [`e39e7b7`](https://github.com/beambeambeam/toktickit/commit/e39e7b7) (same root cause; no separate change) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173537436); open. |
| @Kiatisakk | [Incorrect Resolved verification record](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671860) | [`88c1b96`](https://github.com/beambeambeam/toktickit/commit/88c1b96) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173540829); open. |
| @Kiatisakk | [Blank Assignee selection](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671863) | [`7231698`](https://github.com/beambeambeam/toktickit/commit/7231698) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173545624); open. |
| @Kiatisakk | [Create/cancel/save keyboard focus](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671867) | [`d93ea18`](https://github.com/beambeambeam/toktickit/commit/d93ea18) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173571814); open. |
| @Kiatisakk | [Read-field whitespace](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671871) | [`59f4c55`](https://github.com/beambeambeam/toktickit/commit/59f4c55) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173573701); open. |
| @Kiatisakk | [Unexpected list error code and logging](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671878) | [`96f9840`](https://github.com/beambeambeam/toktickit/commit/96f9840) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173578567); open. |
| @Kiatisakk | [Assignee field error details](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671882) | [`887945e`](https://github.com/beambeambeam/toktickit/commit/887945e) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173581501); open. |
| @Kiatisakk | [Canonical payload hash order](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671888) | [`a49ac13`](https://github.com/beambeambeam/toktickit/commit/a49ac13) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173591019); open. |
| @Kiatisakk | [Action-card heading outline](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671892) | [`6729249`](https://github.com/beambeambeam/toktickit/commit/6729249) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173592921); open. |
| @Kiatisakk | [Migration recovery reproduction](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671899) | [`6dd2571`](https://github.com/beambeambeam/toktickit/commit/6dd2571) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173598050); open. |
| @Kiatisakk | [Reachable screenshot provenance](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4172671903) | [`dd0e56a`](https://github.com/beambeambeam/toktickit/commit/dd0e56a) | [Reply](https://github.com/beambeambeam/toktickit/pull/82#discussion_r4173624889); open. |

Verification after these changes: 134 client tests, 140 server tests, OpenAPI parity, all TypeScript projects, format/lint and both production builds passed. The feature browser run passed 12 journeys and recaptured 44 PNGs from pushed source `6dd2571`; all 15 canonical states and representative supplementary captures were inspected. Eighteen affected earlier-lab browser journeys and both migration recovery/preservation scripts passed. See [the current test checkpoint](tests.md#pr-82-review-follow-up-checkpoint--2026-10-03) and [visual inventory](../../artifacts/lab-04/README.md).
