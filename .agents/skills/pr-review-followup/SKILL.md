---
name: pr-review-followup
description: "Handle requested follow-up on GitHub pull request review feedback: fix actionable threads individually, commit each change separately, reply and leave threads open for reviewer resolution, then request re-review after all fixes are pushed."
---

# Follow up on PR review threads

Use this workflow when the user asks you to address or resolve GitHub pull request review feedback. If they ask only for a summary, report the findings without changing the branch or PR.

## Identify the work

1. Find the PR from the supplied URL or number. Otherwise identify the PR for the current branch. Ask only if the repository or PR is ambiguous.
2. Read applicable repository instructions, inspect the worktree, and follow its commit conventions. Note pre-existing changes so they stay out of review-fix commits.
3. Fetch the full review threads and record each unresolved actionable thread's ID, author, finding, file context, and current resolution state. Work every thread the user asked you to handle; do not merge findings from separate threads.

## Resolve threads one at a time

For each unresolved actionable thread:

1. Read the surrounding code and relevant spec. Decide whether the finding is valid and determine the smallest complete fix. If the finding is mistaken or already satisfied, prepare a concise evidence-based reply instead of making a speculative change. Ask the user only when a product decision or material scope choice is required.
2. Implement the fix for this thread alone. Run the relevant focused checks and fix any failure caused by the change.
3. Review the staged diff. Keep pre-existing work and unrelated findings out. Create one commit for this thread's change, using repository commit rules. Do not combine threads. Do not make an empty commit when no change is warranted.
4. Push the commit so the reviewer can see it. Reply in the matching review thread with a short, factual note about the fix or disposition; include the commit when useful. Leave the thread open for the reviewer to verify and resolve it. Do not resolve review threads yourself.
5. Record the thread, commit (if any), reply, and current state before moving on.

If a push or reply fails, check the remote and thread state before retrying so you do not duplicate a commit or comment. Retry a transient failure once. If access or state still blocks completion, continue with independent threads where possible and report the blocker.

## Request re-review

After every targeted thread has a reply and every fix commit is pushed, verify that each changed finding has its own commit. Then request a new review from the human reviewer or reviewers who raised the findings, unless the same review request is already active. Leave the threads open; the reviewer should resolve them after verifying the response and changes.

When the PR author says to “request changes again” at closeout, use GitHub's request-review action. A formal “Request changes” review is a reviewer vote, not an action the PR author submits.

## Report completion

Summarize the thread-to-commit mapping, checks run, reply state, and reviewer request. State that the answered threads remain open for reviewer resolution.
