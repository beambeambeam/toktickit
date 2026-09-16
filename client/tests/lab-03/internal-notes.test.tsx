/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/api/errors";
import { InternalNotesSection } from "@/components/internal-notes-section";
import type { CurrentStatus, Entry } from "@/generated/hey-api/types.gen";

const { getInternalNotesMock, postInternalNoteMock } = vi.hoisted(() => ({
  getInternalNotesMock: vi.fn(),
  postInternalNoteMock: vi.fn(),
}));

vi.mock("@/api/internal-notes", () => ({
  getTicketInternalNotes: getInternalNotesMock,
  postTicketInternalNote: postInternalNoteMock,
}));

const firstNote: Entry = {
  author: { displayName: "Iris IT Staff", id: 1 },
  content: "<img src=x onerror=alert(1)>\nOnly staff can read this.",
  createdAt: "2026-09-10T10:00:00.000Z",
  id: 101,
};

const newNote: Entry = {
  author: { displayName: "Iris IT Staff", id: 1 },
  content: "Private follow-up",
  createdAt: "2026-09-10T10:01:00.000Z",
  id: 102,
};

const renderSection = ({
  canPost = true,
  currentStatus = "Open" as const,
  principalId = 1,
  ticketId = 11,
}: {
  canPost?: boolean;
  currentStatus?: CurrentStatus;
  principalId?: number;
  ticketId?: number;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <InternalNotesSection
          canPost={canPost}
          currentStatus={currentStatus}
          principalId={principalId}
          ticketId={ticketId}
        />
      </QueryClientProvider>
    ),
  };
};

describe("Internal Notes section", () => {
  beforeEach(() => {
    getInternalNotesMock.mockReset().mockResolvedValue([firstNote]);
    postInternalNoteMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders private entries as escaped text and adds a trimmed note", async () => {
    postInternalNoteMock.mockResolvedValue(newNote);
    renderSection();

    await screen.findByText(/<img src=x onerror=alert\(1\)>/u);
    expect(document.querySelector("img")).toBeNull();

    const composer = screen.getByRole("textbox", { name: "Internal Note" });
    fireEvent.change(composer, { target: { value: "  Private follow-up  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));

    await waitFor(() => {
      expect(postInternalNoteMock).toHaveBeenCalledWith(
        11,
        "Private follow-up"
      );
    });
    await screen.findByText("Internal Note added successfully.");
    expect(composer).toHaveProperty("value", "");
  });

  it("keeps the draft after a recoverable failure without automatic retry", async () => {
    postInternalNoteMock.mockRejectedValue(
      new ApiRequestError(500, "The API request failed.", "INTERNAL_ERROR")
    );
    renderSection();

    const composer = await screen.findByRole("textbox", {
      name: "Internal Note",
    });
    fireEvent.change(composer, {
      target: { value: "Keep this private draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));

    await screen.findByText("The API request failed.");
    expect(composer).toHaveProperty("value", "Keep this private draft");
    expect(postInternalNoteMock).toHaveBeenCalledTimes(1);
  });

  it("clears the draft when navigating to another Ticket", async () => {
    const rendered = renderSection();
    const composer = await screen.findByRole("textbox", {
      name: "Internal Note",
    });
    fireEvent.change(composer, { target: { value: "Ticket A private draft" } });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InternalNotesSection
          canPost
          currentStatus="Open"
          principalId={1}
          ticketId={12}
        />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("textbox", { name: "Internal Note" })
    ).toHaveProperty("value", "");
  });

  it("focuses invalid input and describes its validation error", async () => {
    renderSection();
    const composer = await screen.findByRole("textbox", {
      name: "Internal Note",
    });
    fireEvent.change(composer, { target: { value: " \t" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));

    await screen.findByText(/Internal Note must contain 1–5000/u);
    expect(document.activeElement).toBe(composer);
    expect(composer.getAttribute("aria-describedby")).toBe(
      "internal-note-help-11 internal-note-11-error"
    );
    expect(postInternalNoteMock).not.toHaveBeenCalled();
  });

  it("hides the composer for terminal Tickets and read-only Administrators", async () => {
    getInternalNotesMock.mockResolvedValueOnce([]);
    renderSection({ currentStatus: "Closed" });

    await screen.findByText("No Internal Notes yet.");
    expect(screen.queryByRole("textbox", { name: "Internal Note" })).toBeNull();
    expect(
      screen.getByText(/Closed and Cancelled Tickets are read-only/u)
    ).toBeTruthy();

    cleanup();
    renderSection({ canPost: false });
    await screen.findByText(/<img src=x onerror=alert\(1\)>/u);
    expect(screen.queryByRole("textbox", { name: "Internal Note" })).toBeNull();
    expect(screen.getByText(/Administrator access is read-only/u)).toBeTruthy();
  });

  it("keys note data by authenticated principal", async () => {
    const { queryClient } = renderSection({ principalId: 2 });

    await screen.findByText(/<img src=x onerror=alert\(1\)>/u);
    expect(queryClient.getQueryData(["internal-notes", 2, 11])).toEqual([
      firstNote,
    ]);
    expect(queryClient.getQueryData(["internal-notes", 1, 11])).toBeUndefined();
  });
});
