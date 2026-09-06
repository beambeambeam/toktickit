/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as RequesterApi from "@/api/requester";
import { ApiRequestError } from "@/api/requester";
import { RequesterProvider } from "@/context/requester";
import { RequesterTicketDetailPage } from "@/pages/requester-ticket-detail-page";

const {
  downloadTicketAttachmentMock,
  getTicketMock,
  removeTicketAttachmentMock,
  uploadTicketAttachmentsMock,
} = vi.hoisted(() => ({
  downloadTicketAttachmentMock: vi.fn(),
  getTicketMock: vi.fn(),
  removeTicketAttachmentMock: vi.fn(),
  uploadTicketAttachmentsMock: vi.fn(),
}));

vi.mock("@/api/requester", async () => {
  const actual = await vi.importActual<typeof RequesterApi>("@/api/requester");

  return {
    ...actual,
    downloadTicketAttachment: downloadTicketAttachmentMock,
    getTicket: getTicketMock,
    removeTicketAttachment: removeTicketAttachmentMock,
    uploadTicketAttachments: uploadTicketAttachmentsMock,
  };
});

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof TanStackRouter>(
    "@tanstack/react-router"
  );

  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  };
});

const owner = {
  displayName: "Ada Requester",
  email: "ada@example.test",
  id: 1,
};

const category = { id: 1, name: "Network" };
const relatedSystem = { id: 2, name: "Campus Wi-Fi" };

const activeAttachment = {
  byteSize: 12_345,
  id: 101,
  mediaType: "image/png",
  originalFilename: "network-error.png",
  removalReason: null,
  removedAt: null,
  state: "Active" as const,
  uploadedAt: "2026-09-02T10:00:00.000Z",
};

const removedAttachment = {
  byteSize: 9876,
  id: 102,
  mediaType: "application/pdf",
  originalFilename: "router-log.pdf",
  removalReason: "Duplicate evidence file",
  removedAt: "2026-09-02T11:00:00.000Z",
  state: "Removed" as const,
  uploadedAt: "2026-09-02T09:00:00.000Z",
};

const ticket = {
  attachments: [activeAttachment, removedAttachment],
  category,
  currentStatus: "New" as const,
  description:
    "The requester cannot reach the campus network from the assigned device.",
  id: 11,
  relatedSystem,
  requestedPriority: "High" as const,
  requester: owner,
  summary: "Wi-Fi outage on the third floor",
  ticketDate: "2026-09-02T10:00:00.000Z",
  ticketNumber: "TKT-20260902-ABC123",
  updatedAt: "2026-09-02T10:00:00.000Z",
};

const renderTicketDetail = (ticketId = "11") => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RequesterProvider>
        <RequesterTicketDetailPage ticketId={ticketId} />
      </RequesterProvider>
    </QueryClientProvider>
  );
};

const createDeferredTicket = () => {
  let resolveTicket: ((value: unknown) => void) | undefined;
  // oxlint-disable-next-line promise/avoid-new -- Deferred ticket controls the loading state.
  const promise = new Promise<unknown>((resolve) => {
    resolveTicket = resolve;
  });

  return {
    promise,
    resolve: (value: unknown) => {
      resolveTicket?.(value);
    },
  };
};

