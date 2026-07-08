import { describe, expect, it } from "vitest";
import { PeriodError, resolvePeriod, zonedDayStartUtc } from "@/lib/aggregates";

const NOW = new Date("2026-07-08T12:00:00.000Z");
const CREATED = "2026-01-01T00:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

describe("resolvePeriod — named periods", () => {
  it.each([
    ["week", 7],
    ["month", 30],
    ["quarter", 91],
  ] as const)("%s is a trailing %i-day window ending now", (period, days) => {
    const r = resolvePeriod({ period }, "UTC", CREATED, NOW);
    expect(r.toUtc.getTime()).toBe(NOW.getTime());
    expect(r.fromUtc.getTime()).toBe(NOW.getTime() - days * DAY);
    expect(r.periodDays).toBe(days);
  });

  it("rejects unknown period names", () => {
    expect(() => resolvePeriod({ period: "year" }, "UTC", CREATED, NOW)).toThrow(
      PeriodError,
    );
  });
});

describe("resolvePeriod — all-time", () => {
  it("spans workspace creation to now", () => {
    const r = resolvePeriod({}, "UTC", CREATED, NOW);
    expect(r.fromUtc.toISOString()).toBe(CREATED);
    expect(r.toUtc.getTime()).toBe(NOW.getTime());
    expect(r.periodDays).toBeCloseTo(188.5, 1);
  });
});

describe("resolvePeriod — custom from/to in workspace timezone", () => {
  it("interprets dates in an IANA timezone (Jerusalem summer, UTC+3)", () => {
    const r = resolvePeriod(
      { from: "2026-07-01", to: "2026-07-02" },
      "Asia/Jerusalem",
      CREATED,
      NOW,
    );
    expect(r.fromUtc.toISOString()).toBe("2026-06-30T21:00:00.000Z");
    // `to` is inclusive: range ends at the start of the NEXT local day.
    expect(r.toUtc.toISOString()).toBe("2026-07-02T21:00:00.000Z");
    expect(r.periodDays).toBe(2);
  });

  it("respects winter offsets (Jerusalem winter, UTC+2)", () => {
    const r = resolvePeriod(
      { from: "2026-01-15", to: "2026-01-15" },
      "Asia/Jerusalem",
      CREATED,
      NOW,
    );
    expect(r.fromUtc.toISOString()).toBe("2026-01-14T22:00:00.000Z");
    expect(r.toUtc.toISOString()).toBe("2026-01-15T22:00:00.000Z");
    expect(r.periodDays).toBe(1);
  });

  it("handles negative-offset timezones (New York DST, UTC-4)", () => {
    const r = resolvePeriod(
      { from: "2026-06-01", to: "2026-06-01" },
      "America/New_York",
      CREATED,
      NOW,
    );
    expect(r.fromUtc.toISOString()).toBe("2026-06-01T04:00:00.000Z");
  });

  it("defaults a missing from to workspace creation and a missing to to now", () => {
    const withoutFrom = resolvePeriod({ to: "2026-07-01" }, "UTC", CREATED, NOW);
    expect(withoutFrom.fromUtc.toISOString()).toBe(CREATED);
    const withoutTo = resolvePeriod({ from: "2026-07-01" }, "UTC", CREATED, NOW);
    expect(withoutTo.toUtc.getTime()).toBe(NOW.getTime());
  });

  it("rejects malformed dates, inverted ranges, and bad timezones", () => {
    expect(() =>
      resolvePeriod({ from: "07/01/2026" }, "UTC", CREATED, NOW),
    ).toThrow(PeriodError);
    expect(() =>
      resolvePeriod({ from: "2026-07-05", to: "2026-07-01" }, "UTC", CREATED, NOW),
    ).toThrow(PeriodError);
    expect(() => zonedDayStartUtc("2026-07-01", "Not/AZone")).toThrow(PeriodError);
  });
});

describe("zonedDayStartUtc", () => {
  it("UTC dates map to UTC midnight", () => {
    expect(zonedDayStartUtc("2026-03-10", "UTC").toISOString()).toBe(
      "2026-03-10T00:00:00.000Z",
    );
  });
});
