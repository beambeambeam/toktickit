# Lab 3 AI Use Record

## Tool and purpose

Codex in T3 Code assisted with source/repository inspection and drafting the Sprint 3 engineering contract. This session began with GPT-5.6-Luna and continued after a model switch to GPT-6. Work is subject to student and peer review; AI output is not evidence of their approval.

## Actual selected prompts

Only prompts visible in this session are recorded. The final requirement is 6–10 selected substantive prompts across Lab 3; this record now contains six. The reflection below is based on those prompts and the recorded implementation, test, review, and evidence results.

| Date | Actual prompt | Observed use |
| --- | --- | --- |
| 2026-09-08 | `$implement https://github.com/beambeambeam/toktickit/issues/49` | Inspect Issue #49/#48, repository conventions and labsheet; create feature/49-sprint-3-engineering-contract and prepare the six living documents. |
| 2026-09-10 | `$implement https://github.com/beambeambeam/toktickit/issues/50` | Inspect Issue #50/#48, repository conventions, labsheet and the Lab 2 flow; implement authenticated Requester migration, session security, protected navigation, ownership continuity, tests, and responsive E2E evidence. |
| 2026-09-12 | `$implement https://github.com/beambeambeam/toktickit/issues/56` | Inspect Issue #56/#48, repository conventions and the existing authentication flow; implement Administrator user search/filter and account creation, validation, API/client synchronization, responsive UI, tests, and review follow-up. |
| 2026-09-15 | `$implement https://github.com/beambeambeam/toktickit/issues/51` | Inspect Issue #51/#48, the Lab 3 contracts and existing authenticated workflow; implement staff Ticket queue/detail read models, filtering, sorting, pagination, role boundaries, UI states, tests, and browser evidence. |
| 2026-09-19 | `$implement https://github.com/beambeambeam/toktickit/issues/58` | Integrate the merged Lab 3 slices on `lab3-staging`; run isolated-database API/browser verification; add reproducible screenshot manifests, visual review records and release-gate traceability. |

The user supplied the implement skill instructions requiring appropriate TDD seams, regular focused tests/typechecks, full tests at the end, code review and a commit. Actual verification and agent-review outcomes are maintained in [tests.md](./tests.md) and [reviewer.md](./reviewer.md). Six substantive prompts are visible in this record. No unseen prompt is invented.

## My Reflection

I used Codex as a development assistant throughout Lab 3, from turning the labsheet into an engineering contract to implementing authentication, the authenticated Requester flow, Administrator user management, the staff Ticket queue/detail workflow, and the final integration evidence. I accepted the proposal to work in vertical slices with shared specification, API, UI, test, reviewer, and AI-use documents. This gave me a clear dependency order and made it easier to connect each implementation change to an observable acceptance criterion instead of treating the lab as one large feature.

I did not accept AI output without checking it. The implementation and review process led me to correct assumptions about migration safety, isolated test databases, generated-client synchronization, role boundaries, session revocation, responsive behavior, and visual evidence. In particular, review findings and the Lab 3 boundary tests made me pay closer attention to cases that are easy to miss in a happy-path implementation: only one staff member winning a claim race, duplicate account creation, concurrent role or deactivation changes, stale Ticket versions, private-note isolation, CSRF/origin checks, and preservation of existing Lab 2 data during migration. The final browser run also showed that screenshots and accessibility checks are useful evidence, but they do not prove backend authorization or replace human peer review.

The tests changed my understanding of what “finished” means. Passing focused client or API tests was not enough; the full workflow required disposable databases, real sessions, cross-role checks, concurrency cases, responsive viewports, and traceable screenshot manifests. The recorded Lab 3 run passed 107 client tests, 120 server tests, and 81 browser tests with six expected desktop-only skips, while the documents still distinguish automated results from the pending final-main and external peer-review gates. This separation helped me avoid treating generated code or an automated pass as proof that every submission requirement was complete.

The main limitation of AI assistance is that it can move quickly from an incomplete assumption to a plausible implementation or an overly confident status summary. It cannot take responsibility for the correctness of my requirements interpretation, the meaning of the evidence, or the final submission decision. I therefore reviewed the diffs, test output, review comments, screenshots, and remaining gaps myself, and I remain responsible for the final Lab 3 sign-off.
