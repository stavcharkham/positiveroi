import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TRAILING_WINDOW_DAYS,
  multiplierProgress,
  tierFor,
} from "@positiveroi/core";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * All rollup reads, backed by the SQL functions in
 * supabase/migrations/0008_aggregate_functions.sql. They run on the ADMIN
 * client — callers are responsible for authorization (requireMember,
 * verifyApiKey, or getPublicWorkspace) before calling anything here.
 * Every function already filters is_test = false in SQL.
 */

// ---------------------------------------------------------------------------
// Period resolution
// ---------------------------------------------------------------------------

export type PeriodName = "week" | "month" | "quarter";

export const PERIOD_DAYS: Record<PeriodName, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

/**
 * A custom range packed into one period value: "YYYY-MM-DD..YYYY-MM-DD".
 * The dashboard threads a single ?period= param through every link, so the
 * custom picker rides the same param; the REST read API keeps its documented
 * separate from/to params (both forms resolve identically below).
 */
const CUSTOM_PERIOD_RE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export function parseCustomPeriod(
  value: string,
): { from: string; to: string } | null {
  const match = CUSTOM_PERIOD_RE.exec(value);
  return match ? { from: match[1] as string, to: match[2] as string } : null;
}

export interface ResolvedPeriod {
  fromUtc: Date;
  toUtc: Date;
  periodDays: number;
}

/** Thrown for invalid period params; routes map it to validation_failed. */
export class PeriodError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Offset of `timeZone` from UTC at the given instant, in ms. */
function tzOffsetMs(timeZone: string, utc: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(utc)) parts[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === "24" ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utc.getTime();
}

/** UTC instant of local midnight for a YYYY-MM-DD date in an IANA timezone. */
export function zonedDayStartUtc(dateStr: string, timeZone: string): Date {
  if (!DATE_RE.test(dateStr)) {
    throw new PeriodError(`invalid date "${dateStr}" — expected YYYY-MM-DD`);
  }
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Date.UTC rolls invalid components over (2026-02-31 → Mar 3) instead of
  // failing; reject anything that did not round-trip so it maps to
  // validation_failed rather than silently querying the wrong window.
  const probe = new Date(naive);
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new PeriodError(`invalid calendar date "${dateStr}"`);
  }
  let offset: number;
  try {
    offset = tzOffsetMs(timeZone, new Date(naive));
    // Second pass corrects DST-transition edges.
    offset = tzOffsetMs(timeZone, new Date(naive - offset));
  } catch {
    throw new PeriodError(`invalid timezone "${timeZone}"`);
  }
  return new Date(naive - offset);
}

/**
 * Resolve query params into a UTC range.
 * - period=week|month|quarter: trailing 7/30/90 days ending now.
 * - period="YYYY-MM-DD..YYYY-MM-DD": custom range, same semantics as from/to.
 * - from/to (YYYY-MM-DD): calendar days interpreted in the workspace
 *   timezone; `to` is inclusive (range ends at the start of the next day).
 * - neither: all-time, from workspace.created_at to now.
 */
export function resolvePeriod(
  opts: { period?: string | null; from?: string | null; to?: string | null },
  workspaceTimezone: string,
  workspaceCreatedAt: string | Date,
  now: Date = new Date(),
): ResolvedPeriod {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  if (opts.period) {
    const custom = parseCustomPeriod(opts.period);
    if (custom) {
      return resolvePeriod(custom, workspaceTimezone, workspaceCreatedAt, now);
    }
    if (!(opts.period in PERIOD_DAYS)) {
      throw new PeriodError(
        `invalid period "${opts.period}" — expected week, month, or quarter`,
      );
    }
    const days = PERIOD_DAYS[opts.period as PeriodName];
    return {
      fromUtc: new Date(now.getTime() - days * MS_PER_DAY),
      toUtc: now,
      periodDays: days,
    };
  }

  if (opts.from || opts.to) {
    const fromUtc = opts.from
      ? zonedDayStartUtc(opts.from, workspaceTimezone)
      : new Date(workspaceCreatedAt);
    let toUtc: Date;
    if (opts.to) {
      const toStart = zonedDayStartUtc(opts.to, workspaceTimezone);
      toUtc = new Date(toStart.getTime() + MS_PER_DAY); // inclusive day
    } else {
      toUtc = now;
    }
    if (fromUtc.getTime() >= toUtc.getTime()) {
      throw new PeriodError("from must be before to");
    }
    return {
      fromUtc,
      toUtc,
      periodDays: (toUtc.getTime() - fromUtc.getTime()) / MS_PER_DAY,
    };
  }

  const fromUtc = new Date(workspaceCreatedAt);
  const periodDays = Math.max(
    1,
    (now.getTime() - fromUtc.getTime()) / MS_PER_DAY,
  );
  return { fromUtc, toUtc: now, periodDays };
}

