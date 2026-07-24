import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ListX } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveMinutesSavedPerRun } from "@positiveroi/core";
import { timeseries, toolStats, type ResolvedPeriod } from "@/lib/aggregates";
import { requireMember, type WorkspaceRow } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt } from "@/components/product/receipt";
import { RunsSparkline } from "@/components/product/runs-sparkline";
import { SourceBadge } from "@/components/product/source-badge";
import { StatTile } from "@/components/product/stat-tile";
import {
  UUID_RE,
  deriveToolStatus,
  firstParam,
  fmtDate,
  fmtStamp,
  foldToSlots,
  periodLabel,
  safePeriod,
  validPeriodParam,
  type SearchParams,
  type ToolRecord,
} from "../helpers";
import { SnippetsPanel } from "../snippets-panel";
import { ToolStatusChip } from "../status-chip";
import { TOOL_TYPE_META, fmtHours, fmtNum } from "../tool-meta";
import {
  RUNS_PAGE_SIZE,
  getBaselineHistory,
  getCreditHistory,
  getRunsPage,
  getSourceCounts,
} from "./data";
import { CreditPanel } from "./credit-panel";
import { RunsTable, type RunDisplayRow } from "./runs-table";
import { SettingsPanel } from "./settings-panel";
import { ToolTabNav, parseToolTab } from "./tab-nav";

export const metadata: Metadata = { title: "Tool" };

