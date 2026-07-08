import * as React from "react";
import { cn } from "@/lib/utils";

export interface RunsSparklineProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, "values"> {
  /** Bucketed run counts, oldest first. */
  values: number[];
  width?: number;
  height?: number;
  "aria-label"?: string;
}

/**
 * Tiny inline run-activity sparkline. Pure SVG — no ids, no gradients — so it
 * renders identically in server and client components.
 */
function RunsSparkline({
  values,
  width = 96,
  height = 28,
  className,
  ...props
}: RunsSparklineProps) {
  const pad = 2;
  const max = Math.max(...values, 1);
  const n = values.length;

  const points =
    n === 1
      ? [
          [pad, y(values[0]!)],
          [width - pad, y(values[0]!)],
        ]
      : values.map((v, i) => [
          pad + (i * (width - pad * 2)) / (n - 1),
          y(v),
        ]);

  function y(v: number): number {
    return height - pad - (v / max) * (height - pad * 2);
  }

  const line = points.map(([px, py]) => `${px},${py}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const flat = n === 0 || values.every((v) => v === 0);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      className={cn("shrink-0", className)}
      {...props}
    >
      {flat ? (
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="var(--border)"
          strokeWidth={1.5}
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      ) : (
        <>
          <polygon points={area} fill="var(--accent)" fillOpacity={0.08} />
          <polyline
            points={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export { RunsSparkline };
