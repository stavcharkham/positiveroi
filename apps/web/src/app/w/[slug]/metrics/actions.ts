"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { METRIC_UNITS, type EventSource } from "@positiveroi/core";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { periodFromParam } from "../_lib/data";
import { normalizePeriodParam } from "../_lib/format";
import { isValidMetricKey, keyFromName } from "./key";

/**
 * Metric definition CRUD (lead/admin) + the drill-down read behind each
 * tile. Values themselves are only ever written by the ingest path.
 */

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  unit: z.enum(METRIC_UNITS),
});

export interface MetricActionResult {
  ok: boolean;
  error?: string;
}

export async function createMetricDefinitionAction(
  workspaceSlug: string,
  input: unknown,
): Promise<MetricActionResult> {
  const { workspace } = await requireMember(workspaceSlug, "lead");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give the metric a name (up to 80 characters) and a unit." };
  }

  const key = keyFromName(parsed.data.name);
  if (!isValidMetricKey(key)) {
    return {
      ok: false,
      error: "The name must contain at least two letters or digits to derive a key from.",
    };
  }

  const admin = getAdminClient();
  const { error } = await admin.from("metric_definitions").insert({
    workspace_id: workspace.id,
    key,
    name: parsed.data.name,
    unit: parsed.data.unit,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A metric with the key "${key}" already exists.` };
    }
    return { ok: false, error: "Could not create the metric. Try again." };
  }

  // Metric tiles also show on the company dashboard.
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete (with the cascade count shown first)
// ---------------------------------------------------------------------------

/** How many recorded values a delete would cascade — shown in the confirm. */
export async function metricUsageAction(
  workspaceSlug: string,
  metricId: string,
): Promise<{ ok: boolean; count: number }> {
  const { workspace } = await requireMember(workspaceSlug, "lead");
  const admin = getAdminClient();
  const { count, error } = await admin
    .from("metric_values")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("metric_id", metricId);
  if (error) return { ok: false, count: 0 };
  return { ok: true, count: count ?? 0 };
}

export async function deleteMetricDefinitionAction(
  workspaceSlug: string,
  metricId: string,
): Promise<MetricActionResult> {
  const { workspace } = await requireMember(workspaceSlug, "lead");
  const admin = getAdminClient();
  const { error } = await admin
    .from("metric_definitions")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("id", metricId);
  if (error) {
    return { ok: false, error: "Could not delete the metric. Try again." };
  }
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Drill-down: the events behind a tile
// ---------------------------------------------------------------------------

export interface MetricContribution {
  id: string;
  value: number;
  occurredAt: string;
  eventId: string;
  source: EventSource;
  toolId: string | null;
  toolName: string;
}

export async function listMetricContributionsAction(
  workspaceSlug: string,
  metricId: string,
  periodParam?: string,
): Promise<MetricContribution[]> {
  const { workspace } = await requireMember(workspaceSlug);
  const period = periodFromParam(normalizePeriodParam(periodParam), workspace);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("metric_values")
    .select(
      "id, value, occurred_at, event_id, events!inner(id, source, is_test, tool_id, tools(id, name))",
    )
    .eq("workspace_id", workspace.id)
    .eq("metric_id", metricId)
    .eq("events.is_test", false)
    .gte("occurred_at", period.fromUtc.toISOString())
    .lt("occurred_at", period.toUtc.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`metric contributions lookup failed: ${error.message}`);

  type Raw = {
    id: string;
    value: number;
    occurred_at: string;
    event_id: string;
    events:
      | {
          source: EventSource;
          tool_id: string | null;
          tools: { id: string; name: string } | { id: string; name: string }[] | null;
        }
      | {
          source: EventSource;
          tool_id: string | null;
          tools: { id: string; name: string } | { id: string; name: string }[] | null;
        }[]
      | null;
  };
  return ((data ?? []) as Raw[]).map((row) => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    const tool = event && (Array.isArray(event.tools) ? event.tools[0] : event.tools);
    return {
      id: row.id,
      value: Number(row.value),
      occurredAt: row.occurred_at,
      eventId: row.event_id,
      source: event?.source ?? "rest",
      toolId: tool?.id ?? null,
      toolName: tool?.name ?? "Unknown tool",
    };
  });
}
