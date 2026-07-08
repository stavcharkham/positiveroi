import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceRow } from "@/lib/guards";

/**
 * The ONE anon -> service-role gate. Public pages and badges may only show
 * data for a workspace that opted in (public_enabled) under its public_slug.
 * Everything public flows through here; nothing else lets anon reach data.
 */
export async function getPublicWorkspace(
  slug: string,
  client?: SupabaseClient,
): Promise<WorkspaceRow | null> {
  if (!slug) return null;
  const supabase = client ?? getAdminClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("public_slug", slug)
    .eq("public_enabled", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as WorkspaceRow;
}
