# Lab 2 AI-Use Record

## 1. Purpose and responsibility

AI was used as a specification and planning assistant. The student remains responsible for interpreting the Lab 2 PDF, choosing scope, approving the design, reviewing generated documents, implementing the tickets, running tests, and approving the final submission.

Generated text is a draft until it is checked against the PDF, reference images, repository guidance, codebase, review comments, and test evidence.

## 2. Tools and source material

| Item | Record |
| --- | --- |
| Assistant | OpenAI Codex coding agent |
| Specification skill | to-spec |
| Ticket skill | to-tickets; this is the local skill name for the requested to-ticket workflow |
| Primary source | Lab 2 PDF/labsheet and supplied reference images |
| Repository inputs | Existing code, tests, AGENTS.md guidance, PR #39, and Kiatisakk’s review |
| Main outputs | Lab 2 specification, vertical-slice tickets, six living Lab 2 documents, and the Issue #36 implementation |
| Human responsibility | Review every requirement, decision, ticket, generated file, test, and evidence claim |

## 3. Workflow

1. Drop the Lab 2 PDF and reference images into the conversation.
2. Use to-spec to turn the PDF, images, repository, and existing discussion into a complete feature specification.
3. Review the proposed test seams, scope boundaries, ambiguities, and implementation decisions.
4. Use to-tickets to break the approved specification into tracer-bullet vertical slices. Each ticket must deliver a demonstrable end-to-end behavior, list its blockers, and include observable acceptance criteria.
5. Review ticket granularity and blocking edges before publishing or implementing tickets.
6. Ask the coding agent to write the base Lab 2 documents from the approved specification and ticket breakdown.
7. Update the documents after each vertical slice with actual paths, results, review evidence, and AI-use reflection.
8. Implement Issue #36 after checking its discussion and the UI reference at `reports/lab02/tickets/09.png`; verify the result against the Lab 2 contract and repository checks.

The workflow is document-first. It must not claim that implementation, tests, screenshots, or ticket publication are complete when they are only planned.

## 4. Core reusable prompts

### Prompt 1 — PDF to specification to tickets

    I uploaded the Lab 2 PDF and its reference images. Use the to-spec skill first, then use the to-tickets skill.

    Treat the PDF, images, repository guidance, existing code/tests, and current conversation as source material. Inspect the repository before drafting. Use the project domain vocabulary. Do not interview me; synthesize what is already known.

    First produce a complete Lab 2 specification with:
    - Problem Statement
    - Solution
    - extensive numbered User Stories
    - Implementation Decisions
    - Testing Decisions using the highest practical existing seams
    - Out of Scope
    - Further Notes

    Resolve ambiguity explicitly. Audit the reference images against the written scope so later-lab or staff-only fields are not added accidentally.

    Then propose tracer-bullet tickets from the approved specification. Every ticket must cut through the required layers, be independently demoable, list genuine blockers, and contain observable acceptance criteria. Put blockers before dependent tickets. Show the proposed breakdown for review before publishing anything to the issue tracker.

    Return the specification summary, proposed ticket list, blocking edges, unresolved decisions, and risks. Do not implement code.

### Prompt 2 — Approved specification to base documents

    Using the approved Lab 2 specification and ticket breakdown, write the base documentation under docs/lab-02:

    - specification.md
    - tests.md
    - ui-spec.md
    - api-spec.md
    - reviewer.md
    - ai-use.md

    Keep all documents internally consistent. Number Functional Requirements, Business Rules, and Acceptance Criteria. Define UI tokens, screen states, responsive/accessibility behavior, data decisions, API endpoints, request/response shapes, validation, ownership, safe errors, planned test paths, and Definition of Done.

    Map every Acceptance Criterion to at least one planned test. Mark implementation results, screenshots, approvals, and final PDF evidence as Pending when they do not exist yet. Record review comments and responses without inventing approval. Include this two-stage PDF-to-spec-to-tickets workflow in ai-use.md and keep a six-to-ten prompt record.

    Use the supplied images as visual direction only. Preserve explicit Lab 2 exclusions. Do not write implementation code, fabricate test results, or claim that an issue is complete.

## 5. Supporting prompts and verification

| # | Supporting prompt objective | Output used | Verification |
| --- | --- | --- | --- |
| 3 | Audit the PDF and reference images for included/excluded behavior | Kept Requested Priority and Current Status; excluded IT Priority, staff controls, comments, event log, and resolution fields | Compared every image-derived feature with the written Lab 2 scope |
| 4 | Challenge the specification for ambiguous ownership, context, Attachment, validation, and failure behavior | Added explicit requester-context, ownership, storage compensation, limits, removal reason, and safe-error decisions | Cross-checked against the labsheet and Kiatisakk’s review |
| 5 | Build a test plan from the approved Acceptance Criteria | Added planned unit, API, UI, accessibility, responsive, visual, and E2E paths | Confirmed every AC has a planned test path |
| 6 | Check the Lab 2 repository contract | Added the six required documents and the required numbered sections | Compared with labsheet sections 4, 15, 16, 19, and 20 |
| 7 | Review generated documentation for traceability and unsupported claims | Added reviewer status, Pending markers, and human-review responsibility | Checked links, counts, headings, and repository state |

## 6. Generated outputs and current status

| Output | Status |
| --- | --- |
| Numbered specification with FR-01–FR-15, BR-01–BR-20, and AC-01–AC-20 | Drafted and repository-checked |
| Vertical-slice ticket breakdown | Requires review before tracker publication |
| tests.md | Base plan drafted; implementation paths/results Pending |
| ui-spec.md | Base UI contract drafted; screenshots/checklist Pending |
| api-spec.md | Base API contract drafted; OpenAPI implementation Pending |
| reviewer.md | PR #39 finding and response recorded; reviewer re-check Pending |
| ai-use.md | This workflow record; student reflection review Pending |

## 7. Implementation update

Issue #36 implementation used the GitHub issue acceptance criteria, its UI-reference comment, the Lab 2 specification/API/UI contracts, repository guidance, and the report reference images under `reports/lab02`. The implementation added the Prisma model/migration/seed, requester-context middleware, active reference-data APIs, ownership-scoped Ticket and Attachment services, OpenAPI/generated client updates, Requester selection/Create Ticket/My Tickets/Detail screens, validation, and focused tests.

Verification recorded on 2026-09-02: formatting/lint fix, client/server type checks, client tests (32), server tests (31), OpenAPI synchronization, and production build pass. A local browser preview covered the end-to-end requester flow and Attachment lifecycle. Internal standards/spec review findings were addressed. Screenshot/PDF evidence and human approval remain Pending until supplied.

## 8. Reflection draft

The PDF-first workflow made the long handout actionable. to-spec helped turn stakeholder language and reference images into a coherent contract; to-tickets then exposed the dependency order and kept implementation work vertical instead of splitting it into disconnected database, API, and UI tasks. The second prompt made the contract easier to use by putting specification, tests, UI, API, review, and AI-use records in one consistent document set.

The main risk is accepting generated scope or decisions without checking the source. I reduced that risk by comparing the images with the written scope, recording explicit exclusions, marking unknown results as Pending, and keeping human approval before ticket publication and implementation.

Student review required: edit this reflection if needed, then approve the final wording before PDF submission.

## 9. Ongoing updates

After each vertical slice, record:

- Prompt or task summary.
- Files changed with AI assistance.
- Human corrections and decisions.
- Tests and evidence that verified the result.
- Review comments, responses, and approval state.
- Any generated suggestion rejected and why.
