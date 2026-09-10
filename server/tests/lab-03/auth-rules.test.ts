import { describe, expect, it } from "vitest";

import {
  isValidEmail,
  isValidPasswordLength,
  normalizeEmail,
  passwordLengthInCodePoints,
} from "../../src/services/auth-rules.js";

describe("Lab 3 authentication rules", () => {
  it("counts Unicode code points without trimming or blocking spaces", () => {
    expect(passwordLengthInCodePoints("a".repeat(14))).toBe(14);
    expect(passwordLengthInCodePoints("a".repeat(15))).toBe(15);
    expect(passwordLengthInCodePoints("😀".repeat(15))).toBe(15);
    expect(passwordLengthInCodePoints("a".repeat(128))).toBe(128);
    expect(passwordLengthInCodePoints("a".repeat(129))).toBe(129);

    expect(isValidPasswordLength("a".repeat(14))).toBe(false);
    expect(isValidPasswordLength(" pass phrase ok ")).toBe(true);
    expect(isValidPasswordLength("a".repeat(128))).toBe(true);
    expect(isValidPasswordLength("a".repeat(129))).toBe(false);
  });

  it("normalizes and validates a single mailbox address", () => {
    expect(normalizeEmail("  Ada@Example.TEST ")).toBe("ada@example.test");
    expect(isValidEmail("ada@example.test")).toBe(true);
    expect(isValidEmail(`Ada Requester <ada@example.test>`)).toBe(false);
    expect(isValidEmail("ada example@example.test")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@x.test`)).toBe(false);
  });
});
