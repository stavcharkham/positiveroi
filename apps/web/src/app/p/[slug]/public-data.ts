import "server-only";
import { cache } from "react";
import {
  leaderboards,
  resolvePeriod,
  timeseries,
  workspaceStats,
  type ResolvedPeriod,
} from "@/lib/aggregates";
import type { WorkspaceRow } from "@/lib/guards";
import { getPublicWorkspace } from "@/lib/public-gate";
import { getAdminClient } from "@/lib/supabase/admin";
import type { PublicImpactData } from "./public-impact-view";

/**
 * Numbers for the public page, badge, and settings preview. Everything comes
 * from lib/aggregates — the exact rollups the dashboards use (is_test always
 * excluded in SQL). Callers authorize first: getPublicWorkspace for anon
 * surfaces, requireMember for the settings preview.
 */

/** Deduplicates the gate lookup between generateMetadata and the page. */
export const getCachedPublicWorkspace = cache((slug: string) =>
  getPublicWorkspace(slug),
);

/** The public window: trailing quarter, resolved like every dashboard read. */
export function publicQuarter(workspace: WorkspaceRow): ResolvedPeriod {
  return resolvePeriod(
    { period: "quarter" },
    workspace.timezone,
    workspace.created_at,
  );
}

export async function getPublicImpactData(
  workspace: WorkspaceRow,
): Promise<PublicImpactData> {
  const admin = getAdminClient();
  const period = publicQuarter(workspace);

  const [stats, buckets, boards, multipliers] = await Promise.all([
    workspaceStats(workspace.id, period, admin),
    timeseries(workspace.id, "week", period, undefined, admin),
    leaderboards(workspace.id, period, admin),
    countMultipliers(workspace.id),
  ]);

  return {
    workspaceName: workspace.name,
    currency: workspace.currency.trim(),
    hours: stats.hours,
    runs: stats.runs,
    builders: stats.builders,
    multipliers,
    money: Math.round((stats.hours * workspace.hourly_rate_cents) / 100),
    trend: buckets.map((b) => Math.round((b.minutes / 60) * 10) / 10),
    topTools: boards.tools
      .slice(0, 5)
      .map((t) => ({ name: t.name, hours: t.hours })),
    periodFrom: period.fromUtc.toISOString(),
    periodTo: period.toUtc.toISOString(),
  };
}

/** Permanent Multiplier badges earned in this workspace. */
async function countMultipliers(workspaceId: string): Promise<number> {
  const admin = getAdminClient();
  const { count, error } = await admin
    .from("builder_badges")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("badge", "multiplier");
  if (error) throw new Error(`multiplier count failed: ${error.message}`);
  return count ?? 0;
}
