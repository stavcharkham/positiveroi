import * as React from "react";
import { cn } from "@/lib/utils";

/** The drawn lightning mark in its accent-soft square — same glyph as login. */
function LightningMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5 text-accent"
        fill="currentColor"
        aria-hidden
      >
        <path d="M13 2 4.5 13.5h5L10 22l8.5-11.5h-5L13 2Z" />
      </svg>
    </span>
  );
}

/** Mark + name, used in the marketing header and footer. */
function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LightningMark />
      <span className="numeral text-lg leading-none text-foreground">
        PositiveROI
      </span>
    </span>
  );
}

export { LightningMark, Wordmark };
