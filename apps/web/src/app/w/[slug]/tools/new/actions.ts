"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify, toolCreateSchema, type EventSource } from "@positiveroi/core";
import { requireMember } from "@/lib/guards";
import { ingestEvents } from "@/lib/ingest-core";
import { getAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "../helpers";

/**
 * Registration wizard writes. All behind requireMember on the admin client;
 * test and manual runs go through ingestEvents — the single write path —
 * never straight inserts.
 */

const UNIQUE_VIOLATION = "23505";

const createToolInputSchema = toolCreateSchema
  .extend({ owner_id: z.string().uuid().optional() })
  .refine(
    (v) =>
      Math.abs(v.raw_estimate_minutes * 100 - Math.round(v.raw_estimate_minutes * 100)) <
      1e-6,
    { message: "baseline supports at most 2 decimal places" },
  );

export interface CreateToolResult {
  ok: boolean;
  error?: string;
  toolId?: string;
  toolSlug?: string;
}

export async function createToolAction(
  workspaceSlug: string,
  input: unknown,
): Promise<CreateToolResult> {
  const { user, workspace, member } = await requireMember(workspaceSlug);

  const parsed = createToolInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form. Something is missing or out of range." };
  }
  const data = parsed.data;
  const admin = getAdminClient();

  // Builders always own what they register; leads and admins may assign.
  let ownerId = user.id;
  if (data.owner_id && data.owner_id !== user.id) {
    if (member.role === "builder") {
      return { ok: false, error: "Only leads and admins can register a tool for someone else." };
    }
    const { data: ownerRow } = await admin
      .from("members")
      .select("user_id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", data.owner_id)
      .maybeSingle();
    if (!ownerRow) {
      return { ok: false, error: "That owner is not a member of this workspace." };
    }
    ownerId = data.owner_id;
  }

  // Insert, retrying with a numbered suffix on a slug collision.
  const base = slugify(data.name);
  let tool: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 5 && !tool; attempt++) {
    const toolSlug = attempt === 0 ? base : `${base.slice(0, 60)}-${attempt + 1}`;
    const { data: inserted, error } = await admin
      .from("tools")
      .insert({
        workspace_id: workspace.id,
        owner_id: ownerId,
        name: data.name,
        slug: toolSlug,
        description: data.description,
        type: data.type,
        status: "active",
        origin: "dashboard",
        raw_estimate_minutes: data.raw_estimate_minutes,
        high_judgment: data.high_judgment,
      })
      .select("id, slug")
      .single();
    if (inserted) tool = inserted as { id: string; slug: string };
    else if (error && error.code !== UNIQUE_VIOLATION) {
      return { ok: false, error: "Could not create the tool. Try again." };
    }
  }
  if (!tool) {
    return { ok: false, error: "Too many tools share that name. Pick another." };
  }

  // The audit invariant: every baseline set writes history. Roll back if not.
  const { error: historyError } = await admin.from("baseline_history").insert({
    workspace_id: workspace.id,
    tool_id: tool.id,
    changed_by: user.id,
    old_raw_estimate: null,
    new_raw_estimate: data.raw_estimate_minutes,
    old_high_judgment: null,
    new_high_judgment: data.high_judgment,
  });
  if (historyError) {
    await admin.from("tools").delete().eq("id", tool.id);
    return { ok: false, error: "Could not create the tool. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/tools`);
  return { ok: true, toolId: tool.id, toolSlug: tool.slug };
}

// ---------------------------------------------------------------------------
// Test + manual runs (wizard step 4 footer)
// ---------------------------------------------------------------------------

export interface LogRunResult {
  ok: boolean;
  error?: string;
  eventId?: string;
}

/** A test run: proves the pipe, never counted in any total. */
export async function sendTestRunAction(
  workspaceSlug: string,
  toolId: string,
): Promise<LogRunResult> {
  return logRun(workspaceSlug, toolId, true);
}

/** A manual run: real, counted, attributed to the member who logged it. */
export async function logManualRunAction(
  workspaceSlug: string,
  toolId: string,
): Promise<LogRunResult> {
  return logRun(workspaceSlug, toolId, false);
}

async function logRun(
  workspaceSlug: string,
  toolId: string,
  isTest: boolean,
): Promise<LogRunResult> {
  const { user, workspace } = await requireMember(workspaceSlug);
  const outcome = await ingestEvents(
    {
      kind: "member",
      userId: user.id,
      workspaceId: workspace.id,
      source: "manual",
      isTest,
    },
    { tool: toolId },
  );
  if (!outcome.ok) {
    return { ok: false, error: "That run did not validate. Try again." };
  }
  const result = outcome.response.results[0];
  if (!result || result.status !== "accepted") {
    return { ok: false, error: result?.error?.message ?? "The run was not accepted." };
  }
  return { ok: true, eventId: result.event_id };
}

// ---------------------------------------------------------------------------
// First-run polling (wizard step 4, every 3s — no Realtime)
// ---------------------------------------------------------------------------

export interface FirstRunPayload {
  id: string;
  occurredAt: string;
  source: EventSource;
  minutesSaved: number;
}

export async function getFirstRunAction(
  workspaceSlug: string,
  toolId: string,
): Promise<{ ok: boolean; event: FirstRunPayload | null }> {
  const { workspace } = await requireMember(workspaceSlug);
  if (!UUID_RE.test(toolId)) return { ok: false, event: null };

  const admin = getAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, occurred_at, source, minutes_saved")
    .eq("workspace_id", workspace.id)
    .eq("tool_id", toolId)
    .eq("is_test", false)
    .order("occurred_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return { ok: true, event: null };

  return {
    ok: true,
    event: {
      id: data.id as string,
      occurredAt: data.occurred_at as string,
      source: data.source as EventSource,
      minutesSaved: Number(data.minutes_saved),
    },
  };
}
