import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  METADATA_MAX_BYTES,
  OCCURRED_AT_MAX_FUTURE_MS,
  OCCURRED_AT_MAX_PAST_DAYS,
  TRAILING_WINDOW_DAYS,
  effectiveMinutesSavedPerRun,
  ingestBodySchema,
  normalizeIngestBody,
  multiplierProgress,
  type IngestEvent,
  type IngestResponse,
  type IngestResult,
} from "@positiveroi/core";
import { getAdminClient } from "@/lib/supabase/admin";
import { maybeAwardMultiplier } from "@/lib/badges";

/**
 * The write path. Every event — API key or dashboard manual log — lands
 * through ingestEvents. Callers authenticate FIRST (verifyApiKey /
 * requireMember); this function trusts its ctx and enforces the ingestion
 * contract: tool resolution, occurred_at bounds, credit clamping,
 * idempotency, metrics fan-out, and lazy Multiplier awards.
 */

export type IngestContext =
  | { kind: "api"; keyId: string; workspaceId: string }
  | {
      kind: "member";
      userId: string;
      workspaceId: string;
      source: "manual";
      isTest?: boolean;
    };

export type IngestOutcome =
  | { ok: true; response: IngestResponse }
  | { ok: false; issues: unknown[] };

interface ToolRow {
  id: string;
  slug: string;
  name: string;
  status: "active" | "archived";
  owner_id: string;
  raw_estimate_minutes: number;
  minutes_saved_per_run: number;
  /** Builder-set credit; null means the suggested Undercount applies. */
  minutes_saved_override: number | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

// ---------------------------------------------------------------------------
// Pure rules — exported for unit tests.
// ---------------------------------------------------------------------------

/**
 * A minutes_saved override may only shift credit within
 * [0, tool.raw_estimate_minutes]; rounded to the column's 2dp scale.
 */
export function clampMinutesSaved(
  override: number,
  rawEstimateMinutes: number,
): number {
  const clamped = Math.min(Math.max(override, 0), rawEstimateMinutes);
  return Math.round(clamped * 100) / 100;
}

/**
 * occurred_at bounds. API path: no more than 5 minutes in the future and
 * no older than 90 days. Member (manual) path: only the future bound.
 */
export function occurredAtOutOfRange(
  occurredAtIso: string | undefined,
  ctxKind: "api" | "member",
  now: Date = new Date(),
): boolean {
  if (occurredAtIso === undefined) return false;
  const t = Date.parse(occurredAtIso);
  if (Number.isNaN(t)) return true;
  if (t > now.getTime() + OCCURRED_AT_MAX_FUTURE_MS) return true;
  if (
    ctxKind === "api" &&
    t < now.getTime() - OCCURRED_AT_MAX_PAST_DAYS * 24 * 60 * 60 * 1000
  ) {
    return true;
  }
  return false;
}

/** Serialized metadata must fit in 8KB (mirrors the DB check). */
export function metadataTooLarge(metadata: Record<string, unknown>): boolean {
  return Buffer.byteLength(JSON.stringify(metadata), "utf8") > METADATA_MAX_BYTES;
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

function rejected(code: string, message: string): IngestResult {
  return { status: "rejected", error: { code, message } };
}

async function resolveTools(
  supabase: SupabaseClient,
  workspaceId: string,
  refs: string[],
): Promise<{ bySlug: Map<string, ToolRow>; byId: Map<string, ToolRow> }> {
  const bySlug = new Map<string, ToolRow>();
  const byId = new Map<string, ToolRow>();
  const uuidRefs = refs.filter((r) => UUID_RE.test(r));

  const columns =
    "id, slug, name, status, owner_id, raw_estimate_minutes, minutes_saved_per_run, minutes_saved_override";
  const queries = [
    supabase
      .from("tools")
      .select(columns)
      .eq("workspace_id", workspaceId)
      .in("slug", refs),
  ];
  if (uuidRefs.length > 0) {
    queries.push(
      supabase
        .from("tools")
        .select(columns)
        .eq("workspace_id", workspaceId)
        .in("id", uuidRefs),
    );
  }
  for (const query of queries) {
    const { data, error } = await query;
    if (error) throw new Error(`tool lookup failed: ${error.message}`);
    for (const row of (data ?? []) as ToolRow[]) {
      bySlug.set(row.slug, row);
      byId.set(row.id, row);
    }
  }
  return { bySlug, byId };
}

export async function ingestEvents(
  ctx: IngestContext,
  rawBody: unknown,
  client?: SupabaseClient,
): Promise<IngestOutcome> {
  const parsed = ingestBodySchema.safeParse(rawBody);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  const events = normalizeIngestBody(parsed.data);

  const supabase = client ?? getAdminClient();
  const now = new Date();

  const { bySlug, byId } = await resolveTools(
    supabase,
    ctx.workspaceId,
    Array.from(new Set(events.map((e) => e.tool))),
  );
  // Postgres's uuid type is case-insensitive, so an uppercase UUID matches a
  // row whose id is stored lowercase; look it up by the lowercased ref.
  const lookupTool = (ref: string): ToolRow | undefined =>
    UUID_RE.test(ref)
      ? (byId.get(ref.toLowerCase()) ?? bySlug.get(ref))
      : bySlug.get(ref);

  // Metric definitions are per-workspace and few — fetch once when needed.
  let metricIdByKey: Map<string, string> | null = null;
  if (events.some((e) => Object.keys(e.metrics).length > 0)) {
    const { data, error } = await supabase
      .from("metric_definitions")
      .select("id, key")
      .eq("workspace_id", ctx.workspaceId);
    if (error) throw new Error(`metric lookup failed: ${error.message}`);
    metricIdByKey = new Map(
      ((data ?? []) as { id: string; key: string }[]).map((m) => [m.key, m.id]),
    );
  }

  const results: IngestResult[] = [];
  /** Last accepted result index per tool — gets the tool_totals attached. */
  const lastAcceptedByTool = new Map<string, { index: number; tool: ToolRow }>();

  for (const event of events) {
    results.push(
      await ingestOne(supabase, ctx, event, now, lookupTool, metricIdByKey),
    );
    const index = results.length - 1;
    const result = results[index] as IngestResult;
    if (result.status === "accepted") {
      const tool = lookupTool(event.tool) as ToolRow;
      lastAcceptedByTool.set(tool.id, { index, tool });
    }
  }

  // Trailing-30d totals for each touched tool's owner + lazy badge award.
  // The window's exclusive end gets the same 5-minute future tolerance the
  // occurred_at bounds allow: DB-defaulted occurred_at comes from Postgres's
  // clock, and if that runs ahead of this server's, the run just inserted
  // would otherwise be missing from its own tool_totals.
  const totalsNow = new Date();
  const toIso = new Date(
    totalsNow.getTime() + OCCURRED_AT_MAX_FUTURE_MS,
  ).toISOString();
  const fromIso = new Date(
    totalsNow.getTime() - TRAILING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  for (const { index, tool } of lastAcceptedByTool.values()) {
    const { data, error } = await supabase.rpc("roi_builder_hours", {
      ws: ctx.workspaceId,
      p_owner: tool.owner_id,
      p_from: fromIso,
      p_to: toIso,
    });
    if (error) continue; // totals are advisory; never fail accepted events
    const minutes = Number(data ?? 0);
    const hours = minutes / 60;
    (results[index] as IngestResult).tool_totals = {
      tool: tool.slug,
      owner_hours_30d: Math.round(hours * 100) / 100,
      multiplier_progress: Math.round(multiplierProgress(hours) * 10000) / 10000,
    };
    await maybeAwardMultiplier(ctx.workspaceId, tool.owner_id, hours, supabase);
  }

  const counts = { accepted: 0, duplicates: 0, rejected: 0 };
  for (const r of results) {
    if (r.status === "accepted") counts.accepted += 1;
    else if (r.status === "duplicate") counts.duplicates += 1;
    else counts.rejected += 1;
  }

  return {
    ok: true,
    response: {
      results,
      accepted: counts.accepted,
      duplicates: counts.duplicates,
      rejected: counts.rejected,
    },
  };
}

async function ingestOne(
  supabase: SupabaseClient,
  ctx: IngestContext,
  event: IngestEvent,
  now: Date,
  lookupTool: (ref: string) => ToolRow | undefined,
  metricIdByKey: Map<string, string> | null,
): Promise<IngestResult> {
  const tool = lookupTool(event.tool);
  if (!tool) {
    return rejected("unknown_tool", `No tool "${event.tool}" in this workspace.`);
  }
  if (tool.status === "archived") {
    return rejected("tool_archived", `Tool "${tool.slug}" is archived.`);
  }
  if (occurredAtOutOfRange(event.occurred_at, ctx.kind, now)) {
    return rejected(
      "occurred_at_out_of_range",
      ctx.kind === "api"
        ? "occurred_at must be within the last 90 days and at most 5 minutes in the future."
        : "occurred_at may be at most 5 minutes in the future.",
    );
  }
  if (metadataTooLarge(event.metadata)) {
    return rejected("metadata_too_large", "metadata exceeds the 8KB limit.");
  }

  // Snapshot: per-event caller override (clamped) beats the tool's credit;
  // the tool's credit is the builder-set number when present, else the
  // suggested Undercount from the generated column.
  const hasOverride = event.minutes_saved !== undefined;
  const minutesSaved = hasOverride
    ? clampMinutesSaved(event.minutes_saved as number, tool.raw_estimate_minutes)
    : effectiveMinutesSavedPerRun(
        tool.minutes_saved_per_run,
        tool.minutes_saved_override,
      );

  const row: Record<string, unknown> = {
    workspace_id: ctx.workspaceId,
    tool_id: tool.id,
    source: ctx.kind === "member" ? "manual" : event.source,
    is_test: ctx.kind === "member" ? (ctx.isTest ?? event.is_test) : event.is_test,
    minutes_saved: minutesSaved,
    minutes_overridden: hasOverride,
    idempotency_key: event.idempotency_key ?? null,
    metadata: event.metadata,
  };
  if (event.occurred_at !== undefined) {
    row.occurred_at = new Date(event.occurred_at).toISOString();
  }
  if (ctx.kind === "api") row.api_key_id = ctx.keyId;
  else row.created_by = ctx.userId;

  const { data: inserted, error } = await supabase
    .from("events")
    .insert(row)
    .select("id, occurred_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION && event.idempotency_key) {
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("tool_id", tool.id)
        .eq("idempotency_key", event.idempotency_key)
        .maybeSingle();
      return {
        status: "duplicate",
        ...(existing ? { event_id: existing.id as string } : {}),
      };
    }
    // The app-side metadata pre-check measures UTF-8 text bytes; the DB check
    // measures jsonb (pg_column_size), which adds per-entry overhead. A payload
    // that slips past the pre-check but trips the DB check surfaces as a
    // check_violation — report it as what it is, not a generic internal error.
    if (error.code === CHECK_VIOLATION) {
      return rejected("metadata_too_large", "metadata exceeds the 8KB limit.");
    }
    return rejected("internal", "Event could not be stored.");
  }

  const warnings: string[] = [];
  const metricEntries = Object.entries(event.metrics);
  if (metricEntries.length > 0) {
    const metricRows: Record<string, unknown>[] = [];
    for (const [key, value] of metricEntries) {
      const metricId = metricIdByKey?.get(key);
      if (!metricId) {
        warnings.push(`unknown_metric:${key}`);
        continue;
      }
      metricRows.push({
        workspace_id: ctx.workspaceId,
        event_id: inserted.id,
        metric_id: metricId,
        occurred_at: inserted.occurred_at,
        value,
      });
    }
    if (metricRows.length > 0) {
      const { error: metricError } = await supabase
        .from("metric_values")
        .insert(metricRows);
      if (metricError) warnings.push("metrics_write_failed");
    }
  }

  return {
    status: "accepted",
    event_id: inserted.id as string,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
