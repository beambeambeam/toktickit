# Lab 3 Reviewer Record

## Status and review basis

Prepared under [Issue #49](https://github.com/beambeambeam/toktickit/issues/49) on 2026-09-08, branch `feature/49-sprint-3-engineering-contract`, baseline `ad5640b`. Scope: the six Lab 3 documents, checked against Issue #48, local labsheet §§1–14 and the Lab 2 contract. No application implementation or external approval is claimed.

## Participants and external evidence

| Role | Confirmed record |
| --- | --- |
| Repository owner | GitHub @beambeambeam; existing Lab 2 record identifies Supawit Marayat. |
| Lab 3 peer reviewer | Not yet confirmed for this increment. Do not carry Lab 2 approval into Lab 3. |
| Agent contract review | Two-axis Standards/Spec review against ad5640b; advisory only. |

| Deliverable | PR / reviewer / comments / response / approval / merge |
| --- | --- |
| #49 contract → lab3-staging | [PR #59](https://github.com/beambeambeam/toktickit/pull/59), reviewer Kiatisakk, reviewed commit `27aa9bbcbc9353e4785cf87b04e33428b495c3ed`; [changes-requested review](https://github.com/beambeambeam/toktickit/pull/59#pullrequestreview-5153448021) with inline findings on [E2E-01 seed state](https://github.com/beambeambeam/toktickit/pull/59#discussion_r3967618584), [inactive feedback](https://github.com/beambeambeam/toktickit/pull/59#discussion_r3967618595), and [password rules](https://github.com/beambeambeam/toktickit/pull/59#discussion_r3967618606) / working-tree response makes E2E-01 disposable-fixture based, documents ordered inactive feedback, and records the deliberate password-policy departure; fix commit and re-review pending / changes requested; no approval or merge. |
| #50 authentication → lab3-staging | [PR #60](https://github.com/beambeambeam/toktickit/pull/60), reviewer Kiatisakk, reviewed commit `57bd6a26dbc4ab533a1f58c65f576b5c3ca89260`; [changes-requested review](https://github.com/beambeambeam/toktickit/pull/60#pullrequestreview-5166607869) found proxy trust/cookie flags, leaked login reservations, inactive-account throttling, password-change 429 UX and evidence ownership issues. Follow-up response fixes those findings, adds auth/cache regression coverage, and records Lab 2 selector/evidence adaptations; fix is the current PR head, re-review pending / no approval or merge. |
| #51–57 features → lab3-staging | Pending implementation and reviewed PRs. |
| Release lab3-staging → main | Pending release PR, reviewer and final merge SHA. |
| Reciprocal peer review | No Lab 3 evidence recorded. |

For each actual review append date, exact reviewed commit, reviewer identity, PR/comment links, actionable comments, author responses/fix commits, re-review outcome, formal approval and merge actor/SHA. Record requested changes and unresolved findings honestly. Agent findings belong in their own section, never in the peer approval column.

## PR #61 icon scope clarification

On 2026-09-14, Kiatisakk reviewed commit `43803a88ec0fdf3b8ce60902d9cc31c31c6e40a2` and [noted that the Hugeicons migration is unrelated to #56](https://github.com/beambeambeam/toktickit/pull/61#discussion_r4002899408). The migration was a separate explicit owner request and has no associated Issue. It remains in this PR as its own commit, `43803a8`, rather than being presented as part of the user-management acceptance criteria. The PR description records this scope exception; future unrelated visual migrations should use separate PRs. This clarification does not claim reviewer approval.

## Agent review

Standards review (2026-09-08, Codex subagent): one prose-spacing finding and one path-shorthand clarity suggestion. Corrected concatenated HTTP status wording and explicitly documented table paths as relative to `/api`. No further standard or relevant abstraction findings reported.

Spec review (2026-09-08, separate Codex subagent): five actionable findings resolved after checking current controllers/upload middleware/rules: preserved malformed-ID 400 behavior; Attachment count errors and filename normalization; exact removal response envelope; persisted seed identity; and explicit Resolved-to-Closed UI confirmation. The same source check corrected the multipart wire field to repeated `attachments` and preserved specialized Attachment error codes. Local recheck confirmed the revised contracts match these source boundaries.

One scope suggestion was not adopted: the reviewer considered one seeded example per status/all four priorities broader than “distributed across statuses, priorities.” The contract retains that concrete fixture distribution to make the required eight-status/four-priority UI and workflow evidence repeatable; it adds no product capability. This is a documented planning choice for peer review.

Standards: one prose finding fixed, one clarity suggestion adopted. Spec: five findings fixed, one seed-distribution suggestion retained with rationale. Verification results belong in [tests.md](./tests.md). No invented “LGTM”, student response or reviewer signature.

## Open completion gates

External contract approval is outstanding before feature implementation. Feature reviews, release integration, final-main test/capture provenance, student reflection and final PDF submission remain pending. A prepared contract is not a completed Lab 3 product; do not close the parent or mark downstream work Done from this record.
