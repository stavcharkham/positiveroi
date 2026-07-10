"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_SECTIONS = [
  { label: "General", segment: "" },
  { label: "Members", segment: "members" },
  { label: "API keys", segment: "keys" },
  { label: "Public page", segment: "public" },
] as const;

const MEMBER_SECTIONS = [{ label: "API keys", segment: "keys" }] as const;

function SettingsNav({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/w/${slug}/settings`;
  const sections = isAdmin ? ADMIN_SECTIONS : MEMBER_SECTIONS;

  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
      {sections.map((section) => {
        const href = section.segment ? `${base}/${section.segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={section.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent text-foreground"
                : "border-transparent text-foreground-secondary hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { SettingsNav };
