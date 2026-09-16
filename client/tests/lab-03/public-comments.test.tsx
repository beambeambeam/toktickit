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
import { PublicCommentsSection } from "@/components/public-comments-section";
import type { CurrentStatus, Entry } from "@/generated/hey-api/types.gen";

const { getTicketCommentsMock, postTicketCommentMock } = vi.hoisted(() => ({
  getTicketCommentsMock: vi.fn(),
  postTicketCommentMock: vi.fn(),
}));

vi.mock("@/api/ticket-comments", () => ({
  getTicketComments: getTicketCommentsMock,
  postTicketComment: postTicketCommentMock,
}));

const firstComment: Entry = {
  author: { displayName: "Ada Requester", id: 1 },
  content: "<b>Existing</b>\nVisible to everyone",
  createdAt: "2026-09-10T10:00:00.000Z",
  id: 101,
};

const newComment: Entry = {
  author: { displayName: "Ada Requester", id: 1 },
  content: "New update 😀",
  createdAt: "2026-09-10T10:01:00.000Z",
  id: 102,
};

const renderSection = ({
  canPost = true,
  currentStatus = "Open" as const,
  ticketId = 11,
}: {
  canPost?: boolean;
  currentStatus?: CurrentStatus;
  ticketId?: number;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <PublicCommentsSection
        canPost={canPost}
        currentStatus={currentStatus}
        principalId={1}
        ticketId={ticketId}
      />
    </QueryClientProvider>
  );

  return { ...rendered, queryClient };
};

describe("Public Comments section", () => {
  beforeEach(() => {
    getTicketCommentsMock.mockReset().mockResolvedValue([firstComment]);
    postTicketCommentMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders plain text with line breaks and posts a trimmed comment", async () => {
    postTicketCommentMock.mockResolvedValue(newComment);
    renderSection();

    await screen.findByText("<b>Existing</b>", { exact: false });
    expect(screen.getByText("<b>Existing</b>", { exact: false })).toBeTruthy();
    expect(document.querySelector("b")).toBeNull();

    const composer = screen.getByRole("textbox", {
      name: "Public Comment",
    });
    fireEvent.change(composer, { target: { value: "  New update 😀  " } });
    fireEvent.click(
      screen.getByRole("button", { name: "Post Public Comment" })
    );

    await waitFor(() => {
      expect(postTicketCommentMock).toHaveBeenCalledWith(11, "New update 😀");
    });
    await screen.findByText("Public Comment posted successfully.");
    expect(composer).toHaveProperty("value", "");
  });

  it("keeps the draft after a recoverable post failure without retrying", async () => {
    postTicketCommentMock.mockRejectedValue(
      new ApiRequestError(500, "The API request failed.", "INTERNAL_ERROR")
    );
    renderSection();

    const composer = await screen.findByRole("textbox", {
      name: "Public Comment",
    });
    fireEvent.change(composer, { target: { value: "Keep this draft" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Post Public Comment" })
    );

    await screen.findByText("The API request failed.");
    expect(composer).toHaveProperty("value", "Keep this draft");
    expect(postTicketCommentMock).toHaveBeenCalledTimes(1);
  });

  it("clears draft and feedback when navigating to another Ticket", async () => {
    const rendered = renderSection();
    const composer = await screen.findByRole("textbox", {
      name: "Public Comment",
    });
    fireEvent.change(composer, { target: { value: "Ticket A draft" } });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <PublicCommentsSection
          canPost
          currentStatus="Open"
          principalId={1}
          ticketId={12}
        />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("textbox", { name: "Public Comment" })
    ).toHaveProperty("value", "");
  });

  it("hides the composer for terminal Tickets and read-only Administrators", async () => {
    getTicketCommentsMock.mockResolvedValueOnce([]);
    renderSection({ currentStatus: "Closed" });
    await screen.findByText("No public comments yet.");
    expect(screen.queryByLabelText("Public Comment")).toBeNull();
    expect(
      screen.getByText(/Closed and Cancelled Tickets are read-only/u)
    ).toBeTruthy();

    cleanup();
    renderSection({ canPost: false });
    await screen.findByText(/<b>Existing<\/b>/u);
    expect(
      screen.queryByRole("textbox", { name: "Public Comment" })
    ).toBeNull();
    expect(screen.getByText(/Administrator access is read-only/u)).toBeTruthy();
  });
});
