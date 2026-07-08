import * as React from "react";
import { MultiplierRing } from "@/components/product/multiplier-ring";
import { RunsSparkline } from "@/components/product/runs-sparkline";
import { StatTile } from "@/components/product/stat-tile";
import { cn } from "@/lib/utils";

/**
 * The hero's static dashboard mock — a designed, screenshot-like composition
 * of the real product components with sample data. Nothing here fetches,
 * ticks, or pretends to be live; the watermark says so.
 */

const SAMPLE_TOOLS = [
  {
    name: "pipeline-digest",
    perRun: "13.5 min/run",
    hours: "86h",
    spark: [2, 4, 3, 6, 5, 8, 7, 9, 8, 11, 10, 13],
  },
  {
    name: "meeting-notes-agent",
    perRun: "9 min/run",
    hours: "54h",
    spark: [1, 2, 4, 3, 5, 4, 6, 7, 6, 8, 9, 9],
  },
  {
    name: "qa-triage",
    perRun: "4.5 min/run",
    hours: "31h",
    spark: [0, 1, 1, 3, 2, 4, 3, 5, 6, 5, 7, 8],
  },
];

function DashboardPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Soft accent bloom behind the window */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[3rem] bg-accent/5 blur-3xl"
      />

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-subtle/60 px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="mx-auto rounded-md border border-border/70 bg-background px-3 py-0.5 font-mono text-[0.6875rem] text-foreground-muted">
            positiveroi.dev/w/acme
          </span>
          <span aria-hidden className="w-[54px]" />
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5">
              <span className="text-sm font-semibold text-foreground">
                Acme
              </span>
              <span className="text-[0.8125rem] text-foreground-muted">
                Company impact
              </span>
            </div>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-mono text-[0.6875rem] text-foreground-secondary">
              this month
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Hours saved"
                  value="342"
                  sub="180 credited hrs/mo = 1 FTE"
                  undercounted
                  className="p-4"
                />
                <StatTile
                  label="Runs measured"
                  value="1,204"
                  sub="across 9 live tools"
                  className="p-4"
                />
                <StatTile
                  label="Value"
                  value="$20,520"
                  sub="342h × $60/hr"
                  className="p-4"
                />
              </div>

              <div className="mt-3 rounded-lg border border-border bg-surface shadow-xs">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-[0.8125rem] font-medium text-foreground-secondary">
                    Tools
                  </span>
                  <span className="font-mono text-[0.6875rem] text-foreground-muted">
                    top 3 of 9
                  </span>
                </div>
                <ul>
                  {SAMPLE_TOOLS.map((tool) => (
                    <li
                      key={tool.name}
                      className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-foreground">
                        {tool.name}
                      </span>
                      <span className="hidden font-mono text-[0.6875rem] text-foreground-muted sm:inline">
                        {tool.perRun}
                      </span>
                      <RunsSparkline
                        values={tool.spark}
                        width={80}
                        height={24}
                        aria-label={`Run activity for ${tool.name}`}
                        className="hidden sm:block"
                      />
                      <span className="numeral w-11 text-right text-lg leading-none text-foreground">
                        {tool.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col items-center rounded-lg border border-border bg-surface p-4 shadow-xs lg:w-[15.5rem]">
              <span className="self-start text-[0.8125rem] font-medium text-foreground-secondary">
                Top builder · Dana
              </span>
              <MultiplierRing
                hours30d={112}
                totalRuns={418}
                size={168}
                className="mt-3"
              />
            </div>
          </div>
        </div>

        {/* Preview watermark */}
        <span className="absolute bottom-3 right-3 rounded-full border border-dashed border-border bg-background/85 px-2.5 py-0.5 font-mono text-[0.6875rem] lowercase text-foreground-muted">
          preview · sample data
        </span>
      </div>
    </div>
  );
}

export { DashboardPreview };
