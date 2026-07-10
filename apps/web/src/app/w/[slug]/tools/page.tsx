import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { effectiveMinutesSavedPerRun } from "@positiveroi/core";
import { leaderboards, timeseries, toolStats } from "@/lib/aggregates";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RunsSparkline } from "@/components/product/runs-sparkline";
import {
  deriveToolStatus,
  foldToSlots,
  periodLabel,
  safePeriod,
  validPeriodParam,
  type SearchParams,
  type ToolRecord,
} from "./helpers";
import { ToolStatusChip } from "./status-chip";
import { TOOL_TYPE_META, fmtHours, fmtNum } from "./tool-meta";

export const metadata: Metadata = { title: "Tools" };

type DirectoryTool = Pick<
  ToolRecord,
  | "id"
  | "owner_id"
  | "name"
  | "slug"
  | "description"
  | "type"
  | "status"
  | "minutes_saved_per_run"
  | "minutes_saved_override"
  | "created_at"
>;

export default async function ToolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { workspace } = await requireMember(slug);
  const period = safePeriod(sp, workspace);
  const periodParam = validPeriodParam(sp);
  const hoursLabel = periodLabel(sp);
  const admin = getAdminClient();

  const [toolsRes, membersRes, statsMap, boards] = await Promise.all([
    admin
      .from("tools")
      .select(
        "id, owner_id, name, slug, description, type, status, minutes_saved_per_run, minutes_saved_override, created_at",
      )
      .eq("workspace_id", workspace.id)
      .order("name"),
    admin
      .from("members")
      .select("user_id, display_name")
      .eq("workspace_id", workspace.id),
    toolStats(workspace.id, admin),
    leaderboards(workspace.id, period, admin),
  ]);
  if (toolsRes.error) {
    throw new Error(`tools lookup failed: ${toolsRes.error.message}`);
  }
  const tools = (toolsRes.data ?? []) as DirectoryTool[];
  const nameByUser = new Map(
    ((membersRes.data ?? []) as { user_id: string; display_name: string }[]).map(
      (m) => [m.user_id, m.display_name],
    ),
  );
  const periodByTool = new Map(boards.tools.map((t) => [t.toolId, t]));

  // Sparkline buckets — only for tools that have ever had a real run.
  const sparkByTool = new Map<string, number[]>();
  await Promise.all(
    tools
      .filter((t) => statsMap.has(t.id))
      .map(async (t) => {
        const buckets = await timeseries(workspace.id, "day", period, t.id, admin);
        sparkByTool.set(t.id, foldToSlots(buckets, period));
      }),
  );

  const rows = tools
    .map((tool) => {
      const stat = statsMap.get(tool.id);
      const inPeriod = periodByTool.get(tool.id);
      return {
        tool,
        ownerName: nameByUser.get(tool.owner_id) ?? "former member",
        status: deriveToolStatus(tool.status, stat?.lastRunAt ?? null),
        periodMinutes: inPeriod?.minutes ?? 0,
        periodRuns: inPeriod?.runs ?? 0,
        spark: sparkByTool.get(tool.id) ?? new Array<number>(12).fill(0),
      };
    })
    .sort((a, b) => {
      if (a.tool.status !== b.tool.status) {
        return a.tool.status === "active" ? -1 : 1;
      }
      if (b.periodMinutes !== a.periodMinutes) {
        return b.periodMinutes - a.periodMinutes;
      }
      return a.tool.name.localeCompare(b.tool.name);
    });

  const withPeriod = (path: string) =>
    periodParam ? `${path}?period=${periodParam}` : path;
  const newToolHref = `/w/${slug}/tools/new`;

  return (
    <div>
      <PageHeader
        title="Tools"
        description="Every tool, its honest baseline, and what its runs earn."
      >
        <Button asChild>
          <Link href={newToolHref}>
            <Plus aria-hidden /> Register a tool
          </Link>
        </Button>
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No tools yet"
          body="Register the first one: name it, set an honest baseline, and watch the first run land. Takes about two minutes."
        >
          <Button asChild>
            <Link href={newToolHref}>
              <Plus aria-hidden /> Register a tool
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
          <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6.5rem_7rem_6.5rem_8.5rem] items-center gap-3 border-b border-border px-5 py-2.5 md:grid">
            {["Tool", "Type", "Credited", "Activity", `Hours · ${hoursLabel}`, "Status"].map(
              (label) => (
                <span
                  key={label}
                  className="text-[0.6875rem] uppercase tracking-[0.14em] text-foreground-muted"
                >
                  {label}
                </span>
              ),
            )}
          </div>
          <ul className="divide-y divide-border">
            {rows.map(({ tool, ownerName, status, periodMinutes, periodRuns, spark }) => (
              <li key={tool.id}>
                <Link
                  href={withPeriod(`/w/${slug}/tools/${tool.id}`)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-subtle/60 md:grid-cols-[minmax(0,1fr)_6rem_6.5rem_7rem_6.5rem_8.5rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tool.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-foreground-muted">
                      {ownerName}
                      {tool.description ? ` · ${tool.description}` : ""}
                    </p>
                  </div>

                  <div className="hidden md:block">
                    <Badge variant="outline">{TOOL_TYPE_META[tool.type].label}</Badge>
                  </div>

                  <p className="hidden font-mono text-[0.8125rem] tabular-nums text-foreground-secondary md:block">
                    {fmtNum(
                      effectiveMinutesSavedPerRun(
                        Number(tool.minutes_saved_per_run),
                        tool.minutes_saved_override === null
                          ? null
                          : Number(tool.minutes_saved_override),
                      ),
                    )}
                    <span className="text-foreground-muted"> min/run</span>
                  </p>

                  <div className="hidden md:block">
                    <RunsSparkline
                      values={spark}
                      width={88}
                      height={26}
                      aria-label={`${periodRuns} runs, ${hoursLabel}`}
                    />
                  </div>

                  <p className="hidden md:block">
                    <span className="numeral text-xl leading-none text-foreground">
                      {fmtHours(periodMinutes)}
                    </span>
                    <span className="ml-1 font-mono text-[0.6875rem] text-foreground-muted">
                      hrs
                    </span>
                  </p>

                  <div className="justify-self-end md:justify-self-start">
                    <ToolStatusChip status={status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
