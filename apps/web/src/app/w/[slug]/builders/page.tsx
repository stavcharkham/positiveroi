import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { MULTIPLIER_HOURS_30D, tierFor } from "@positiveroi/core";
import { leaderboards } from "@/lib/aggregates";
import { maybeAwardMultiplier } from "@/lib/badges";
import { requireMember } from "@/lib/guards";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { UndercountedTag } from "@/components/product/stat-tile";
import { TierBadge } from "@/components/product/tier-badge";
import {
  allTimePeriod,
  listMembers,
  multiplierBadges,
  periodFromParam,
  toolCountsByOwner,
  trailing30Period,
} from "../_lib/data";
import {
  formatHours,
  formatNumber,
  monthYear,
  normalizePeriodParam,
  periodLabel,
  withPeriod,
} from "../_lib/format";

export const metadata: Metadata = { title: "Builders" };

interface BuilderPageRow {
  userId: string;
  displayName: string;
  departed: boolean;
  hoursPeriod: number;
  runsPeriod: number;
  hours30d: number;
  runsAllTime: number;
  toolCount: number;
  tier: ReturnType<typeof tierFor>;
  multiplierEarnedAt: string | null;
}

export default async function BuildersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { workspace } = await requireMember(slug);

  const periodName = normalizePeriodParam(sp.period);
  const period = periodFromParam(periodName, workspace);
  const label = periodLabel(periodName);
  const base = `/w/${slug}`;

  const [boardsPeriod, boards30, boardsAll, members, toolCounts] =
    await Promise.all([
      leaderboards(workspace.id, period),
      leaderboards(workspace.id, trailing30Period()),
      leaderboards(workspace.id, allTimePeriod(workspace)),
      listMembers(workspace.id),
      toolCountsByOwner(workspace.id),
    ]);

  const periodBy = new Map(boardsPeriod.builders.map((b) => [b.userId, b]));
  const trailingBy = new Map(boards30.builders.map((b) => [b.userId, b]));
  const allTimeBy = new Map(boardsAll.builders.map((b) => [b.userId, b]));

  // Lazy award pass — anyone whose trailing-30d hours qualify gets the
  // permanent badge now, before we read the badge table.
  await Promise.all(
    boards30.builders
      .filter((b) => b.hours >= MULTIPLIER_HOURS_30D)
      .map((b) => maybeAwardMultiplier(workspace.id, b.userId, b.hours)),
  );
  const badges = await multiplierBadges(workspace.id);

  // Every current member, plus departed builders whose runs still count.
  const userIds = new Set<string>([
    ...members.map((m) => m.userId),
    ...boardsAll.builders.map((b) => b.userId),
  ]);
  const nameByMember = new Map(members.map((m) => [m.userId, m.displayName]));

  const rows: BuilderPageRow[] = [...userIds].map((userId) => {
    const memberName = nameByMember.get(userId);
    const hours30d = trailingBy.get(userId)?.hours ?? 0;
    const runsAllTime = allTimeBy.get(userId)?.runs ?? 0;
    return {
      userId,
      displayName: memberName || "Former member",
      departed: !memberName,
      hoursPeriod: periodBy.get(userId)?.hours ?? 0,
      runsPeriod: periodBy.get(userId)?.runs ?? 0,
      hours30d,
      runsAllTime,
      toolCount: toolCounts.get(userId) ?? 0,
      tier: tierFor(hours30d, runsAllTime),
      multiplierEarnedAt: badges.get(userId) ?? null,
    };
  });

  rows.sort(
    (a, b) =>
      b.hoursPeriod - a.hoursPeriod ||
      b.runsPeriod - a.runsPeriod ||
      a.displayName.localeCompare(b.displayName),
  );

  const maxHours = rows[0]?.hoursPeriod ?? 0;

  return (
    <>
      <PageHeader
        title="Builders"
        description={`Everyone whose tools credited time ${label}. Tiers follow the trailing 30 days.`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No builders yet"
          body="Invite your team from Settings — every member shows up here once they join."
        />
      ) : (
        <Card>
          {/* Column heads */}
          <div className="hidden items-center gap-4 border-b border-border px-5 py-2.5 text-xs font-medium text-foreground-secondary sm:flex">
            <span className="w-6" aria-hidden />
            <span className="flex-1">Builder</span>
            <span className="flex w-28 items-center justify-end gap-1.5">
              Hours <UndercountedTag />
            </span>
            <span className="w-16 text-right">Runs</span>
            <span className="w-14 text-right">Tools</span>
          </div>

          <ol>
            {rows.map((row, i) => (
              <li
                key={row.userId}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  href={withPeriod(
                    `${base}/tools?owner=${encodeURIComponent(row.userId)}`,
                    periodName,
                  )}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-subtle/60 sm:flex-nowrap"
                  aria-label={`See ${row.displayName}'s tools and runs`}
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-foreground-muted">
                    {i + 1}
                  </span>
                  <Avatar
                    name={row.displayName}
                    size="md"
                    className={row.departed ? "opacity-60" : undefined}
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={
                        row.departed
                          ? "truncate text-sm italic text-foreground-muted"
                          : "truncate text-sm font-medium text-foreground"
                      }
                    >
                      {row.displayName}
                    </span>
                    {row.tier && (
                      <TierBadge
                        tierKey={row.tier.key}
                        earnedLabel={
                          row.tier.hours >= MULTIPLIER_HOURS_30D &&
                          row.multiplierEarnedAt
                            ? `first earned ${monthYear(row.multiplierEarnedAt)}`
                            : undefined
                        }
                      />
                    )}
                    {row.multiplierEarnedAt &&
                      (!row.tier || row.tier.hours < MULTIPLIER_HOURS_30D) && (
                        <TierBadge
                          tierKey="multiplier"
                          earnedLabel={`first earned ${monthYear(row.multiplierEarnedAt)}`}
                        />
                      )}
                  </span>
                  <span className="w-28 shrink-0 text-right">
                    <span className="numeral text-xl leading-none text-foreground">
                      {formatHours(row.hoursPeriod)}h
                    </span>
                    <HoursBar value={row.hoursPeriod} max={maxHours} />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums text-foreground-secondary">
                    {formatNumber(row.runsPeriod)}
                  </span>
                  <span className="w-14 shrink-0 text-right text-sm tabular-nums text-foreground-secondary">
                    {formatNumber(row.toolCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

/** Thin proportional bar — magnitude at a glance, kept quiet. */
function HoursBar({ value, max }: { value: number; max: number }) {
  if (max <= 0) return null;
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <span className="mt-1.5 block h-0.5 w-full rounded-full bg-subtle" aria-hidden>
      <span
        className="block h-0.5 rounded-full bg-accent/70"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
