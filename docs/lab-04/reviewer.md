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

## PR #83 — Issue #75 pending edits and assignment

[PR #83](https://github.com/beambeambeam/toktickit/pull/83) targets `lab4-staging`. On 2026-10-06 UTC, @Kiatisakk requested changes at `571690e`. The review contained four inline threads and general requests for the Issue link and AI-use record.

Each inline finding now has its own pushed commit and matching reply. All four threads remain open for reviewer verification and resolution. This checkpoint does not claim human approval.

| Finding | Commit | Reply / state |
| --- | --- | --- |
| Focus after refresh | [`d837355`](https://github.com/beambeambeam/toktickit/commit/d837355a32f18722e2d33a88e0b19eff2b624959) | [Reply](https://github.com/beambeambeam/toktickit/pull/83#discussion_r4205345987). Open. |
| Server field-error focus | [`cf2fa29`](https://github.com/beambeambeam/toktickit/commit/cf2fa2946e627f816c96f1d977c5defee342f331) | [Reply](https://github.com/beambeambeam/toktickit/pull/83#discussion_r4205364199). Open. |
| Readable historical assignee identity | [`b39a8a5`](https://github.com/beambeambeam/toktickit/commit/b39a8a50091e237a026817d52d3472e55b287068) | [Reply](https://github.com/beambeambeam/toktickit/pull/83#discussion_r4205388749). Open. |
| Parent Ticket lock evidence | [`7ca8895`](https://github.com/beambeambeam/toktickit/commit/7ca8895a5953e7b3edcc00763f51960de0123fb4) | [Reply](https://github.com/beambeambeam/toktickit/pull/83#discussion_r4205421175). Open. |

The GitHub `addCloseIssueReferences` mutation linked Issue #75. A subsequent `closingIssuesReferences` query returned 75. The `lab-04` label remains present.

The AI-use record now contains actual Issue #75 prompts, model names, delegated work and review corrections. Commit: [`a5abb9b`](https://github.com/beambeambeam/toktickit/commit/a5abb9b8c6d924085ef0e22c35c700b1818f26da). The record does not invent a student reflection.

The shipped history endpoint matches `api-spec.md`: authorized reads, stable createdAt/ID order, bounded pages and public snapshot fields. Snapshots retain assignee IDs. The UI uses permitted current names where available and identifies unknown IDs as former assignees. It does not claim to store past names or roles.

The parent-lock regression observes a waiting Ticket `SELECT ... FOR UPDATE`. Concurrent resolution makes the captured Ticket version stale. That edit returns `VERSION_CONFLICT`. An edit with the fresh version returns `TICKET_TERMINAL`. Both preserve the action, events and resolved Ticket metadata. Removing the explicit Ticket lock makes this test fail.

GitHub tracks the review request and approval state. The reviewer must verify the replies and resolve the threads.

## PR #85 — Issue #78 Requester dashboard

[PR #85](https://github.com/beambeambeam/toktickit/pull/85) targets `lab4-staging`. @Kiatisakk requested changes and Greptile left inline findings. The review has 16 inline threads.

Each shared defect has one commit. Every thread has a matching reply with that commit. All threads remain open for reviewer verification and resolution. This checkpoint does not claim human approval.

| Finding | Commit | Reply / state |
| --- | --- | --- |
| Requester sign-in landed on My Tickets, not Dashboard | [`de9f0e0`](https://github.com/beambeambeam/toktickit/commit/de9f0e063a55844bafa8cde4c497254cb6943230) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243012250), [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243012365). Open. |
| Malformed `from`/`through` URL dates crashed My Tickets | [`58973b5`](https://github.com/beambeambeam/toktickit/commit/58973b599c81e8958df2daa4bd979fe51ace5f45) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243018027), [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243018123). Open. |
| My Tickets and Dashboard used different date formats; three formatter copies | [`2e9f321`](https://github.com/beambeambeam/toktickit/commit/2e9f321c9367a8f690d30f8f69b7c0a75d4fae21) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243022085), [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243022202). Open. |
| Refresh lost keyboard focus while fetching | [`510b654`](https://github.com/beambeambeam/toktickit/commit/510b6540738a6cbd0be8d0232c45bea75066b3b3) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243024100). Open. |
| Retry lost focus; Retry shown for forbidden errors | [`4729a4e`](https://github.com/beambeambeam/toktickit/commit/4729a4e1b9e2654fabfb9d11c67abc23783a9a0c) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243025835). Open. |
| Refresh result not announced | [`e4fa610`](https://github.com/beambeambeam/toktickit/commit/e4fa6108aba94deccf8e5eeba98d5f90bf373ddd) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243027395). Open. |
| Dashboard cache not refreshed after Ticket writes | [`2aaf09c`](https://github.com/beambeambeam/toktickit/commit/2aaf09c86823c0861f428c0eca9c6bc91fef1cd3) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243032235). Open. |
| No test rows on or 1 ms outside the window endpoints | [`53bd80e`](https://github.com/beambeambeam/toktickit/commit/53bd80ebd2082f66995a5b06c73c7c32a6e5b8a5) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243038042). Open. |
| Foreign Waiting Ticket not tested for ownership | [`1951e44`](https://github.com/beambeambeam/toktickit/commit/1951e4473be1e7388ab6387c5a91acb4b758c38f) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243039449). Open. |
| Rule test covered unused helpers; helpers unused; two overclaiming test records | [`7de0c70`](https://github.com/beambeambeam/toktickit/commit/7de0c707931999fb0b583957d932b6ac63f6cbc0) | [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243040945), [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243041027), [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243041126), [Reply](https://github.com/beambeambeam/toktickit/pull/85#discussion_r4243041231). Open. |

The first reply in the cache-refresh thread named the wrong commit. A second reply in the same thread gives `2aaf09c`.

Each test-gap fix has a mutation check. The new test failed when the fix was removed: the sign-in landing, the bad URL date, the Bangkok date format, Refresh focus, Retry focus, the refresh announcement, refetch on mount, `gte`/`lte` to `gt`/`lt` changes, the foreign Waiting count, and the active status set. The Dashboard repository now takes an optional snapshot time so the endpoint test can pin the window.

The reviewer must verify the replies and resolve the threads. A re-review request goes to @Kiatisakk only.
