# Lab 2 Review Record

## 1. Purpose

Record reviewer identity, PR links, findings, responses, approvals, and unresolved limitations. This file is updated after every Lab 2 review; an open comment is not marked approved until the reviewer confirms the response.

## 2. Specification MR

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Pull Request     | #39 — Add Lab 2 specification                            |
| Pull Request URL | https://github.com/beambeambeam/toktickit/pull/39        |
| Repository       | beambeambeam/toktickit                                   |
| Base             | lab2-staging                                             |
| Head             | feature/5-requester-create                               |
| Scope            | Pre-implementation Lab 2 contract and evidence documents |
| Current status   | Pending reviewer re-check                                |

### Review finding: Kiatisakk

Reviewer: Kiatisakk  
Review date: 2026-08-19  
Review state: Changes requested

Finding: Functional Requirements and Business Rules were not numbered as required by the labsheet. Section 4.3 requires FR/BR numbering, and Section 8.10/Part 2 requires numbered requirements, rules, acceptance criteria, and Definition of Done.

Response: Added numbered FR-01 through FR-15 and BR-01 through BR-20 to specification.md. Confirmed the required numbered sections and linked each FR to acceptance criteria. Added the companion tests, UI, API, review, and AI-use documents required by the engineering contract.

Verification: Pending reviewer confirmation.

### Earlier attachment review

The attachment upload ordering, cleanup/compensation behavior, and removal-reason boundary were clarified in commit 70362f6. The current contract records the same behavior in specification.md and api-spec.md; API tests remain Pending until implementation.

## 3. Review checklist

| Check | Status |
| --- | --- |
| Numbered FR and BR requirements | Ready for re-check |
| Numbered acceptance criteria | Ready for re-check |
| Definition of Done | Ready for re-check |
| UI contract covers screens, states, responsive, and accessibility | Ready for re-check |
| API contract covers shapes, statuses, errors, and ownership | Ready for re-check |
| Test plan maps every AC to a planned path | Ready for re-check |
| Six required Lab 2 documents exist | Ready for re-check |
| Implementation tests and screenshots | Pending implementation |
| Final PDF and main-branch checks | Pending release |

## 4. Future review entries

Add one subsection per implementation/release PR with reviewer, date, link, comments, responses, approval state, and evidence. Keep unresolved findings visible until closed.
