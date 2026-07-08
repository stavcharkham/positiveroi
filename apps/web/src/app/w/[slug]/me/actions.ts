"use server";

import { requireMember } from "@/lib/guards";
import { recentRunsFor, type RunRow } from "../_lib/data";

/**
 * Poll target for the recent-runs strip (5s interval on the client).
 * requireMember re-proves membership on every tick — the poll is a read of
 * the caller's OWN runs only.
 */
export async function recentRunsAction(workspaceSlug: string): Promise<RunRow[]> {
  const { user, workspace } = await requireMember(workspaceSlug);
  return recentRunsFor(workspace.id, user.id, 10);
}
