import "server-only";
import {
  EVENT_SOURCES,
  TRAILING_WINDOW_DAYS,
  effectiveMinutesSavedPerRun,
  type EventSource,
  type ToolType,
} from "@positiveroi/core";
import {
  resolvePeriod,
  timeseries,
  toolStats,
  PeriodError,
  type PeriodName,
  type ResolvedPeriod,
  type TimeseriesBucket,
  type TimeseriesBucketName,
} from "@/lib/aggregates";
import { maybeAwardMultiplier } from "@/lib/badges";
import type { WorkspaceRow } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Dashboard-track data helpers. Everything aggregate-shaped goes through
 * lib/aggregates (which guarantees is_test = false); the direct queries here
 * are row reads (tools, badges, recent runs) with the same filter applied.
 * Callers authorize with requireMember BEFORE calling anything in this file.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export function periodFromParam(
  name: string | undefined,
  workspace: Pick<WorkspaceRow, "timezone" | "created_at">,
): ResolvedPeriod {
  try {
    return resolvePeriod({ period: name ?? null }, workspace.timezone, workspace.created_at);
  } catch (err) {
    if (err instanceof PeriodError) {
      return resolvePeriod({}, workspace.timezone, workspace.created_at);
    }
    throw err;
  }
}

export function allTimePeriod(
  workspace: Pick<WorkspaceRow, "timezone" | "created_at">,
): ResolvedPeriod {
  return resolvePeriod({}, workspace.timezone, workspace.created_at);
}

/** The Multiplier window: trailing 30 days, never calendar months. */
export function trailing30Period(now: Date = new Date()): ResolvedPeriod {
  return {
    fromUtc: new Date(now.getTime() - TRAILING_WINDOW_DAYS * MS_PER_DAY),
    toUtc: now,
    periodDays: TRAILING_WINDOW_DAYS,
  };
}

/** Bucket size that keeps a trend chart readable at any period length. */
export function bucketFor(period: ResolvedPeriod): TimeseriesBucketName {
  if (period.periodDays <= 31) return "day";
  if (period.periodDays <= 190) return "week";
  return "month";
}

// ---------------------------------------------------------------------------
// Zero-filled timeseries (the RPC only returns buckets that have runs)
// ---------------------------------------------------------------------------

function truncToBucketUtc(d: Date, bucket: TimeseriesBucketName): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (bucket === "month") return new Date(Date.UTC(y, m, 1));
  const midnight = new Date(Date.UTC(y, m, day));
  if (bucket === "day") return midnight;
  // week — ISO weeks start Monday, matching Postgres date_trunc('week').
  const offset = (midnight.getUTCDay() + 6) % 7;
  return new Date(midnight.getTime() - offset * MS_PER_DAY);
}

