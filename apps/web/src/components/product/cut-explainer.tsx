"use client";

import * as React from "react";
import {
  CONSERVATISM_FACTOR,
} from "@positiveroi/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "How the cut works", as a popup — the wizard must never navigate away
 * and lose the builder's answers. The full methodology page opens in a
 * new tab for anyone who wants the long version.
 */
function CutExplainer({
  triggerLabel = "How the cut works",
  className,
}: {
  triggerLabel?: string;
  className?: string;
}) {
  const cutPct = Math.round((1 - CONSERVATISM_FACTOR) * 100);
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "cursor-pointer text-left font-sans font-medium text-accent hover:underline",
          className,
        )}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How the cut works</DialogTitle>
          <DialogDescription>
            Trust is everything when you measure your own tools, so every
            claim is cut before a single minute counts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-foreground-secondary">
          <p>
            <span className="font-medium text-foreground">
              The conservatism cut, −{cutPct}%.
            </span>{" "}
            Only {Math.round(CONSERVATISM_FACTOR * 100)}% of your estimate
            counts. This absorbs optimism, runs that partially fail, and the
            overhead the estimate forgot.
          </p>
          <p>
            <span className="font-medium text-foreground">
              A person still checks, ÷2.
            </span>{" "}
            If someone still reviews, edits, or approves what comes out, the
            saved time is halved again. The tool removed part of the work,
            not all of it.
          </p>
          <p>
            Deliberately low numbers hold up when someone questions them. If
            you know the real number, you can set it yourself. It gets a
            builder-set label wherever it appears.
          </p>
          <a
            href="/methodology"
            target="_blank"
            rel="noreferrer"
            className="inline-block font-medium text-accent hover:underline"
          >
            Read the full methodology →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CutExplainer };
