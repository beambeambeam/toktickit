# Lab 2 Peer Review Record

This record was reconstructed from GitHub on 2026-09-02. It covers the review received in this repository and the completed reciprocal reviews in the reviewer's repository.

## Participants

| Role | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| Student and repository owner | Supawit Marayat | `67070501045` | [@beambeambeam](https://github.com/beambeambeam) |
| Peer reviewer | Kiatisak Markmeeshap | `67070501005` | [@Kiatisakk](https://github.com/Kiatisakk) |

The same pair reviewed in both directions. Kiatisak reviewed Supawit's work in [`beambeambeam/toktickit`](https://github.com/beambeambeam/toktickit), and Supawit reviewed Kiatisak's work in [`Kiatisakk/toktickit`](https://github.com/Kiatisakk/toktickit).

## Review received

Supawit's Lab 2 work was reviewed by Kiatisak in the following Issue-backed PRs.

| PR | Scope | Review and response | Final state |
| --- | --- | --- | --- |
| [#39](https://github.com/beambeambeam/toktickit/pull/39) | Issue #35: Lab 2 specification | Numbered FR and BR sections were required. `356cec9` added them and the companion documents; `70362f6` resolved two automated contract findings. | Approved and merged by Kiatisak on 2026-08-28. |
| [#42](https://github.com/beambeambeam/toktickit/pull/42) | Issue #36: requester context and ticketing flow | Two blocking evidence gaps and two Greptile P1 Attachment findings were resolved in `dc87ecd` and `9988016`; Kiatisak re-reviewed with `LGTM`. | Approved and merged by Kiatisak on 2026-09-02. |
| [#43](https://github.com/beambeambeam/toktickit/pull/43) | Issue #37: My Tickets discovery and ownership | Kiatisak found no blocking defects and requested independent API contract cases, 44px/wrapping mobile pagination controls, and empty/no-results screenshot evidence. Follow-up changes address all requested items. | Follow-up human review pending. |

## Reviews completed for Kiatisak

Supawit reviewed every completed Issue-backed Lab 2 work PR available in Kiatisak's repository: Issues #14 through #19. He also reviewed the formatter repair and the follow-up review-record PR. GitHub shows all eight PRs approved and merged by `beambeambeam`.

| Partner PR | Scope | Review and response | Final state |
| --- | --- | --- | --- |
| [#22](https://github.com/Kiatisakk/toktickit/pull/22) | Issue #14: sprint engineering contract | No actionable finding; approved with `LGTM`. | Approved and merged by Supawit on 2026-08-20. |
| [#23](https://github.com/Kiatisakk/toktickit/pull/23) | Issue #15: Zen Green foundation, routing, and tooling | 3 inline findings. Kiatisak replied to all 3 and fixed them in `6461582`; Supawit re-checked and approved. | Approved and merged by Supawit on 2026-08-22. |
| [#24](https://github.com/Kiatisakk/toktickit/pull/24) | Issue #16: Development Requester context | 11 inline findings. Kiatisak replied to all 11 and fixed them in `81f4c44`; Supawit re-checked and approved. | Approved and merged by Supawit on 2026-08-28. |
| [#25](https://github.com/Kiatisakk/toktickit/pull/25) | Formatter and line-ending repair; no Issue | No actionable finding; approved with `LGTM`. | Approved and merged by Supawit on 2026-08-28. |
| [#26](https://github.com/Kiatisakk/toktickit/pull/26) | Issue #17: ticket creation | 9 inline findings. Kiatisak replied to all 9 and fixed them in `4ee588e`; Supawit re-checked and approved. | Approved and merged by Supawit on 2026-08-29. |
| [#27](https://github.com/Kiatisakk/toktickit/pull/27) | Issue #18: My Tickets | 16 inline findings. Kiatisak fixed all 16 in `64e933e`; Supawit re-checked and approved with `LGTM`. | Approved and merged by Supawit on 2026-08-31. |
| [#29](https://github.com/Kiatisakk/toktickit/pull/29) | Issue #19: Ticket Detail and attachments | 11 inline findings. Kiatisak replied to all 11 and fixed them in `8ba1072`; Supawit approved. Kiatisak then requested another check after further layout commits. | Approved and merged by Supawit on 2026-09-01. |
| [#30](https://github.com/Kiatisakk/toktickit/pull/30) | Follow-up record of PR #29 review; no Issue | Verified the written record against the review discussion; approved with `LGTM`. | Approved and merged by Supawit on 2026-09-02. |

Across PRs #23, #24, #26, #27, and #29, Supawit submitted 50 top-level inline findings. The author addressed every finding before final approval; no finding was left unresolved or argued out of scope. PRs #22, #25, and #30 required no changes.

## Significant findings and resolutions

### PR #23 — foundation

The review found partial TypeScript strictness, stale Lab 1 branch guidance in `CLAUDE.md`, and duplicate string construction for field message IDs. Kiatisak enabled `strict: true` in all client tsconfigs, generalized workflow guidance to `<lab>-staging`, and introduced shared `errorId()` and `hintId()` builders.

### PR #24 — requester context

The 11 findings covered both implementation risk and specification compliance: retired seed rows could retain unique display-order slots; unchecked API payloads were cast to trusted types; shell props and context could disagree about identity; file URLs were parsed incorrectly; the review record was incomplete; required loading, empty, Continue, and Cancel behavior was missing or looping; requester IDs outside the positive safe-integer range received the wrong error; unmatched API paths and JSON parse failures escaped the documented envelope; a stale startup request could overwrite manual selection; and active IT staff could pass requester validation. Commit `81f4c44` resolved all 11 and added regression coverage.

### PR #26 — ticket creation

The 9 findings covered incomplete response guards, reference-data checks outside the creation transaction, ticket numbers beyond the six-digit limit, misleading pre-submit dates, an incomplete success screen, missing focus on the first invalid control, enabled submission when reference data was unavailable, unexplained empty reference lists, and missing API boundary tests. Commit `4ee588e` resolved all 9 and expanded the tests.

### PR #27 — My Tickets

The 16 findings covered incomplete ticket-list response validation, repeated and nested query parameters, non-decimal page sizes, inconsistent count and row snapshots, request races, missing loading skeletons, undersized mobile targets, missing table overflow, incorrect hover-token use, duplicate priority definitions, unexplained failed filter data, missing IT-priority tests, non-transactional demonstration seeding, and ticket numbers whose year did not match their creation year. Commit `64e933e` resolved all 16; later commits added running-app layout corrections and more visual regression coverage.

### PR #29 — Ticket Detail and attachments

The 11 findings included a race that could exceed the five-attachment limit, concurrent removals overwriting audit data, swallowed file-deletion errors, incomplete cleanup after partial writes, stale ticket-detail requests, uploaded test files accumulating on disk, ownership validation occurring after multipart buffering, and four missing attachment-row requirements: file type, uploading state, invalid state, and unavailable/retry state. Commit `8ba1072` resolved all 11 with per-ticket serialization, conditional removal, targeted cleanup, request lifecycle guards, ownership-first middleware, UI states, and regression tests.

### PR #42 — requester context and ticketing flow

The two blocking findings were evidence gaps, not missing authorization logic. The original E2E only proved that a Ticket link was absent from Requester 2's list; the follow-up captures the Requester 1 Ticket URL, switches requester context, navigates directly to that URL, and asserts the unavailable response. It also requests an active Attachment successfully, removes it, requests the same content URL, and asserts HTTP `404`.

The review also recorded non-blocking notes: §8.8 had no browser computed-colour assertions; §8.7 had no explicit horizontal-scroll check; one large PR provided thin Part 1 branch-history evidence; the reviewer had not read every large UI file in depth; `Closes #36` required the Development panel because the base branch was `lab2-staging`; and the `TKT-\\d{8}-[A-Z0-9]{6}` identifier shape differed from the approved illustration and was flagged as a submission risk, not a requested change. The reviewer separately confirmed the parameterized ownership queries, deterministic secondary sort key, and `ai-use.md` record were sound.

Follow-up verification reported `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm test:e2e` (6/6 across desktop, tablet, and mobile), `pnpm run build`, and `pnpm run check` passing.

### PR #43 — My Tickets discovery and ownership

Kiatisak found no blocking defects. The review requested separate API contract cases for search, filters, sorting, pagination, and invalid-query validation; explicit 44px mobile pagination controls and wrapping page buttons; and screenshots for the empty-owned-list and valid no-results states. The follow-up splits the server suite, uses the shared control-height token with wrapping pagination, and captures both states at desktop, tablet, and mobile viewports.

## Current limitations

- Kiatisak's Issues [#20](https://github.com/Kiatisakk/toktickit/issues/20) and [#21](https://github.com/Kiatisakk/toktickit/issues/21) remain open, so no review can yet be recorded for final report/submission or the Lab 2 release PR.
- PR #43's follow-up human review remains pending after the requested changes.
