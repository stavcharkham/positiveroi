import Link from "next/link";
import { UndercountedTag } from "@/components/product/stat-tile";
import { cn } from "@/lib/utils";

/**
 * A drillable headline stat: the whole tile is one link down to the rows
 * behind the number, while inner controls (the undercounted chip, the admin
 * rate edit) sit above the link on their own layer. Visually identical to
 * StatTile — no dead-end numbers.
 */
function HeadlineTile({
  href,
  drillLabel,
  label,
  value,
  sub,
  undercounted = false,
  action,
  size = "md",
  className,
}: {
  href: string;
  /** Accessible name for the drill link, e.g. "See the tools behind the hours". */
  drillLabel: string;
  label: string;
  value: string;
  sub?: string;
  undercounted?: boolean;
  /** Extra interactive control, top-right (admin rate edit). */
  action?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("group relative h-full", className)}>
      <Link
        href={href}
        aria-label={drillLabel}
        className="absolute inset-0 z-[1] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <div className="h-full rounded-lg border border-border bg-surface p-5 shadow-xs transition-colors group-hover:border-accent/40">
        <div className="flex items-center gap-2">
          <span className="text-[0.8125rem] font-medium text-foreground-secondary">
            {label}
          </span>
          {undercounted && (
            <span className="relative z-10">
              <UndercountedTag />
            </span>
          )}
        </div>
        <div
          className={cn(
            "numeral mt-1.5 leading-none text-foreground",
            size === "lg" ? "text-[3.5rem]" : "text-[2.75rem]",
          )}
        >
          {value}
        </div>
        {sub && (
          <p className="mt-2 text-[0.8125rem] text-foreground-muted">{sub}</p>
        )}
      </div>
      {action && <div className="absolute right-4 top-4 z-10">{action}</div>}
    </div>
  );
}

export { HeadlineTile };
