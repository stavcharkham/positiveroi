"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Invite revocation. Creation reuses lib/actions/invites.createInviteAction.
 * Role changes and member removal are deliberately out of scope in v1.
 */

export interface RevokeInviteResult {
  ok: boolean;
  error?: string;
}

export async function revokeInviteAction(
  workspaceSlug: string,
  inviteId: string,
): Promise<RevokeInviteResult> {
  const { workspace } = await requireMember(workspaceSlug, "admin");

  const parsedId = z.string().uuid().safeParse(inviteId);
  if (!parsedId.success) return { ok: false, error: "Unknown invite." };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .is("revoked_at", null)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "Could not revoke the invite. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/settings/members`);
  return { ok: true };
}
