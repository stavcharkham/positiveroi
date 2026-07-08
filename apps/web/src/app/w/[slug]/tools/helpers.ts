import {
  PeriodError,
  resolvePeriod,
  type ResolvedPeriod,
  type TimeseriesBucket,
} from "@/lib/aggregates";
import type { WorkspaceRow } from "@/lib/guards";
import type { ToolType } from "@positiveroi/core";

/**
 * Server-side helpers shared by the tools directory, wizard, and detail
 * pages. Client-safe copy/formatting lives in ./tool-meta.ts instead —
 * this file transitively imports server-only modules.
 */

/** Tool row as stored (numerics may arrive as strings — wrap in Number()). */
export interface ToolRecord {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  type: ToolType;
  status: "active" | "archived";
  origin: "dashboard" | "api";
  raw_estimate_minutes: number;
  high_judgment: boolean;
  minutes_saved_per_run: number;
  created_at: string;
  updated_at: string;
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const PERIOD_NAMES = ["week", "month", "quarter"] as const;

/** The raw ?period= value, but only when it is one we recognize. */
export function validPeriodParam(sp: SearchParams): string | null {
  const period = firstParam(sp.period);
  return period && (PERIOD_NAMES as readonly string[]).includes(period)
    ? period
    : null;
}

/** resolvePeriod with a fall-back to all-time on a hand-mangled ?period=. */
export function safePeriod(sp: SearchParams, workspace: WorkspaceRow): ResolvedPeriod {
  try {
    return resolvePeriod(
      { period: firstParam(sp.period) },
      workspace.timezone,
      workspace.created_at,
    );
  } catch (error) {
    if (error instanceof PeriodError) {
      return resolvePeriod({}, workspace.timezone, workspace.created_at);
    }
    throw error;
  }
}

/** Human label for the current period, e.g. "last 30 days". */
export function periodLabel(sp: SearchParams): string {
  switch (validPeriodParam(sp)) {
    case "week":
      return "last 7 days";
    case "month":
      return "last 30 days";
    case "quarter":
      return "last quarter";
    default:
      return "all time";
  }
}

// ---------------------------------------------------------------------------
// Derived tool status — never stored, always computed from the last real run.
// ---------------------------------------------------------------------------

export const QUIET_AFTER_DAYS = 14;

export type DerivedToolStatus = "live" | "awaiting" | "quiet" | "archived";

export function deriveToolStatus(
  status: "active" | "archived",
  lastRunAt: string | null,
  now: Date = new Date(),
): DerivedToolStatus {
  if (status === "archived") return "archived";
  if (!lastRunAt) return "awaiting";
  const ageMs = now.getTime() - new Date(lastRunAt).getTime();
  return ageMs > QUIET_AFTER_DAYS * 24 * 60 * 60 * 1000 ? "quiet" : "live";
}

// ---------------------------------------------------------------------------
// Sparkline slots
// ---------------------------------------------------------------------------

/**
 * Fold day-bucketed run counts into a fixed number of slots spanning the
 * period, so every sparkline has the same shape regardless of period length.
 * Day buckets are date_trunc'd and can start just before fromUtc — clamped.
 */
export function foldToSlots(
  buckets: TimeseriesBucket[],
  period: ResolvedPeriod,
  slots = 12,
): number[] {
  const values = new Array<number>(slots).fill(0);
  const from = period.fromUtc.getTime();
  const span = Math.max(1, period.toUtc.getTime() - from);
  for (const bucket of buckets) {
    const t = Date.parse(bucket.start);
    let index = Math.floor(((t - from) / span) * slots);
    if (index < 0) index = 0;
    if (index >= slots) index = slots - 1;
    values[index] = (values[index] ?? 0) + bucket.runs;
  }
  return values;
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/** "Jun 3, 14:05" in the workspace timezone; adds the year when it differs. */
export function fmtStamp(
  iso: string,
  timeZone: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** "Jun 3, 2026" in the workspace timezone. */
export function fmtDate(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
