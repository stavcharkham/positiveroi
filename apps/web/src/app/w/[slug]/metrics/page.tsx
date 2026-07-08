import type { Metadata } from "next";
import { Target } from "lucide-react";
import type { MetricUnit } from "@positiveroi/core";
import { metricTotals } from "@/lib/aggregates";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { periodFromParam } from "../_lib/data";
import { normalizePeriodParam, periodLabel } from "../_lib/format";
import { AddMetricDialog, MetricTile, type MetricTileData } from "./metrics-client";

export const metadata: Metadata = { title: "Metrics" };

export default async function MetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { workspace, member } = await requireMember(slug);

  const periodName = normalizePeriodParam(sp.period);
  const period = periodFromParam(periodName, workspace);
  const label = periodLabel(periodName);
  const canManage = member.role === "lead" || member.role === "admin";

  const admin = getAdminClient();
  const [{ data: defs, error }, totals] = await Promise.all([
    admin
      .from("metric_definitions")
      .select("id, key, name, unit")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    metricTotals(workspace.id, period),
  ]);
  if (error) throw new Error(`metric definitions lookup failed: ${error.message}`);

  const totalById = new Map(totals.map((t) => [t.metricId, t.total]));
  const tiles: MetricTileData[] = (
    (defs ?? []) as { id: string; key: string; name: string; unit: MetricUnit }[]
  ).map((d) => ({
    id: d.id,
    key: d.key,
    name: d.name,
    unit: d.unit,
    total: totalById.get(d.id) ?? 0,
  }));

  const allZero = tiles.length > 0 && tiles.every((t) => t.total === 0);

  return (
    <>
      <PageHeader
        title="Metrics"
        description={`Business outcomes your tools reported ${label}. Every total drills to the events behind it.`}
      >
        {canManage && <AddMetricDialog workspaceSlug={slug} />}
      </PageHeader>

      {allZero && (
        <div className="mb-4 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-foreground-secondary">
          Nothing recorded yet. Send{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            metrics: {"{"}revenue_influenced: 1200{"}"}
          </code>{" "}
          on any run and the tiles below start counting.
        </div>
      )}

      {tiles.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No metrics defined"
          body={
            canManage
              ? "Define a metric, then tools attach values to their runs with its key."
              : "A lead or admin can define metrics; tools then attach values to their runs."
          }
        >
          {canManage && <AddMetricDialog workspaceSlug={slug} />}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <MetricTile
              key={tile.id}
              workspaceSlug={slug}
              metric={tile}
              currency={workspace.currency}
              periodParam={periodName}
              periodText={label}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </>
  );
}
