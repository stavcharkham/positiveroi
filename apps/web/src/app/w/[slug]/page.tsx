import type { Metadata } from "next";
import Link from "next/link";
import { MoonStar } from "lucide-react";
import {
  MULTIPLIER_HOURS_30D,
  fteEquivalent,
  moneyValueCents,
} from "@positiveroi/core";
import {
  goneQuiet,
  leaderboards,
  metricTotals,
  timeseries,
  workspaceStats,
  type BuilderLeaderboardRow,
  type ToolLeaderboardRow,
} from "@/lib/aggregates";
import { requireMember } from "@/lib/guards";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { HeadlineTile } from "./_components/headline-tile";
import { RateEdit } from "./_components/rate-edit";
import { SampleDashboard } from "./_components/sample-dashboard";
import { TrendChart } from "./_components/trend-chart";
import {
  allTimePeriod,
  bucketFor,
  periodFromParam,
  zeroFillSeries,
} from "./_lib/data";
import {
  formatFte,
  formatHours,
  formatMetricValue,
  formatMoneyCents,
  formatNumber,
  normalizePeriodParam,
  periodLabel,
  timeAgo,
  withPeriod,
} from "./_lib/format";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyDashboardPage({
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
  const bucket = bucketFor(period);

  const [stats, series, boards, metrics, quiet] = await Promise.all([
    workspaceStats(workspace.id, period),
    timeseries(workspace.id, bucket, period),
    leaderboards(workspace.id, period),
    metricTotals(workspace.id, period),
    goneQuiet(workspace.id),
  ]);

  // Zero in this period — is the workspace empty, or just this slice of it?
  let allTimeRuns = stats.runs;
  if (stats.runs === 0 && periodName) {
    allTimeRuns = (await workspaceStats(workspace.id, allTimePeriod(workspace))).runs;
  }
  if (allTimeRuns === 0) {
    return (
      <>
        <PageHeader
          title={workspace.name}
          description="What your builders' AI tools save, counted conservatively."
        />
        <SampleDashboard workspaceSlug={slug} />
      </>
    );
  }

  const base = `/w/${slug}`;
  const label = periodLabel(periodName);
  const fte = fteEquivalent(stats.hours, period.periodDays);
  const money =
    workspace.hourly_rate_cents === null
      ? 0
      : moneyValueCents(stats.hours, workspace.hourly_rate_cents);
  const points = zeroFillSeries(series, bucket, period).map((b) => ({
    start: b.start,
    hours: Math.round((b.minutes / 60) * 100) / 100,
    runs: b.runs,
  }));
  const isAdmin = member.role === "admin";

  return (
    <>
      <PageHeader
        title={workspace.name}
        description={`Hours, value, and runs measured ${label}.`}
      />

      {stats.runs === 0 && (
        <div className="mb-4 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-foreground-secondary">
          No runs {label}. {formatNumber(allTimeRuns)} all-time — widen the
          period selector to see them.
        </div>
      )}

      {/* Headline stats — each one drills to the rows behind it */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HeadlineTile
          href={withPeriod(`${base}/tools`, periodName)}
          drillLabel="See the tools behind the hours"
          label="Hours saved"
          value={formatHours(stats.hours)}
          sub={`across ${formatNumber(stats.activeTools)} ${stats.activeTools === 1 ? "tool" : "tools"}`}
          undercounted
        />
        <HeadlineTile
          href={withPeriod(`${base}/builders`, periodName)}
          drillLabel="See the builders behind the multiplier"
          label="Multiplier equivalent"
          value={formatFte(fte)}
          sub={`full-time jobs · ${MULTIPLIER_HOURS_30D} credited hrs/mo = 1 FTE`}
        />
        {workspace.hourly_rate_cents !== null ? (
          <HeadlineTile
            href={withPeriod(`${base}/tools`, periodName)}
            drillLabel="See the tools behind the value"
            label="Value"
            value={formatMoneyCents(money, workspace.currency)}
            sub={`at ${formatMoneyCents(workspace.hourly_rate_cents, workspace.currency)}/hr · estimate`}
            action={
              isAdmin ? (
                <RateEdit
                  workspaceSlug={slug}
                  hourlyRateCents={workspace.hourly_rate_cents}
                  currency={workspace.currency}
                />
              ) : undefined
            }
          />
        ) : isAdmin ? (
          <HeadlineTile
            href={`${base}/settings`}
            drillLabel="Set the hourly rate in settings"
            label="Value"
            value="—"
            sub="Set an hourly rate to turn hours into money"
            action={
              <RateEdit
                workspaceSlug={slug}
                hourlyRateCents={null}
                currency={workspace.currency}
              />
            }
          />
        ) : null}
        <HeadlineTile
          href={withPeriod(`${base}/tools`, periodName)}
          drillLabel="See the runs behind this number"
          label="Runs measured"
          value={formatNumber(stats.runs)}
          sub={`${formatNumber(stats.builders)} ${stats.builders === 1 ? "builder" : "builders"} active`}
        />
      </div>

      {/* Trend */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Hours saved over time</CardTitle>
          <CardDescription>
            Credited hours per {bucket}, {label}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart points={points} bucket={bucket} />
        </CardContent>
      </Card>

      {/* Custom metrics */}
      {metrics.length > 0 && (
        <section className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m) => (
              <HeadlineTile
                key={m.metricId}
                href={withPeriod(`${base}/metrics`, periodName)}
                drillLabel={`See the events behind ${m.name}`}
                label={m.name}
                value={formatMetricValue(m.total, m.unit, workspace.currency)}
                sub={m.key}
              />
            ))}
          </div>
        </section>
      )}

      {/* Leaderboards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <LeaderboardCard
          title="Builders"
          viewAllHref={withPeriod(`${base}/builders`, periodName)}
          empty="No credited runs from any builder yet."
        >
          {boards.builders.slice(0, 5).map((b, i) => (
            <BuilderRow key={b.userId} row={b} rank={i + 1} max={boards.builders[0]?.hours ?? 0} />
          ))}
        </LeaderboardCard>
        <LeaderboardCard
          title="Tools"
          viewAllHref={withPeriod(`${base}/tools`, periodName)}
          empty="No tool has credited runs yet."
        >
          {boards.tools.slice(0, 5).map((t, i) => (
            <ToolRow
              key={t.toolId}
              row={t}
              rank={i + 1}
              max={boards.tools[0]?.hours ?? 0}
              href={withPeriod(`${base}/tools/${t.toolId}`, periodName)}
            />
          ))}
        </LeaderboardCard>
      </div>

      {/* Gone quiet — display only, no nudge buttons */}
      {quiet.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MoonStar className="size-4 text-foreground-muted" aria-hidden />
              Gone quiet
            </CardTitle>
            <CardDescription>
              Tools with prior runs but nothing in the last 14 days. Worth a
              conversation, not a chase.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="divide-y divide-border">
              {quiet.map((t) => (
                <li key={t.toolId} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={withPeriod(`${base}/tools/${t.toolId}`, periodName)}
                    className="min-w-0 truncate text-sm font-medium text-foreground hover:text-accent"
                  >
                    {t.name}
                  </Link>
                  <span className="shrink-0 text-xs text-foreground-muted">
                    last run {timeAgo(t.lastRunAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------------------

function LeaderboardCard({
  title,
  viewAllHref,
  empty,
  children,
}: {
  title: string;
  viewAllHref: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Link
          href={viewAllHref}
          className="text-[0.8125rem] font-medium text-accent hover:underline"
        >
          view all
        </Link>
      </CardHeader>
      <CardContent className="pt-4">
        {hasRows ? (
          <ol className="flex flex-col gap-1">{children}</ol>
        ) : (
          <p className="py-4 text-sm text-foreground-muted">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BuilderRow({
  row,
  rank,
  max,
}: {
  row: BuilderLeaderboardRow;
  rank: number;
  max: number;
}) {
  const departed = row.displayName === "";
  const name = departed ? "Former member" : row.displayName;
  return (
    <li className="rounded-md px-2 py-2 transition-colors hover:bg-subtle/60">
      <div className="flex items-center gap-3">
        <span className="w-4 shrink-0 text-right font-mono text-xs text-foreground-muted">
          {rank}
        </span>
        <Avatar name={name} size="sm" className={departed ? "opacity-60" : undefined} />
        <span
          className={
            departed
              ? "min-w-0 flex-1 truncate text-sm italic text-foreground-muted"
              : "min-w-0 flex-1 truncate text-sm font-medium text-foreground"
          }
        >
          {name}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {formatHours(row.hours)}h
        </span>
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-foreground-muted">
          {formatNumber(row.runs)} runs
        </span>
      </div>
      <MeterBar value={row.hours} max={max} />
    </li>
  );
}

function ToolRow({
  row,
  rank,
  max,
  href,
}: {
  row: ToolLeaderboardRow;
  rank: number;
  max: number;
  href: string;
}) {
  return (
    <li className="rounded-md px-2 py-2 transition-colors hover:bg-subtle/60">
      <div className="flex items-center gap-3">
        <span className="w-4 shrink-0 text-right font-mono text-xs text-foreground-muted">
          {rank}
        </span>
        <Link
          href={href}
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-accent"
        >
          {row.name}
        </Link>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {formatHours(row.hours)}h
        </span>
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-foreground-muted">
          {formatNumber(row.runs)} runs
        </span>
      </div>
      <MeterBar value={row.hours} max={max} />
    </li>
  );
}

/** Quiet proportional bar under a leaderboard row — data ink, kept thin. */
function MeterBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="ml-7 mt-1.5 h-0.5 rounded-full bg-subtle" aria-hidden>
      <div
        className="h-0.5 rounded-full bg-accent/70"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
