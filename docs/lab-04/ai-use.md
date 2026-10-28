# Lab 4 AI Use Record

## Tool and purpose

Codex in T3 Code assisted with reading Issue #73 and the Lab 4 handout, drafting the engineering contract, and applying peer review findings. The model name for the 2026-10-02 review-response work is GPT-6-Luna. The earlier contract-preparation model is not recorded in the available session history.

## Selected prompt excerpts

These eight excerpts are actual instructions selected from four user requests; they are not eight separate conversation turns.

| Date | Prompt excerpt | Observed use |
| --- | --- | --- |
| 2026-09-30 | `$implement issue #73` | Inspect the issue and prepare its requested engineering contract. |
| 2026-09-30 | `Also please read the reports/lab04/lab-sheet for more context` | Use the handout to set the document structure and required deliverables. |
| 2026-09-30 | `please do the git branch too please` | Create and use the feature branch for Issue #73. |
| 2026-10-01 | `push and create PR for repo pattern` | Push the branch and open the pull request using the repository workflow. |
| 2026-10-02 | `solve all the thread one by one` | Work through each review finding as a separate change. |
| 2026-10-02 | `one thread per one commit` | Keep each review-finding fix in its own commit. |
| 2026-10-02 | `go comment under thread short and clear` | Reply under each matching inline review thread. |
| 2026-10-02 | `after all of thread resolve go request change again` | Resolve the findings and request another review after all responses are posted. |

## My Reflection

I used Codex to organize the Issue #73 contract work around the handout and to prepare a reviewable branch and pull request. Peer review exposed gaps in the first draft, including the distinction between product outcomes and process checks, legacy status-history limits, and required repository records. I checked each finding against the handout and the contract before changing the documents. Keeping each response in a separate commit makes the reason for each change easier to inspect. The pull request still needs peer re-review; generated text, commit hooks, and automated checks do not count as approval.

## Issue #74 implementation and PR #82 follow-up — 2026-10-03

Codex in T3 Code supported Issue #74 implementation, checks, commit regrouping and PR #82 review follow-up. Main model: GPT-6.1-Sol with high reasoning. The completed delegated implementation/review/research tasks used GPT-5.6-Luna with max reasoning and Fast mode, under the instructions active when they were launched.

These six excerpts are actual user instructions from this task:

