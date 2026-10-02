# Lab 4 Reviewer Record

## Current review

[PR #80 — Sprint 4 engineering contract](https://github.com/beambeambeam/toktickit/pull/80) is open against `lab4-staging`. On 2026-10-02, @Kiatisakk and the Greptile review bot left ten inline review threads. Each finding was addressed in its own commit, answered in its thread, and resolved.

| Reviewer | Finding | Response |
| --- | --- | --- |
| Greptile | Document that legacy Ticket status history cannot be reconstructed from the new event table. | Added the migration boundary and user-facing history note. [Commit](https://github.com/beambeambeam/toktickit/commit/b40d193); replied and resolved. |
| Greptile | Require server confirmation for terminal Action Taken transitions. | Required and documented server confirmation. [Commit](https://github.com/beambeambeam/toktickit/commit/4788a73); replied and resolved. |
| @Kiatisakk | Align specification headings with the Lab 4 handout. | Added all 11 sections and moved decisions to §11. [Commit](https://github.com/beambeambeam/toktickit/commit/c7dbf4f); replied and resolved. |
| @Kiatisakk | Remove the follow-up completion condition made unreachable by BR-05. | Removed the unreachable condition. [Commit](https://github.com/beambeambeam/toktickit/commit/54f1fd9); replied and resolved. |
| @Kiatisakk | Use observable Given/When/Then product acceptance criteria. | Replaced process criteria with 25 product outcomes and moved contract checks to DoD. [Commit](https://github.com/beambeambeam/toktickit/commit/f17e655); replied and resolved. |
| @Kiatisakk | Add the required reviewer and AI-use records. | Added both handout-required files and updated scope/DoD. [Commit](https://github.com/beambeambeam/toktickit/commit/34a14c3); replied and resolved. |
| @Kiatisakk | Mark the contract as proposed until peer review approves it. | Marked specification, API, and UI docs proposed. [Commit](https://github.com/beambeambeam/toktickit/commit/0eb58ce); replied and resolved. |
| @Kiatisakk | Specify deterministic error precedence for the resolution gate. | Returned all gate reasons in a fixed order under one error code. [Commit](https://github.com/beambeambeam/toktickit/commit/01ddb40); replied and resolved. |
| @Kiatisakk | List stable screenshot names and states for each evidence folder. | Added per-folder desktop/tablet/mobile state filenames. [Commit](https://github.com/beambeambeam/toktickit/commit/5bbb7c0); replied and resolved. |
| @Kiatisakk | Split bundled API test cases into separately verifiable rows. | Split the plan into focused API test IDs and updated traceability. [Commit](https://github.com/beambeambeam/toktickit/commit/8cde49e); replied and resolved. |

No reviewer approval has been received for PR #80 as of 2026-10-02. Do not treat an automated check as peer approval.
