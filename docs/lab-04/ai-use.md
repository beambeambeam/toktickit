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
