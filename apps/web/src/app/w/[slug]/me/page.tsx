import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  MULTIPLIER_HOURS_30D,
  moneyValueCents,
  type ToolType,
} from "@positiveroi/core";
import { builderStats, leaderboards } from "@/lib/aggregates";
import { requireMember } from "@/lib/guards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MultiplierRing } from "@/components/product/multiplier-ring";
import { RunsSparkline } from "@/components/product/runs-sparkline";
import { TierBadge } from "@/components/product/tier-badge";
import { HeadlineTile } from "../_components/headline-tile";
import {
  multiplierState,
  myToolCards,
  periodFromParam,
  recentRunsFor,
  sourceSplit,
  toolsOwnedBy,
  type MyToolCard,
  type ToolLiveStatus,
} from "../_lib/data";
import {
  formatHours,
  formatMoneyCents,
  formatNumber,
  monthYear,
  normalizePeriodParam,
  periodLabel,
  withPeriod,
} from "../_lib/format";
import { MultiplierToast } from "./multiplier-toast";
import { RecentRuns } from "./recent-runs";

export const metadata: Metadata = { title: "My Impact" };

const TOOL_TYPE_LABEL: Record<ToolType, string> = {
  automation: "automation",
  skill: "skill",
  agent: "agent",
  app: "app",
};

export default async function BuilderDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { user, workspace } = await requireMember(slug);

  const periodName = normalizePeriodParam(sp.period);
  const period = periodFromParam(periodName, workspace);
  const label = periodLabel(periodName);
  const base = `/w/${slug}`;

  const [boards, bstats, tools] = await Promise.all([
    leaderboards(workspace.id, period),
    builderStats(workspace.id, user.id),
    toolsOwnedBy(workspace.id, user.id),
  ]);

  const mine = boards.builders.find((b) => b.userId === user.id);
  const myHours = mine?.hours ?? 0;
  const myRuns = mine?.runs ?? 0;
  const money =
    workspace.hourly_rate_cents === null
      ? null
      : moneyValueCents(myHours, workspace.hourly_rate_cents);
  const toolIds = tools.map((t) => t.id);
  const periodToolTotals = new Map(
    boards.tools.map((t) => [t.toolId, { hours: t.hours, runs: t.runs }]),
  );

  // multiplierState performs the lazy award — trailing 30 days, always.
  const [split, cards, badge, initialRuns] = await Promise.all([
    sourceSplit(workspace.id, toolIds, period),
    myToolCards(workspace.id, tools, period, periodToolTotals),
    multiplierState(workspace.id, user.id, bstats.hours30d),
    recentRunsFor(workspace.id, user.id, 10),
  ]);

  const activeToolCount = tools.filter((t) => t.status === "active").length;
  const pct = Math.min(100, Math.round(bstats.multiplierProgress * 100));

  return (
    <>
      <MultiplierToast newlyAwarded={badge.newlyAwarded} />
      <PageHeader
        title="My Impact"
        description={`What your tools saved ${label}. Counted conservatively — the numbers survive scrutiny.`}
      />

      {/* Hero: the three numbers + the ring */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <HeadlineTile
            className="sm:col-span-2"
            size="lg"
            href="#my-tools"
            drillLabel="See the tools behind the hours"
            label="Hours saved"
            value={formatHours(myHours)}
            sub={`across ${formatNumber(activeToolCount)} ${activeToolCount === 1 ? "tool" : "tools"} ${label}`}
            undercounted
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-full">
                <HeadlineTile
                  href="#recent-runs"
                  drillLabel="See the runs behind this number"
                  label="Runs measured"
                  value={formatNumber(myRuns)}
                  sub={split.length > 0 ? "hover for the per-source split" : "runs land here as they happen"}
                />
              </div>
            </TooltipTrigger>
            {split.length > 0 && (
              <TooltipContent side="bottom" align="start">
                <p className="mb-1 font-semibold">By source</p>
                <ul className="flex flex-col gap-0.5">
                  {split.map((s) => (
                    <li key={s.source} className="flex items-center justify-between gap-4">
                      <span className="font-mono lowercase">via {s.source}</span>
                      <span className="font-semibold tabular-nums">
                        {formatNumber(s.runs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            )}
          </Tooltip>
          {money !== null && workspace.hourly_rate_cents !== null && (
            <HeadlineTile
              href="#my-tools"
              drillLabel="See the tools behind the money"
              label="Money saved"
              value={formatMoneyCents(money, workspace.currency)}
              sub={`at ${formatMoneyCents(workspace.hourly_rate_cents, workspace.currency)}/hr · estimate`}
            />
          )}
        </div>

        <Card>
          <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <MultiplierRing
              hours30d={bstats.hours30d}
              totalRuns={bstats.totalRuns}
              size={190}
            />
            {badge.earnedAt && (
              <TierBadge
                tierKey="multiplier"
                earnedLabel={`first earned ${monthYear(badge.earnedAt)}`}
              />
            )}
            <p className="text-center text-xs leading-relaxed text-foreground-muted">
              {formatHours(bstats.hours30d)}h of {MULTIPLIER_HOURS_30D}h ·{" "}
              {pct}% of a full-time job. Trailing 30 days — it decays honestly
              and never resets on a calendar month.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My tools */}
      <section id="my-tools" className="mt-10 scroll-mt-20">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          My tools
        </h2>
        <p className="mt-0.5 text-sm text-foreground-secondary">
          Each card drills into its runs — no number here is a dead end.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ToolCard
              key={card.id}
              card={card}
              href={withPeriod(`${base}/tools/${card.id}`, periodName)}
              hoursLabel={label}
            />
          ))}
          <Link
            href={`${base}/tools/new`}
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/50 p-5 text-sm font-medium text-foreground-secondary transition-colors hover:border-accent/60 hover:text-accent"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-subtle">
              <Plus className="size-4" aria-hidden />
            </span>
            Register a tool
          </Link>
        </div>
      </section>

      {/* Recent runs */}
      <section id="recent-runs" className="mt-10 scroll-mt-20">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Recent runs
            </h2>
            <p className="mt-0.5 text-sm text-foreground-secondary">
              Your last 10 measured runs — the rows behind every number above.
            </p>
          </div>
          <span className="shrink-0 text-xs text-foreground-muted">
            refreshes every 5s
          </span>
        </div>
        <Card className="mt-4">
          <CardContent className="px-4 py-1.5">
            <RecentRuns workspaceSlug={slug} initial={initialRuns} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tool card
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  ToolLiveStatus,
  { label: string; variant: "success" | "neutral" | "warning" }
> = {
  live: { label: "live", variant: "success" },
  awaiting: { label: "awaiting first run", variant: "neutral" },
  quiet: { label: "quiet 14d", variant: "warning" },
};

function ToolCard({
  card,
  href,
  hoursLabel,
}: {
  card: MyToolCard;
  href: string;
  hoursLabel: string;
}) {
  const status = STATUS_META[card.status];
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs transition-colors hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent">
            {card.name}
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {TOOL_TYPE_LABEL[card.type]} · {formatMinutesPerRun(card.minutesPerRun)}{" "}
            min/run credited
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="numeral text-2xl leading-none text-foreground">
            {formatHours(card.hoursInPeriod)}h
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {formatNumber(card.runsInPeriod)} runs {hoursLabel}
          </p>
        </div>
        <RunsSparkline
          values={card.sparkline}
          width={104}
          height={30}
          aria-label={`Run activity for ${card.name}`}
        />
      </div>
    </Link>
  );
}

function formatMinutesPerRun(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(1).replace(/\.0$/, "");
}
