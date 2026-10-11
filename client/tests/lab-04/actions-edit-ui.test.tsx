/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearCsrfToken, setCsrfToken } from "@/api/client";
import { ActionsTakenSection } from "@/components/actions-taken-section";
import type {
  Owner,
  TicketDetail,
  ActionTaken,
} from "@/generated/hey-api/types.gen";

const staff: Owner = {
  displayName: "Iris Staff",
  id: 10,
  isActive: true,
  isEligible: true,
  role: "IT Staff",
};
const admin: Owner = {
  displayName: "Ari Admin",
  id: 20,
  isActive: true,
  isEligible: true,
  role: "Administrator",
};
const action: ActionTaken = {
  assignee: staff,
  attachmentNotes: null,
  cancelledAt: null,
  cancelledBy: null,
  completedAt: null,
  completedBy: null,
  createdAt: "2026-09-30T04:00:00.000Z",
  createdBy: staff,
  description: "Replace the cable.",
  followUpNote: null,
  followUpRequired: false,
  id: 41,
  performedBy: null,
  result: null,
  startedAt: null,
  status: "Planned",
  ticketId: 120,
  updatedAt: "2026-09-30T04:00:00.000Z",
  version: 1,
};
const ticket: TicketDetail = {
  attachments: [],
  cancelledAt: null,
  category: { id: 1, name: "Network" },
  closedAt: null,
  currentStatus: "Open",
  description: "The office network is unavailable.",
  id: 120,
  itPriority: "Medium",
  owner: staff,
  relatedSystem: { id: 2, name: "Office" },
  reopenedAt: null,
  requestedPriority: "Medium",
  requester: {
    displayName: "Rina Requester",
    email: "rina@example.test",
    id: 12,
  },
  resolutionIndication: null,
  resolvedAt: null,
  statusChangedAt: action.createdAt,
  summary: "Office network unavailable",
  ticketDate: action.createdAt,
  ticketNumber: "TK-00120",
  updatedAt: action.createdAt,
  version: 8,
};
const pageOf = (saved: ActionTaken) => ({
  items: [saved],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
});
const writes: { body: Record<string, unknown>; csrf: string | null }[] = [];
const lifecycleWrites: {
  body: Record<string, unknown>;
  csrf: string | null;
}[] = [];
let saved = action;
let ticketSaved = ticket;
let writeResponse: (request: Request) => Response | Promise<Response>;
let lifecycleResponse: () => Response | Promise<Response>;
let historyResponse: () => Response;

const renderSection = (
  overrides: Partial<Parameters<typeof ActionsTakenSection>[0]> = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const props = {
    currentStatus: "Open" as const,
    defaultAssigneeId: 10,
    onRefreshTicket: vi.fn(),
    owners: [staff, admin],
    principalId: 10,
    principalRole: "IT Staff" as const,
    ticketId: 120,
    ticketVersion: 8,
    ...overrides,
  };
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ActionsTakenSection {...props} />
    </QueryClientProvider>
  );
  return {
    queryClient,
    ...view,
    rerenderSection: (
      next: Partial<Parameters<typeof ActionsTakenSection>[0]>
    ) => {
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <ActionsTakenSection {...props} {...next} />
        </QueryClientProvider>
      );
    },
  };
};

beforeEach(() => {
  saved = action;
  ticketSaved = ticket;
  writes.length = 0;
  lifecycleWrites.length = 0;
  setCsrfToken("edit-csrf");
  writeResponse = () => Response.json({ action: saved, ticket: ticketSaved });
  lifecycleResponse = () =>
    Response.json({ action: saved, ticket: ticketSaved });
  historyResponse = () =>
    Response.json({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname.endsWith("/transition")) {
        const body: unknown = await request.clone().json();
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          throw new TypeError("Expected transition request body.");
        }
        lifecycleWrites.push({
          body: Object.fromEntries(Object.entries(body)),
          csrf: request.headers.get("X-CSRF-Token"),
        });
        return await lifecycleResponse();
      }
      if (request.method === "PUT") {
        const body: unknown = await request.clone().json();
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          throw new TypeError("Expected replacement body.");
        }
        writes.push({
          body: Object.fromEntries(Object.entries(body)),
          csrf: request.headers.get("X-CSRF-Token"),
        });
        return await writeResponse(request);
      }
      if (url.pathname.endsWith("/actions")) {
        return Response.json(pageOf(saved));
      }
      if (url.pathname.endsWith("/history")) {
        return historyResponse();
      }
      if (url.pathname === "/api/tickets/120") {
        return Response.json(ticketSaved);
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    })
  );
});

