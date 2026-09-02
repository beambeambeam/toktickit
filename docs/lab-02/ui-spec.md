# Lab 2 UI Specification — Zen Green Requester Workflows

## 1. Purpose and source of truth

This document is the detailed presentation contract for Lab 2. It refines [specification.md](./specification.md) and the three supplied reference illustrations:

- Ticket Detail: labsheet image page 2.
- Development Requester Selection: labsheet image page 9.
- My Tickets: labsheet image page 10.

The illustrations establish visual direction, not the complete Lab 2 feature list. Lab 2 shows Requested Priority and Current Status. Profile, IT Priority, Ticket Owner, Public Comments, Service Actions, Event Log, Resolution Summary, staff controls, and later workflow controls are excluded.

## 2. Design tokens

| Token | Value or rule | Use |
| --- | --- | --- |
| Primary green | #006B3C | Header, primary actions, strong emphasis |
| Secondary green | #0B7A46 | Active navigation, links, focus and hover accents |
| Pale green | #EAF6EF | Selected, success, and subtle section emphasis |
| Page background | #F5F7F6 or equivalent quiet near-white | Page canvas |
| Surface | White, subtle border, restrained shadow | Cards and form sections |
| Text | Dark charcoal-green, not pure black | Body and headings |
| Error | Dark red text and border | Validation and failure |
| Warning | Amber callout or badge | Warning and unavailable states |
| Success | Readable green plus text/icon | Confirmation; never color alone |
| Spacing | Consistent 4/8 px rhythm | Layout, field groups, and sections |
| Control height | One shared token for ordinary controls | Selects, inputs, and buttons |

Use a readable system sans-serif stack. Keep Summary and Description wider than short controls. Dates and metadata use a consistent locale-aware display format while API timestamps remain unchanged.

## 3. Application shell

The shell contains:

- TokTickIT identity.
- My Tickets navigation.
- Create Ticket navigation.
- Current Development Requester display.
- Clear active-page indication.
- Change Requester action.
- Responsive mobile navigation.

The selected Requester is context, not authentication. The selector screen must state: “This is for Lab 2 testing only. It is not a login screen.” Do not use login, password, session, or secure identity language for this flow.

## 4. Screen contracts

### 4.1 Development Requester Selection

| Element | Contract |
| --- | --- |
| Title | TokTickIT |
| Explanation | State that the selection is a testing context and authentication arrives in Lab 3 |
| Control | Keyboard-accessible select containing active Requesters only |
| Continue | Primary action; disabled until a valid Requester is selected |
| Loading | Visible progress/status while active Requesters load |
| Empty | Explain that no active Requesters are available and provide recovery guidance |
| API failure | Safe error message and retry action |
| Existing context | Show Change/Back as secondary navigation when returning from a selected context |

After Continue, show the selected Requester in the shell and reload requester-scoped data. Context switching clears visible requester data before replacement data appears.

### 4.2 Create Ticket

Labels appear above controls. Required fields use a red asterisk and a validation message below the associated control; the asterisk never replaces the message.

| Field | Mode | Rules |
| --- | --- | --- |
| Ticket Number | Read-only | Hidden until success; backend-generated |
| Ticket Date | Read-only | Backend timestamp; locale-aware display |
| Requester | Read-only context | Selected Development Requester; never editable in the form |
| Category | Editable, required | Active API reference data |
| Related System | Editable, required | Active API reference data |
| Summary | Editable, required | Trimmed length 5–120 |
| Requested Priority | Editable, required | Low, Medium, High, or Urgent |
| Description | Editable multiline, required | Trimmed length 20–4000 |
| Attachments | Editable, optional | JPG/JPEG, PNG, WEBP, or PDF; 5 MB each; five active maximum |

Initial, loading, validation failure, submitting, success, API failure, invalid-file, and recovery states are required. Submit is disabled and visibly busy while processing. A recoverable failure preserves valid values. Success shows the official Ticket Number and a clear next action.

### 4.3 My Tickets

Provide:

- Search.
- Category, Related System, Requested Priority, and Current Status filters.
- Sort control.
- Page number and permitted page-size control.
- Clear Filters action.
- Create Ticket action.
- Retry on failure.

Desktop may use a table. Mobile may use cards or a responsive table, but every Ticket must retain enough information to identify and open it.

Required visible fields:

1. Ticket Number.
2. Ticket Date.
3. Summary.
4. Category.
5. Requested Priority.
6. Current Status.
7. Last Updated.

States:

