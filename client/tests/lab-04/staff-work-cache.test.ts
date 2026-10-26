import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { invalidateStaffWorkQueries } from "@/api/staff-query-options";

describe("Staff work cache", () => {
  it("invalidates the Queue, staff Dashboard, and My Actions after a write", async () => {
    const queryClient = new QueryClient();
    const keys = [
      ["staff-tickets", 7, "IT Staff", { page: 1 }],
      ["staff-dashboard", 7, "IT Staff"],
      ["staff-my-actions", 7, "IT Staff", 1, 20],
    ];
    for (const key of keys) {
      queryClient.setQueryData(key, {});
    }

    await invalidateStaffWorkQueries(queryClient);

    expect(
      keys.map((key) => queryClient.getQueryState(key)?.isInvalidated ?? false)
    ).toEqual([true, true, true]);
  });
});