export default async function ToolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug, id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const { user, workspace, member } = await requireMember(slug);
  const admin = getAdminClient();

  const { data: toolRow, error: toolError } = await admin
    .from("tools")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();
  if (toolError) throw new Error(`tool lookup failed: ${toolError.message}`);
  if (!toolRow) notFound();
  const tool = toolRow as ToolRecord;

  const period = safePeriod(sp, workspace);
  const periodParam = validPeriodParam(sp);
  const tab = parseToolTab(firstParam(sp.tab));
  const basePath = `/w/${slug}/tools/${tool.id}`;

  const [statsMap, ownerRes] = await Promise.all([
    toolStats(workspace.id, admin),
    admin
      .from("members")
      .select("display_name")
      .eq("workspace_id", workspace.id)
      .eq("user_id", tool.owner_id)
      .maybeSingle(),
  ]);
  const stat = statsMap.get(tool.id);
  const ownerName = ownerRes.data?.display_name || "former member";
  const status = deriveToolStatus(tool.status, stat?.lastRunAt ?? null);
  const override =
    tool.minutes_saved_override === null ? null : Number(tool.minutes_saved_override);
  const creditPerRun = effectiveMinutesSavedPerRun(
    Number(tool.minutes_saved_per_run),
    override,
  );

  return (
    <div>
      <Link
        href={periodParam ? `/w/${slug}/tools?period=${periodParam}` : `/w/${slug}/tools`}
        className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> All tools
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {tool.name}
            </h1>
            <Badge variant="outline">{TOOL_TYPE_META[tool.type].label}</Badge>
            <ToolStatusChip status={status} />
          </div>
          {tool.description && (
            <p className="mt-1 text-sm text-foreground-secondary">{tool.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={ownerName} size="sm" /> {ownerName}
            </span>
            <span className="font-mono">
              {fmtNum(creditPerRun)} min/run credited
              {override !== null && (
                <span className="ml-1.5 rounded-full bg-accent-soft px-2 py-px text-accent">
                  builder-set
                </span>
              )}
            </span>
            <span>registered {fmtDate(tool.created_at, workspace.timezone)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <ToolTabNav basePath={basePath} active={tab} periodParam={periodParam} />
      </div>

      <div className="mt-4">
        {tab === "overview" && (
          <OverviewTab
            admin={admin}
            workspace={workspace}
            tool={tool}
            period={period}
            sp={sp}
            basePath={basePath}
            periodParam={periodParam}
            ownerName={ownerName}
            allTimeMinutes={stat?.minutesAllTime ?? 0}
          />
        )}
        {tab === "runs" && (
          <RunsTab
            admin={admin}
            workspace={workspace}
            tool={tool}
            sp={sp}
            basePath={basePath}
            periodParam={periodParam}
          />
        )}
        {tab === "setup" && (
          <SetupTab tool={tool} workspaceSlug={slug} />
        )}
        {tab === "settings" && (
          <SettingsTab
            admin={admin}
            workspace={workspace}
            tool={tool}
            workspaceSlug={slug}
            canEdit={member.role !== "builder"}
            canEditCredit={member.role !== "builder" || tool.owner_id === user.id}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

async function OverviewTab({
  admin,
  workspace,
  tool,
  period,
  sp,
  basePath,
  periodParam,
  ownerName,
  allTimeMinutes,
}: {
  admin: SupabaseClient;
  workspace: WorkspaceRow;
  tool: ToolRecord;
  period: ResolvedPeriod;
  sp: SearchParams;
  basePath: string;
  periodParam: string | null;
  ownerName: string;
  allTimeMinutes: number;
}) {
  const [buckets, sourceCounts] = await Promise.all([
    timeseries(workspace.id, "day", period, tool.id, admin),
    getSourceCounts(admin, workspace.id, tool.id),
  ]);
  const periodRuns = buckets.reduce((sum, b) => sum + b.runs, 0);
  const periodMinutes = buckets.reduce((sum, b) => sum + b.minutes, 0);
  const label = periodLabel(sp);
  const runsHref = withParams(basePath, { tab: "runs", period: periodParam });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <StatTile
          label={`Hours saved · ${label}`}
          value={fmtHours(periodMinutes)}
          sub={
            periodParam
              ? `${fmtHours(allTimeMinutes)} hrs all-time`
              : `${fmtNum(
                  effectiveMinutesSavedPerRun(
                    Number(tool.minutes_saved_per_run),
                    tool.minutes_saved_override === null
                      ? null
                      : Number(tool.minutes_saved_override),
                  ),
                )} credited min/run`
          }
          undercounted
        />
        <StatTile
          label={`Runs measured · ${label}`}
          value={periodRuns}
          sub="test runs excluded"
        />
        <Receipt
          rawMinutes={Number(tool.raw_estimate_minutes)}
          highJudgment={tool.high_judgment}
          overrideMinutes={
            tool.minutes_saved_override === null
              ? undefined
              : Number(tool.minutes_saved_override)
          }
        />
      </div>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[0.8125rem] font-medium text-foreground-secondary">
              How runs arrive
            </h2>
            <p className="mt-0.5 text-xs text-foreground-muted">
              A capture that fails silently shows up as a zero here.
            </p>
          </div>
          <RunsSparkline
            values={foldToSlots(buckets, period)}
            width={120}
            height={30}
            aria-label={`${periodRuns} runs, ${label}`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {sourceCounts.map(({ source, count }) => (
            <div key={source} className="flex items-center gap-2">
              <span
                className={
                  count === 0
                    ? "numeral text-2xl leading-none text-foreground-muted"
                    : "numeral text-2xl leading-none text-foreground"
                }
              >
                {count}
              </span>
              <SourceBadge source={source} />
            </div>
          ))}
        </div>
        <Link
          href={runsHref}
          className="mt-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-accent hover:underline"
        >
          See every run behind these numbers <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>

      <p className="text-xs text-foreground-muted">
        Owned by {ownerName}. Numbers follow the period selector; test runs are
        never counted.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

async function RunsTab({
  admin,
  workspace,
  tool,
  sp,
  basePath,
  periodParam,
}: {
  admin: SupabaseClient;
  workspace: WorkspaceRow;
  tool: ToolRecord;
  sp: SearchParams;
  basePath: string;
  periodParam: string | null;
}) {
  const rawPage = Number.parseInt(firstParam(sp.page) ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const [{ rows, total }, membersRes] = await Promise.all([
    getRunsPage(admin, workspace.id, tool.id, page),
    admin
      .from("members")
      .select("user_id, display_name")
      .eq("workspace_id", workspace.id),
  ]);
  const nameByUser = new Map(
    ((membersRes.data ?? []) as { user_id: string; display_name: string }[]).map(
      (m) => [m.user_id, m.display_name],
    ),
  );

  if (total === 0) {
    return (
      <EmptyState
        icon={ListX}
        title="No runs yet"
        body="Wire up capture in the Setup tab, or log one manually from the registration wizard."
      >
        <Button asChild variant="secondary">
          <Link href={withParams(basePath, { tab: "setup", period: periodParam })}>
            Open setup
          </Link>
        </Button>
      </EmptyState>
    );
  }

  const displayRows: RunDisplayRow[] = rows.map((row) => ({
    id: row.id,
    stamp: fmtStamp(row.occurred_at, workspace.timezone),
    occurredAtIso: new Date(row.occurred_at).toISOString(),
    source: row.source,
    minutes: fmtNum(Number(row.minutes_saved)),
    overridden: row.minutes_overridden,
    isTest: row.is_test,
    addedBy:
      row.source === "manual"
        ? (row.created_by && nameByUser.get(row.created_by)) || "former member"
        : null,
    hasIdempotencyKey: row.idempotency_key !== null,
    metadataKeys: Object.keys(row.metadata ?? {}),
  }));

  const totalPages = Math.max(1, Math.ceil(total / RUNS_PAGE_SIZE));
  const pageHref = (p: number) =>
    withParams(basePath, {
      tab: "runs",
      period: periodParam,
      page: p > 1 ? String(p) : null,
    });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      {displayRows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-foreground-secondary">
          Nothing on this page.{" "}
          <Link href={pageHref(1)} className="font-medium text-accent hover:underline">
            Back to page 1
          </Link>
        </p>
      ) : (
        <RunsTable rows={displayRows} />
      )}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <p className="text-xs text-foreground-muted">
          Page {Math.min(page, totalPages)} of {totalPages} · {total}{" "}
          {total === 1 ? "run" : "runs"}, newest first
        </p>
        <div className="flex items-center gap-1.5">
          {page > 1 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled>
              Previous
            </Button>
          )}
          {page < totalPages ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function SetupTab({
  tool,
  workspaceSlug,
}: {
  tool: ToolRecord;
  workspaceSlug: string;
}) {
  const endpoint = await requestOrigin();
  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">Capture</h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        Add this where the tool does its work, so every run reports itself.
      </p>
      <div className="mt-4">
        <SnippetsPanel
          type={tool.type}
          toolSlug={tool.slug}
          endpoint={endpoint}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function SettingsTab({
  admin,
  workspace,
  tool,
  workspaceSlug,
  canEdit,
  canEditCredit,
}: {
  admin: SupabaseClient;
  workspace: WorkspaceRow;
  tool: ToolRecord;
  workspaceSlug: string;
  canEdit: boolean;
  canEditCredit: boolean;
}) {
  const override =
    tool.minutes_saved_override === null ? null : Number(tool.minutes_saved_override);
  const creditPanel = canEditCredit ? (
    <CreditPanel
      workspaceSlug={workspaceSlug}
      toolId={tool.id}
      suggested={Number(tool.minutes_saved_per_run)}
      initialOverride={override}
    />
  ) : null;

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">Baseline</h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-foreground-secondary">
            Baseline edits and archiving are for leads and admins, so every
            change to the math is accountable. If this baseline looks wrong,
            ask a lead to change it.
          </p>
          <div className="mt-4 max-w-sm">
            <Receipt
              rawMinutes={Number(tool.raw_estimate_minutes)}
              highJudgment={tool.high_judgment}
              overrideMinutes={override ?? undefined}
            />
          </div>
        </section>
        {creditPanel}
        <BaselineHistorySection
          admin={admin}
          workspace={workspace}
          toolId={tool.id}
        />
        <CreditHistorySection admin={admin} workspace={workspace} toolId={tool.id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsPanel
        workspaceSlug={workspaceSlug}
        toolId={tool.id}
        toolName={tool.name}
        initialRawMinutes={Number(tool.raw_estimate_minutes)}
        initialHighJudgment={tool.high_judgment}
        status={tool.status}
      />
      {creditPanel}
      <BaselineHistorySection admin={admin} workspace={workspace} toolId={tool.id} />
      <CreditHistorySection admin={admin} workspace={workspace} toolId={tool.id} />
    </div>
  );
}

async function BaselineHistorySection({
  admin,
  workspace,
  toolId,
}: {
  admin: SupabaseClient;
  workspace: WorkspaceRow;
  toolId: string;
}) {
  const [history, membersRes] = await Promise.all([
    getBaselineHistory(admin, workspace.id, toolId),
    admin
      .from("members")
      .select("user_id, display_name")
      .eq("workspace_id", workspace.id),
  ]);
  if (history.length === 0) return null;
  const nameByUser = new Map(
    ((membersRes.data ?? []) as { user_id: string; display_name: string }[]).map(
      (m) => [m.user_id, m.display_name],
    ),
  );

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">
        Baseline history
      </h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        Every change to the math, on the record.
      </p>
      <ul className="mt-4 space-y-2.5">
        {history.map((change) => {
          const who =
            (change.changed_by && nameByUser.get(change.changed_by)) ||
            "former member";
          const isCreation = change.old_raw_estimate === null;
          return (
            <li key={change.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.8125rem]">
              <span className="font-medium text-foreground">{who}</span>
              <span className="text-foreground-secondary">
                {isCreation
                  ? `set the baseline to ${fmtNum(Number(change.new_raw_estimate))} min`
                  : `changed the baseline ${fmtNum(Number(change.old_raw_estimate))} → ${fmtNum(Number(change.new_raw_estimate))} min`}
                {", person-still-checks "}
                {change.new_high_judgment ? "on" : "off"}
              </span>
              <span className="font-mono text-xs text-foreground-muted">
                {fmtStamp(change.changed_at, workspace.timezone)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function CreditHistorySection({
  admin,
  workspace,
  toolId,
}: {
  admin: SupabaseClient;
  workspace: WorkspaceRow;
  toolId: string;
}) {
  const [history, membersRes] = await Promise.all([
    getCreditHistory(admin, workspace.id, toolId),
    admin
      .from("members")
      .select("user_id, display_name")
      .eq("workspace_id", workspace.id),
  ]);
  if (history.length === 0) return null;
  const nameByUser = new Map(
    ((membersRes.data ?? []) as { user_id: string; display_name: string }[]).map(
      (m) => [m.user_id, m.display_name],
    ),
  );

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">
        Credit history
      </h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        Every builder-set credit, on the record.
      </p>
      <ul className="mt-4 space-y-2.5">
        {history.map((change) => {
          const who =
            (change.changed_by && nameByUser.get(change.changed_by)) ||
            "former member";
          const line =
            change.new_value === null
              ? "went back to the suggested credit"
              : change.old_value === null
                ? `set the credit to ${fmtNum(Number(change.new_value))} min/run`
                : `changed the credit ${fmtNum(Number(change.old_value))} → ${fmtNum(Number(change.new_value))} min/run`;
          return (
            <li
              key={change.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.8125rem]"
            >
              <span className="font-medium text-foreground">{who}</span>
              <span className="text-foreground-secondary">{line}</span>
              <span className="font-mono text-xs text-foreground-muted">
                {fmtStamp(change.created_at, workspace.timezone)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function withParams(
  basePath: string,
  entries: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Origin of the current request — inlined into the capture snippets. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