// ---------------------------------------------------------------------------
// Rollup wrappers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Workspace row fetch for API routes (admin client — authorize first). */
export async function getWorkspace(
  workspaceId: string,
  client?: SupabaseClient,
): Promise<import("@/lib/guards").WorkspaceRow | null> {
  const supabase = client ?? getAdminClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`workspace lookup failed: ${error.message}`);
  return (data as import("@/lib/guards").WorkspaceRow) ?? null;
}

async function rpc<T>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

export interface WorkspaceStats {
  runs: number;
  minutes: number;
  hours: number;
  activeTools: number;
  builders: number;
}

export async function workspaceStats(
  workspaceId: string,
  period: ResolvedPeriod,
  client?: SupabaseClient,
): Promise<WorkspaceStats> {
  const supabase = client ?? getAdminClient();
  const rows = await rpc<
    { runs: number; minutes: number; active_tools: number; builders: number }[]
  >(supabase, "roi_workspace_stats", {
    ws: workspaceId,
    p_from: period.fromUtc.toISOString(),
    p_to: period.toUtc.toISOString(),
  });
  const row = rows?.[0] ?? { runs: 0, minutes: 0, active_tools: 0, builders: 0 };
  const minutes = Number(row.minutes ?? 0);
  return {
    runs: Number(row.runs ?? 0),
    minutes,
    hours: round2(minutes / 60),
    activeTools: Number(row.active_tools ?? 0),
    builders: Number(row.builders ?? 0),
  };
}

/** Trailing-30d credited hours for tools owned by a builder. */
export async function builderHours30d(
  workspaceId: string,
  userId: string,
  client?: SupabaseClient,
  now: Date = new Date(),
): Promise<number> {
  const supabase = client ?? getAdminClient();
  const minutes = await rpc<number | null>(supabase, "roi_builder_hours", {
    ws: workspaceId,
    p_owner: userId,
    p_from: new Date(
      now.getTime() - TRAILING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    p_to: now.toISOString(),
  });
  return round2(Number(minutes ?? 0) / 60);
}

export interface BuilderStats {
  hours30d: number;
  multiplierProgress: number;
  tier: ReturnType<typeof tierFor>;
  totalRuns: number;
}

export async function builderStats(
  workspaceId: string,
  userId: string,
  client?: SupabaseClient,
): Promise<BuilderStats> {
  const supabase = client ?? getAdminClient();
  const hours30d = await builderHours30d(workspaceId, userId, supabase);

  const { data: toolRows, error: toolsError } = await supabase
    .from("tools")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("owner_id", userId);
  if (toolsError) throw new Error(`builder tools lookup failed: ${toolsError.message}`);

  let totalRuns = 0;
  const toolIds = ((toolRows ?? []) as { id: string }[]).map((t) => t.id);
  if (toolIds.length > 0) {
    const { count, error } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .in("tool_id", toolIds)
      .eq("is_test", false);
    if (error) throw new Error(`builder runs count failed: ${error.message}`);
    totalRuns = count ?? 0;
  }

  return {
    hours30d,
    multiplierProgress: multiplierProgress(hours30d),
    tier: tierFor(hours30d, totalRuns),
    totalRuns,
  };
}

export type TimeseriesBucketName = "day" | "week" | "month";

export interface TimeseriesBucket {
  start: string;
  runs: number;
  minutes: number;
}

export async function timeseries(
  workspaceId: string,
  bucket: TimeseriesBucketName,
  period: ResolvedPeriod,
  toolId?: string,
  client?: SupabaseClient,
): Promise<TimeseriesBucket[]> {
  const supabase = client ?? getAdminClient();
  const rows = await rpc<
    { bucket_start: string; runs: number; minutes: number }[]
  >(supabase, "roi_timeseries", {
    ws: workspaceId,
    p_bucket: bucket,
    p_from: period.fromUtc.toISOString(),
    p_to: period.toUtc.toISOString(),
    p_tool: toolId ?? null,
  });
  return (rows ?? []).map((r) => ({
    start: r.bucket_start,
    runs: Number(r.runs),
    minutes: Number(r.minutes),
  }));
}

export interface BuilderLeaderboardRow {
  userId: string;
  /** Empty string for departed members — render as "former member". */
  displayName: string;
  minutes: number;
  hours: number;
  runs: number;
}

export interface ToolLeaderboardRow {
  toolId: string;
  name: string;
  slug: string;
  minutes: number;
  hours: number;
  runs: number;
}

export async function leaderboards(
  workspaceId: string,
  period: ResolvedPeriod,
  client?: SupabaseClient,
): Promise<{ builders: BuilderLeaderboardRow[]; tools: ToolLeaderboardRow[] }> {
  const supabase = client ?? getAdminClient();
  const args = {
    ws: workspaceId,
    p_from: period.fromUtc.toISOString(),
    p_to: period.toUtc.toISOString(),
  };
  const [builderRows, toolRows] = await Promise.all([
    rpc<{ user_id: string; display_name: string; minutes: number; runs: number }[]>(
      supabase,
      "roi_leaderboard_builders",
      args,
    ),
    rpc<{ tool_id: string; name: string; slug: string; minutes: number; runs: number }[]>(
      supabase,
      "roi_leaderboard_tools",
      args,
    ),
  ]);
  return {
    builders: (builderRows ?? []).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name ?? "",
      minutes: Number(r.minutes),
      hours: round2(Number(r.minutes) / 60),
      runs: Number(r.runs),
    })),
    tools: (toolRows ?? []).map((r) => ({
      toolId: r.tool_id,
      name: r.name,
      slug: r.slug,
      minutes: Number(r.minutes),
      hours: round2(Number(r.minutes) / 60),
      runs: Number(r.runs),
    })),
  };
}

