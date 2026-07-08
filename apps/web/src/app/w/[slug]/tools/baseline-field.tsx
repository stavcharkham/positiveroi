"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import {
  RAW_ESTIMATE_MAX_DASHBOARD,
  RAW_ESTIMATE_SOFT_WARNING,
} from "@positiveroi/core";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [5, 15, 30, 60, 120];

export interface BaselineFieldProps {
  value: number;
  onChange: (next: number) => void;
  id?: string;
  className?: string;
}

/**
 * Minute stepper + presets for the baseline ("how long did one round take by
 * hand?"). Clamps to the 480-minute hard cap and shows the soft warning above
 * 240 — the same guardrails the server enforces.
 */
function BaselineField({ value, onChange, id, className }: BaselineFieldProps) {
  function set(next: number) {
    if (!Number.isFinite(next)) {
      onChange(0);
      return;
    }
    // Round to the column's 2dp scale, then clamp to the hard cap.
    const rounded = Math.round(next * 100) / 100;
    onChange(Math.min(Math.max(rounded, 0), RAW_ESTIMATE_MAX_DASHBOARD));
  }

  function stepDown() {
    if (value <= 5) set(1);
    else set(Math.max(1, Math.ceil(value / 5) * 5 - 5));
  }

  function stepUp() {
    if (value < 1) set(1);
    else if (value < 5) set(5);
    else set(Math.floor(value / 5) * 5 + 5);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <StepButton label="Fewer minutes" onClick={stepDown} disabled={value <= 1}>
          <Minus className="size-4" aria-hidden />
        </StepButton>
        <div className="relative w-28">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={1}
            max={RAW_ESTIMATE_MAX_DASHBOARD}
            value={value || ""}
            onChange={(e) => set(e.target.valueAsNumber)}
            className="numeral h-11 pr-10 text-center text-xl"
            aria-label="Baseline minutes per run, by hand"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[0.6875rem] text-foreground-muted">
            min
          </span>
        </div>
        <StepButton
          label="More minutes"
          onClick={stepUp}
          disabled={value >= RAW_ESTIMATE_MAX_DASHBOARD}
        >
          <Plus className="size-4" aria-hidden />
        </StepButton>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => set(preset)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors",
              value === preset
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-foreground-secondary hover:border-accent/50 hover:text-foreground",
            )}
          >
            {preset}
          </button>
        ))}
      </div>

      {value >= RAW_ESTIMATE_MAX_DASHBOARD ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning">
          {RAW_ESTIMATE_MAX_DASHBOARD} minutes is the hard cap: one full
          working day per run.
        </p>
      ) : value > RAW_ESTIMATE_SOFT_WARNING ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning">
          Over {RAW_ESTIMATE_SOFT_WARNING} minutes is a big claim. If that is
          what it really took, keep it. If you are not sure, take a lower
          number.
        </p>
      ) : null}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-foreground-secondary shadow-xs transition-colors hover:bg-subtle hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export { BaselineField };
