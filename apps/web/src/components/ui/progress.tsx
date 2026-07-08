"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export interface ProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  /** 0-100. Values above 100 are clamped for display. */
  value?: number;
  /** Render the fill with the accent gradient (delight moments only). */
  gradient?: boolean;
}

function Progress({ className, value = 0, gradient = false, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-subtle",
        className,
      )}
      value={clamped}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "size-full flex-1 rounded-full transition-transform duration-500 ease-out",
          gradient ? "" : "bg-accent",
        )}
        style={{
          transform: `translateX(-${100 - clamped}%)`,
          ...(gradient ? { background: "var(--gradient-accent)" } : {}),
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