describe("Requester Ticket Detail page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      "toktickit.development-requester",
      JSON.stringify(owner)
    );
    getTicketMock.mockReset().mockResolvedValue(ticket);
    uploadTicketAttachmentsMock.mockReset().mockResolvedValue([]);
    removeTicketAttachmentMock.mockReset();
    downloadTicketAttachmentMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders read-only Ticket information with active and removed states", async () => {
    const { container } = renderTicketDetail();

    await screen.findByText("TKT-20260902-ABC123");
    expect(
      screen.getByRole("heading", { name: "Ticket information" })
    ).toBeTruthy();
    expect(screen.getByText("Wi-Fi outage on the third floor")).toBeTruthy();
    expect(screen.getByText("network-error.png")).toBeTruthy();
    expect(screen.getByText("router-log.pdf")).toBeTruthy();
    const stateLabels = [...container.querySelectorAll(".state-label")];
    expect(stateLabels).toHaveLength(2);
    expect(stateLabels[0]?.className).toMatch(/active/u);
    expect(stateLabels[0]?.textContent).toMatch(/Active/u);
    expect(stateLabels[1]?.className).toMatch(/removed/u);
    expect(stateLabels[1]?.textContent).toMatch(/Removed/u);
    expect(
      screen.getByText("Duplicate evidence file", { exact: false })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
    expect(getTicketMock).toHaveBeenCalledWith(1, 11, expect.anything());
  });

  it("announces loading while the Ticket loads", async () => {
    const deferred = createDeferredTicket();
    getTicketMock.mockReturnValue(deferred.promise);
    renderTicketDetail();

    expect(screen.getByText("Loading Ticket Detail…")).toBeTruthy();

    deferred.resolve(ticket);
    await screen.findByText("TKT-20260902-ABC123");
  });

  it("shows a safe failure state when the Ticket cannot be loaded", async () => {
    getTicketMock.mockRejectedValue(new Error("Ticket was not found."));
    renderTicketDetail();

    await screen.findByRole(
      "heading",
      { name: "Ticket unavailable" },
      { timeout: 5000 }
    );
    expect(screen.getByText("Ticket was not found.")).toBeTruthy();
  });

  it("hides unowned Tickets behind the safe not-found state", async () => {
    getTicketMock.mockRejectedValue(
      new ApiRequestError(404, "Ticket was not found.", "RESOURCE_NOT_FOUND")
    );
    renderTicketDetail();

    await screen.findByRole(
      "heading",
      { name: "Ticket unavailable" },
      { timeout: 5000 }
    );
    expect(screen.getByText("Ticket was not found.")).toBeTruthy();
    expect(screen.queryByText("Wi-Fi outage on the third floor")).toBeNull();
  });

  it("shows an invalid Ticket state without calling the API", async () => {
    renderTicketDetail("not-a-ticket");

    await screen.findByRole("heading", { name: "Invalid Ticket Number" });
    expect(getTicketMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid file selection without uploading", async () => {
    renderTicketDetail();

    await screen.findByText("network-error.png");
    const picker = screen.getByLabelText("Attachments (optional)");
    fireEvent.change(picker, {
      target: {
        files: [new File(["nope"], "notes.exe", { type: "" })],
      },
    });

    expect(
      await screen.findByText("notes.exe: use JPG, JPEG, PNG, WEBP, or PDF.")
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Attachment(s)" })
    ).toHaveProperty("disabled", true);
    expect(uploadTicketAttachmentsMock).not.toHaveBeenCalled();
  });

  it("uploads a valid Attachment and confirms success", async () => {
    const uploadedAttachment = {
      ...activeAttachment,
      id: 103,
      originalFilename: "extra.png",
    };
    getTicketMock.mockResolvedValueOnce(ticket).mockResolvedValue({
      ...ticket,
      attachments: [...ticket.attachments, uploadedAttachment],
    });
    renderTicketDetail();

    await screen.findByText("network-error.png");
    const picker = screen.getByLabelText("Attachments (optional)");
    const file = new File(["evidence"], "extra.png", { type: "image/png" });
    fireEvent.change(picker, { target: { files: [file] } });

    const addButton = screen.getByRole("button", {
      name: "Add Attachment(s)",
    });
    expect(addButton).not.toHaveProperty("disabled", true);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(uploadTicketAttachmentsMock).toHaveBeenCalledWith(1, 11, [file]);
    });
    await screen.findByText("Attachment(s) added successfully.", {
      exact: false,
    });
    await screen.findByText("extra.png");
  });

  it("disables Attachment selection once five active Attachments exist", async () => {
    getTicketMock.mockResolvedValue({
      ...ticket,
      attachments: Array.from({ length: 5 }, (_, index) => ({
        ...activeAttachment,
        id: 200 + index,
        originalFilename: `evidence-${index}.png`,
      })),
    });
    renderTicketDetail();

    await screen.findByText("evidence-0.png");
    expect(screen.getByLabelText("Attachments (optional)")).toHaveProperty(
      "disabled",
      true
    );
  });

  it("requires a valid removal reason before calling the API", async () => {
    removeTicketAttachmentMock.mockResolvedValue({
      ...activeAttachment,
      removalReason: "Duplicate evidence file",
      removedAt: "2026-09-02T12:00:00.000Z",
      state: "Removed",
    });
    getTicketMock
      .mockResolvedValueOnce(ticket)
      .mockResolvedValue({ ...ticket, attachments: [removedAttachment] });
    renderTicketDetail();

    await screen.findByText("network-error.png");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    const dialog = within(await screen.findByRole("alertdialog"));
    const reason = dialog.getByLabelText("Removal reason", { exact: false });
    fireEvent.change(reason, { target: { value: "ab" } });
    fireEvent.click(dialog.getByRole("button", { name: "Confirm removal" }));

    expect(
      await screen.findByText(
        "Removal reason must contain 3–500 characters after trimming."
      )
    ).toBeTruthy();
    expect(removeTicketAttachmentMock).not.toHaveBeenCalled();

    fireEvent.change(reason, {
      target: { value: "x".repeat(501) },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Confirm removal" }));

    expect(
      await screen.findByText(
        "Removal reason must contain 3–500 characters after trimming."
      )
    ).toBeTruthy();
    expect(removeTicketAttachmentMock).not.toHaveBeenCalled();

    fireEvent.change(reason, {
      target: { value: "Duplicate evidence file" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Confirm removal" }));

    await waitFor(() => {
      expect(removeTicketAttachmentMock).toHaveBeenCalledWith(
        1,
        11,
        101,
        "Duplicate evidence file"
      );
    });
    await screen.findByText("Attachment removed.", { exact: false });
    await waitFor(() => {
      expect(screen.queryByText("network-error.png")).toBeNull();
    });
  });

  it("downloads an active Attachment through the detail action", async () => {
    const blob = new Blob(["evidence"], { type: "image/png" });
    downloadTicketAttachmentMock.mockResolvedValue({
      blob,
      filename: "network-error.png",
    });
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn((): void => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    renderTicketDetail();

    await screen.findByText("network-error.png");
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(downloadTicketAttachmentMock).toHaveBeenCalledWith(1, 11, 101);
    });
    expect(clickSpy).toHaveBeenCalled();
  });
});
