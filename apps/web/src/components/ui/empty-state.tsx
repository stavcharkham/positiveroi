import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  body?: string;
  /** Action slot — usually a Button or a link. */
  children?: React.ReactNode;
}

function EmptyState({
  icon: Icon,
  title,
  body,
  children,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/50 px-6 py-16 text-center",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-subtle">
          <Icon className="size-5 text-foreground-muted" aria-hidden />
        </div>
      )}
      <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
      {body && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-foreground-secondary">
          {body}
        </p>
      )}
      {children && <div className="mt-5 flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { EmptyState };