- Initial/loading.
- Empty: the selected Requester has no Tickets.
- No results: a valid query has no matching Tickets.
- Failure: safe message and retry.
- Loaded: deterministic ordering and pagination metadata.

Empty and no-results states must use different explanatory text and actions.

### 4.4 Requester Ticket Detail

Display owned Ticket information read-only and separate it visually from Attachment actions. Show:

- Ticket Number, Ticket Date, Requester, Category, Related System, Summary, Requested Priority, Current Status, Description, and Last Updated.
- Attachment filename, type, size, upload time, and state.
- Add Attachment action.
- Download action for active owned files.
- Remove action with confirmation and a trimmed 3–500 character reason.

Removed metadata remains visible when the contract allows it. Removed or unavailable content has no download or preview action. Do not add comments, internal notes, staff actions, or post-creation status controls.

## 5. Component and feedback states

### 5.1 Field states

Every reusable control distinguishes editable, read-only, invalid, disabled, and focused states through border, background, icon, text, or layout—not color alone. Focus indicators remain visible. Read-only values use a soft gray-green or warm ivory surface while remaining readable.

### 5.2 Button hierarchy

| Variant | Use |
| --- | --- |
| Primary | Continue, Create Ticket, Submit |
| Secondary | Cancel, Back, Retry where neutral recovery is appropriate |
| Tertiary | Clear Filters and low-emphasis navigation |
| Destructive | Remove Attachment |
| Disabled | Unavailable because of validation, missing context, or processing |
| Busy | Disabled processing state with visible progress text or indicator |

Buttons have visible text. Icons support text; icon-only controls require accessible names and tooltips.

### 5.3 Attachment states

| State       | Presentation and behavior                                    |
| ----------- | ------------------------------------------------------------ |
| Active      | Metadata plus Download and Remove actions when owned         |
| Uploading   | Progress/busy indicator; duplicate actions disabled          |
| Invalid     | Inline reason beside the file control; file is not submitted |
| Removed     | Retained metadata and reason; no download or preview         |
| Unavailable | Safe explanation; no download or preview                     |

### 5.4 Badges and status

Requested Priority and Current Status use readable text/icon badges. Each badge has a non-color indicator. Lab 2 exposes Current Status New only; do not render IT Priority as a Lab 2 status.

## 6. Responsive behavior

| Viewport | Required behavior |
| --- | --- |
| Desktop, 992 px and above | Centered multi-column layout with a sensible maximum width |
| Tablet, 768–991 px | Two columns where practical; Summary and Description retain usable width |
| Mobile, below 768 px | Stacked fields and touch-friendly controls |
| All sizes | No horizontal page scroll, clipping, overlap, hidden actions, or unreadable filenames |

The shell collapses to usable mobile navigation. Tables may become cards. Long Ticket numbers, summaries, filenames, validation text, and removal reasons must wrap without breaking actions.

## 7. Accessibility

- Use semantic headings, landmarks, labels, and form controls.
- Associate every validation message with its field.
- Keep keyboard focus visible and keyboard order logical.
- Give icon-only controls accessible names.
- Announce loading, success, failure, and list updates through an appropriate status region.
- Do not communicate error, warning, success, priority, or status by color alone.
- Preserve usable contrast and touch target size.
- Keep disabled and busy controls non-activatable.

## 8. Visual evidence and checklist

Store evidence under:

- artifacts/lab-02/screenshots/create-ticket/
- artifacts/lab-02/screenshots/my-tickets/
- artifacts/lab-02/screenshots/ticket-detail/

Capture desktop, tablet, and mobile views plus required validation, failure, empty/no-results, ownership, and Attachment states. The final checklist compares each screen against this file and the supplied illustrations:

- Zen Green tokens and readable contrast.
- Editable versus read-only field treatment.
- Required asterisks and message placement.
- Primary, secondary, tertiary, destructive, disabled, and busy hierarchy.
- Loading, success, failure, empty, no-results, and Attachment states.
- Visible focus and accessible names.
- No clipping, overlap, horizontal overflow, or hidden actions.
- Correct Lab 2 scope: Requested Priority and Current Status only.

Evidence captured on 2026-09-02 with `pnpm test:e2e`: Create Ticket (12 PNGs), My Tickets (9 PNGs), and Ticket Detail (9 PNGs) under the required directories. The artifacts cover desktop, tablet, mobile, validation, ownership isolation, direct unauthorized Ticket refusal, active Attachment, and removed Attachment states. The E2E flow also verifies that removed Attachment content returns 404. Final checklist completion and human visual approval remain Pending.
