"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { EventSource } from "@positiveroi/core";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/product/source-badge";
import { cn } from "@/lib/utils";

export interface RunDisplayRow {
  id: string;
  /** Formatted server-side in the workspace timezone. */
  stamp: string;
  occurredAtIso: string;
  source: EventSource;
  /** Formatted credited minutes, e.g. "13.5". */
  minutes: string;
  overridden: boolean;
  isTest: boolean;
  /** Display name for manual runs — "added by X". */
  addedBy: string | null;
  hasIdempotencyKey: boolean;
  metadataKeys: string[];
}

/**
 * The runs table body — each row expands to the full event, because every
 * number in the product must drill down to the runs behind it.
 */
function RunsTable({ rows }: { rows: RunDisplayRow[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const open = openId === row.id;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : row.id)}
              aria-expanded={open}
              className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-subtle/60"
            >
              <span className="w-32 shrink-0 font-mono text-xs tabular-nums text-foreground-secondary">
                {row.stamp}
              </span>
              <SourceBadge source={row.source} short />
              <span className="font-mono text-xs tabular-nums text-foreground">
                {row.minutes} <span className="text-foreground-muted">min</span>
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {row.isTest && (
                  <Badge variant="warning" className="font-mono lowercase">
                    test
                  </Badge>
                )}
                {row.addedBy && (
                  <span className="truncate text-xs text-foreground-muted">
                    added by {row.addedBy}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-foreground-muted transition-transform",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </span>
            </button>

            {open && (
              <dl className="grid gap-x-6 gap-y-2 border-t border-dashed border-border bg-subtle/40 px-4 py-3 sm:grid-cols-2">
                <DetailItem label="Occurred at" value={row.occurredAtIso} mono />
                <DetailItem label="Source" value={row.source} mono />
                <DetailItem
                  label="Credited minutes"
                  value={`${row.minutes}${row.overridden ? " (overridden by the caller)" : ""}`}
                  mono
                />
                <DetailItem
                  label="Idempotency key"
                  value={row.hasIdempotencyKey ? "present" : "none"}
                  mono
                />
                <DetailItem
                  label="Metadata keys"
                  value={row.metadataKeys.length > 0 ? row.metadataKeys.join(", ") : "none"}
                  mono
                />
                {row.isTest && (
                  <DetailItem
                    label="Counted"
                    value="no — test runs never touch totals"
                  />
                )}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 break-all text-xs text-foreground-secondary",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export { RunsTable };