export interface MetricTotal {
  metricId: string;
  key: string;
  name: string;
  unit: string;
  total: number;
}

export async function metricTotals(
  workspaceId: string,
  period: ResolvedPeriod,
  client?: SupabaseClient,
): Promise<MetricTotal[]> {
  const supabase = client ?? getAdminClient();
  const rows = await rpc<
    { metric_id: string; key: string; name: string; unit: string; total: number }[]
  >(supabase, "roi_metric_totals", {
    ws: workspaceId,
    p_from: period.fromUtc.toISOString(),
    p_to: period.toUtc.toISOString(),
  });
  return (rows ?? []).map((r) => ({
    metricId: r.metric_id,
    key: r.key,
    name: r.name,
    unit: r.unit,
    total: Number(r.total),
  }));
}

export interface GoneQuietTool {
  toolId: string;
  name: string;
  slug: string;
  ownerId: string;
  lastRunAt: string;
}

/** Active tools with at least one prior run but none in the last 14 days. */
export async function goneQuiet(
  workspaceId: string,
  client?: SupabaseClient,
): Promise<GoneQuietTool[]> {
  const supabase = client ?? getAdminClient();
  const rows = await rpc<
    { tool_id: string; name: string; slug: string; owner_id: string; last_run_at: string }[]
  >(supabase, "roi_gone_quiet", { ws: workspaceId });
  return (rows ?? []).map((r) => ({
    toolId: r.tool_id,
    name: r.name,
    slug: r.slug,
    ownerId: r.owner_id,
    lastRunAt: r.last_run_at,
  }));
}

export interface ToolStatsRow {
  toolId: string;
  runs30d: number;
  minutesAllTime: number;
  hoursAllTime: number;
  lastRunAt: string | null;
}

/** Per-tool rollups for the tools list (read-scope GET /api/v1/tools). */
export async function toolStats(
  workspaceId: string,
  client?: SupabaseClient,
): Promise<Map<string, ToolStatsRow>> {
  const supabase = client ?? getAdminClient();
  const rows = await rpc<
    { tool_id: string; runs_30d: number; minutes_all_time: number; last_run_at: string | null }[]
  >(supabase, "roi_tool_stats", { ws: workspaceId });
  const map = new Map<string, ToolStatsRow>();
  for (const r of rows ?? []) {
    map.set(r.tool_id, {
      toolId: r.tool_id,
      runs30d: Number(r.runs_30d),
      minutesAllTime: Number(r.minutes_all_time),
      hoursAllTime: round2(Number(r.minutes_all_time) / 60),
      lastRunAt: r.last_run_at,
    });
  }
  return map;
}
