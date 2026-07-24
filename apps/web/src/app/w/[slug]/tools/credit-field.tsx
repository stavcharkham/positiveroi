"use client";

import * as React from "react";
import { RAW_ESTIMATE_MAX_DASHBOARD } from "@positiveroi/core";
import { Input } from "@/components/ui/input";
import { fmtNum } from "./tool-meta";
import { cn } from "@/lib/utils";

export interface CreditFieldProps {
  /** The suggested Undercount for the current baseline + judgment. */
  suggested: number;
  /** Builder-set credit; null = the suggestion applies. */
  value: number | null;
  onChange: (next: number | null) => void;
  id?: string;
  className?: string;
}

/**
 * The credited-minutes editor. Empty = the suggested Undercount applies; a
 * typed number becomes the tool's credit, within (0, 480], and is labeled
 * builder-set on every receipt. Same bounds the server enforces.
 */
function CreditField({ suggested, value, onChange, id, className }: CreditFieldProps) {
  function set(raw: number) {
    if (!Number.isFinite(raw)) {
      onChange(null);
      return;
    }
    // Round to the column's 2dp scale, then clamp to the hard cap. Zero and
    // below stay as typed so the out-of-range message shows instead of a
    // silent jump.
    const rounded = Math.round(raw * 100) / 100;
    onChange(Math.min(rounded, RAW_ESTIMATE_MAX_DASHBOARD));
  }

  const overridden = value !== null && value !== suggested;
  const invalid = value !== null && value <= 0;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-32">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0.01}
            max={RAW_ESTIMATE_MAX_DASHBOARD}
            step="any"
            value={value ?? ""}
            placeholder={fmtNum(suggested)}
            onChange={(e) =>
              e.target.value === "" ? onChange(null) : set(e.target.valueAsNumber)
            }
            className="numeral h-11 pr-16 text-center text-xl"
            aria-label="Credited minutes per run"
            aria-invalid={invalid}
            aria-describedby={invalid && id ? `${id}-error` : undefined}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[0.6875rem] text-foreground-muted">
            min/run
          </span>
        </div>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="cursor-pointer text-[0.8125rem] font-medium text-accent hover:underline"
          >
            Use the suggestion ({fmtNum(suggested)} min)
          </button>
        )}
      </div>

      {invalid ? (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="rounded-md bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning"
        >
          The credit must be above 0 and at most {RAW_ESTIMATE_MAX_DASHBOARD}{" "}
          minutes per run.
        </p>
      ) : overridden ? (
        <p className="text-xs leading-relaxed text-foreground-muted">
          {fmtNum(value)} differs from the suggested {fmtNum(suggested)} min, so
          it is labeled <span className="text-accent">builder-set</span> on
          every receipt.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-foreground-muted">
          Leave empty to use the suggested number.
        </p>
      )}
    </div>
  );
}

export { CreditField };
