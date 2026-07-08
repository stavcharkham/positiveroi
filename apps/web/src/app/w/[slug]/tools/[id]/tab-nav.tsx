import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ToolTab = "overview" | "runs" | "setup" | "settings";

const TABS: { id: ToolTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "runs", label: "Runs" },
  { id: "setup", label: "Setup" },
  { id: "settings", label: "Settings" },
];

export function parseToolTab(value: string | null): ToolTab {
  return TABS.some((t) => t.id === value) ? (value as ToolTab) : "overview";
}

/**
 * URL-driven tabs (?tab=) so each tab's data is fetched server-side and the
 * runs table can paginate. Carries the global period across.
 */
function ToolTabNav({
  basePath,
  active,
  periodParam,
}: {
  basePath: string;
  active: ToolTab;
  periodParam: string | null;
}) {
  return (
    <nav
      className="inline-flex h-9 items-center gap-1 rounded-md bg-subtle p-1"
      aria-label="Tool sections"
    >
      {TABS.map((tab) => {
        const params = new URLSearchParams();
        if (tab.id !== "overview") params.set("tab", tab.id);
        if (periodParam) params.set("period", periodParam);
        const qs = params.toString();
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={qs ? `${basePath}?${qs}` : basePath}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-surface text-foreground shadow-xs"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { ToolTabNav };
