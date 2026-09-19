# Lab 3 Reviewer Record

## Status and review basis

Prepared under [Issue #49](https://github.com/beambeambeam/toktickit/issues/49) on 2026-09-08 and updated for [Issue #58](https://github.com/beambeambeam/toktickit/issues/58) on 2026-09-19. The integrated implementation is on `lab3-staging`; baseline `ad5640b` remains the pre-Lab-3 starting point. This record distinguishes formal GitHub reviews, agent review and the still-pending release/submission gates.

## Participants and external evidence

| Role | Confirmed record |
| --- | --- |
| Repository owner | GitHub @beambeambeam; existing Lab 2 record identifies Supawit Marayat. |
| Lab 3 peer reviewer | Kiatisakk formally approved PRs #59–#65. PRs #66 and #67 have substantive comments but no formal APPROVED review; do not claim blanket Lab 3 approval. |
| Agent review | Two-axis Standards/Spec review for the contract, plus the #58 implementation diff review recorded below; advisory only. |

| Deliverable | PR / reviewer / comments / response / approval / merge |
| --- | --- |
| #49 contract → lab3-staging | [PR #59](https://github.com/beambeambeam/toktickit/pull/59), Kiatisakk; changes requested against `27aa9bb`, resolved and formally approved against `a9b0432`; merged by beambeambeam as `e23a7f90ec2e675d9ae75f3e9407583763b55936`. Findings covered fixture isolation, ordered inactive feedback and password-policy documentation. |
| #50 authentication → lab3-staging | [PR #60](https://github.com/beambeambeam/toktickit/pull/60), Kiatisakk; changes requested against `57bd6a`, resolved and formally approved against `0059970`; merged as `d2d0bdec05d394dd4ab269459fbe00531eaabb93`. Findings covered proxy/cookie handling, rate-limit reservations, change-password cleanup and evidence ownership. |
| #51 queue/detail → lab3-staging | [PR #62](https://github.com/beambeambeam/toktickit/pull/62), Kiatisakk; changes requested against `ec0f6fff`, formally approved against `3ffac5c`; merged as `a9071bef46e46b9fd1fdaf383267f6d3c83f3f7b`. Queue/detail 403 handling and contract/test-register follow-up were addressed. |
| #52 ownership/priority → lab3-staging | [PR #63](https://github.com/beambeambeam/toktickit/pull/63), Kiatisakk; changes requested against `fd68a301`, formally approved against `6c762be5`; merged as `3966b72556383ae3d42ccb8e1097d01f37c143fc`. Owner-save semantics, actor rechecks, browser journey and register follow-up were addressed. |
| #53 workflow/indication → lab3-staging | [PR #64](https://github.com/beambeambeam/toktickit/pull/64), Kiatisakk; changes requested against `e55ce2ff`, formally approved against `5aac231`; merged as `a587a7bd7731a657dcb85d7ea7fa9fd2dea61f00`. Confirmation focus note and browser/register follow-up were addressed. |
| #54 public comments → lab3-staging | [PR #65](https://github.com/beambeambeam/toktickit/pull/65), Kiatisakk; changes requested against `d37a451e`, formally approved against `fc5d0af`; merged as `8a396e0308e65a6e048251fa80dcb481f4004b53`. Textarea feedback and Requester/staff browser coverage were addressed. |
| #55 internal notes → lab3-staging | [PR #66](https://github.com/beambeambeam/toktickit/pull/66), Kiatisakk; substantive comment review against `7ea430c2`, no formal APPROVED review; merged as `9fb7e205d91345d1e02163e60adaef87ace79b5c`. Comments were non-blocking and concerned `aria-describedby`, test-register maintenance and issue linking. |
| #56 user list/create → lab3-staging | [PR #61](https://github.com/beambeambeam/toktickit/pull/61), Kiatisakk; changes requested against `43803a8`, formally approved against `b8dd1e6`; merged as `1e6616557c5d895329edcca683354aad8b273de2`. Created-account first-login, authorization, duplicate-race and register gaps were addressed. |
| #57 edit/reset lifecycle → lab3-staging | [PR #67](https://github.com/beambeambeam/toktickit/pull/67), Kiatisakk; substantive comment review against `807cffe0`, no formal APPROVED review; merged as `4afd55d8e1cfb64c1746fa4340e84fede25928bb`. No bug was reported; register, issue-linking and merge-order comments remain recorded as process notes. |
| #58 integration evidence → lab3-staging | This working-tree implementation adds isolated API/browser verification, manifest-backed screenshots, visual review and release traceability. No external PR, peer approval or final-`main` result is claimed here. |
| Release lab3-staging → main | Pending release PR, reviewer and final merge SHA. |
| Reciprocal peer review | Pending. The feature review history above is not a reciprocal peer-review sign-off for the final integrated release. |

For each actual review append date, exact reviewed commit, reviewer identity, PR/comment links, actionable comments, author responses/fix commits, re-review outcome, formal approval and merge actor/SHA. Record requested changes and unresolved findings honestly. Agent findings belong in their own section, never in the peer approval column.

## PR #61 icon scope clarification

On 2026-09-14, Kiatisakk reviewed commit `43803a88ec0fdf3b8ce60902d9cc31c31c6e40a2` and [noted that the Hugeicons migration is unrelated to #56](https://github.com/beambeambeam/toktickit/pull/61#discussion_r4002899408). The migration was a separate explicit owner request and has no associated Issue. It remains in this PR as its own commit, `43803a8`, rather than being presented as part of the user-management acceptance criteria. The PR description records this scope exception; future unrelated visual migrations should use separate PRs. This clarification does not claim reviewer approval.

## PR #61 acceptance coverage response

Kiatisakk's [2026-09-14 acceptance-coverage finding](https://github.com/beambeambeam/toktickit/pull/61#discussion_r4002899385), against `43803a88ec0fdf3b8ce60902d9cc31c31c6e40a2`, requested proof of created-account password replacement, authorization, duplicate races, search/filter behavior and create-to-first-login. The response adds endpoint and lifecycle suites plus a browser test and updates the API-05/UI-06/E2E-04 register to actual paths and partial status. The API fixture requires an explicit disposable test-server URL and never falls back to the shared local database. The #58 isolated run now executes the suites inside the full 120-test server total and the six lifecycle browser cases across three projects; final-main provenance and remaining negative-case coverage are still pending.

## Agent review

Standards review (2026-09-08, Codex subagent): one prose-spacing finding and one path-shorthand clarity suggestion. Corrected concatenated HTTP status wording and explicitly documented table paths as relative to `/api`. No further standard or relevant abstraction findings reported.

Spec review (2026-09-08, separate Codex subagent): five actionable findings resolved after checking current controllers/upload middleware/rules: preserved malformed-ID 400 behavior; Attachment count errors and filename normalization; exact removal response envelope; persisted seed identity; and explicit Resolved-to-Closed UI confirmation. The same source check corrected the multipart wire field to repeated `attachments` and preserved specialized Attachment error codes. Local recheck confirmed the revised contracts match these source boundaries.

One scope suggestion was not adopted: the reviewer considered one seeded example per status/all four priorities broader than “distributed across statuses, priorities.” The contract retains that concrete fixture distribution to make the required eight-status/four-priority UI and workflow evidence repeatable; it adds no product capability. This is a documented planning choice for peer review.

Standards: one prose finding fixed, one clarity suggestion adopted. Spec: five findings fixed, one seed-distribution suggestion retained with rationale. Verification results belong in [tests.md](./tests.md). No invented “LGTM”, student response or reviewer signature.

### #58 working-tree review outcome

The two-axis review of the staged integration diff found no documented standards violation. It identified judgement-call smells around evidence setup living in global Playwright setup, repeated project-name slug logic and a vague variable name; the variable was clarified, while the small shared test helpers remain intentionally local to the specs. The spec review found evidence-provenance, accidental-manifest-reset and queue-state-label defects. These were corrected by recording full SHA plus source-dirty state, resetting Lab 3 manifests only for full/Lab 3 runs, and labeling the UI-normalized queue/detail captures `normalized` rather than `seeded`. The review also flagged the Lab 1 seed timeout and tablet button wrapping as scope concerns; both directly support #58's full CI and responsive evidence and are documented in [tests.md](./tests.md) and [visual-checklist.md](../../artifacts/lab-03/visual-checklist.md).

The review did not convert the remaining external gates into passes: there is still no release PR to `main`, reciprocal peer sign-off, complete prompt count, student reflection or final PDF. No #58 peer approval is claimed.

## Open completion gates

The contract and #49–#65 feature review gates are recorded; #66/#67 have no formal approval, and no release PR from `lab3-staging` to `main` exists yet. Final-main test/build/browser provenance, reciprocal peer review, Kanban status, six-to-ten prompt record, the student's genuine reflection and the single nine-part PDF remain pending. Do not close the parent or mark downstream work Done from this record.
