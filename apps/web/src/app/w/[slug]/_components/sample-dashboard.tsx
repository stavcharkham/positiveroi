import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/product/stat-tile";
import { TrendChart, type TrendPoint } from "./trend-chart";

/**
 * The company dashboard before the first run: the real layout, ghosted with
 * sample numbers and a watermark, so the team sees what they are about to
 * earn. One live CTA — register a tool.
 */
function SampleDashboard({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-45" aria-hidden>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Hours saved" value="342" sub="across 6 tools" undercounted />
          <StatTile
            label="Multiplier equivalent"
            value="1.9"
            sub="full-time jobs · 180 credited hrs/mo = 1 FTE"
          />
          <StatTile label="Value" value="$20,520" sub="at $60/hr" />
          <StatTile label="Runs measured" value="1,284" sub="4 builders active" />
        </div>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Hours saved over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart points={samplePoints()} bucket="week" />
          </CardContent>
        </Card>
      </div>

      {/* Watermark */}
      <div
        className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10"
        aria-hidden
      >
        <span className="rotate-[-6deg] rounded-md border border-dashed border-border bg-surface/80 px-4 py-1.5 font-mono text-sm uppercase tracking-[0.3em] text-foreground-muted shadow-xs">
          sample
        </span>
      </div>

      {/* The one live thing on the page */}
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
        <Card className="w-full max-w-md bg-elevated text-center shadow-md">
          <CardContent className="flex flex-col items-center gap-3 p-8">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              These numbers are waiting for your first run
            </h2>
            <p className="text-sm leading-relaxed text-foreground-secondary">
              Register a tool, log one run, and this dashboard starts counting
              — conservatively, with the receipt to prove it.
            </p>
            <Button asChild className="mt-2">
              <Link href={`/w/${workspaceSlug}/tools/new`}>
                Register a tool <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function samplePoints(): TrendPoint[] {
  const hours = [4, 9, 7, 14, 12, 19, 16, 24, 27, 23, 31, 36];
  const now = Date.now();
  return hours.map((h, i) => ({
    start: new Date(now - (hours.length - 1 - i) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    hours: h,
    runs: h * 4,
  }));
}

export { SampleDashboard };
