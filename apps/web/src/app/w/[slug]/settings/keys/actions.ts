"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateApiKey } from "@/lib/api-keys";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Key management, admin only. The plaintext secret exists exactly once: in
 * the create response. Only the sha256 hash and a display prefix are stored.
 * Revoked rows are kept — events attribute to them.
 */

const createKeySchema = z.object({
  name: z.string().trim().max(80),
  scope: z.enum(["ingest", "read"]),
});

export interface CreateApiKeyResult {
  ok: boolean;
  error?: string;
  /** Full secret — shown once, never retrievable again. */
  secret?: string;
}

export async function createApiKeyAction(
  workspaceSlug: string,
  input: unknown,
): Promise<CreateApiKeyResult> {
  const { user, workspace } = await requireMember(workspaceSlug, "admin");

  const parsed = createKeySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Name the key (up to 80 characters) and pick a scope.",
    };
  }

  const key = generateApiKey(parsed.data.scope);
  const admin = getAdminClient();
  const { error } = await admin.from("api_keys").insert({
    workspace_id: workspace.id,
    name: parsed.data.name,
    scope: parsed.data.scope,
    key_prefix: key.prefix,
    key_hash: key.hash,
    created_by: user.id,
  });
  if (error) {
    return { ok: false, error: "Could not create the key. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/settings/keys`);
  return { ok: true, secret: key.secret };
}

export interface RevokeApiKeyResult {
  ok: boolean;
  error?: string;
}

export async function revokeApiKeyAction(
  workspaceSlug: string,
  keyId: string,
): Promise<RevokeApiKeyResult> {
  const { workspace } = await requireMember(workspaceSlug, "admin");

  const parsedId = z.string().uuid().safeParse(keyId);
  if (!parsedId.success) return { ok: false, error: "Unknown key." };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .is("revoked_at", null)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "Could not revoke the key. Try again." };
  }

  revalidatePath(`/w/${workspaceSlug}/settings/keys`);
  return { ok: true };
}
