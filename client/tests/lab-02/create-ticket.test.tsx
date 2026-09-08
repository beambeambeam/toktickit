/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as RequesterApi from "@/api/requester";
import { RequesterProvider } from "@/context/requester";
import { CreateTicketPage } from "@/pages/create-ticket-page";

const { createTicketMock, navigateMock } = vi.hoisted(() => ({
  createTicketMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/api/requester", async () => {
  const actual = await vi.importActual<typeof RequesterApi>("@/api/requester");

  return { ...actual, createTicket: createTicketMock };
});

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof TanStackRouter>(
    "@tanstack/react-router"
  );

  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
    useNavigate: () => navigateMock,
  };
});

const requester = {
  displayName: "Ada Requester",
  email: "ada@example.test",
  id: 1,
} as const;

const category = { id: 1, name: "Network" } as const;
const relatedSystem = { id: 2, name: "Campus Wi-Fi" } as const;

const createdTicket = {
  attachments: [],
  category,
  currentStatus: "New",
  description:
    "The requester cannot reach the campus network from the assigned device.",
  id: 11,
  relatedSystem,
  requestedPriority: "High",
  requester,
  summary: "Wi-Fi outage",
  ticketDate: "2026-09-02T10:00:00.000Z",
  ticketNumber: "TKT-20260902-ABC123",
  updatedAt: "2026-09-02T10:00:00.000Z",
} as const;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });

type MockFetchImplementation = (
  ...arguments_: Parameters<typeof fetch>
) => Promise<Response> | Response;

const renderCreateTicket = () => {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <RequesterProvider>
        <CreateTicketPage />
      </RequesterProvider>
    </QueryClientProvider>
  );
};

const mockReferenceData = (items: {
  categories: readonly { id: number; name: string }[];
  relatedSystems: readonly { id: number; name: string }[];
}) => {
  vi.stubGlobal(
    "fetch",
    vi.fn<MockFetchImplementation>().mockImplementation((input) => {
      const requestUrl =
        input instanceof Request ? input.url : input.toString();
      const { pathname } = new URL(requestUrl);

      let response: Response;
      if (pathname === "/api/categories") {
        response = Response.json({ items: items.categories });
      } else if (pathname === "/api/related-systems") {
        response = Response.json({ items: items.relatedSystems });
      } else {
        response = Response.json(
          { error: { code: "NOT_FOUND", message: "Not found" } },
          { status: 404 }
        );
      }

      return response;
    })
  );
};

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText(/Category/u), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText(/Related System/u), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText(/Ticket Summary/u), {
    target: { value: "Wi-Fi outage" },
  });
  fireEvent.change(screen.getByLabelText(/Requested Priority/u), {
    target: { value: "High" },
  });
  fireEvent.change(screen.getByLabelText(/Description/u), {
    target: {
      value:
        "The requester cannot reach the campus network from the assigned device.",
    },
  });
};

describe("Create Ticket page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    createTicketMock.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem(
      "toktickit.development-requester",
      JSON.stringify(requester)
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("blocks creation when required reference data is empty", async () => {
    mockReferenceData({ categories: [], relatedSystems: [] });
    renderCreateTicket();

    expect(
      await screen.findByText("Required reference data is unavailable.")
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveProperty(
      "disabled",
      true
    );
    expect(
      screen.getByRole("button", { name: "Create Ticket" })
    ).toHaveProperty("disabled", true);
  });

  it("shows field errors without submitting an invalid form", async () => {
    mockReferenceData({
      categories: [category],
      relatedSystems: [relatedSystem],
    });
    renderCreateTicket();

    await screen.findByRole("option", { name: "Network" });
    fireEvent.submit(screen.getByRole("button", { name: "Create Ticket" }));

    expect(
      await screen.findByText(
        "Summary must contain 5–120 characters after trimming."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Description must contain 20–4000 characters after trimming."
      )
    ).toBeTruthy();
    expect(createTicketMock).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText(/Ticket Summary/u).getAttribute("aria-invalid")
    ).toBe("true");
  });

  it("preserves entered values after a recoverable API failure", async () => {
    mockReferenceData({
      categories: [category],
      relatedSystems: [relatedSystem],
    });
    createTicketMock.mockRejectedValueOnce(new Error("API unavailable."));
    renderCreateTicket();

    await screen.findByRole("option", { name: "Network" });
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(await screen.findByText("API unavailable.")).toBeTruthy();
    expect(screen.getByDisplayValue("Wi-Fi outage")).toBeTruthy();
    expect(
      screen.getByDisplayValue(/The requester cannot reach the campus network/u)
    ).toBeTruthy();
  });

  it("associates invalid Attachment feedback with the file control", async () => {
    mockReferenceData({
      categories: [category],
      relatedSystems: [relatedSystem],
    });
    renderCreateTicket();

    await screen.findByRole("option", { name: "Network" });
    const fileInput = screen.getByLabelText(/Attachments/u);
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(["not permitted"], "notes.txt", { type: "text/plain" }),
        ],
      },
    });

    expect(
      await screen.findByText("notes.txt: use JPG, JPEG, PNG, WEBP, or PDF.")
    ).toBeTruthy();
    expect(fileInput.getAttribute("aria-describedby")).toBe(
      "attachments-help attachments-error"
    );
    expect(fileInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("disables duplicate submission and shows the backend Ticket Number", async () => {
    mockReferenceData({
      categories: [category],
      relatedSystems: [relatedSystem],
    });
    let resolveCreate!: (ticket: typeof createdTicket) => void;
    // eslint-disable-next-line promise/avoid-new -- the test needs a controllable in-flight mutation.
    const createPromise = new Promise<typeof createdTicket>((resolve) => {
      resolveCreate = resolve;
    });
    createTicketMock.mockReturnValueOnce(createPromise);
    renderCreateTicket();

    await screen.findByRole("option", { name: "Network" });
    fillValidForm();

    const createButton = screen.getByRole("button", {
      name: "Create Ticket",
    });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createTicketMock).toHaveBeenCalledTimes(1);
      expect(createButton).toHaveProperty("disabled", true);
      expect(screen.getByText("Creating your Ticket…")).toBeTruthy();
    });
    expect(createTicketMock).toHaveBeenCalledWith({
      attachments: [],
      categoryId: 1,
      description:
        "The requester cannot reach the campus network from the assigned device.",
      relatedSystemId: 2,
      requestedPriority: "High",
      requesterId: 1,
      summary: "Wi-Fi outage",
    });

    act(() => {
      resolveCreate(createdTicket);
    });

    expect(await screen.findByText("TKT-20260902-ABC123")).toBeTruthy();
    expect(screen.getByText("Saved successfully")).toBeTruthy();
  });
});
