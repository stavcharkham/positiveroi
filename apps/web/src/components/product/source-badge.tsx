import * as React from "react";
import { Braces, Globe, PenLine, Plug, Zap } from "lucide-react";
import type { EventSource } from "@positiveroi/core";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<
  EventSource,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  rest: { label: "via REST", Icon: Globe },
  mcp: { label: "via MCP", Icon: Plug },
  hook: { label: "via hook", Icon: Zap },
  sdk: { label: "via SDK", Icon: Braces },
  manual: { label: "manual", Icon: PenLine },
};

export interface SourceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  source: EventSource;
  /** Drop the "via " prefix — for dense tables. */
  short?: boolean;
}

/** How a run arrived. Per-source counts are what make a silent capture failure visible. */
function SourceBadge({ source, short = false, className, ...props }: SourceBadgeProps) {
  const meta = SOURCE_META[source];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-px font-mono text-[0.6875rem] lowercase leading-4 text-foreground-secondary",
        className,
      )}
      {...props}
    >
      <meta.Icon className="size-3 text-foreground-muted" aria-hidden />
      {short ? meta.label.replace(/^via /, "") : meta.label}
    </span>
  );
}

export { SourceBadge };
