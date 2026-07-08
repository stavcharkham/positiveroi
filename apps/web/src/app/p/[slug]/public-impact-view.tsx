import * as React from "react";
import Link from "next/link";
import { GITHUB_URL } from "@positiveroi/core";
import { RunsSparkline } from "@/components/product/runs-sparkline";
import { UndercountedTag } from "@/components/product/stat-tile";
import { cn } from "@/lib/utils";

/**
 * The shareable proof page, as one presentational component. Rendered by
 * /p/[slug] (server, ISR) and by the settings live preview (client) — both
 * pass the same data shape, so what admins preview is what the world sees.
 * No hooks, no server imports: it must work on both sides.
 */

export interface PublicImpactData {
  workspaceName: string;
  /** ISO 4217 code used only for formatting the money figure. */
  currency: string;
  /** Credited hours, trailing quarter, is_test excluded. */
  hours: number;
  runs: number;
  builders: number;
  multipliers: number;
  /** Whole currency units: credited hours × workspace rate. */
  money: number;
  /** Weekly credited hours, oldest bucket first. */
  trend: number[];
  /** Top tools by credited hours — names and hours only. */
  topTools: { name: string; hours: number }[];
  /** Trailing-quarter window, ISO timestamps. */
  periodFrom: string;
  periodTo: string;
}

export interface PublicConfig {
  show_tools: boolean;
  show_builders: boolean;
  show_money: boolean;
}

export interface PublicImpactViewProps {
  data: PublicImpactData;
  config: PublicConfig;
  className?: string;
}

const STAT_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

function PublicImpactView({ data, config, className }: PublicImpactViewProps) {
  const stats: { label: string; value: string; sub?: string }[] = [
    { label: "Runs measured", value: formatCount(data.runs) },
  ];
  if (config.show_builders) {
    stats.push(
      { label: "Builders active", value: formatCount(data.builders) },
      { label: "Multipliers earned", value: formatCount(data.multipliers) },
    );
  }
  if (config.show_money) {
    stats.push({
      label: "Value created",
      value: formatMoney(data.money, data.currency),
    });
  }

  return (
    <div className={cn("bg-background text-foreground", className)}>
      <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-accent-soft">
              <LightningMark className="size-3.5 text-accent" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              PositiveROI
            </span>
          </Link>
          <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-foreground-muted">
            Impact report
          </span>
        </header>

        <section className="mt-14 sm:mt-20">
          <p className="font-mono text-xs uppercase tracking-wider text-foreground-muted">
            {formatRange(data.periodFrom, data.periodTo)} · trailing quarter
          </p>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-medium leading-[1.12] tracking-tight sm:text-[3.25rem]">
            {data.workspaceName}&rsquo;s builders saved{" "}
            <span className="numeral whitespace-nowrap text-accent">
              {formatHours(data.hours)} hours
            </span>{" "}
            this quarter
          </h1>
          <div className="mt-6 flex flex-wrap items-start gap-x-3 gap-y-2">
            <UndercountedTag className="mt-0.5" />
            <p className="max-w-lg text-sm leading-relaxed text-foreground-secondary">
              Every run is measured. The minutes are deliberately conservative:
              each claimed baseline takes a 40% confidence cut, then credit is
              halved again when a human decision stays in the loop.
            </p>
          </div>
        </section>

        <section className="mt-12" aria-label="Headline numbers">
          <div
            className={cn(
              "grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border",
              stats.length > 1 && "grid-cols-2",
              STAT_COLS[stats.length] ?? "sm:grid-cols-4",
            )}
          >
            {stats.map((s) => (
              <div key={s.label} className="bg-surface px-5 py-4">
                <p className="text-[0.8125rem] font-medium text-foreground-secondary">
                  {s.label}
                </p>
                <p className="numeral mt-1 text-3xl text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-label="Weekly trend">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-foreground">
              Credited hours per week
            </h2>
            <span className="font-mono text-[0.6875rem] text-foreground-muted">
              last 13 weeks
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-surface p-5">
            <RunsSparkline
              values={data.trend}
              width={640}
              height={120}
              className="h-auto w-full"
              aria-label="Credited hours saved per week over the trailing quarter"
            />
          </div>
        </section>

        {config.show_tools && data.topTools.length > 0 && (
          <section className="mt-12" aria-label="Top tools">
            <h2 className="text-sm font-semibold text-foreground">
              Where the time went
            </h2>
            <ol className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {data.topTools.map((tool, i) => (
                <li
                  key={`${tool.name}-${i}`}
                  className="flex items-baseline gap-4 px-5 py-3.5"
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-foreground-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {tool.name}
                  </span>
                  <span className="numeral text-xl text-foreground">
                    {formatHours(tool.hours)}
                  </span>
                  <span className="text-xs text-foreground-muted">hrs</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-16 border-t border-border pt-6 sm:mt-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground-secondary">
              Counted with{" "}
              <span className="font-medium text-foreground">PositiveROI</span>{" "}
              using the{" "}
              <Link
                href="/methodology"
                className="font-medium text-accent hover:underline"
              >
                Undercount methodology
              </Link>
              .
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground"
            >
              Open source on GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function LightningMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M13 2 4.5 13.5h5L10 22l8.5-11.5h-5L13 2Z" />
    </svg>
  );
}

const countFormat = new Intl.NumberFormat("en-US");

function formatCount(n: number): string {
  return countFormat.format(n);
}

function formatHours(h: number): string {
  if (h >= 100) return countFormat.format(Math.round(h));
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(h);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${countFormat.format(Math.round(amount))} ${currency}`;
  }
}

function formatRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const year = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day.format(from)} to ${year.format(to)}`;
}

export { PublicImpactView, LightningMark };
