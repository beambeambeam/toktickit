/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it("does not turn owner display names into modifier classes", () => {
    render(<StatusBadge kind="owner" value="Inactive Support" />);

    expect(screen.getByText("Inactive Support").className).toBe(
      "status-badge owner-badge"
    );
  });
});
