# Lab 1 Peer Review Record

## Student

- Name: Supawit Marayat
- Student ID: `67070501045`
- GitHub username: `beambeambeam`

## Peer reviewer

- Name: Kiatisak Markmeeshap
- Student ID: `67070501005`
- GitHub username: `Kiatisakk`

## Repository and project links

- Repository: <https://github.com/beambeambeam/toktickit>
- GitHub Project: <https://github.com/users/beambeambeam/projects/2>
- Required Project statuses: `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, `Done`

## Submitted pull requests

| Issue | Feature branch | Pull request | Target | Peer review result |
| --- | --- | --- | --- | --- |
| 1. Project foundation | `feature/1-project-foundation` | [PR #19](https://github.com/beambeambeam/toktickit/pull/19) | `lab1-staging` | Approved by `Kiatisakk`; final comment: `lgtm`. |
| 2. API health check | `feature/2-health-check` | [PR #29](https://github.com/beambeambeam/toktickit/pull/29) | `lab1-staging` | Approved by `Kiatisakk`; final comment: `lgtm`. |
| 3. Category seed | `feature/3-category-seed` | [PR #30](https://github.com/beambeambeam/toktickit/pull/30) | `lab1-staging` | Approved by `Kiatisakk`; final comment: `lgtm`. |
| 4. Category list | `feature/4-category-list` | [PR #31](https://github.com/beambeambeam/toktickit/pull/31) | `lab1-staging` | Approved by `Kiatisakk`; final comment: `lgtm`. |

## Review comments and responses

Known GitHub review history:

- PR #19: reviewer requested `discuss thhis`; follow-up discussion/changes ended with approval `lgtm`.
- PR #29: a changes-requested review had no written body; follow-up fixes were pushed, then the reviewer approved with `lgtm`.
- PR #30: reviewer approved with `lgtm`.
- PR #31: a changes-requested review had no written body; follow-up fixes were pushed, then the reviewer approved with `lgtm`.

Add exact screenshots or links to the review threads in the final PDF.

## Reviews completed for partner

The reviewed Lab 1 feature PRs were submitted by Kiatisak in `Kiatisakk/toktickit`.

| Partner PR | Review comment I gave | Partner response / resolution |
| --- | --- | --- |
| [PR #5 — project foundation](https://github.com/Kiatisakk/toktickit/pull/5) | Requested a broader `tests/lab-*/**/*.test.{ts,tsx}` Vitest glob and questioned the workspace `.gitignore` files. | Kiatisak widened the Vitest glob, consolidated ignore rules into the root `.gitignore`, deleted the workspace ignore files, and explained the changes in the review thread. I then approved with `LGTM`. |
| [PR #6 — API health check](https://github.com/Kiatisakk/toktickit/pull/6) | `LGTM. Reviewed /api/health, client loading/success/error flow, and related tests. No actionable findings. No remote checks were reported.` | No separate reply was posted; the PR was merged after my approval. |
| [PR #7 — category seed](https://github.com/Kiatisakk/toktickit/pull/7) | Reported that mutable names could create duplicate categories on rename, and that insertion order did not guarantee API response order. | Kiatisak fixed the rename/reconciliation issue in `173b4fc`, marked API ordering out of scope for the seed PR, and carried it into the category-list work. I approved with `LGTM`. |
| [PR #8 — category list](https://github.com/Kiatisakk/toktickit/pull/8) | Asked that the product requirements settle the display-order question: `LGTM for question 2 please follow the product requirements but for now it's already ok`. | Kiatisak added `displayOrder`, migration and seed updates in `9b8f9e9`, requested a fresh review on the changed head, and I approved the final version with `LGTM`. |

Partner repository: <https://github.com/Kiatisakk/toktickit>
