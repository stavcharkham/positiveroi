import {
  CONSERVATISM_FACTOR,
  DAYS_PER_MONTH,
  JUDGMENT_FACTOR,
  MULTIPLIER_HOURS_30D,
  TIERS,
} from "./constants.js";

/**
 * The Undercount: Baseline -> Confidence Cut (-40%) -> Judgment Cut (/2) -> Credited Time.
 *
 * MUST stay byte-identical in behavior to the Postgres generated column:
 *   round(raw_estimate_minutes * 0.6 * case when high_judgment then 0.5 else 1.0 end, 2)
 *
 * Postgres numeric round() is half-up. JS floats can land on .xx5 boundaries and
 * round the wrong way, so we compute in integer space: raw_estimate_minutes is
 * numeric(8,2), i.e. an integer count of hundredths. 0.6 = 6/10 and 0.3 = 3/10,
 * so the exact result in tenths-of-hundredths is an integer we can round half-up.
 */
export function computeMinutesSavedPerRun(
  rawEstimateMinutes: number,
  highJudgment: boolean,
): number {
  if (!Number.isFinite(rawEstimateMinutes) || rawEstimateMinutes <= 0) {
    throw new Error("raw estimate must be a positive number of minutes");
  }
  const hundredths = Math.round(rawEstimateMinutes * 100);
  if (Math.abs(rawEstimateMinutes * 100 - hundredths) > 1e-6) {
    throw new Error("raw estimate supports at most 2 decimal places");
  }
  const tenthsOfHundredths = hundredths * (highJudgment ? 3 : 6);
  const roundedHundredths = Math.floor((tenthsOfHundredths + 5) / 10);
  return roundedHundredths / 100;
}

/** Human-readable receipt of the computation, shown wherever the number appears. */
export function methodologyReceipt(
  rawEstimateMinutes: number,
  highJudgment: boolean,
): string {
  const afterConfidence = computeMinutesSavedPerRun(rawEstimateMinutes, false);
  const credited = computeMinutesSavedPerRun(rawEstimateMinutes, highJudgment);
  const confidencePct = Math.round((1 - CONSERVATISM_FACTOR) * 100);
  if (highJudgment) {
    return `${formatMinutes(rawEstimateMinutes)} min baseline − ${confidencePct}% confidence cut = ${formatMinutes(afterConfidence)} min ÷ 2 judgment cut = ${formatMinutes(credited)} credited min/run`;
  }
  return `${formatMinutes(rawEstimateMinutes)} min baseline − ${confidencePct}% confidence cut = ${formatMinutes(credited)} credited min/run`;
}

function formatMinutes(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * The credited minutes a run snapshots: the builder-set override when one is
 * set, else the suggested Undercount. The override layer lives entirely here
 * and in the DB coalesce — the suggested-value machinery stays frozen.
 */
export function effectiveMinutesSavedPerRun(
  suggested: number,
  override: number | null | undefined,
): number {
  return override ?? suggested;
}

/**
 * Normalize a builder's requested credit against the suggestion: a number
 * equal to the suggestion is no override at all (stored as null), so
 * "builder-set" is only ever shown on numbers that actually differ.
 */
export function normalizeCreditOverride(
  suggested: number,
  requested: number | null | undefined,
): number | null {
  if (requested === null || requested === undefined) return null;
  return requested === suggested ? null : requested;
}

/** Progress toward the Multiplier badge, from trailing-30-day credited hours. */
export function multiplierProgress(hours30d: number): number {
  if (!Number.isFinite(hours30d) || hours30d <= 0) return 0;
  return hours30d / MULTIPLIER_HOURS_30D;
}

/**
 * Display tier for a builder, from trailing-30d credited hours and total run count.
 * Returns null when there is nothing to show (no runs at all).
 */
export function tierFor(hours30d: number, totalRuns: number) {
  if (totalRuns < 1) return null;
  let current: (typeof TIERS)[number] = TIERS[0];
  for (const tier of TIERS) {
    if (hours30d >= tier.hours) current = tier;
  }
  return current;
}

/**
 * Full-time-equivalent jobs represented by `hours` credited over `periodDays`.
 * 180 credited hours per 30.44-day month = 1 FTE, pro-rated to the period.
 */
export function fteEquivalent(hours: number, periodDays: number): number {
  if (!Number.isFinite(hours) || hours <= 0 || periodDays <= 0) return 0;
  return hours / ((MULTIPLIER_HOURS_30D * periodDays) / DAYS_PER_MONTH);
}

/** Money value of credited hours at a workspace hourly rate, in cents. */
export function moneyValueCents(hours: number, hourlyRateCents: number): number {
  if (hours <= 0 || hourlyRateCents <= 0) return 0;
  return Math.round(hours * hourlyRateCents);
}

export const METHODOLOGY = {
  conservatismFactor: CONSERVATISM_FACTOR,
  judgmentFactor: JUDGMENT_FACTOR,
  description:
    "measured runs × conservative estimated minutes per run — baselines take a 40% confidence cut, then a further 50% judgment cut when a human decision remains",
} as const;