function nextBucketUtc(d: Date, bucket: TimeseriesBucketName): Date {
  if (bucket === "day") return new Date(d.getTime() + MS_PER_DAY);
  if (bucket === "week") return new Date(d.getTime() + 7 * MS_PER_DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export function zeroFillSeries(
  rows: TimeseriesBucket[],
  bucket: TimeseriesBucketName,
  period: ResolvedPeriod,
): TimeseriesBucket[] {
  const byStart = new Map<number, TimeseriesBucket>();
  for (const row of rows) byStart.set(new Date(row.start).getTime(), row);

  const filled: TimeseriesBucket[] = [];
  let cursor = truncToBucketUtc(period.fromUtc, bucket);
  // Safety valve: never build more than 400 points regardless of range.
  while (cursor.getTime() < period.toUtc.getTime() && filled.length < 400) {
    const hit = byStart.get(cursor.getTime());
    filled.push(
      hit ?? { start: cursor.toISOString(), runs: 0, minutes: 0 },
    );
    cursor = nextBucketUtc(cursor, bucket);
  }
  return filled;
}

// ---------------------------------------------------------------------------
// Builder dashboard reads
// ---------------------------------------------------------------------------

export interface ToolRow {
  id: string;
  name: string;
  slug: string;
  type: ToolType;
  status: "active" | "archived";
  minutes_saved_per_run: number;
  /** Builder-set credit; null = the suggested Undercount applies. */
  minutes_saved_override: number | null;
  raw_estimate_minutes: number;
  high_judgment: boolean;
}

export async function toolsOwnedBy(
  workspaceId: string,
  userId: string,
): Promise<ToolRow[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tools")
    .select("id, name, slug, type, status, minutes_saved_per_run, minutes_saved_override, raw_estimate_minutes, high_judgment")
    .eq("workspace_id", workspaceId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`tools lookup failed: ${error.message}`);
  return (data ?? []) as ToolRow[];
}

export type ToolLiveStatus = "live" | "awaiting" | "quiet";

/** Derived status chip: live / awaiting first run / quiet 14 days. */
export function toolLiveStatus(
  lastRunAt: string | null | undefined,
  now: Date = new Date(),
): ToolLiveStatus {
  if (!lastRunAt) return "awaiting";
  const age = now.getTime() - new Date(lastRunAt).getTime();
  return age > 14 * MS_PER_DAY ? "quiet" : "live";
}

export interface MyToolCard {
  id: string;
  name: string;
  type: ToolType;
  minutesPerRun: number;
  hoursInPeriod: number;
  runsInPeriod: number;
  sparkline: number[];
  status: ToolLiveStatus;
}

/** Card-grid data for the builder's active tools. */
export async function myToolCards(
  workspaceId: string,
  tools: ToolRow[],
  period: ResolvedPeriod,
  periodToolTotals: Map<string, { hours: number; runs: number }>,
): Promise<MyToolCard[]> {
  const active = tools.filter((t) => t.status === "active");
  if (active.length === 0) return [];
  const bucket = bucketFor(period);
  const [statsMap, sparklines] = await Promise.all([
    toolStats(workspaceId),
    Promise.all(
      active.map(async (t) => {
        const rows = await timeseries(workspaceId, bucket, period, t.id);
        return zeroFillSeries(rows, bucket, period).map((b) => b.runs);
      }),
    ),
  ]);
  return active.map((t, i) => {
    const totals = periodToolTotals.get(t.id);
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      minutesPerRun: effectiveMinutesSavedPerRun(
        Number(t.minutes_saved_per_run),
        t.minutes_saved_override === null ? null : Number(t.minutes_saved_override),
      ),
      hoursInPeriod: totals?.hours ?? 0,
      runsInPeriod: totals?.runs ?? 0,
      sparkline: sparklines[i] ?? [],
      status: toolLiveStatus(statsMap.get(t.id)?.lastRunAt ?? null),
    };
  });
}

/** Per-source run counts for the builder's tools in the period. */
export async function sourceSplit(
  workspaceId: string,
  toolIds: string[],
  period: ResolvedPeriod,
): Promise<{ source: EventSource; runs: number }[]> {
  if (toolIds.length === 0) return [];
  const admin = getAdminClient();
  const counts = await Promise.all(
    EVENT_SOURCES.map(async (source) => {
      const { count, error } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("tool_id", toolIds)
        .eq("is_test", false)
        .eq("source", source)
        .gte("occurred_at", period.fromUtc.toISOString())
        .lt("occurred_at", period.toUtc.toISOString());
      if (error) throw new Error(`source split failed: ${error.message}`);
      return { source, runs: count ?? 0 };
    }),
  );
  return counts.filter((c) => c.runs > 0);
}

// ---------------------------------------------------------------------------
// Recent runs (row reads, is_test = false like every number on screen)
// ---------------------------------------------------------------------------

export interface RunRow {
  id: string;
  toolId: string;
  toolName: string;
  source: EventSource;
  minutes: number;
  overridden: boolean;
  occurredAt: string;
  surface: string | null;
}

export async function recentRunsFor(
  workspaceId: string,
  ownerId: string,
  limit = 10,
): Promise<RunRow[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("events")
    .select(
      "id, occurred_at, source, minutes_saved, minutes_overridden, metadata, tool_id, tools!inner(name, owner_id)",
    )
    .eq("workspace_id", workspaceId)
    .eq("tools.owner_id", ownerId)
    .eq("is_test", false)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recent runs lookup failed: ${error.message}`);

  type Raw = {
    id: string;
    occurred_at: string;
    source: EventSource;
    minutes_saved: number;
    minutes_overridden: boolean;
    metadata: Record<string, unknown> | null;
    tool_id: string;
    tools: { name: string } | { name: string }[] | null;
  };
  return ((data ?? []) as Raw[]).map((row) => {
    const tool = Array.isArray(row.tools) ? row.tools[0] : row.tools;
    const surface = row.metadata?.surface;
    return {
      id: row.id,
      toolId: row.tool_id,
      toolName: tool?.name ?? "Unknown tool",
      source: row.source,
      minutes: Number(row.minutes_saved),
      overridden: row.minutes_overridden,
      occurredAt: row.occurred_at,
      surface: typeof surface === "string" ? surface : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Multiplier badge state (lazy award happens here)
// ---------------------------------------------------------------------------

export interface MultiplierState {
  earnedAt: string | null;
  newlyAwarded: boolean;
}

/**
 * Reads the permanent badge and lazily awards it when trailing-30d hours
 * qualify. "Newly awarded" means: qualified now, had no badge row before —
 * the moment the celebration toast fires.
 */
export async function multiplierState(
  workspaceId: string,
  userId: string,
  hours30d: number,
): Promise<MultiplierState> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("builder_badges")
    .select("earned_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("badge", "multiplier")
    .maybeSingle();
  if (error) throw new Error(`badge lookup failed: ${error.message}`);

  const hadBadge = Boolean(data);
  const qualifies = await maybeAwardMultiplier(workspaceId, userId, hours30d);
  if (hadBadge) return { earnedAt: (data as { earned_at: string }).earned_at, newlyAwarded: false };
  if (!qualifies) return { earnedAt: null, newlyAwarded: false };
  return { earnedAt: new Date().toISOString(), newlyAwarded: true };
}

/** All permanent Multiplier badges in a workspace, keyed by user id. */
export async function multiplierBadges(
  workspaceId: string,
): Promise<Map<string, string>> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("builder_badges")
    .select("user_id, earned_at")
    .eq("workspace_id", workspaceId)
    .eq("badge", "multiplier");
  if (error) throw new Error(`badges lookup failed: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { user_id: string; earned_at: string }[]) {
    map.set(row.user_id, row.earned_at);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Members (builders page baseline — includes members with zero runs)
// ---------------------------------------------------------------------------

export interface MemberListRow {
  userId: string;
  displayName: string;
  role: string;
}

export async function listMembers(workspaceId: string): Promise<MemberListRow[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("members")
    .select("user_id, display_name, role")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`members lookup failed: ${error.message}`);
  return ((data ?? []) as { user_id: string; display_name: string; role: string }[]).map(
    (m) => ({ userId: m.user_id, displayName: m.display_name, role: m.role }),
  );
}

/** Active tool count per owner, for the builders page. */
export async function toolCountsByOwner(
  workspaceId: string,
): Promise<Map<string, number>> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tools")
    .select("owner_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  if (error) throw new Error(`tool counts lookup failed: ${error.message}`);
  const map = new Map<string, number>();
  for (const row of (data ?? []) as { owner_id: string }[]) {
    map.set(row.owner_id, (map.get(row.owner_id) ?? 0) + 1);
  }
  return map;
}
