# Lab 2 AI Use and Reflection

## Tool and model

- Coding agent: Codex in T3 Code
- LLM/model: GPT-5.6-Luna
- Account or platform: T3 Code
- Main use: requirements clarification, specification and ticket planning, implementation support, debugging, test review, code review, and documentation review.

## Selected key prompts

The workflow moved from the Lab 2 source material to a reviewed specification, vertical-slice tickets, implementation, browser evidence, and submission preparation. `$implement` and `$code-review` below mean the local skills used for the relevant work.

| Prompt name | Actual prompt text | Result / reflection |
| --- | --- | --- |
| Convert Lab 2 source material to a specification and tickets | `$to-spec` followed by `$to-tickets`<br><br>Read the Lab 2 PDF, labsheet, reference images, repository guidance, existing code/tests, and current discussion. Produce a complete specification, then break it into independently demonstrable vertical slices with blockers and observable acceptance criteria. Do not implement code. | The source material became a numbered Lab 2 contract and three vertical slices: requester creation, My Tickets discovery, and Ticket Detail/Attachment lifecycle. Reflection: making dependencies explicit prevented disconnected database, API, and UI work. |
| Write the Lab 2 living documents | Use the approved specification and ticket breakdown to write `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `reviewer.md`, and `ai-use.md` under `docs/lab-02`. Keep requirements, decisions, tests, evidence, and pending status consistent. | The six required documents recorded the domain model, UI states, API contracts, planned tests, review notes, and AI-use workflow. Reflection: a shared document contract made later implementation decisions easier to trace. |
| Audit reference images and boundaries | Compare the supplied Requester Selection, My Tickets, and Ticket Detail images with the written Lab 2 scope. Keep Lab 2 fields and exclude later-lab or staff-only controls. | Requested Priority and Current Status were retained; IT Priority, Ticket Owner, comments, service actions, event log, resolution, and authentication fields stayed excluded. Reflection: treating images as visual direction avoided copying unrelated workflow into the MVP. |
| Implement Issue #36 | `$implement https://github.com/beambeambeam/toktickit/issues/36`<br><br>Read the issue discussion and the UI reference comment. Use additional context from `reports/lab02`. Create a feature branch, implement the requester context and Create Ticket flow, add tests, verify the repository, and commit the work. | Added the Prisma migration/seed, active reference-data APIs, requester-context middleware, ownership-scoped Ticket and Attachment services, OpenAPI/generated client updates, Zen Green requester/Create Ticket/My Tickets/Detail screens, validation, and focused tests. Reflection: the report context clarified the temporary requester-selector UX and the full Lab 2 screen contract. |
| Review the implementation | `$code-review lab2-staging`<br><br>Review the branch on Standards and Spec axes using repository guidance, the Lab 2 specification, tests, UI/API contracts, and report context. Report exact findings and do not invent approval or evidence. | The review caught service transaction-boundary issues, generated-client bypasses, stale compatibility paths, missing field-level Attachment feedback, accessibility gaps, and incomplete reference-data failure handling. Fixes were applied and rechecked. Reflection: separate Standards and Spec reviews distinguished implementation defects from submission evidence gaps. |
| Run browser E2E and capture evidence | `pnpm test:e2e`<br><br>Run the real client/API requester flow across desktop, tablet, and mobile Chromium. Capture the required Create Ticket, My Tickets, and Ticket Detail screenshots, including validation, ownership, direct unauthorized Ticket access, active Attachment, and removed Attachment states. Verify active download and blocked removed download. | Playwright passed all 6 tests and captured 30 PNG artifacts in the required Lab 2 directories. Reflection: making evidence capture part of the executable flow tied screenshots to a repeatable scenario instead of a one-off manual state. Final PDF and human approval remain pending. |

## Final brief reflection

The PDF-first workflow made the long Lab 2 handout actionable. Specification and ticket planning exposed the dependency order before implementation, while the report images supplied concrete UI direction without overriding written scope. Implementing the requester flow through database, API, client, tests, browser E2E, and documentation kept the behavior demonstrable end to end.

I still had to inspect the generated code, verify ownership and failure behavior, run the checks, review the branch, inspect the generated screenshots, and mark final PDF evidence and human approval as Pending rather than treating generated output as proof. The student remains responsible for the final requirements review, reflection, evidence, and submission approval.
