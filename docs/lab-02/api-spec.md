# Lab 2 API Specification — Requester Ticketing MVP

## 1. Contract rules

This document is the API contract for Lab 2. It refines [specification.md](./specification.md). Paths use the existing /api prefix. Authentication, sessions, passwords, tokens, and secure role authorization are out of scope.

The temporary requester context is sent on requester-scoped calls as:

    X-Development-Requester-Id: <integer id>

The header is a test context, not a trusted identity. The server validates that the referenced Development Requester exists and is active, then derives Ticket ownership from it. A requesterId supplied in a body is ignored or rejected; it never overrides the header.

All timestamps are ISO 8601 UTC strings. IDs are integer identifiers. API responses use JSON unless a download is requested.

## 2. Common response shapes

### 2.1 Error

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed.",
        "details": {
          "field": "summary",
          "reason": "Summary must contain 5–120 characters after trimming."
        }
      }
    }

Codes are stable, messages are safe, and details contain only field-level information. Never expose stack traces, SQL/database messages, local paths, storage keys, secrets, or internal authorization details.

### 2.2 TicketSummary

    {
      "id": 1,
      "ticketNumber": "TKT-20260822-A1B2C3",
      "ticketDate": "2026-08-22T10:00:00.000Z",
      "summary": "Cannot connect to campus Wi-Fi",
      "category": { "id": 1, "name": "Network" },
      "relatedSystem": { "id": 3, "name": "Campus Wi-Fi" },
      "requestedPriority": "High",
      "currentStatus": "New",
      "updatedAt": "2026-08-22T10:00:00.000Z"
    }

### 2.3 AttachmentMetadata

    {
      "id": 1,
      "originalFilename": "network-error.png",
      "mediaType": "image/png",
      "byteSize": 12345,
      "uploadedAt": "2026-08-22T10:00:00.000Z",
      "state": "Active",
      "removedAt": null,
      "removalReason": null
    }

Removed metadata may remain visible. Removed content never includes a download URL or stream.

### 2.4 TicketDetail

TicketDetail contains TicketSummary fields plus:

    {
      "requester": { "id": 1, "displayName": "Ada Requester", "email": "ada@example.test" },
      "description": "The laptop cannot reach the campus network.",
      "attachments": []
    }

## 3. Reference-data endpoints

### GET /api/categories

Returns active Categories from PostgreSQL in display order.

- Success: 200
- Response: { "items": [{ "id": 1, "name": "Network" }] }
- Failure: 500 with safe error envelope

### GET /api/related-systems

Returns active Related Systems from PostgreSQL in display order.

- Success: 200
- Failure: 500 with safe error envelope

### GET /api/development-requesters

Returns active Development Requesters for the selection screen. No requester context is required.

- Success: 200
- Response: { "items": [{ "id": 1, "displayName": "Ada Requester", "email": "ada@example.test" }] }
- Failure: 500 with safe error envelope

Inactive Requesters must never appear.

## 4. Ticket endpoints

### POST /api/tickets

Requires a valid X-Development-Requester-Id header. Consumes multipart/form-data:

| Part | Type | Rule |
| --- | --- | --- |
| categoryId | integer | Active Category |
| relatedSystemId | integer | Active Related System |
| summary | string | Trimmed length 5–120 |
| description | string | Trimmed length 20–4000 |
| requestedPriority | enum | Low, Medium, High, Urgent |
| attachments[] | file, optional | JPG/JPEG, PNG, WEBP, or PDF; 5 MB each; five active maximum |

The request must not require or trust requesterId. The server sets Ticket Date, Ticket Number, Current Status New, and ownership.

Responses:

- 201 with { "ticket": TicketDetail }
- 400 for missing/invalid context, fields, relationships, or file signatures
- 404 for missing or inactive reference data
- 413 for a file over 5 MB or a request exceeding the configured request limit
- 415 for an unsupported file type
- 409 for a documented uniqueness/state conflict
- 500 for a safe unexpected failure