| Date | Prompt excerpt | Observed use |
| --- | --- | --- |
| 2026-10-03 | `$implement #74 also checkout more context in /reports/lab4` | Read Issue #74, the Lab 4 handout and repository rules; implement Planned Action Taken create/read. |
| 2026-10-03 | `Use the ticket’s seams and starting commit` | Use rules, authenticated API, UI, browser journeys and migration recovery as test seams; review from `ab279fa`. |
| 2026-10-03 | `first make a new branch follow repo pattern` | Correct the initial branch choice to `feature/74-create-view-actions-taken`. |
| 2026-10-03 | `for commit please do $commit-multiple` | Regroup the implementation into four focused commits with repository commit hooks. |
| 2026-10-03 | `push and create PR back to lab4-staging please follow repo pattern` | Push and create [PR #82](https://github.com/beambeambeam/toktickit/pull/82) targeting `lab4-staging` using the PR template. |
| 2026-10-03 | `$pr-review-followup` | Reproduce actionable feedback, commit each changed finding separately, push and reply in each matching thread; leave threads open for reviewer verification. |

Observed review corrections include the Resolved create restriction, explicit UI assignee validation, focus restoration, pagination, compact read fields, API errors, canonical hashing and fresh capture provenance. Runtime checks and the human review response mapping are linked in [tests.md](tests.md) and [reviewer.md](reviewer.md). The existing reflection above is the earlier Issue #73 record; this addendum records observed #74 work. The student's #74 reflection has not been supplied.

## Issue #75 implementation and PR #83 follow-up — 2026-10-07

Codex in T3 Code supported Issue #75 implementation and PR #83 review fixes. The main model was GPT-6.1-Sol with high reasoning. Delegated backend, browser, Standards review and Spec review tasks used GPT-6 Luna with max reasoning and Fast mode.

The agent read Issue #75, the Lab 4 handout, repository instructions and existing source. The implementation added pending edits, reassignment and authorized revision history. Authenticated API tests used disposable PostgreSQL. React Testing Library tested the HTTP boundary. Playwright tested two staff contexts and Requester reads.

These selected excerpts are actual user instructions. They do not count all user or tool messages.

| Date | Prompt excerpt | Observed use |
| --- | --- | --- |
| 2026-10-04 | `$implement #75 also checkout more context in /reports/lab4` | Read the issue and `reports/lab04/lab-sheet/markdown.md`. Implement the #75 feature scope. |
| 2026-10-04 | `Use these existing seams (Recommended)` | Confirm authenticated Supertest, edit/assignment UI and two-worker Playwright tests before further tests. |
| 2026-10-04 | `Use 4da687a (Recommended)` | Confirm the fixed base for independent Standards and Spec reviews. |
| 2026-10-04 | `push and create PR follow repo pattern/history please` | Push the feature branch. Create PR #83 against `lab4-staging` with the repository template and label. |
| 2026-10-05 | `rebase origin/main please` | Check the fetched main branch. Preserve merge history because main was already an ancestor. |
| 2026-10-07 | `$pr-review-followup` | Reproduce review findings. Commit each changed finding separately. Push each commit and reply in its matching thread. |

The independent Standards review found duplicate create/edit validation. The agent shared that validation and checked the correction. The Spec review found no defect within the #75 scope. It recorded the unavailable start/complete eligibility gates under #76.

The human review found two focus defects and a gap in Ticket-lock test evidence. New regressions reproduced both focus defects. A database test now observes the parent Ticket lock. Removing that lock makes the new test fail. History labels now use permitted current names and retain IDs for unknown former assignees. The API snapshot contract did not change.

The agent used the pr-review-followup skill for separate commits and thread replies. It used the ASD-STE100 skill for new review text. Replies leave the threads open for reviewer verification. Test results and response links are recorded in [tests.md](tests.md) and [reviewer.md](reviewer.md).

**My Reflection**

For Issue #75 I used the agent to build editing, reassignment and revision history on top of the #74 Action Taken records. I accepted the split between a backend task, a browser task and two independent reviews, because each review looked at a different risk: the Standards review found the duplicated create and edit validation, and the Spec review checked that nothing outside #75 was built. I did not accept the work on the agent's word. The human review on PR #83 still found two focus defects and a gap in the Ticket-lock test, so the passing automated tests had not covered everything. I learned that a test only counts if it fails when the behavior is removed, and the lock test now does. Automated checks do not imply human approval.

## Issue #76 Action Taken lifecycle — 2026-10-11

Codex in T3 Code supported Issue #76 implementation, verification and evidence capture. The model was GPT-6 Luna with max reasoning. No delegated agents were used. Work stayed in the assigned `feature/76-action-lifecycle` worktree. No GitHub issue, PR or remote branch was changed.

The agent read Issue #76, parent Issue #72, the worktree setup, repository guidance, Lab 4 documents, PR #82/#83 diffs and the TDD skill. The change adds a versioned transition API, role-aware lifecycle controls, and browser verification. Existing lifecycle columns and event tables were used; no migration was needed. API tests used the isolated `toktickit_t76` database.

This is an actual instruction excerpt from the user. It does not count all user or tool messages.

| Date | Prompt excerpt | Observed use |
| --- | --- | --- |
| 2026-10-11 | `Implement #76 completely and verify it. Do not implement other tickets.` | Keep the work within Action Taken lifecycle behavior and verify the named API, UI and E2E seams. |

The API tests cover actor and assignee eligibility, both Action and Ticket versions, terminal confirmation, Result and Follow-up gates, immutable terminal writes, Requester access, parent metadata and ordered history. UI tests cover focus, duplicate-write prevention, errors, refresh, terminal controls and Requester history. Playwright captures the real lifecycle at desktop, tablet and mobile sizes, plus 320 CSS pixels and 200% checks. The capture manifests link to the clean lifecycle source commit.

The implementation keeps each transition and its history event, Action version, Ticket version and public timestamp in one transaction. Browser evidence shows the final event history remains readable after completion or cancellation. The user asked the agent not to push, open a PR or edit issues, and no external GitHub state was changed.

## PR #84 review follow-up — 2026-10-12

Claude Code supported the PR #84 review fixes. The model was Claude Sonnet 5.5. Work stayed in the `feature/76-action-lifecycle` worktree with its isolated database and ports.

The agent read the nine unresolved review threads, the `pr-review-followup` skill, the worktree setup, repository guidance and the Lab 4 documents.

This is an actual instruction summary from the launching request. It does not count all tool messages.

| Date | Prompt summary | Observed use |
| --- | --- | --- |
| 2026-10-12 | Follow up on the nine PR #84 review threads. Make one commit per defect. Push, reply in each thread and leave threads open. For test findings, prove the new test fails without the fix. Update the review, AI-use and test records. Request re-review from @Kiatisakk. | Fixed the focus, query key, accessibility and draft-lock findings. Added three server tests. Ran mutation checks. Regenerated screenshot evidence. |

The shared PostgreSQL server was down, so the agent ran its own container for the isolated database. The first mutation check changed the wrong code location and stayed green. The agent detected the invalid check and repeated it at the correct location. Results are in [tests.md](tests.md) and [reviewer.md](reviewer.md).

**My Reflection**

For PR #84 I asked the agent to fix the nine review threads one commit per defect and to leave every thread open for the reviewer. I accepted that process because it keeps each review reason next to its change. The record shows that the first mutation check changed the wrong code location and stayed green, and the agent caught it and repeated the check. That showed me that a mutation check can pass for the wrong reason, so I read the results instead of trusting the word "verified". The shared database was also down, so the agent used its own container, which I would not have noticed without the record. Automated checks do not imply human approval.

## Issue #78 implementation — 2026-10-11

Codex in T3 Code supported the Requester dashboard API, My Tickets drill-down, UI, browser coverage, and verification record. The model was GPT-6 Luna with max reasoning. The work stayed on `feature/78-requester-dashboard` and did not implement sibling issues.

These excerpts are actual instructions from the Issue #78 task:

| Date | Prompt excerpt | Observed use |
| --- | --- | --- |
| 2026-10-11 | `Act as the implementation sub-agent for this task.` | Work as the implementer for the assigned issue. |
| 2026-10-11 | `Implement #78 completely and verify it.` | Complete the Requester dashboard API, generated client, UI, query filters, tests, and feature records. |
| 2026-10-11 | `Do not implement other tickets.` | Keep action lifecycle and staff dashboard work outside this change. |
| 2026-10-11 | `Work ONLY in this git worktree: /Users/beam/.cache/toktickit-72/wt/78` | Keep commands and edits in the assigned worktree. |
| 2026-10-11 | `Run the existing earlier-lab regression tests and this feature’s unit/rule, API/integration, UI and browser E2E tests as applicable` | Use the repository’s rule, API, UI, full client/server, and Requester browser test seams. |

The implementation used test-first rule, API, UI, and browser checks. The API derives the Requester from the session. The tests check ownership, private-note isolation, exact UTC bounds, zero results, list parity, role restrictions, preview limits, and performance measurements. The browser journey checks the generated links, Ticket detail, account switch, focus, axe, viewport overflow, and zoom. Verification outcomes are recorded in [tests.md](tests.md).

**My Reflection**

For Issue #78 I gave the agent one issue, one worktree and a clear limit: do not implement other tickets. That kept the Requester dashboard separate from the lifecycle and staff dashboard work. I accepted the rule that the API derives the Requester from the session, because it removes a whole class of cross-Requester mistakes, and the tests for ownership and private-note isolation prove it. The later PR #85 review showed what the first pass missed, mostly in the test record and in screenshot provenance, so a finished feature was not the same as finished evidence. Automated checks do not imply human approval.

## PR #85 review follow-up — 2026-10-12

Claude Code supported the PR #85 review follow-up. The model was Claude Sonnet 5.5. The work stayed on `feature/78-requester-dashboard` in the assigned worktree. It did not touch PR #84 or any issue.

| Date | Prompt summary | Observed use |
| --- | --- | --- |
| 2026-10-12 | Handle the review follow-up for PR #85 with the pr-review-followup skill. | Reproduce each of the 16 threads, make one commit per defect, push, and reply in the thread. |
| 2026-10-12 | Never resolve a thread. Use one commit for a shared defect. Run a mutation check for each test-gap finding. | Leave threads open. Share one commit across the four test-record threads. Confirm new tests fail without the fix. |
| 2026-10-12 | Update the reviewer, AI-use, and test records. Run every check before the last push. | Record the commits and the actual test results. Request re-review from @Kiatisakk only. |

**My Reflection**

For PR #85 I used the agent to work through 16 review threads, one commit per defect, with no thread resolved by the agent. I required a mutation check for every test-gap finding. I did this because a new test that never fails proves nothing, and the first version of the Lab 4 tests had that weakness. I accepted sharing one commit across the four test-record threads, because they were one defect. I still decided when the work was done: I asked for re-review from the reviewer and did not treat the agent's report as approval. Automated checks do not imply human approval.

## PR #86 review follow-up — 2026-10-15

Claude Code supported the PR #86 review follow-up for Issue #77. The model was Claude Opus 5.5. The work stayed on `feature/77-ticket-lifecycle-gate` in the assigned worktree. It did not touch PR #87 or any other issue.

| Date | Prompt summary | Observed use |
| --- | --- | --- |
| 2026-10-15 | Handle the review follow-up for PR #86 with the pr-review-followup skill, as for PR #87. | Reproduce each of the 18 threads, make one commit for each finding, push, and reply in the thread. |
| 2026-10-15 | Never resolve a thread. Request re-review at the end. | Leave threads open. Request re-review from @Kiatisakk only. |
| 2026-10-15 | Record actual outcomes only in the test record. | Run the API, UI, two-staff race, axe, reflow, and screenshot checks. Inspect the captures. Record the measured results and the remaining limits. |

**My Reflection**

For PR #86 I used the agent to handle 18 review threads for the Ticket resolution gate. I asked it to record only the measured results in the test record, and to inspect the captures instead of assuming they were right. The gate has a two-staff race, and the record shows a check with two staff sessions. I learned that a concurrency rule needs a test with two real sessions, because a single-user test can pass with the bug still present. I left every thread open for the reviewer. Automated checks do not imply human approval.

## PR #87 review follow-up — 2026-10-15

Claude Code supported the PR #87 review follow-up for Issue #79. The model was Claude Opus 5.5. The work stayed on `feature/79-staff-dashboard` in the assigned worktree. It did not touch PR #86 or any other issue.

| Date | Prompt summary | Observed use |
| --- | --- | --- |
| 2026-10-15 | Handle the review follow-up for Issue #79 (PR #87) with the pr-review-followup skill. | Reproduce each of the 14 threads, make one commit for each finding, push, and reply in the thread. |
| 2026-10-15 | Never resolve a thread. Request re-review at the end. | Leave threads open. Request re-review from @Kiatisakk only. |
| 2026-10-15 | Record actual outcomes only in the test record. | Run the parity, performance, Administrator, axe, reflow, and visual checks. Record the measured results and the remaining limits. |
| 2026-10-15 | Rebase PR #87 onto `lab4-staging` and handle the second review. | Rebase onto `78be599` and resolve the conflicts. Fix one test mock that the rebase broke. Add a fixture database guard and a Ticket detail invalidation test, each with a mutation check. Reply to both nits and leave the threads open. |

**My Reflection**

For PR #87 I used the agent for 14 review threads on the staff dashboard, and then for a rebase onto `lab4-staging` and a second review. I accepted its fixes because each came with a reproduction and a mutation check, and because it recorded the limits of what it ran. The rebase broke one test mock. The record shows that the agent found and fixed it, which is a reminder that a rebase needs a full test run and not only a clean merge. I kept the decision to request re-review for myself. Automated checks do not imply human approval.

## Release check and documentation cleanup — 2026-10-26 and 2026-10-27

Claude Code in T3 Code supported the final check of `lab4-staging`, the release PRs and the documentation cleanup on branch `clean-up-lab4`. The model was Claude Sonnet 5.5. No delegated agents were used.

These are actual instruction excerpts from the user. They do not count all user or tool messages.

| Date | Prompt excerpt | Observed use |
| --- | --- | --- |
| 2026-10-26 | `check if we need any code to changes more as after we release lab4-staging i can't change any code for this labs now` | Run the full checks on `lab4-staging` and look for defects before the release. |
| 2026-10-26 | `fix them` | Fix the three defects found: the seeded Ticket Owner in the E2E setup, the flaky My Actions navigation check, and the undeclared `InternalNote` index. |
| 2026-10-26 | `let do it follow this repo and old release MR too!` | Read the repository PR template and the Lab 3 release PRs (#69, #70). Open PR #89 into `lab4-staging` and release PR #88 into `main`. |
| 2026-10-27 | `CREATE NEW BRANCH CALL clean up lab4` and `FIX ERVERY THIGN YOU DONE WRONG` | Create `clean-up-lab4` and correct the stale Lab 4 documents. |
| 2026-10-27 | `CHECK REPO PATTERN. CHECK REPO PATTER THER EARE PATTERN FOR THIS` | Read how Lab 3 wrapped up (PR #69 and its small `docs:` commits). Follow it: separate commits for the reviewer record, the status lines, the test plan and the visual checklist. |
| 2026-10-27 | `write e2e to capture it PLEASE` | Extend the staff dashboard evidence spec with loading, empty and forbidden captures, regenerate the evidence from a clean tree (42 PNGs, manifests at `5adf79a`), and update the test record, UI inventory and visual checklist. |

The agent found and fixed these mistakes in its own work:

- The first owner fix in `prepare-e2e.ts` used `ticket.update`. It broke `lab-04/e2e-setup.test.ts` because that test has no seeded Ticket. The full CI run caught it, and the fix now uses `updateMany`.
- The first navigation fix used `primaryNavigation.or(menuToggle)`. It caused a strict-mode violation on desktop and was replaced with a `:visible` locator.
- The agent pushed `lab4-staging` directly and the push was rejected by the branch rule. The change went through PR #89 instead.
- The agent told the user that the stale documents could be left or fixed later, and did not say that merging the release first would close the window to fix them in `lab4-staging`. This cleanup is the correction.

The agent read the GitHub review and merge records for PRs #80 to #89 and wrote the [final outcomes](reviewer.md#final-outcomes-and-release) from them. It compared the committed screenshot manifests with the documentation and corrected the Requester dashboard provenance. It did not re-inspect the screenshots. Check results are in [tests.md](tests.md#release-verification--2026-10-26).

**My Reflection**

I used the agent for the final check of `lab4-staging` before the release. It found three real defects that the earlier reviews did not find: the seeded Ticket Owner in the E2E setup, a flaky My Actions navigation check, and an `InternalNote` index that the schema did not declare. I accepted all three fixes. I did not accept every step the agent took. Its first owner fix broke a server test, and its first navigation fix failed on desktop. The full CI run caught both, so the full run is what I trust, not a single focused test. The agent also did not tell me that merging the release would close the window to fix stale documents in `lab4-staging`. I merged, found out afterward, and had to open a cleanup PR. In future I will ask what a merge makes impossible before I do it. I wanted the staff loading, empty and forbidden states to have screenshots too, so I asked for an E2E capture, and the agent regenerated the whole staff evidence set from a clean tree so the manifests match the images. I still have to read the drafted text and the final evidence myself and approve the PR. Automated checks do not imply human approval.

The reflections for Issues #75 and #78, PR #84, #85, #86 and #87 and this release work were drafted by Claude Code at the student's request from the records above. The student asked for them to be filled in.
