import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MULTIPLIER_HOURS_30D } from "@positiveroi/core";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * The Multiplier badge: 180 credited hours in the trailing 30 days.
 * Awarded lazily wherever the trailing hours are computed; permanent once
 * earned (insert-only, conflicts ignored).
 */
export async function maybeAwardMultiplier(
  workspaceId: string,
  userId: string,
  hours30d: number,
  client?: SupabaseClient,
): Promise<boolean> {
  if (hours30d < MULTIPLIER_HOURS_30D) return false;
  const supabase = client ?? getAdminClient();
  await supabase.from("builder_badges").upsert(
    { workspace_id: workspaceId, user_id: userId, badge: "multiplier" },
    { onConflict: "workspace_id,user_id,badge", ignoreDuplicates: true },
  );
  return true;
}