Creation is atomic from the API consumer’s perspective. Validate every file first, write accepted files under generated opaque keys in non-public final storage, then create the Ticket and Attachment metadata in one database transaction. If file writing or the transaction fails, clean up every file written for the attempt and return failure. Never report a successful Ticket with incomplete Attachment metadata.

### GET /api/tickets

Requires a valid requester context. Returns only Tickets owned by that context.

Query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| search | text; searches Ticket Number, Summary, Description | none |
| categoryId | integer | none |
| relatedSystemId | integer | none |
| requestedPriority | Low, Medium, High, Urgent | none |
| currentStatus | New | none |
| sortBy | ticketNumber, ticketDate, summary, requestedPriority, currentStatus, updatedAt | updatedAt |
| sortDirection | asc, desc | desc |
| page | positive integer | 1 |
| pageSize | 10, 25, 50 | 10 |

The maximum page size is 50. Every sort uses immutable Ticket id as a secondary key. Invalid values return 400; they never silently fall back to defaults.

Success response:

    {
      "items": [],
      "page": 1,
      "pageSize": 10,
      "totalItems": 0,
      "totalPages": 0
    }

Responses:

- 200 on success
- 400 for invalid header or query parameters
- 500 for a safe unexpected failure

An empty owned list and a valid query with no matches are both 200 responses; the UI distinguishes them using query state.

### GET /api/tickets/:ticketId

Requires a valid requester context. Returns a TicketDetail only when the Ticket is owned by that context.

- 200 with TicketDetail
- 400 for malformed identifiers or context
- 404 for missing or unowned Tickets
- 500 for a safe unexpected failure

The 404 behavior intentionally avoids revealing whether another Requester owns the identifier.

## 5. Attachment endpoints

### GET /api/tickets/:ticketId/attachments

Returns active and documented removed AttachmentMetadata for an owned Ticket.

- 200 on success
- 400 for malformed identifiers or context
- 404 for missing or unowned Tickets
- 500 for a safe unexpected failure

### POST /api/tickets/:ticketId/attachments

Requires a valid requester context and owned Ticket. Consumes multipart/form-data with one or more attachments[] parts.

- 201 with { "attachments": [AttachmentMetadata, ...] }
- 400 for invalid context, identifier, count, signature, or metadata
- 404 for missing or unowned Ticket
- 413 for a file over 5 MB
- 415 for an unsupported type
- 409 when the five-active-Attachment limit would be exceeded
- 500 for a safe persistence failure

Check ownership and the active count before writing content. Use the same opaque-storage and database-compensation behavior as creation uploads. A failed operation cleans up staged/final files and never reports success.

### GET /api/tickets/:ticketId/attachments/:attachmentId/content

Streams an active Attachment only when both the Ticket and Attachment are owned by the requester context.

- 200 with file content and safe Content-Type/Content-Disposition
- 400 for malformed identifiers or context
- 404 for missing, unowned, removed, or unavailable content
- 500 for a safe unexpected failure

Original filenames are normalized for display and are never used as storage paths or authorization decisions.

### DELETE /api/tickets/:ticketId/attachments/:attachmentId

Consumes JSON:

    { "reason": "No longer needed for this request." }

Trim the reason before checking its inclusive 3–500 character limit. Require ownership and active Attachment state. Soft removal sets removedAt, removalReason, and removal actor metadata while retaining required file metadata. The content becomes unavailable immediately.

- 200 with retained AttachmentMetadata in Removed state
- 400 for malformed identifiers, context, body, or reason
- 404 for missing, unowned, or already unavailable resources
- 409 for a documented invalid state transition
- 500 for a safe unexpected failure

## 6. Validation and ownership matrix

| Condition | Response |
| --- | --- |
| Missing/malformed requester header | 400 safe context error |
| Nonexistent/inactive requester header | 400 safe context error |
| Client body attempts to choose another requester | Ignore or reject; never override context |
| Missing/unowned Ticket or Attachment | 404 safe resource response |
| Inactive Category/Related System | 404 or documented 400 reference-data error |
| Summary/Description outside limits | 400 field details |
| Invalid query parameter | 400 field details |
| Unsupported Attachment type | 415 |
| Attachment over 5 MB | 413 |
| More than five active Attachments | 409 or documented 400 limit error |
| Removed Attachment download/preview | 404 |

