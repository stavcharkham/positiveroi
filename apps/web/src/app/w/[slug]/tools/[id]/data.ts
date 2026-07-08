import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_SOURCES, type EventSource } from "@positiveroi/core";

/**
 * Read helpers for the tool detail page. Callers authorize first
 * (requireMember) — these run on the admin client, scoped by workspace id
 * on every query.
 */

export interface SourceCount {
  source: EventSource;
  count: number;
}

/**
 * Real (non-test) run counts per source. Zeros included on purpose — a
 * silently failing capture shows up as "0 via hook" next to a live source.
 */
export async function getSourceCounts(
  admin: SupabaseClient,
  workspaceId: string,
  toolId: string,
): Promise<SourceCount[]> {
  return Promise.all(
    EVENT_SOURCES.map(async (source) => {
      const { count, error } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("tool_id", toolId)
        .eq("is_test", false)
        .eq("source", source);
      if (error) throw new Error(`source count failed: ${error.message}`);
      return { source, count: count ?? 0 };
    }),
  );
}

export const RUNS_PAGE_SIZE = 25;

export interface RunRow {
  id: string;
  occurred_at: string;
  source: EventSource;
  minutes_saved: number;
  minutes_overridden: boolean;
  is_test: boolean;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
}

/** One page of runs, newest first, test runs included (they get labeled). */
export async function getRunsPage(
  admin: SupabaseClient,
  workspaceId: string,
  toolId: string,
  page: number,
): Promise<{ rows: RunRow[]; total: number }> {
  const from = (page - 1) * RUNS_PAGE_SIZE;
  const { data, count, error } = await admin
    .from("events")
    .select(
      "id, occurred_at, source, minutes_saved, minutes_overridden, is_test, idempotency_key, metadata, created_by",
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId)
    .eq("tool_id", toolId)
    .order("occurred_at", { ascending: false })
    .range(from, from + RUNS_PAGE_SIZE - 1);

  if (error) {
    // Range past the end (hand-edited ?page=) — recover with just the count.
    if (error.code === "PGRST103") {
      const { count: total } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("tool_id", toolId);
      return { rows: [], total: total ?? 0 };
    }
    throw new Error(`runs lookup failed: ${error.message}`);
  }
  return { rows: (data ?? []) as RunRow[], total: count ?? 0 };
}

export interface BaselineChange {
  id: string;
  changed_by: string | null;
  changed_at: string;
  old_raw_estimate: number | null;
  new_raw_estimate: number;
  old_high_judgment: boolean | null;
  new_high_judgment: boolean;
}

export async function getBaselineHistory(
  admin: SupabaseClient,
  workspaceId: string,
  toolId: string,
): Promise<BaselineChange[]> {
  const { data, error } = await admin
    .from("baseline_history")
    .select(
      "id, changed_by, changed_at, old_raw_estimate, new_raw_estimate, old_high_judgment, new_high_judgment",
    )
    .eq("workspace_id", workspaceId)
    .eq("tool_id", toolId)
    .order("changed_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`baseline history lookup failed: ${error.message}`);
  return (data ?? []) as BaselineChange[];
}
