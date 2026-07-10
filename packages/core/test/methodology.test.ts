import { describe, expect, it } from "vitest";
import {
  computeMinutesSavedPerRun,
  effectiveMinutesSavedPerRun,
  fteEquivalent,
  methodologyReceipt,
  multiplierProgress,
  normalizeCreditOverride,
  tierFor,
} from "../src/methodology.js";

describe("computeMinutesSavedPerRun (The Undercount)", () => {
  it("applies the confidence cut only", () => {
    expect(computeMinutesSavedPerRun(45, false)).toBe(27);
    expect(computeMinutesSavedPerRun(20, false)).toBe(12);
    expect(computeMinutesSavedPerRun(120, false)).toBe(72);
  });

  it("applies confidence + judgment cuts", () => {
    expect(computeMinutesSavedPerRun(45, true)).toBe(13.5);
    expect(computeMinutesSavedPerRun(90, true)).toBe(27);
    expect(computeMinutesSavedPerRun(20, true)).toBe(6);
  });

  it("matches Postgres half-up rounding on .xx5 boundaries", () => {
    // 45.01 * 0.6 = 27.006 -> 27.01 (half-up)
    expect(computeMinutesSavedPerRun(45.01, false)).toBe(27.01);
    // 0.15 * 0.3 = 0.045 -> 0.05 (half-up; naive float math gives 0.04)
    expect(computeMinutesSavedPerRun(0.15, true)).toBe(0.05);
    // 2.05 * 0.3 = 0.615 -> 0.62 (half-up; naive float math gives 0.61)
    expect(computeMinutesSavedPerRun(2.05, true)).toBe(0.62);
    // 1.25 * 0.6 = 0.75 exactly — no rounding needed
    expect(computeMinutesSavedPerRun(1.25, false)).toBe(0.75);
  });

  it("agrees with exact decimal reference across the full 2-decimal range", () => {
    // Reference: integer math on hundredths, half-up — what Postgres numeric does.
    for (let hundredths = 1; hundredths <= 48000; hundredths += 7) {
      const raw = hundredths / 100;
      for (const hj of [false, true]) {
        const t = hundredths * (hj ? 3 : 6);
        const expected = Math.floor((t + 5) / 10) / 100;
        expect(computeMinutesSavedPerRun(raw, hj)).toBe(expected);
      }
    }
  });

  it("rejects invalid input", () => {
    expect(() => computeMinutesSavedPerRun(0, false)).toThrow();
    expect(() => computeMinutesSavedPerRun(-5, false)).toThrow();
    expect(() => computeMinutesSavedPerRun(1.005, false)).toThrow(/2 decimal/);
    expect(() => computeMinutesSavedPerRun(NaN, false)).toThrow();
  });
});

describe("methodologyReceipt", () => {
  it("narrates both cuts", () => {
    expect(methodologyReceipt(45, true)).toBe(
      "45 min baseline − 40% confidence cut = 27 min ÷ 2 judgment cut = 13.5 credited min/run",
    );
  });
  it("narrates the confidence cut alone", () => {
    expect(methodologyReceipt(45, false)).toBe(
      "45 min baseline − 40% confidence cut = 27 credited min/run",
    );
  });
});

describe("multiplierProgress / tiers / FTE", () => {
  it("computes progress toward 180h", () => {
    expect(multiplierProgress(90)).toBeCloseTo(0.5);
    expect(multiplierProgress(0)).toBe(0);
    expect(multiplierProgress(270)).toBeCloseTo(1.5);
  });

  it("assigns display tiers from trailing-30d hours", () => {
    expect(tierFor(0, 0)).toBeNull();
    expect(tierFor(0, 3)?.key).toBe("first_run");
    expect(tierFor(10, 5)?.key).toBe("saver");
    expect(tierFor(179.99, 5)?.key).toBe("heavy_lifter");
    expect(tierFor(180, 5)?.key).toBe("multiplier");
    expect(tierFor(400, 5)?.key).toBe("multiplier_x2");
    expect(tierFor(600, 5)?.key).toBe("multiplier_x3");
  });

  it("pro-rates FTE to the period", () => {
    // 180 hours over one average month = exactly 1 FTE
    expect(fteEquivalent(180, 30.44)).toBeCloseTo(1);
    // Same rate over a week
    expect(fteEquivalent(42, 7)).toBeCloseTo(42 / (180 * (7 / 30.44)), 6);
    expect(fteEquivalent(0, 30)).toBe(0);
  });
});

describe("builder-set credit (the override layer)", () => {
  it("effectiveMinutesSavedPerRun prefers the override, else the suggestion", () => {
    expect(effectiveMinutesSavedPerRun(13.5, null)).toBe(13.5);
    expect(effectiveMinutesSavedPerRun(13.5, undefined)).toBe(13.5);
    expect(effectiveMinutesSavedPerRun(13.5, 20)).toBe(20);
    expect(effectiveMinutesSavedPerRun(13.5, 0.01)).toBe(0.01);
  });

  it("normalizeCreditOverride stores null when the request equals the suggestion", () => {
    expect(normalizeCreditOverride(13.5, null)).toBeNull();
    expect(normalizeCreditOverride(13.5, undefined)).toBeNull();
    expect(normalizeCreditOverride(13.5, 13.5)).toBeNull();
    expect(normalizeCreditOverride(13.5, 20)).toBe(20);
    expect(normalizeCreditOverride(13.5, 6)).toBe(6);
  });

  it("round-trips: a normalized override always changes the effective credit", () => {
    for (const suggested of [0.05, 6, 13.5, 27, 288]) {
      for (const requested of [null, 0.01, 6, 13.5, 240, 480]) {
        const override = normalizeCreditOverride(suggested, requested);
        const effective = effectiveMinutesSavedPerRun(suggested, override);
        if (override === null) {
          expect(effective).toBe(suggested);
        } else {
          expect(effective).toBe(requested);
          expect(effective).not.toBe(suggested);
        }
      }
    }
  });
});
