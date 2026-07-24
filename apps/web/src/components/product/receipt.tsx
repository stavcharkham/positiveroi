"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  CONSERVATISM_FACTOR,
  computeMinutesSavedPerRun,
} from "@positiveroi/core";
import { cn } from "@/lib/utils";

export interface ReceiptProps {
  /** Raw baseline minutes as claimed by the builder. */
  rawMinutes: number;
  /** Whether the Judgment Cut (÷2) applies. */
  highJudgment: boolean;
  /**
   * Builder-set credited minutes per run. When it differs from the computed
   * suggestion, the receipt keeps the cut lines, shows the suggestion, and
   * labels the final number "Builder set". Absent = render as always.
   */
  overrideMinutes?: number;
  /** Staggered line-by-line reveal (wizard step 3). */
  animate?: boolean;
  /** Render the "test — not counted in totals" chip. */
  isTest?: boolean;
  /** Show the closing line + methodology link under the total. */
  closingLine?: boolean;
  className?: string;
}

/**
 * The Receipt — the methodology made visible. Every credited number in the
 * product traces back to this exact arithmetic, so the receipt renders it
 * like a paper slip: baseline, the cuts, the credited total.
 */
function Receipt({
  rawMinutes,
  highJudgment,
  overrideMinutes,
  animate = false,
  isTest = false,
  closingLine = false,
  className,
}: ReceiptProps) {
  const valid = Number.isFinite(rawMinutes) && rawMinutes > 0;
  const afterConfidence = valid
    ? computeMinutesSavedPerRun(rawMinutes, false)
    : null;
  const credited = valid
    ? computeMinutesSavedPerRun(rawMinutes, highJudgment)
    : null;
  const confidencePct = Math.round((1 - CONSERVATISM_FACTOR) * 100);
  // Only an override that actually differs from the suggestion is one.
  const override =
    overrideMinutes !== undefined &&
    Number.isFinite(overrideMinutes) &&
    credited !== null &&
    overrideMinutes !== credited
      ? overrideMinutes
      : null;

  const lines: { label: string; value: string; cut?: boolean }[] = [
    { label: "By hand, each time", value: valid ? `${fmt(rawMinutes)} min` : "—" },
    {
      label: `Trust cut −${confidencePct}%`,
      value: afterConfidence !== null ? `${fmt(afterConfidence)} min` : "—",
      cut: true,
    },
  ];
  if (highJudgment) {
    lines.push({
      label: "A person still checks ÷2",
      value: credited !== null ? `${fmt(credited)} min` : "—",
      cut: true,
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface font-mono shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-dashed border-border px-4 py-2.5">
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-foreground-muted">
          Your receipt
        </span>
        <span className="flex items-center gap-1.5">
          {override !== null && (
            <span className="rounded-full bg-accent-soft px-2 py-px text-[0.6875rem] lowercase text-accent">
              builder-set
            </span>
          )}
          {isTest && (
            <span className="rounded-full bg-warning-soft px-2 py-px text-[0.6875rem] lowercase text-warning">
              test — not counted in totals
            </span>
          )}
        </span>
      </div>

      <div className="px-4 py-3">
        {lines.map((line, i) => (
          <ReceiptLine key={line.label} index={i} animate={animate}>
            <span
              className={cn(
                "text-[0.8125rem]",
                line.cut ? "text-foreground-secondary" : "text-foreground",
              )}
            >
              {line.label}
            </span>
            <span
              className={cn(
                "text-[0.8125rem] tabular-nums",
                line.cut ? "text-foreground-secondary" : "text-foreground",
              )}
            >
              {line.value}
            </span>
          </ReceiptLine>
        ))}
      </div>

      <div className="border-t border-dashed border-border px-4 py-3">
        {override === null ? (
          <ReceiptLine index={lines.length} animate={animate}>
            <span className="text-[0.8125rem] font-medium text-foreground">
              Credited time
            </span>
            <span className="numeral text-2xl leading-none text-accent">
              {credited !== null ? `${fmt(credited)}` : "—"}
              <span className="ml-1 font-mono text-[0.6875rem] text-foreground-muted">
                min/run
              </span>
            </span>
          </ReceiptLine>
        ) : (
          <>
            <ReceiptLine index={lines.length} animate={animate}>
              <span className="text-[0.8125rem] text-foreground-secondary">
                Suggested credit
              </span>
              <span className="text-[0.8125rem] tabular-nums text-foreground-secondary">
                {fmt(credited!)} min/run
              </span>
            </ReceiptLine>
            <ReceiptLine index={lines.length + 1} animate={animate}>
              <span className="text-[0.8125rem] font-medium text-foreground">
                Builder set
              </span>
              <span className="numeral text-2xl leading-none text-accent">
                {fmt(override)}
                <span className="ml-1 font-mono text-[0.6875rem] text-foreground-muted">
                  min/run
                </span>
              </span>
            </ReceiptLine>
          </>
        )}
        {closingLine && valid && (
          <ReceiptLine
            index={lines.length + (override === null ? 1 : 2)}
            animate={animate}
          >
            <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
              {override === null ? (
                <>
                  Your tool earns {fmt(credited!)} of the {fmt(rawMinutes)}{" "}
                  minutes you claimed. When someone questions this number,
                  it holds up.
                </>
              ) : (
                <>
                  You set this tool&apos;s credit to {fmt(override)} min/run.
                  The suggested undercount was {fmt(credited!)}.
                </>
              )}{" "}
              <Link
                href="/methodology"
                className="text-accent hover:underline"
              >
                How the cut works
              </Link>
            </p>
          </ReceiptLine>
        )}
      </div>
    </div>
  );
}

function ReceiptLine({
  index,
  animate,
  children,
}: {
  index: number;
  animate: boolean;
  children: React.ReactNode;
}) {
  if (!animate) {
    return (
      <div className="flex items-baseline justify-between gap-4 py-1">
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className="flex items-baseline justify-between gap-4 py-1"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 + index * 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function fmt(m: number): string {
  return Number.isInteger(m)
    ? String(m)
    : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export { Receipt };
