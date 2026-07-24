import { describe, expect, it } from "vitest";
import { computeMinutesSavedPerRun } from "@positiveroi/core";
import { fmtMinutes, receiptStages } from "@/lib/receipt-stages";

describe("receiptStages", () => {
  it("returns null until there is a positive claim", () => {
    expect(receiptStages(0, false)).toBeNull();
    expect(receiptStages(-5, true)).toBeNull();
    expect(receiptStages(Number.NaN, false)).toBeNull();
  });

  it("matches the frozen core math at every stage", () => {
    for (const raw of [1, 5, 15, 37.5, 120, 480]) {
      for (const judgment of [false, true]) {
        const stages = receiptStages(raw, judgment)!;
        expect(stages[0]).toEqual({ key: "claim", minutes: raw, share: 1 });
        expect(stages[1]!.minutes).toBe(computeMinutesSavedPerRun(raw, false));
        const last = stages[stages.length - 1]!;
        expect(last.minutes).toBe(computeMinutesSavedPerRun(raw, judgment));
      }
    }
  });

  it("adds the judgment stage only when a human stays in the loop", () => {
    expect(receiptStages(15, false)!.map((s) => s.key)).toEqual([
      "claim",
      "trust",
    ]);
    expect(receiptStages(15, true)!.map((s) => s.key)).toEqual([
      "claim",
      "trust",
      "judgment",
    ]);
  });

  it("keeps shares descending within (0, 1]", () => {
    const stages = receiptStages(15, true)!;
    for (const stage of stages) {
      expect(stage.share).toBeGreaterThan(0);
      expect(stage.share).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i]!.share).toBeLessThan(stages[i - 1]!.share);
    }
  });

  it("formats minutes without trailing zeros", () => {
    expect(fmtMinutes(9)).toBe("9");
    expect(fmtMinutes(4.5)).toBe("4.5");
    expect(fmtMinutes(11.25)).toBe("11.25");
  });
});
