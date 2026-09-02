# Lab 2 Peer Review Record

This record was reconstructed from GitHub on 2026-09-02. It covers the review received in this repository and the completed reciprocal reviews in the reviewer's repository.

## Participants

| Role | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| Student and repository owner | Supawit Marayat | `67070501045` | [@beambeambeam](https://github.com/beambeambeam) |
| Peer reviewer | Kiatisak Markmeeshap | `67070501005` | [@Kiatisakk](https://github.com/Kiatisakk) |

The same pair reviewed in both directions. Kiatisak reviewed Supawit's work in [`beambeambeam/toktickit`](https://github.com/beambeambeam/toktickit), and Supawit reviewed Kiatisak's work in [`Kiatisakk/toktickit`](https://github.com/Kiatisakk/toktickit).

## Review received

### PR #39 — Lab 2 specification

[beambeambeam/toktickit#39](https://github.com/beambeambeam/toktickit/pull/39) · `feature/5-requester-create` into `lab2-staging` · linked to Issue #35

| Event | GitHub evidence |
| --- | --- |
| Changes requested | Kiatisak, 2026-08-19 07:09 UTC |
| Finding | Functional Requirements and Business Rules were not numbered as required by labsheet §§4.3 and 8.10 and Part 2 submission evidence. |
| Response | Commit `356cec9` added numbered FR and BR sections and the companion API, UI, test, review, and AI-use documents. |
| Follow-up review | Kiatisak approved with `LGTM`, 2026-08-22 17:18 UTC. |
| Merge | Kiatisak merged the approved PR, 2026-08-28 16:12 UTC. |

Two automated inline findings were also resolved in commit `70362f6`: attachment removal reasons now share a 3–500 character limit across the specification, API, UI, Issues, and planned tests; attachment creation now defines file-write, database-transaction, and cleanup ordering so failed requests do not leave persisted metadata or orphan files.

Result: the blocking human finding and both automated contract findings were resolved before merge. PR #42's follow-up approval and merge are recorded below.

### PR #42 — Issue #36 requester ticketing flow

[beambeambeam/toktickit#42](https://github.com/beambeambeam/toktickit/pull/42) · `feature/36-requester-context-create-ticket` into `lab2-staging` · linked to Issue #36

| Event | GitHub evidence |
| --- | --- |
| Changes requested | Kiatisak, 2026-09-02, against commit `d5bebe9`: direct cross-Requester access and blocked removed-Attachment download evidence were missing. |
| Automated review | Greptile identified two P1 Attachment findings: the active-count limit could race under concurrent uploads, and failed file cleanup could leave removed metadata with unreclaimable content. |
| Human-review response | Commit `dc87ecd` added direct unauthorized Ticket navigation, blocked removed-Attachment URL evidence, and the unauthorized-detail screenshots. |
| Automated-review response | Commit `9988016` serializes the active-Attachment check with a parent-Ticket row lock; removal now deletes content before soft-removal metadata commits and remains retryable after cleanup failure. Integration tests cover both cases. |
| Follow-up review | Kiatisak approved with `LGTM`, 2026-09-02, on commit `9988016`. |
| Merge | Kiatisak merged commit `c6524ed` into `lab2-staging`, 2026-09-02. |
| Final status | Approved and merged. Issue #36 is linked in the PR Development panel. |

#### Conversation details

The two blocking findings were evidence gaps, not missing authorization logic. The original E2E only proved that a Ticket link was absent from Requester 2's list; the follow-up captures the Requester 1 Ticket URL, switches requester context, navigates directly to that URL, and asserts the unavailable response. It also requests an active Attachment successfully, removes it, requests the same content URL, and asserts HTTP `404`.

The review also recorded non-blocking notes: §8.8 had no browser computed-colour assertions; §8.7 had no explicit horizontal-scroll check; one large PR provided thin Part 1 branch-history evidence; the reviewer had not read every large UI file in depth; `Closes #36` required the Development panel because the base branch was `lab2-staging`; and the `TKT-\\d{8}-[A-Z0-9]{6}` identifier shape differed from the approved illustration and was flagged as a submission risk, not a requested change. The reviewer separately confirmed the parameterized ownership queries, deterministic secondary sort key, and `ai-use.md` record were sound.

Follow-up verification reported `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, `pnpm test:e2e` (6/6 across desktop, tablet, and mobile), `pnpm run build`, and `pnpm run check` passing.

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

## Current limitations

- Kiatisak's Issues [#20](https://github.com/Kiatisakk/toktickit/issues/20) and [#21](https://github.com/Kiatisakk/toktickit/issues/21) remain open, so no review can yet be recorded for final report/submission or the Lab 2 release PR.

## Issue #37 implementation review record

Date: 2026-09-02. Branch: `feature/37-my-tickets`. Fixed point: `lab2-staging`.

The local two-axis `$code-review` inspected `git diff lab2-staging...HEAD` against the repository guidance and the Issue #37/Lab 2 contract. Initial reports found five Standards breaches and one Standards smell judgement, plus four Spec findings:

- Tests inspected request query syntax and duplicate table/card DOM nodes instead of public behavior.
- The list status region announced loading but not successful result counts; the priority predicate was duplicated.
- `reviewer.md` lacked the Issue #37 record.
- UI tests lacked explicit initial/background loading assertions.
- API tests omitted Summary search and page/page-size metadata assertions.
- Unrelated Create Ticket and Ticket Detail screenshot artifacts were regenerated.

The first follow-up Spec review also identified missing explicit empty-owned-list and API zero-result coverage.

Resolutions: tests now assert visible page state and rendered ownership text; loading/refetch and `aria-busy` are covered; successful result counts are announced; the priority predicate is shared in `client/src/lib/ticket-priorities.ts`; Summary, empty-list/no-results, and pagination metadata are asserted; this review record is appended; and only My Tickets screenshot evidence remains changed.

Final follow-up reports are clear on both axes: Standards PASS (no hard breaches or smell findings) and Spec PASS (no missing, out-of-scope, or incorrect behavior findings). Verification after the corrections: `pnpm run fix`, `pnpm run check-types`, `pnpm run test`, and `pnpm run build` pass; the requester E2E suite previously passed 6/6 across desktop, tablet, and mobile Chromium. No GitHub PR or peer approval is claimed by this local record.
