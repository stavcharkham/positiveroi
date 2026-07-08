"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Public page configuration — the only write that can expose data to anon
 * visitors, so it is admin-gated and the slug is validated against the same
 * pattern the database enforces.
 */

const PUBLIC_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

const publicConfigSchema = z.object({
  enabled: z.boolean(),
  publicSlug: z.string().trim().toLowerCase().regex(PUBLIC_SLUG_RE),
  showTools: z.boolean(),
  showBuilders: z.boolean(),
  showMoney: z.boolean(),
});

export interface PublicConfigActionResult {
  ok: boolean;
  error?: string;
}

export async function updatePublicConfigAction(
  workspaceSlug: string,
  input: unknown,
): Promise<PublicConfigActionResult> {
  const { workspace } = await requireMember(workspaceSlug, "admin");

  const parsed = publicConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "The public address must be 3 to 40 characters: lowercase letters, numbers, and hyphens.",
    };
  }
  const { enabled, publicSlug, showTools, showBuilders, showMoney } =
    parsed.data;

  const admin = getAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      public_enabled: enabled,
      public_slug: publicSlug,
      public_config: {
        show_tools: showTools,
        show_builders: showBuilders,
        show_money: showMoney,
      },
    })
    .eq("id", workspace.id);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That public address is taken. Try another." };
    }
    return { ok: false, error: "Could not save. Try again." };
  }

  // Refresh the ISR page under both the old and new address.
  if (workspace.public_slug && workspace.public_slug !== publicSlug) {
    revalidatePath(`/p/${workspace.public_slug}`);
  }
  revalidatePath(`/p/${publicSlug}`);
  revalidatePath(`/w/${workspaceSlug}/settings/public`);
  return { ok: true };
}
