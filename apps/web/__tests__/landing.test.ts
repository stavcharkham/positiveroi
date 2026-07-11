import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/landing";

describe("safeNextPath", () => {
  it("passes clean same-origin relative paths", () => {
    expect(safeNextPath("/w/acme")).toBe("/w/acme");
    expect(safeNextPath("/w/acme/tools?tab=runs")).toBe("/w/acme/tools?tab=runs");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
  });

  it("rejects empty, non-rooted, and protocol-relative values", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("w/acme")).toBeNull();
  });

  it("rejects the backslash open-redirect vector and control chars", () => {
    // /\evil.com normalizes to //evil.com in browser URL parsing.
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("/\\/evil.com")).toBeNull();
    expect(safeNextPath("/foo\\bar")).toBeNull();
    expect(safeNextPath("/foo\nbar")).toBeNull();
    expect(safeNextPath("/foo\tbar")).toBeNull();
  });
});
