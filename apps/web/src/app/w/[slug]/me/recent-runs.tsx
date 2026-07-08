"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SourceBadge } from "@/components/product/source-badge";
import { cn } from "@/lib/utils";
import type { RunRow } from "../_lib/data";
import { timeAgo } from "../_lib/format";
import { recentRunsAction } from "./actions";

const POLL_MS = 5000;

/**
 * The last 10 of the builder's runs, refreshed every 5 seconds. Rows expand
 * to the full event — every headline number drills down to exactly these.
 */
function RecentRuns({
  workspaceSlug,
  initial,
}: {
  workspaceSlug: string;
  initial: RunRow[];
}) {
  const [runs, setRuns] = React.useState<RunRow[]>(initial);
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let inFlight = false;
    const id = setInterval(() => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      recentRunsAction(workspaceSlug)
        .then((next) => setRuns(next))
        .catch(() => {
          // Transient poll failure — keep showing the last good list.
        })
        .finally(() => {
          inFlight = false;
        });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [workspaceSlug]);

  if (runs.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-foreground-muted">
        No runs yet. They appear here seconds after they land — this list
        refreshes on its own.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {runs.map((run) => {
        const open = openId === run.id;
        return (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : run.id)}
              aria-expanded={open}
              className="flex w-full cursor-pointer items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-subtle/60"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {run.toolName}
              </span>
              <SourceBadge source={run.source} short />
              <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
                +{formatMinutes(run.minutes)} min
              </span>
              <span
                className="w-20 shrink-0 text-right text-xs text-foreground-muted"
                suppressHydrationWarning
              >
                {timeAgo(run.occurredAt)}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 text-foreground-muted transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && <RunDetail run={run} workspaceSlug={workspaceSlug} />}
          </li>
        );
      })}
    </ul>
  );
}

/** The full event behind the row — the drill path's last stop. */
function RunDetail({ run, workspaceSlug }: { run: RunRow; workspaceSlug: string }) {
  return (
    <div className="mb-2.5 rounded-md border border-border bg-subtle/40 px-4 py-3">
      <dl className="grid gap-x-6 gap-y-1.5 text-[0.8125rem] sm:grid-cols-2">
        <DetailRow label="Tool">
          <Link
            href={`/w/${workspaceSlug}/tools/${run.toolId}`}
            className="font-medium text-accent hover:underline"
          >
            {run.toolName}
          </Link>
        </DetailRow>
        <DetailRow label="Occurred">
          <span suppressHydrationWarning>
            {new Date(run.occurredAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </DetailRow>
        <DetailRow label="Credited">
          {formatMinutes(run.minutes)} min
          {run.overridden && (
            <span className="ml-1.5 text-foreground-muted">(overridden on this run)</span>
          )}
        </DetailRow>
        <DetailRow label="Source">
          <SourceBadge source={run.source} />
        </DetailRow>
        {run.surface && <DetailRow label="Surface">{run.surface}</DetailRow>}
        <DetailRow label="Event id">
          <span className="font-mono text-xs">{run.id}</span>
        </DetailRow>
      </dl>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-16 shrink-0 text-foreground-muted">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function formatMinutes(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(1).replace(/\.0$/, "");
}

export { RecentRuns };
