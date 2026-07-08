"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeseriesBucketName } from "@/lib/aggregates";
import { formatHours, formatNumber } from "../_lib/format";

export interface TrendPoint {
  /** Bucket start, ISO string. */
  start: string;
  hours: number;
  runs: number;
}

/**
 * Hours-saved trend. One series, so no legend — the card title names it.
 * Everything draws from CSS variables so light and dark both hold up.
 */
function TrendChart({
  points,
  bucket,
}: {
  points: TrendPoint[];
  bucket: TimeseriesBucketName;
}) {
  const data = React.useMemo(
    () =>
      points.map((p) => ({
        ...p,
        label: tickLabel(p.start, bucket),
      })),
    [points, bucket],
  );

  return (
    <div className="h-60 w-full" aria-label="Hours saved over time" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.7}
            strokeWidth={1}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
            minTickGap={28}
            tickMargin={8}
          />
          <YAxis
            width={42}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickCount={4}
            tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={<TrendTooltip bucket={bucket} />}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="var(--accent)"
            fillOpacity={0.08}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--accent)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipEntry {
  payload?: TrendPoint & { label: string };
}

function TrendTooltip({
  active,
  payload,
  bucket,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  bucket: TimeseriesBucketName;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-border bg-elevated px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-foreground">
        {formatHours(point.hours)} hours
      </p>
      <p className="mt-0.5 text-xs text-foreground-secondary">
        {formatNumber(point.runs)} {point.runs === 1 ? "run" : "runs"}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        {bucket === "week" ? "week of " : ""}
        {tooltipDate(point.start, bucket)}
      </p>
    </div>
  );
}

function tickLabel(iso: string, bucket: TimeseriesBucketName): string {
  const d = new Date(iso);
  if (bucket === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
      ...(d.getUTCMonth() === 0 ? { year: "2-digit" } : {}),
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function tooltipDate(iso: string, bucket: TimeseriesBucketName): string {
  const d = new Date(iso);
  if (bucket === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export { TrendChart };
