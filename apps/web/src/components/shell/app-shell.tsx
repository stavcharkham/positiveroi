"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { MemberRole } from "@positiveroi/core";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUSTOM_PERIOD_PARAM_RE,
  formatPeriodRange,
} from "@/app/w/[slug]/_lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  workspace: { name: string; slug: string };
  workspaces: { name: string; slug: string }[];
  role: MemberRole;
  displayName: string;
  email: string;
  children: React.ReactNode;
}

/**
 * The workspace frame: sidebar navigation, workspace switcher, the global
 * period selector (every number on screen obeys it), theme toggle, user menu.
 */
function AppShell({
  workspace,
  workspaces,
  role,
  displayName,
  email,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <SidebarContent workspace={workspace} role={role} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="anim-fade-enter absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="anim-sheet-enter absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface shadow-lg">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 cursor-pointer rounded-md p-1 text-foreground-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              workspace={workspace}
              role={role}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="cursor-pointer rounded-md p-1.5 text-foreground-secondary hover:bg-subtle lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4.5" />
          </button>

          <WorkspaceSwitcher current={workspace} workspaces={workspaces} />

          <div className="ml-auto flex items-center gap-1.5">
            <PeriodSelector />
            <ThemeToggle />
            <UserMenu displayName={displayName} email={email} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function SidebarContent({
  workspace,
  role,
  onNavigate,
}: {
  workspace: { name: string; slug: string };
  role: MemberRole;
  onNavigate?: () => void;
}) {
  const base = `/w/${workspace.slug}`;
  const items = [
    { label: "My Impact", href: `${base}/me`, icon: Sparkles },
    { label: "Company", href: base, icon: BarChart3, exact: true },
    { label: "Tools", href: `${base}/tools`, icon: Wrench },
    { label: "Builders", href: `${base}/builders`, icon: Users },
    { label: "Metrics", href: `${base}/metrics`, icon: Target },
  ];

  return (
    <>
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-accent-soft">
          <svg viewBox="0 0 24 24" className="size-3.5 text-accent" fill="currentColor" aria-hidden>
            <path d="M13 2 4.5 13.5h5L10 22l8.5-11.5h-5L13 2Z" />
          </svg>
        </div>
        <span className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          PositiveROI
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-2" aria-label="Workspace">
        {items.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-border px-2 py-2">
        <NavLink
          label="Settings"
          href={`${base}/settings`}
          icon={Settings}
          onNavigate={onNavigate}
        />
        <p className="mt-2 truncate px-2.5 pb-1 text-xs text-foreground-muted">
          {workspace.name} · {role}
        </p>
      </div>
    </>
  );
}

function NavLink({
  label,
  href,
  icon: Icon,
  exact = false,
  onNavigate,
}: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  // Carry the global period across navigation.
  const period = searchParams.get("period");
  const target = period ? `${href}?period=${encodeURIComponent(period)}` : href;

  return (
    <Link
      href={target}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "text-foreground-secondary hover:bg-subtle hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4", active ? "text-accent" : "text-foreground-muted")} />
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Top bar pieces
// ---------------------------------------------------------------------------

function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: { name: string; slug: string };
  workspaces: { name: string; slug: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-subtle">
        <span className="max-w-40 truncate">{current.name}</span>
        <ChevronsUpDown className="size-3.5 text-foreground-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.slug} asChild>
            <Link href={`/w/${w.slug}`} className="flex items-center justify-between">
              <span className="truncate">{w.name}</span>
              {w.slug === current.slug && <Check className="size-4 text-accent" aria-hidden />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus className="size-4" aria-hidden /> New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PERIODS = [
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "quarter", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("period");
  const customActive = raw !== null && CUSTOM_PERIOD_PARAM_RE.test(raw);
  const value = customActive ? "custom" : (raw ?? "all");

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  function navigate(period: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (period === null) params.delete("period");
    else params.set("period", period);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onChange(next: string) {
    if (next === "custom") {
      // Prefill from the active range so "edit" starts where you are.
      const match = raw ? CUSTOM_PERIOD_PARAM_RE.exec(raw) : null;
      setFrom(match?.[1] ?? "");
      setTo(match?.[2] ?? "");
      setPickerOpen(true);
      return;
    }
    navigate(next === "all" ? null : next);
  }

  const rangeValid = from !== "" && to !== "" && from <= to;

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverAnchor asChild>
        <div className="flex items-center gap-1.5">
          {customActive && (
            <button
              type="button"
              onClick={() => onChange("custom")}
              className="cursor-pointer whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-xs text-foreground-secondary transition-colors hover:border-accent/50 hover:text-foreground"
              aria-label="Edit the custom date range"
            >
              {formatPeriodRange(raw)}
            </button>
          )}
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger
              className="h-8 w-[8.5rem] text-[0.8125rem]"
              aria-label="Period — every number on screen follows it"
            >
              {value === "custom" ? <span>Custom range</span> : <SelectValue />}
            </SelectTrigger>
            <SelectContent align="end">
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom range…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm font-medium text-foreground">Custom range</p>
        <p className="mt-0.5 text-xs text-foreground-muted">
          Whole days in the workspace timezone; the end day counts.
        </p>
        <div className="mt-3 space-y-2.5">
          <div className="space-y-1">
            <Label htmlFor="period-from" className="text-xs">
              From
            </Label>
            <Input
              id="period-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-[0.8125rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to" className="text-xs">
              To
            </Label>
            <Input
              id="period-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-[0.8125rem]"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={!rangeValid}
          onClick={() => {
            navigate(`${from}..${to}`);
            setPickerOpen(false);
          }}
        >
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Hydration signal without a setState-in-effect: false on the server
  // snapshot, true on the client — avoids a theme-icon hydration mismatch.
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="cursor-pointer rounded-md p-2 text-foreground-secondary transition-colors hover:bg-subtle hover:text-foreground"
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}

function subscribeNoop(): () => void {
  return () => {};
}

function UserMenu({ displayName, email }: { displayName: string; email: string }) {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="cursor-pointer rounded-full transition-shadow hover:ring-2 hover:ring-border"
        aria-label="Account"
      >
        <Avatar name={displayName} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">{displayName}</span>
          <span className="block truncate text-xs font-normal text-foreground-muted">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AppShell };
