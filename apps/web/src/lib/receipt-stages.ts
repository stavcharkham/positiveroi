import { computeMinutesSavedPerRun } from "@positiveroi/core";

export type ReceiptStageKey = "claim" | "trust" | "judgment";

export interface ReceiptStage {
  key: ReceiptStageKey;
  /** Minutes remaining after this stage. */
  minutes: number;
  /** Share of the original claim that remains, in (0, 1]. */
  share: number;
}

/**
 * The stages the receipt flow animates through: the builder's claim, the
 * conservatism cut, and (when a human stays in the loop) the judgment cut. The
 * minutes come from the same frozen core function every credited number
 * uses — this module only shapes them for display.
 */
export function receiptStages(
  rawMinutes: number,
  highJudgment: boolean,
): ReceiptStage[] | null {
  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) return null;
  const afterTrust = computeMinutesSavedPerRun(rawMinutes, false);
  const stages: ReceiptStage[] = [
    { key: "claim", minutes: rawMinutes, share: 1 },
    { key: "trust", minutes: afterTrust, share: afterTrust / rawMinutes },
  ];
  if (highJudgment) {
    const credited = computeMinutesSavedPerRun(rawMinutes, true);
    stages.push({
      key: "judgment",
      minutes: credited,
      share: credited / rawMinutes,
    });
  }
  return stages;
}

/** Format minutes the way receipts do: up to 2 decimals, no trailing zeros. */
export function fmtMinutes(m: number): string {
  return Number.isInteger(m)
    ? String(m)
    : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
