"use client";

import * as React from "react";
import { useInView } from "motion/react";
import { Receipt } from "@/components/product/receipt";

/**
 * Mounts its children the first time it scrolls into view, so mount-time
 * animations (like the MultiplierRing sweep) play where the visitor can
 * actually see them. `fallback` reserves the layout until then.
 */
function InViewMount({
  children,
  fallback,
  className,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  return (
    <div ref={ref} className={className}>
      {inView ? children : fallback}
    </div>
  );
}

/**
 * The wizard's Receipt animation, replayed when scrolled into view:
 * 45 min baseline, high judgment, down to 13.5 credited. Before the trigger,
 * an invisible static copy holds the exact layout.
 */
function ReceiptReplay({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  return (
    <div ref={ref} className={className}>
      {inView ? (
        <Receipt rawMinutes={45} highJudgment animate closingLine />
      ) : (
        <div aria-hidden className="invisible">
          <Receipt rawMinutes={45} highJudgment closingLine />
        </div>
      )}
    </div>
  );
}

export { InViewMount, ReceiptReplay };
