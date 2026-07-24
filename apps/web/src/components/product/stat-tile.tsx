import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Quiet label above the number, e.g. "Hours saved". */
  label: string;
  /** The big number, preformatted (e.g. "342", "2.4", "$4,120"). */
  value: string | number;
  /** Quiet supporting line under the number, e.g. "180 credited hrs/mo = 1 FTE". */
  sub?: string;
  /** Show the `undercounted` tag with the methodology popover. */
  undercounted?: boolean;
}

/**
 * Big editorial numeral + quiet label. The `undercounted` tag opens a
 * popover explaining the methodology and links to /methodology.
 */
function StatTile({
  label,
  value,
  sub,
  undercounted = false,
  className,
  ...props
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-xs",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-medium text-foreground-secondary">
          {label}
        </span>
        {undercounted && <UndercountedTag />}
      </div>
      <div className="numeral mt-1.5 text-[2.75rem] leading-none text-foreground">
        {value}
      </div>
      {sub && (
        <p className="mt-2 text-[0.8125rem] text-foreground-muted">{sub}</p>
      )}
    </div>
  );
}

/** The standalone `undercounted` chip — reusable next to any hours figure. */
function UndercountedTag({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center rounded-full border border-dashed border-accent/50 bg-accent-soft/60 px-1.5 py-px font-mono text-[0.6875rem] lowercase leading-4 text-accent transition-colors hover:border-accent",
            className,
          )}
        >
          undercounted
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-foreground-muted">
          The Undercount
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          Runs are measured. Minutes are estimates that survived two cuts.
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-foreground-secondary">
          Every claim takes a 40% trust cut, then is halved again when a
          person still checks each run.
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-foreground-secondary">
          Builders can set their own number; those are labeled builder-set on
          their receipts.
        </p>
        <Link
          href="/methodology"
          className="mt-3 inline-block text-[0.8125rem] font-medium text-accent hover:underline"
        >
          How the Undercount works &rarr;
        </Link>
      </PopoverContent>
    </Popover>
  );
}

export { StatTile, UndercountedTag };
