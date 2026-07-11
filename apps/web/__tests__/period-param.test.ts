import { describe, expect, it } from "vitest";
import {
  formatPeriodRange,
  normalizePeriodParam,
  periodLabel,
  withPeriod,
} from "@/app/w/[slug]/_lib/format";

describe("normalizePeriodParam", () => {
  it("passes named periods and packed custom ranges through", () => {
    expect(normalizePeriodParam("week")).toBe("week");
    expect(normalizePeriodParam("month")).toBe("month");
    expect(normalizePeriodParam("quarter")).toBe("quarter");
    expect(normalizePeriodParam("2026-05-01..2026-06-12")).toBe(
      "2026-05-01..2026-06-12",
    );
  });

  it("treats anything unknown as all-time", () => {
    expect(normalizePeriodParam(undefined)).toBeUndefined();
    expect(normalizePeriodParam("year")).toBeUndefined();
    expect(normalizePeriodParam("2026-05-01..bogus")).toBeUndefined();
    expect(normalizePeriodParam("2026-05-01")).toBeUndefined();
    expect(normalizePeriodParam(["month", "week"])).toBe("month");
  });

  it("rejects calendar-invalid and inverted custom ranges (label must match data)", () => {
    // Shape-valid but not real dates — would crash Intl.format if accepted.
    expect(normalizePeriodParam("2026-13-99..2026-13-99")).toBeUndefined();
    expect(normalizePeriodParam("2026-02-31..2026-03-01")).toBeUndefined();
    // Inverted range: resolvePeriod falls back to all-time, so the label must too.
    expect(normalizePeriodParam("2026-06-30..2026-06-01")).toBeUndefined();
    // Equal endpoints are a valid one-day range.
    expect(normalizePeriodParam("2026-06-01..2026-06-01")).toBe("2026-06-01..2026-06-01");
  });
});

describe("periodLabel", () => {
  it("names the fixed windows, 90 days included", () => {
    expect(periodLabel("week")).toBe("in the last 7 days");
    expect(periodLabel("month")).toBe("in the last 30 days");
    expect(periodLabel("quarter")).toBe("in the last 90 days");
    expect(periodLabel(undefined)).toBe("all time");
  });

  it("renders custom ranges as readable dates", () => {
    const label = periodLabel("2026-05-01..2026-06-12");
    expect(label).toContain("May 1");
    expect(label).toContain("Jun 12");
  });
});

describe("formatPeriodRange", () => {
  it("formats both ends of the range", () => {
    const label = formatPeriodRange("2026-05-01..2026-06-12");
    expect(label).toMatch(/May 1.* – .*Jun 12/);
  });
});

describe("withPeriod", () => {
  it("threads named and custom periods across links", () => {
    expect(withPeriod("/w/acme/tools", "month")).toBe("/w/acme/tools?period=month");
    expect(withPeriod("/w/acme/tools?tab=runs", "week")).toBe(
      "/w/acme/tools?tab=runs&period=week",
    );
    expect(withPeriod("/w/acme/tools", "2026-05-01..2026-06-12")).toBe(
      "/w/acme/tools?period=2026-05-01..2026-06-12",
    );
    expect(withPeriod("/w/acme/tools", undefined)).toBe("/w/acme/tools");
  });
});
