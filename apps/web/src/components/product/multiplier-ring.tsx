"use client";

import * as React from "react";
import { motion } from "motion/react";
import { MULTIPLIER_HOURS_30D, multiplierProgress, tierFor } from "@positiveroi/core";
import { cn } from "@/lib/utils";

export interface MultiplierRingProps {
  /** Credited hours in the trailing 30 days. */
  hours30d: number;
  /** Total runs ever — decides whether a tier is shown at all. */
  totalRuns: number;
  /** Outer diameter in px. */
  size?: number;
  className?: string;
}

/**
 * Radial progress toward the Multiplier badge (180 credited hours / 30 days).
 * Tier label in the center; the stroke turns into the accent gradient with a
 * soft glow once the badge is earned.
 */
function MultiplierRing({
  hours30d,
  totalRuns,
  size = 200,
  className,
}: MultiplierRingProps) {
  const progress = Math.min(1, multiplierProgress(hours30d));
  const earned = hours30d >= MULTIPLIER_HOURS_30D;
  const tier = tierFor(hours30d, totalRuns);
  const pct = Math.round(progress * 100);

  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gradientId = React.useId();

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      role="img"
      aria-label={`${formatHours(hours30d)} of ${MULTIPLIER_HOURS_30D} saved hours in the last 30 days — ${pct}% of a full-time job`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {earned && (
          <motion.div
            aria-hidden
            className="absolute inset-2 rounded-full"
            style={{ background: "var(--gradient-accent)", filter: "blur(18px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.35, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="relative -rotate-90"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-hover)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--subtle)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={earned ? `url(#${gradientId})` : "var(--accent)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - progress) }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            className="numeral text-4xl leading-none text-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {formatHours(hours30d)}h
          </motion.span>
          <span className="mt-1 text-xs text-foreground-muted">
            of {MULTIPLIER_HOURS_30D}h
          </span>
          {tier && (
            <motion.span
              className={cn(
                "mt-2 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                earned ? "text-accent-foreground" : "bg-accent-soft text-accent",
              )}
              style={earned ? { background: "var(--gradient-accent)" } : undefined}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8, type: "spring", bounce: 0.4 }}
            >
              {tier.label}
            </motion.span>
          )}
        </div>
      </div>
      <p className="mt-3 max-w-[220px] text-center text-[0.8125rem] leading-snug text-foreground-secondary">
        {totalRuns === 0
          ? "Your multiplier starts at run one."
          : earned
            ? "A full-time job's worth of saved time. Earned, not claimed."
            : `${pct}% of a full-time job, at the undercounted rate.`}
      </p>
    </div>
  );
}

function formatHours(h: number): string {
  if (Number.isInteger(h)) return String(h);
  return h.toFixed(1).replace(/\.0$/, "");
}

export { MultiplierRing };
