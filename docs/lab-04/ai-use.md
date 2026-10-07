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

This section records observed agent work. The student did not provide an Issue #75 reflection. Automated checks do not imply human approval.
