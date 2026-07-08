import * as React from "react";
import { Medal } from "lucide-react";
import { MULTIPLIER_HOURS_30D, TIERS, type TierKey } from "@positiveroi/core";
import { cn } from "@/lib/utils";

export interface TierBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tierKey: TierKey;
  /** Permanent-award subtitle, e.g. "first earned March 2026". Multiplier only. */
  earnedLabel?: string;
}

/**
 * Display tier chip. Tiers are labels computed from trailing-30d hours —
 * Multiplier and above get the gradient treatment, everything below stays quiet.
 */
function TierBadge({ tierKey, earnedLabel, className, ...props }: TierBadgeProps) {
  const tier = TIERS.find((t) => t.key === tierKey);
  if (!tier) return null;
  const multiplier = tier.hours >= MULTIPLIER_HOURS_30D;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5",
        multiplier ? "text-accent-foreground" : "bg-accent-soft text-accent",
        className,
      )}
      style={multiplier ? { background: "var(--gradient-accent)" } : undefined}
      {...props}
    >
      {multiplier && <Medal className="size-3" aria-hidden />}
      {tier.label}
      {earnedLabel && (
        <span className={cn("font-normal", multiplier ? "opacity-80" : "text-accent/70")}>
          · {earnedLabel}
        </span>
      )}
    </span>
  );
}

export { TierBadge };
