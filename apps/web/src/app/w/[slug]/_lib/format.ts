import type { MetricUnit } from "@positiveroi/core";
import type { PeriodName } from "@/lib/aggregates";

/**
 * Display formatting shared by the dashboard pages. Client-safe (no
 * server-only imports). All formatters pin the en-US locale so server render
 * and client hydration always agree.
 */

const numberFmt = new Intl.NumberFormat("en-US");
const oneDecimalFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Sanitize the ?period= search param. Anything unknown means all-time. */
export function normalizePeriodParam(
  raw: string | string[] | undefined,
): PeriodName | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "week" || value === "month" || value === "quarter") return value;
  return undefined;
}

/** "in the last 30 days" / "all time" — reads naturally after a noun. */
export function periodLabel(name: PeriodName | undefined): string {
  switch (name) {
    case "week":
      return "in the last 7 days";
    case "month":
      return "in the last 30 days";
    case "quarter":
      return "in the last quarter";
    default:
      return "all time";
  }
}

/** Carry the global period selector across drill-down links. */
export function withPeriod(href: string, name: PeriodName | undefined): string {
  if (!name) return href;
  return `${href}${href.includes("?") ? "&" : "?"}period=${name}`;
}

/** Headline hours: 1 decimal under 100, whole + grouped above. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0";
  if (hours >= 100) return numberFmt.format(Math.round(hours));
  return oneDecimalFmt.format(hours);
}

export function formatNumber(n: number): string {
  return numberFmt.format(Math.round(n));
}

/** FTE figure: "2.4", "0.3" — always one decimal until it gets big. */
export function formatFte(fte: number): string {
  if (!Number.isFinite(fte) || fte <= 0) return "0";
  if (fte >= 100) return numberFmt.format(Math.round(fte));
  return fte.toFixed(1);
}

export function formatMoneyCents(cents: number, currency: string): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCurrency(currency),
    maximumFractionDigits: dollars >= 1000 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(dollars);
}

function safeCurrency(code: string): string {
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

/** Metric totals, formatted by their unit. Duration values are minutes. */
export function formatMetricValue(
  value: number,
  unit: MetricUnit | string,
  currency: string,
): string {
  if (unit === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency(currency),
      maximumFractionDigits: value >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(value);
  }
  if (unit === "duration") return formatDurationMinutes(value);
  return numberFmt.format(value);
}

/** Humane duration from minutes: "45m", "3h 20m", "1,240h". */
export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  if (minutes < 60) return `${oneDecimalFmt.format(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours >= 100) return `${numberFmt.format(hours + (rest >= 30 ? 1 : 0))}h`;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Compact relative time for run rows. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return shortDate(iso);
}

/** "Mar 4" or "Mar 4, 2025" when the year differs from now. */
export function shortDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(d);
}

/** "March 2026" — for permanent badge earned dates. */
export function monthYear(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}