afterEach(() => {
  cleanup();
  clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("pending Action Taken editing", () => {
  it("sends complete replacement with captured versions and CSRF, then restores focus", async () => {
    renderSection();
    const edit = await screen.findByRole("button", {
      name: "Edit Action Taken #41",
    });
    fireEvent.click(edit);
    expect(document.activeElement).toBe(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u)
    );
    fireEvent.change(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u),
      {
        target: { value: "  Test both ports.  " },
      }
    );
    fireEvent.change(screen.getByLabelText(/Assignee/u), {
      target: { value: "20" },
    });
    saved = {
      ...action,
      assignee: admin,
      description: "Test both ports.",
      version: 2,
    };
    ticketSaved = { ...ticket, version: 9 };
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      })
    );
    await waitFor(() => {
      expect(screen.queryByLabelText(/Action Description/u)).toBeNull();
    });
    expect(writes).toEqual([
      {
        body: {
          actionVersion: 1,
          assigneeId: 20,
          attachmentNotes: null,
          description: "Test both ports.",
          followUpNote: null,
          followUpRequired: false,
          result: null,
          ticketVersion: 8,
        },
        csrf: "edit-csrf",
      },
    ]);
    expect(document.activeElement).toBe(edit);
    expect(screen.getByText("Action Taken saved successfully.")).toBeTruthy();
  });

  it("keeps a stale draft and requires refresh/review before a deliberate second save", async () => {
    const { queryClient } = renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Action Taken #41" })
    );
    fireEvent.change(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u),
      {
        target: { value: "My unsaved work" },
      }
    );
    // A background cache update must not silently replace captured versions.
    saved = { ...action, description: "Other worker's saved work", version: 2 };
    ticketSaved = { ...ticket, version: 9 };
    await queryClient.invalidateQueries({ queryKey: ["ticket-actions"] });
    writeResponse = () =>
      Response.json(
        { error: { code: "VERSION_CONFLICT", message: "Changed" } },
        { status: 409 }
      );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      })
    );
    await screen.findByText(/saved action or Ticket changed/u);
    expect(writes[0]?.body.actionVersion).toBe(1);
    expect(writes[0]?.body.ticketVersion).toBe(8);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u).value
    ).toBe("My unsaved work");
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      }).disabled
    ).toBe(true);
    const refresh = screen.getByRole<HTMLButtonElement>("button", {
      name: "Refresh and review",
    });
    refresh.focus();
    fireEvent.click(refresh);
    const review = await screen.findByRole("heading", {
      name: "Latest saved values",
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(review);
    });
    expect(
      screen.getAllByText("Other worker's saved work").length
    ).toBeGreaterThan(0);
    expect(writes).toHaveLength(1);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u).value
    ).toBe("My unsaved work");
    writeResponse = () =>
      Response.json({
        action: { ...saved, description: "My unsaved work", version: 3 },
        ticket: { ...ticketSaved, version: 10 },
      });
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      })
    );
    await waitFor(() => {
      expect(writes).toHaveLength(2);
    });
    expect(writes[1]?.body).toMatchObject({
      actionVersion: 2,
      description: "My unsaved work",
      ticketVersion: 9,
    });
  });

  it("retains an ineligible assignee and explains an empty eligible selection", async () => {
    saved = {
      ...action,
      assignee: { ...staff, isActive: false, isEligible: false },
    };
    renderSection({ owners: [] });
    fireEvent.click(
      await screen.findByRole("button", { name: "Assign Action Taken #41" })
    );
    const select = screen.getByLabelText<HTMLSelectElement>(/Assignee/u);
    expect(document.activeElement).toBe(select);
    expect(select.value).toBe("10");
    expect(
      screen.getByRole("option", {
        name: /Iris Staff.*current ineligible assignee/u,
      })
    ).toBeTruthy();
    expect(
      screen.getByText(/No eligible assignees are available/u)
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Result/u), {
      target: { value: "Keep the historical assignment while documenting." },
    });
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      })
    );
    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    expect(writes[0]?.body.assigneeId).toBe(10);
  });

  it.each([
    [400, "VALIDATION_ERROR", "Enter a follow-up note."],
    [409, "ACTION_ASSIGNEE_INELIGIBLE", "Select eligible staff."],
    [403, "FORBIDDEN", "You are not allowed to edit this action."],
    [404, "RESOURCE_NOT_FOUND", "This Ticket or action was not found."],
    [503, "TEMPORARILY_UNAVAILABLE", "Try again later."],
  ])(
    "preserves text after %i and exposes recovery without another write",
    async (status, code, message) => {
      renderSection();
      writeResponse = () =>
        Response.json(
          {
            error: {
              code,
              message,
              ...(status === 400
                ? { details: { field: "followUpNote", reason: message } }
                : {}),
            },
          },
          { status }
        );
      fireEvent.click(
        await screen.findByRole("button", { name: "Edit Action Taken #41" })
      );
      fireEvent.change(
        screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u),
        {
          target: { value: "My draft survives" },
        }
      );
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Save Action Taken",
        })
      );
      await screen.findByText(
        new RegExp(`${message.replaceAll(".", "\\.")}.*draft is preserved`, "u")
      );
      expect(
        screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u).value
      ).toBe("My draft survives");
      expect(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Refresh and review",
        })
      ).toBeTruthy();
      expect(writes).toHaveLength(1);
    }
  );

  it("focuses an assignee field error from an eligibility race and retains the draft", async () => {
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Action Taken #41" })
    );
    fireEvent.change(screen.getByLabelText(/Action Description/u), {
      target: { value: "My draft after reassignment" },
    });
    fireEvent.change(screen.getByLabelText(/Assignee/u), {
      target: { value: "20" },
    });
    writeResponse = () =>
      Response.json(
        {
          error: {
            code: "ACTION_ASSIGNEE_INELIGIBLE",
            details: {
              field: "assigneeId",
              reason: "Choose an eligible assignee.",
            },
            message: "The selected assignee is ineligible.",
          },
        },
        { status: 409 }
      );
    const save = screen.getByRole<HTMLButtonElement>("button", {
      name: "Save Action Taken",
    });
    save.focus();
    fireEvent.click(save);
    await screen.findByText("Choose an eligible assignee.");
    const assignee = screen.getByLabelText<HTMLSelectElement>(/Assignee/u);
    await waitFor(() => {
      expect(document.activeElement).toBe(assignee);
    });
    expect(assignee.value).toBe("20");
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u).value
    ).toBe("My draft after reassignment");
    expect(writes).toHaveLength(1);
  });

  it("validates before writing, focuses errors, and cancels without saving", async () => {
    renderSection();
    const edit = await screen.findByRole("button", {
      name: "Edit Action Taken #41",
    });
    fireEvent.click(edit);
    fireEvent.click(
      screen.getByLabelText<HTMLInputElement>("Follow-Up Required")
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      })
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText(/Follow-up Note/u)
    );
    expect(writes).toHaveLength(0);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" })
    );
    expect(document.activeElement).toBe(edit);
    expect(screen.queryByLabelText(/Follow-up Note/u)).toBeNull();
    fireEvent.click(edit);
    expect(
      screen.getByLabelText<HTMLInputElement>("Follow-Up Required").checked
    ).toBe(false);
  });

  it("prevents duplicate in-flight writes and blocks cancel while saving", async () => {
    renderSection();
    let finish: ((response: Response) => void) | undefined;
    writeResponse = async () =>
      // oxlint-disable-next-line promise/avoid-new -- Hold the HTTP response to test pending UI and late responses.
      await new Promise<Response>((resolve) => {
        finish = resolve;
      });
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Action Taken #41" })
    );
    const saveButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Save Action Taken",
    });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u).disabled
    ).toBe(true);
    await act(async () => {
      finish?.(Response.json({ action, ticket }));
      await Promise.resolve();
    });
    await screen.findByText("Action Taken saved successfully.");
  });

  it.each(["Resolved", "Closed", "Cancelled"] as const)(
    "renders %s Ticket action history without write controls",
    async (currentStatus) => {
      renderSection({ currentStatus });
      await screen.findByRole("button", {
        name: "View history for Action Taken #41",
      });
      expect(
        screen.queryByRole("button", {
          name: /Edit Action|Assign Action|Add Action/u,
        })
      ).toBeNull();
    }
  );

  it("lets Requesters read attributed snapshots and recover from history failure", async () => {
    renderSection({ owners: [], principalRole: "Requester" });
    historyResponse = () =>
      Response.json(
        { error: { code: "FORBIDDEN", message: "Denied" } },
        { status: 403 }
      );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "View history for Action Taken #41",
      })
    );
    await screen.findByText("You are not allowed to read this history.");
    historyResponse = () =>
      Response.json({
        items: [
          {
            actionId: 41,
            actionVersion: 1,
            actor: staff,
            createdAt: action.createdAt,
            eventType: "ActionCreated",
            fromStatus: null,
            id: 1,
            snapshot: {
              assigneeId: 10,
              attachmentNotes: null,
              description: "<script>plain text</script>",
              followUpNote: null,
              followUpRequired: false,
              result: null,
              status: "Planned",
            },
            toStatus: "Planned",
          },
        ],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      });
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Retry action history",
      })
    );
    const region = screen.getByRole("region", {
      name: "Action Taken #41 history",
    });
    await within(region).findByText("<script>plain text</script>");
    expect(within(region).getByText(/Iris Staff.*Asia\/Bangkok/u)).toBeTruthy();
    expect(region.querySelector("script")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /Edit Action|Assign Action|Add Action/u,
      })
    ).toBeNull();
  });

  it.each(["Requester", "IT Staff"] as const)(
    "shows known assignee names and explicit former identities in %s history",
    async (principalRole) => {
      saved = {
        ...action,
        assignee: {
          ...staff,
          isActive: false,
          isEligible: false,
          role: "Requester",
        },
      };
      renderSection({
        owners: principalRole === "Requester" ? [] : [admin],
        principalRole,
      });
      historyResponse = () =>
        Response.json({
          items: [10, 20, 30].map((assigneeId, index) => ({
            actionId: 41,
            actionVersion: index + 1,
            actor: staff,
            createdAt: action.createdAt,
            eventType: "ActionEdited",
            fromStatus: "Planned",
            id: index + 1,
            snapshot: {
              assigneeId,
              attachmentNotes: null,
              description: "Saved revision.",
              followUpNote: null,
              followUpRequired: false,
              result: null,
              status: "Planned",
            },
            toStatus: "Planned",
          })),
          page: 1,
          pageSize: 20,
          totalItems: 3,
          totalPages: 1,
        });
      fireEvent.click(
        await screen.findByRole("button", {
          name: "View history for Action Taken #41",
        })
      );
      const history = screen.getByRole("region", {
        name: "Action Taken #41 history",
      });
      await within(history).findByText("Iris Staff (User #10)");
      expect(
        within(history).getByText("Former assignee (User #30)")
      ).toBeTruthy();
      expect(
        within(history).getByText(
          principalRole === "Requester"
            ? "Former assignee (User #20)"
            : "Ari Admin (User #20)"
        )
      ).toBeTruthy();
    }
  );

  it("discards local edits and ignores a late mutation after the principal changes", async () => {
    const { queryClient, rerenderSection } = renderSection();
    let finish: ((response: Response) => void) | undefined;
    writeResponse = async () =>
      // oxlint-disable-next-line promise/avoid-new -- Hold the HTTP response to test pending UI and late responses.
      await new Promise<Response>((resolve) => {
        finish = resolve;
      });
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Action Taken #41" })
    );
    fireEvent.change(
      screen.getByLabelText<HTMLTextAreaElement>(/Action Description/u),
      {
        target: { value: "Previous user's draft" },
      }
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save Action Taken",
      })
    );
    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    rerenderSection({ principalId: 12, principalRole: "Requester" });
    await screen.findByRole("button", {
      name: "View history for Action Taken #41",
    });
    expect(screen.queryByLabelText(/Action Description/u)).toBeNull();
    await act(async () => {
      finish?.(
        Response.json({
          action: { ...action, description: "Previous user's draft" },
          ticket: { ...ticket, version: 9 },
        })
      );
      await Promise.resolve();
    });
    expect(queryClient.getQueryData(["ticket", 10, 120])).toBeUndefined();
    expect(queryClient.getQueryData(["ticket", 12, 120])).toBeUndefined();
    expect(screen.queryByText("Action Taken saved successfully.")).toBeNull();
  });

  it("keeps the historical draft assignee visible when refresh reveals reassignment", async () => {
    const previousAssignee = { ...staff, isActive: false, isEligible: false };
    saved = { ...action, assignee: previousAssignee };
    renderSection({ owners: [admin] });
    fireEvent.click(
      await screen.findByRole("button", { name: "Assign Action Taken #41" })
    );
    writeResponse = () =>
      Response.json(
        { error: { code: "VERSION_CONFLICT", message: "Changed" } },
        { status: 409 }
      );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    await screen.findByRole("button", { name: "Refresh and review" });
    saved = { ...action, assignee: admin, version: 2 };
    ticketSaved = { ...ticket, version: 9 };
    fireEvent.click(screen.getByRole("button", { name: "Refresh and review" }));
    await screen.findByRole("heading", { name: "Latest saved values" });
    expect(screen.getByLabelText<HTMLSelectElement>(/Assignee/u).value).toBe(
      "10"
    );
    expect(
      screen.getByRole<HTMLOptionElement>("option", {
        name: /Iris Staff.*draft ineligible assignee/u,
      }).disabled
    ).toBe(true);
    expect(writes).toHaveLength(1);
  });
});

