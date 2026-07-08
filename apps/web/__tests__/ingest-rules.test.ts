import { describe, expect, it } from "vitest";
import {
  clampMinutesSaved,
  metadataTooLarge,
  occurredAtOutOfRange,
} from "@/lib/ingest-core";

const NOW = new Date("2026-07-08T12:00:00.000Z");
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

describe("clampMinutesSaved", () => {
  it("passes values inside [0, raw_estimate_minutes] through", () => {
    expect(clampMinutesSaved(10, 60)).toBe(10);
    expect(clampMinutesSaved(0, 60)).toBe(0);
    expect(clampMinutesSaved(60, 60)).toBe(60);
  });

  it("clamps overrides above the tool's raw estimate down to it", () => {
    expect(clampMinutesSaved(480, 60)).toBe(60);
    expect(clampMinutesSaved(60.01, 60)).toBe(60);
  });

  it("clamps negative overrides to 0", () => {
    expect(clampMinutesSaved(-5, 60)).toBe(0);
  });

  it("rounds to the column's 2-decimal scale", () => {
    expect(clampMinutesSaved(10.999, 60)).toBe(11);
    expect(clampMinutesSaved(10.004, 60)).toBe(10);
  });
});

describe("occurredAtOutOfRange", () => {
  const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

  it("accepts an omitted occurred_at", () => {
    expect(occurredAtOutOfRange(undefined, "api", NOW)).toBe(false);
    expect(occurredAtOutOfRange(undefined, "member", NOW)).toBe(false);
  });

  it("allows up to 5 minutes in the future, rejects beyond", () => {
    expect(occurredAtOutOfRange(iso(4 * MIN), "api", NOW)).toBe(false);
    expect(occurredAtOutOfRange(iso(6 * MIN), "api", NOW)).toBe(true);
    expect(occurredAtOutOfRange(iso(6 * MIN), "member", NOW)).toBe(true);
  });

  it("API path rejects older than 90 days; member path has no lower bound", () => {
    expect(occurredAtOutOfRange(iso(-89 * DAY), "api", NOW)).toBe(false);
    expect(occurredAtOutOfRange(iso(-91 * DAY), "api", NOW)).toBe(true);
    expect(occurredAtOutOfRange(iso(-91 * DAY), "member", NOW)).toBe(false);
    expect(occurredAtOutOfRange(iso(-3650 * DAY), "member", NOW)).toBe(false);
  });

  it("rejects unparseable timestamps", () => {
    expect(occurredAtOutOfRange("not-a-date", "api", NOW)).toBe(true);
  });
});

describe("metadataTooLarge", () => {
  it("accepts small metadata", () => {
    expect(metadataTooLarge({})).toBe(false);
    expect(metadataTooLarge({ note: "ok" })).toBe(false);
  });

  it("rejects metadata serializing to more than 8KB", () => {
    expect(metadataTooLarge({ blob: "x".repeat(8 * 1024) })).toBe(true);
  });

  it("measures bytes, not characters", () => {
    // 3000 four-byte emoji -> 12KB despite only ~3000 chars.
    expect(metadataTooLarge({ blob: "🚀".repeat(3000) })).toBe(true);
  });
});
