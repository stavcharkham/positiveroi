"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/** General workspace settings — admin only, single write path. */

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  hourlyRateDollars: z.coerce.number().min(0).max(1_000_000).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  timezone: z.string().trim().min(1).max(60),
});

export interface SettingsActionResult {
  ok: boolean;
  error?: string;
}

export async function updateWorkspaceSettingsAction(
  workspaceSlug: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const { workspace } = await requireMember(workspaceSlug, "admin");

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Check the form: name up to 80 characters, rate between 0 and 1,000,000, currency as a 3-letter code.",
    };
  }
  if (!isValidTimezone(parsed.data.timezone)) {
    return { ok: false, error: "Pick a valid timezone." };
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      name: parsed.data.name,
      hourly_rate_cents:
        parsed.data.hourlyRateDollars === null
          ? null
          : Math.round(parsed.data.hourlyRateDollars * 100),
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
    })
    .eq("id", workspace.id);
  if (error) {
    return { ok: false, error: "Could not save the changes. Try again." };
  }

  // Name and rate show up across the whole workspace surface.
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