describe("Action Taken lifecycle controls", () => {
  it("starts an action with both current versions and CSRF, then refreshes its state", async () => {
    lifecycleResponse = () => {
      saved = {
        ...action,
        performedBy: staff,
        startedAt: "2026-10-11T13:00:00.000Z",
        status: "In Progress",
        version: 2,
      };
      ticketSaved = { ...ticket, version: 9 };
      return Response.json({ action: saved, ticket: ticketSaved });
    };

    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Action Taken #41" })
    );

    await screen.findByText("Action Taken started.");
    expect(lifecycleWrites).toEqual([
      {
        body: {
          actionVersion: 1,
          ticketVersion: 8,
          toStatus: "In Progress",
        },
        csrf: "edit-csrf",
      },
    ]);
    expect(
      screen.queryByRole("button", { name: "Start Action Taken #41" })
    ).toBeNull();
    expect(screen.getByText("In Progress")).toBeTruthy();
  });

  it("confirms cancellation and explains that the action becomes terminal", async () => {
    lifecycleResponse = () => {
      saved = {
        ...action,
        cancelledAt: "2026-10-11T13:00:00.000Z",
        cancelledBy: admin,
        status: "Cancelled",
        version: 2,
      };
      ticketSaved = { ...ticket, version: 9 };
      return Response.json({ action: saved, ticket: ticketSaved });
    };

    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel Action Taken #41" })
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Confirm cancellation of Action Taken #41?",
    });
    expect(
      within(dialog).getByText(/you cannot edit or change this Action Taken/u)
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm cancellation" })
    );

    await screen.findByText("Action Taken cancelled.");
    expect(lifecycleWrites).toEqual([
      {
        body: {
          actionVersion: 1,
          confirmed: true,
          ticketVersion: 8,
          toStatus: "Cancelled",
        },
        csrf: "edit-csrf",
      },
    ]);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel Action Taken #41" })
      ).toBeNull();
    });
    const status = screen.getByText("Action Taken cancelled.");
    expect(status.getAttribute("role")).toBe("status");
    expect(document.activeElement).toBe(status);
  });

  it("blocks completion when Result is blank or follow-up remains required", async () => {
    saved = { ...action, status: "In Progress", version: 2 };
    renderSection();
    const completeWithoutResult = await screen.findByRole("button", {
      name: "Complete Action Taken #41",
    });
    expect(completeWithoutResult).toHaveProperty("disabled", true);
    expect(screen.getByText(/Add a Result before completion/u)).toBeTruthy();

    cleanup();
    saved = {
      ...action,
      followUpNote: "Confirm the repair with the requester.",
      followUpRequired: true,
      result: "The cable was replaced.",
      status: "In Progress",
      version: 2,
    };
    renderSection();
    const completeWithFollowUp = await screen.findByRole("button", {
      name: "Complete Action Taken #41",
    });
    expect(completeWithFollowUp).toHaveProperty("disabled", true);
    expect(
      screen.getByText(/Clear or correct the follow-up details/u)
    ).toBeTruthy();
    expect(lifecycleWrites).toHaveLength(0);
  });

  it("completes an action only after confirmation and sends confirmed=true", async () => {
    saved = {
      ...action,
      performedBy: staff,
      result: "Replaced the cable and tested both ports.",
      startedAt: "2026-10-11T12:00:00.000Z",
      status: "In Progress",
      version: 2,
    };
    lifecycleResponse = () => {
      saved = {
        ...saved,
        completedAt: "2026-10-11T13:00:00.000Z",
        completedBy: admin,
        status: "Completed",
        version: 3,
      };
      ticketSaved = { ...ticket, version: 9 };
      return Response.json({ action: saved, ticket: ticketSaved });
    };

    renderSection();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Complete Action Taken #41",
      })
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Confirm completion of Action Taken #41?",
    });
    expect(
      within(dialog).getByText(/The Result and event history will remain/u)
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm completion" })
    );

    await screen.findByText("Action Taken completed.");
    expect(lifecycleWrites).toEqual([
      {
        body: {
          actionVersion: 2,
          confirmed: true,
          ticketVersion: 8,
          toStatus: "Completed",
        },
        csrf: "edit-csrf",
      },
    ]);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Complete Action Taken #41" })
      ).toBeNull();
    });
    const status = screen.getByText("Action Taken completed.");
    expect(status.getAttribute("role")).toBe("status");
    expect(document.activeElement).toBe(status);
  });

  it("traps dialog focus, closes on Escape, and restores focus to Cancel", async () => {
    renderSection();
    const cancel = await screen.findByRole("button", {
      name: "Cancel Action Taken #41",
    });
    fireEvent.click(cancel);
    const keep = screen.getByRole("button", { name: "Keep Action Taken" });
    expect(document.activeElement).toBe(keep);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(cancel);
    expect(lifecycleWrites).toHaveLength(0);
  });

  it("refreshes after a version conflict and shows the latest saved status", async () => {
    lifecycleResponse = () =>
      Response.json(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: "The supplied version is stale.",
          },
        },
        { status: 409 }
      );
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Action Taken #41" })
    );
    await screen.findByText(
      /The Action Taken or Ticket changed. Refresh the page/u
    );

    saved = {
      ...action,
      performedBy: staff,
      startedAt: "2026-10-11T13:00:00.000Z",
      status: "In Progress",
      version: 2,
    };
    ticketSaved = { ...ticket, version: 9 };
    fireEvent.click(screen.getByRole("button", { name: "Refresh and review" }));

    await screen.findByText(
      "Latest Action Taken values are ready. Review them before you retry."
    );
    expect(
      screen.queryByRole("button", { name: "Start Action Taken #41" })
    ).toBeNull();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(lifecycleWrites).toHaveLength(1);
  });

  it("prevents a second terminal write while cancellation is in flight", async () => {
    let finish: ((response: Response) => void) | undefined;
    lifecycleResponse = async () =>
      // oxlint-disable-next-line promise/avoid-new -- Hold the request to check duplicate-write protection.
      await new Promise<Response>((resolve) => {
        finish = resolve;
      });
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel Action Taken #41" })
    );
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm cancellation" })
    );
    await waitFor(() => {
      expect(lifecycleWrites).toHaveLength(1);
    });
    expect(
      within(dialog).getByRole("button", { name: "Saving…" })
    ).toHaveProperty("disabled", true);
    expect(
      within(dialog).getByRole("button", { name: "Keep Action Taken" })
    ).toHaveProperty("disabled", true);

    await act(async () => {
      finish?.(
        Response.json({
          action: {
            ...action,
            cancelledAt: "2026-10-11T13:00:00.000Z",
            cancelledBy: admin,
            status: "Cancelled",
            version: 2,
          },
          ticket: { ...ticket, version: 9 },
        })
      );
      await Promise.resolve();
    });
    await screen.findByText("Action Taken cancelled.");
    expect(lifecycleWrites).toHaveLength(1);
  });

  it("removes staff edit and lifecycle controls from terminal actions", () => {
    for (const status of ["Completed", "Cancelled"] as const) {
      saved = { ...action, status, version: 3 };
      renderSection();
      for (const actionName of [
        "Start Action Taken #41",
        "Complete Action Taken #41",
        "Cancel Action Taken #41",
        "Edit Action Taken #41",
        "Assign Action Taken #41",
      ]) {
        expect(screen.queryByRole("button", { name: actionName })).toBeNull();
      }
      cleanup();
    }
  });

  it("shows terminal history to Requesters without staff controls", async () => {
    saved = {
      ...action,
      completedAt: "2026-10-11T13:00:00.000Z",
      completedBy: admin,
      performedBy: staff,
      result: "Replaced the cable and tested both ports.",
      startedAt: "2026-10-11T12:00:00.000Z",
      status: "Completed",
      version: 3,
    };
    historyResponse = () =>
      Response.json({
        items: [
          {
            actionId: action.id,
            actionVersion: 3,
            actor: admin,
            createdAt: "2026-10-11T13:00:00.000Z",
            eventType: "ActionCompleted",
            fromStatus: "In Progress",
            id: 3,
            snapshot: null,
            toStatus: "Completed",
          },
        ],
        page: 1,
        pageSize: 20,
        totalItems: 3,
        totalPages: 1,
      });
    renderSection({ principalId: 12, principalRole: "Requester" });
    for (const actionName of [
      "Start Action Taken #41",
      "Complete Action Taken #41",
      "Cancel Action Taken #41",
      "Edit Action Taken #41",
      "Assign Action Taken #41",
    ]) {
      expect(screen.queryByRole("button", { name: actionName })).toBeNull();
    }
    fireEvent.click(
      await screen.findByRole("button", {
        name: "View history for Action Taken #41",
      })
    );
    await screen.findByText("ActionCompleted");
    expect(screen.getByText("In Progress → Completed")).toBeTruthy();
    expect(screen.getAllByText(/Ari Admin · Administrator/u)).toHaveLength(2);
    expect(
      screen.getAllByText("11 Oct 2026, 20:00 (Asia/Bangkok)")
    ).toHaveLength(1);
    expect(lifecycleWrites).toHaveLength(0);
  });
});
