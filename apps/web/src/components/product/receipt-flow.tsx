"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  fmtMinutes,
  receiptStages,
  type ReceiptStage,
} from "@/lib/receipt-stages";
import { cn } from "@/lib/utils";

export interface ReceiptFlowProps {
  /** Raw baseline minutes as claimed by the builder. */
  rawMinutes: number;
  /** null = the judgment question is still unanswered. */
  highJudgment: boolean | null;
  /** Builder-set credit when it differs from the suggestion. */
  overrideMinutes?: number;
  /** Show the closing line + methodology link. */
  closingLine?: boolean;
  /** Rendered when the builder can set their own number right here. */
  onAdjust?: () => void;
  className?: string;
}

const STAGE_LABELS: Record<ReceiptStage["key"], string> = {
  claim: "You said",
  trust: "Trust cut −40%",
  judgment: "A person still checks ÷2",
};

const STAGE_BAR: Record<ReceiptStage["key"], string> = {
  claim: "bg-foreground/25",
  trust: "bg-accent/55",
  judgment: "bg-accent/55",
};

/**
 * The receipt as a flow: quiet until there is a claim, then the cuts play
 * out bar by bar — claim, trust cut, judgment cut — ending on the credited
 * number. The trust framing leads; the math is the same frozen core
 * function behind every credited number in the product.
 */
function ReceiptFlow({
  rawMinutes,
  highJudgment,
  overrideMinutes,
  closingLine = false,
  onAdjust,
  className,
}: ReceiptFlowProps) {
  const reduced = useReducedMotion() ?? false;
  const stages = receiptStages(rawMinutes, highJudgment === true);
  if (!stages) return null;

  const suggested = stages[stages.length - 1]!.minutes;
  const override =
    overrideMinutes !== undefined &&
    Number.isFinite(overrideMinutes) &&
    overrideMinutes !== suggested
      ? overrideMinutes
      : null;
  const credited = override ?? suggested;
  // The final bar reflects what is actually credited, capped at the claim.
  const creditedShare = Math.min(credited / rawMinutes, 1);

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
        {override !== null && (
          <span className="rounded-full bg-accent-soft px-2 py-px text-[0.6875rem] lowercase text-accent">
            builder-set
          </span>
        )}
      </div>

      <p className="border-b border-dashed border-border px-4 py-3 font-sans text-xs leading-relaxed text-foreground-secondary">
        Trust is everything when you measure your own tools. So we credit
        less than you claim, on purpose.
      </p>

      <div className="space-y-3 px-4 py-3.5">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          const share = isLast && override !== null ? creditedShare : stage.share;
          const minutes = isLast && override !== null ? credited : stage.minutes;
          return (
            <StageRow
              key={stage.key}
              index={i}
              reduced={reduced}
              label={
                isLast && override !== null
                  ? "You set it to"
                  : STAGE_LABELS[stage.key]
              }
              minutes={minutes}
              share={share}
              prevShare={i === 0 ? 1 : stages[i - 1]!.share}
              barClass={STAGE_BAR[stage.key]}
              muted={!isLast && i > 0}
            />
          );
        })}
      </div>

      <div className="border-t border-dashed border-border px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[0.8125rem] font-medium text-foreground">
            Credited, each run
          </span>
          <span className="numeral text-2xl leading-none text-accent">
            <AnimatedMinutes from={rawMinutes} to={credited} reduced={reduced} />
            <span className="ml-1 font-mono text-[0.6875rem] text-foreground-muted">
              min/run
            </span>
          </span>
        </div>

        {highJudgment === null ? (
          <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
            One question left: if a person still checks each run, this halves.
          </p>
        ) : (
          <>
            {override !== null && (
              <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
                Our suggestion was {fmtMinutes(suggested)} min, so this number
                is labeled builder-set wherever it appears.
              </p>
            )}
            {onAdjust && override === null && (
              <button
                type="button"
                onClick={onAdjust}
                className="mt-2 cursor-pointer font-sans text-xs font-medium text-accent hover:underline"
              >
                Know the real number? Set it yourself
              </button>
            )}
            {closingLine && (
              <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
                {override === null ? (
                  <>
                    Your tool earns {fmtMinutes(credited)} of the{" "}
                    {fmtMinutes(rawMinutes)} minutes you claimed. When someone
                    questions this number, it holds up.
                  </>
                ) : (
                  <>
                    You set this tool&apos;s credit to {fmtMinutes(credited)}{" "}
                    min per run.
                  </>
                )}{" "}
                <Link href="/methodology" className="text-accent hover:underline">
                  How the cut works
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StageRow({
  index,
  reduced,
  label,
  minutes,
  share,
  prevShare,
  barClass,
  muted,
}: {
  index: number;
  reduced: boolean;
  label: string;
  minutes: number;
  share: number;
  prevShare: number;
  barClass: string;
  muted: boolean;
}) {
  const delay = reduced ? 0 : 0.15 + index * 0.45;
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.3, delay, ease: "easeOut" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={cn(
            "text-[0.8125rem]",
            muted ? "text-foreground-secondary" : "text-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-[0.8125rem] tabular-nums",
            muted ? "text-foreground-secondary" : "text-foreground",
          )}
        >
          {fmtMinutes(minutes)} min
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
        <motion.div
          className={cn("h-full rounded-full", barClass)}
          initial={reduced ? false : { width: `${prevShare * 100}%` }}
          animate={{ width: `${share * 100}%` }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 90, damping: 18, delay: delay + 0.15 }
          }
        />
      </div>
    </motion.div>
  );
}

/** Counts down from the claim to the credited number as the bars settle. */
function AnimatedMinutes({
  from,
  to,
  reduced,
}: {
  from: number;
  to: number;
  reduced: boolean;
}) {
  const spring = useSpring(reduced ? to : from, {
    stiffness: 80,
    damping: 22,
  });
  React.useEffect(() => {
    spring.set(to);
  }, [spring, to]);
  const decimals = Number.isInteger(to) ? 0 : 2;
  const text = useTransform(spring, (v) =>
    fmtMinutes(Number(v.toFixed(decimals))),
  );
  if (reduced) return <>{fmtMinutes(to)}</>;
  return <motion.span>{text}</motion.span>;
}

export { ReceiptFlow };
