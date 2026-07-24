"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/** Inline hourly-rate edit on the company dashboard Value tile. Admin only. */

// A blank submit must NOT coerce to $0 — clearing the rate lives in
// settings; this inline editor only sets one.
const rateSchema = z.object({
  hourlyRateDollars: z
    .union([z.number(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().finite().min(0).max(1_000_000)),
});

export interface UpdateRateResult {
  ok: boolean;
  error?: string;
}

export async function updateHourlyRateAction(
  workspaceSlug: string,
  input: unknown,
): Promise<UpdateRateResult> {
  const { workspace } = await requireMember(workspaceSlug, "admin");

  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a rate between 0 and 1,000,000." };
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ hourly_rate_cents: Math.round(parsed.data.hourlyRateDollars * 100) })
    .eq("id", workspace.id);
  if (error) {
    return { ok: false, error: "Could not save the rate. Try again." };
  }

  // The rate feeds money figures on every dashboard surface.
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}