Use the same ownership check for list, detail, metadata, upload, download, and removal. Do not rely on client filtering.

## 7. OpenAPI and implementation sync

Implemented on the Lab 2 feature branch:

- `server/openapi.yaml` documents the active reference-data, requester-scoped Ticket, and Attachment endpoints.
- Generated client types and SDK files are synchronized from the OpenAPI document.
- Prisma migration and idempotent seed add Categories, Related Systems, active/inactive Development Requesters, Tickets, and Attachments.
- Attachment content is stored under `ATTACHMENT_STORAGE_DIR` using generated opaque keys; the directory is not public web storage.
- `pnpm openapi:check` passes, and the implemented API behavior is covered by `server/tests/lab-02/rules.test.ts` and `server/tests/lab-02/requester-ticketing.test.ts`.

The contract remains broader than the current automated boundary suite in a few areas, including exhaustive failure-injection permutations. Those gaps remain visible in [tests.md](./tests.md); no unverified status is claimed here.

## 8. Issue #37 implementation decisions and evidence

The existing `GET /api/tickets` contract is implemented as a requester-owned, paginated list. Search covers `ticketNumber`, `summary`, and `description`. Category, Related System, Requested Priority, and Current Status are independent filters. Supported sort fields use the requested direction and an immutable Ticket `id` secondary key for deterministic ordering. The response includes `page`, `pageSize`, `totalItems`, and `totalPages`.

Query parsing is strict: repeated parameters, nested keys, non-decimal integers, unsupported fields, invalid enum values, and invalid page-size values return `400 VALIDATION_ERROR`; invalid input never silently falls back to defaults. The client adapter also validates the response shape before exposing it to the UI and returns a safe `ApiRequestError` for malformed payloads.

Issue #37 API coverage: `server/tests/lab-02/requester-ticketing.test.ts` verifies search across documented fields, all list filters, deterministic ascending/descending pagination, metadata, ownership, and invalid query forms. `client/tests/lab-02/requester-api.test.ts` verifies malformed list-response rejection.

## 9. Issue #38 implementation decisions and evidence

Issue #38 confirms the Ticket Detail and Attachment endpoints implemented under Issue #36 against the contract above; no endpoint shapes changed.

- `GET /api/tickets/:ticketId` and `GET /api/tickets/:ticketId/attachments` enforce the same context-to-Ticket ownership check as the list endpoint and return the safe `404 RESOURCE_NOT_FOUND` envelope for missing or unowned Tickets.
- `POST /api/tickets/:ticketId/attachments` validates files, checks ownership and the active count before storing, writes opaque files before the database write, re-checks the five-active limit inside the write, and compensates staged files on failure. Exceeding the limit returns `409 ATTACHMENT_LIMIT_EXCEEDED`.
- `GET .../attachments/:attachmentId/content` streams only active owned Attachments with safe `Content-Type` and `Content-Disposition`; removed, missing, or unowned content returns `404` and missing storage content is also mapped to safe `404`.
- `DELETE .../attachments/:attachmentId` requires the trimmed 3–500 character reason, deletes file content before committing removal metadata so cleanup failures stay retryable, and returns `200` with the retained `Removed` metadata. Repeat removal returns safe `404`.
- Server coverage for this slice lives in `server/tests/lab-02/requester-ticketing.test.ts`: cross-requester detail hiding, active download, soft removal without exposing removed content, concurrent additions serialized at the active limit, and retryable removal when cleanup fails. Client upload/download/removal boundary coverage lives in `client/tests/lab-02/ticket-detail.test.tsx`; the full lifecycle including removed-download blocking is proven in `e2e/lab-02/requester-flow.spec.ts`.
