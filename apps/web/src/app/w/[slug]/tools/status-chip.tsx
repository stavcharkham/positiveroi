import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { DerivedToolStatus } from "./helpers";

const STATUS_META: Record<
  DerivedToolStatus,
  { label: string; variant: "success" | "warning" | "neutral" | "outline" }
> = {
  live: { label: "live", variant: "success" },
  awaiting: { label: "awaiting first run", variant: "outline" },
  quiet: { label: "quiet 14d", variant: "warning" },
  archived: { label: "archived", variant: "neutral" },
};

/** Derived tool status chip — computed from the last real run, never stored. */
function ToolStatusChip({
  status,
  className,
}: {
  status: DerivedToolStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export { ToolStatusChip };
