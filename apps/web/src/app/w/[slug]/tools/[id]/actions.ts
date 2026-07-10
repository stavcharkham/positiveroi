"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  RAW_ESTIMATE_MAX_DASHBOARD,
  computeMinutesSavedPerRun,
  effectiveMinutesSavedPerRun,
  normalizeCreditOverride,
} from "@positiveroi/core";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "../helpers";

/**
 * Tool settings writes — lead/admin only. Every baseline change writes its
 * baseline_history audit row (who/when/old/new); credited minutes are never
 * computed here — the DB generated column and @positiveroi/core own that.
 */

const baselineInputSchema = z.object({
  rawEstimateMinutes: z
    .number()
    .gt(0)
    .max(RAW_ESTIMATE_MAX_DASHBOARD)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
      message: "at most 2 decimal places",
    }),
  highJudgment: z.boolean(),
});

export interface UpdateBaselineResult {
  ok: boolean;
  error?: string;
  /** New credited minutes per run, from the frozen methodology. */
  creditedPerRun?: number;
}

export async function updateBaselineAction(
  workspaceSlug: string,
  toolId: string,
  input: unknown,
): Promise<UpdateBaselineResult> {
  const { user, workspace } = await requireMember(workspaceSlug, "lead");
  if (!UUID_RE.test(toolId)) return { ok: false, error: "Tool not found." };

  const parsed = baselineInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `The baseline must be above 0 and at most ${RAW_ESTIMATE_MAX_DASHBOARD} minutes.`,
    };
  }
  const { rawEstimateMinutes, highJudgment } = parsed.data;

  const admin = getAdminClient();
  const { data: tool } = await admin
    .from("tools")
    .select("id, raw_estimate_minutes, high_judgment")
    .eq("workspace_id", workspace.id)
    .eq("id", toolId)
    .maybeSingle();
  if (!tool) return { ok: false, error: "Tool not found." };

  const oldRaw = Number(tool.raw_estimate_minutes);
  const oldJudgment = Boolean(tool.high_judgment);
  const creditedPerRun = computeMinutesSavedPerRun(rawEstimateMinutes, highJudgment);

  if (oldRaw === rawEstimateMinutes && oldJudgment === highJudgment) {
    return { ok: true, creditedPerRun };
  }

  const { error: updateError } = await admin
    .from("tools")
    .update({
      raw_estimate_minutes: rawEstimateMinutes,
      high_judgment: highJudgment,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace.id)
    .eq("id", toolId);
  if (updateError) {
    return { ok: false, error: "Could not save the baseline. Try again." };
  }

  const { error: historyError } = await admin.from("baseline_history").insert({
    workspace_id: workspace.id,
    tool_id: toolId,
    changed_by: user.id,
    old_raw_estimate: oldRaw,
    new_raw_estimate: rawEstimateMinutes,
    old_high_judgment: oldJudgment,
    new_high_judgment: highJudgment,
  });
  if (historyError) {
    // Restore the invariant: no baseline change without its audit row.
    await admin
      .from("tools")
      .update({ raw_estimate_minutes: oldRaw, high_judgment: oldJudgment })
      .eq("workspace_id", workspace.id)
      .eq("id", toolId);
    return { ok: false, error: "Could not save the baseline. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/tools/${toolId}`);
  revalidatePath(`/w/${workspaceSlug}/tools`);
  return { ok: true, creditedPerRun };
}

// ---------------------------------------------------------------------------
// Credit override — the builder-set number that replaces the suggestion
// ---------------------------------------------------------------------------

const creditInputSchema = z.object({
  /** null = back to the suggested Undercount. */
  creditMinutes: z
    .number()
    .gt(0)
    .max(RAW_ESTIMATE_MAX_DASHBOARD)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
      message: "at most 2 decimal places",
    })
    .nullable(),
});

export interface UpdateCreditResult {
  ok: boolean;
  error?: string;
  /** The credited minutes new runs will snapshot. */
  creditedPerRun?: number;
}

/**
 * Set, change, or clear the builder-set credit. The tool's owner edits their
 * own; leads and admins edit any. Every change writes a credit_history row —
 * same accountability as the baseline.
 */
export async function updateCreditAction(
  workspaceSlug: string,
  toolId: string,
  input: unknown,
): Promise<UpdateCreditResult> {
  const { user, workspace, member } = await requireMember(workspaceSlug);
  if (!UUID_RE.test(toolId)) return { ok: false, error: "Tool not found." };

  const parsed = creditInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `The credit must be above 0 and at most ${RAW_ESTIMATE_MAX_DASHBOARD} minutes per run.`,
    };
  }

  const admin = getAdminClient();
  const { data: tool } = await admin
    .from("tools")
    .select("id, owner_id, minutes_saved_per_run, minutes_saved_override")
    .eq("workspace_id", workspace.id)
    .eq("id", toolId)
    .maybeSingle();
  if (!tool) return { ok: false, error: "Tool not found." };

  if (member.role === "builder" && tool.owner_id !== user.id) {
    return {
      ok: false,
      error: "Only the tool's owner, a lead, or an admin can change its credit.",
    };
  }

  const suggested = Number(tool.minutes_saved_per_run);
  const oldOverride =
    tool.minutes_saved_override === null ? null : Number(tool.minutes_saved_override);
  const newOverride = normalizeCreditOverride(suggested, parsed.data.creditMinutes);
  const creditedPerRun = effectiveMinutesSavedPerRun(suggested, newOverride);

  if (oldOverride === newOverride) return { ok: true, creditedPerRun };

  const { error: updateError } = await admin
    .from("tools")
    .update({
      minutes_saved_override: newOverride,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace.id)
    .eq("id", toolId);
  if (updateError) {
    return { ok: false, error: "Could not save the credit. Try again." };
  }

  const { error: historyError } = await admin.from("credit_history").insert({
    workspace_id: workspace.id,
    tool_id: toolId,
    changed_by: user.id,
    old_value: oldOverride,
    new_value: newOverride,
  });
  if (historyError) {
    // Restore the invariant: no credit change without its audit row.
    await admin
      .from("tools")
      .update({ minutes_saved_override: oldOverride })
      .eq("workspace_id", workspace.id)
      .eq("id", toolId);
    return { ok: false, error: "Could not save the credit. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/tools/${toolId}`);
  revalidatePath(`/w/${workspaceSlug}/tools`);
  return { ok: true, creditedPerRun };
}

const statusSchema = z.enum(["active", "archived"]);

export async function setToolStatusAction(
  workspaceSlug: string,
  toolId: string,
  status: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { workspace } = await requireMember(workspaceSlug, "lead");
  if (!UUID_RE.test(toolId)) return { ok: false, error: "Tool not found." };

  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status." };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tools")
    .update({ status: parsed.data, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspace.id)
    .eq("id", toolId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Could not update the tool. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/tools/${toolId}`);
  revalidatePath(`/w/${workspaceSlug}/tools`);
  return { ok: true };
}
