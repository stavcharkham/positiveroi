"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { METRIC_UNITS, type MetricUnit } from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge } from "@/components/product/source-badge";
import { formatMetricValue, shortDate } from "../_lib/format";
import {
  createMetricDefinitionAction,
  deleteMetricDefinitionAction,
  listMetricContributionsAction,
  metricUsageAction,
  type MetricContribution,
} from "./actions";
import { keyFromName } from "./key";

const UNIT_LABEL: Record<MetricUnit, string> = {
  currency: "Currency",
  count: "Count",
  duration: "Duration (minutes)",
};

export interface MetricTileData {
  id: string;
  key: string;
  name: string;
  unit: MetricUnit;
  total: number;
}

// ---------------------------------------------------------------------------
// Tile — the whole card opens the drill-down dialog
// ---------------------------------------------------------------------------

function MetricTile({
  workspaceSlug,
  metric,
  currency,
  periodParam,
  periodText,
  canManage,
}: {
  workspaceSlug: string;
  metric: MetricTileData;
  currency: string;
  periodParam?: string;
  periodText: string;
  canManage: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="group cursor-pointer rounded-lg border border-border bg-surface p-5 text-left shadow-xs transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={`See the events behind ${metric.name}`}
      >
        <span className="text-[0.8125rem] font-medium text-foreground-secondary">
          {metric.name}
        </span>
        <span className="numeral mt-1.5 block text-[2.75rem] leading-none text-foreground">
          {formatMetricValue(metric.total, metric.unit, currency)}
        </span>
        <span className="mt-2 block font-mono text-xs text-foreground-muted">
          {metric.key} · {UNIT_LABEL[metric.unit].toLowerCase()}
        </span>
        {metric.total === 0 && (
          <span className="mt-2 block text-xs text-foreground-muted">
            send{" "}
            <code className="rounded bg-subtle px-1 py-0.5 font-mono">
              metrics: {"{"}{metric.key}: 1200{"}"}
            </code>{" "}
            on any run
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{metric.name}</DialogTitle>
          <DialogDescription>
            {formatMetricValue(metric.total, metric.unit, currency)} {periodText},
            summed from the events below. Test runs never count.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ContributionList
            workspaceSlug={workspaceSlug}
            metric={metric}
            currency={currency}
            periodParam={periodParam}
          />
        )}
        {canManage && (
          <DialogFooter className="border-t border-border pt-4 sm:justify-between">
            <DeleteMetric
              workspaceSlug={workspaceSlug}
              metric={metric}
              onDeleted={() => setOpen(false)}
            />
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Fetches on mount — the dialog unmounts it on close, so state stays fresh. */
function ContributionList({
  workspaceSlug,
  metric,
  currency,
  periodParam,
}: {
  workspaceSlug: string;
  metric: MetricTileData;
  currency: string;
  periodParam?: string;
}) {
  const [rows, setRows] = React.useState<MetricContribution[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listMetricContributionsAction(workspaceSlug, metric.id, periodParam)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, metric.id, periodParam]);

  if (failed) {
    return (
      <p className="py-4 text-sm text-foreground-muted">
        Could not load the events. Close and try again.
      </p>
    );
  }
  if (rows === null) {
    return (
      <div className="flex flex-col gap-2 py-1">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-4 text-sm text-foreground-muted">
        No values in this period. Attach one to any run:{" "}
        <code className="rounded bg-subtle px-1 py-0.5 font-mono text-xs">
          metrics: {"{"}{metric.key}: 1200{"}"}
        </code>
      </p>
    );
  }
  return (
    <ul className="max-h-80 divide-y divide-border overflow-y-auto">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2.5">
          {row.toolId ? (
            <Link
              href={`/w/${workspaceSlug}/tools/${row.toolId}`}
              className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-accent"
            >
              {row.toolName}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {row.toolName}
            </span>
          )}
          <SourceBadge source={row.source} short />
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {formatMetricValue(row.value, metric.unit, currency)}
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-foreground-muted">
            {shortDate(row.occurredAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Delete — confirm shows how many recorded values cascade
// ---------------------------------------------------------------------------

function DeleteMetric({
  workspaceSlug,
  metric,
  onDeleted,
}: {
  workspaceSlug: string;
  metric: MetricTileData;
  onDeleted: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 aria-hidden /> Delete definition
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {open && (
          <DeleteConfirm
            workspaceSlug={workspaceSlug}
            metric={metric}
            onDone={() => {
              setOpen(false);
              onDeleted();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirm({
  workspaceSlug,
  metric,
  onDone,
}: {
  workspaceSlug: string;
  metric: MetricTileData;
  onDone: () => void;
}) {
  const [count, setCount] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    metricUsageAction(workspaceSlug, metric.id)
      .then((res) => {
        if (!cancelled) setCount(res.ok ? res.count : 0);
      })
      .catch(() => {
        // Count is advisory; a failed lookup shows "0" rather than hanging.
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, metric.id]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      const result = await deleteMetricDefinitionAction(workspaceSlug, metric.id);
      if (result.ok) {
        toast.success(`Deleted "${metric.name}"`);
        onDone();
      } else {
        toast.error(result.error ?? "Could not delete the metric.");
      }
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete {metric.name}?</DialogTitle>
        <DialogDescription>
          {count === null
            ? "Counting the recorded values this would remove…"
            : count === 0
              ? "No values have been recorded for this metric yet. Nothing else is affected."
              : `This permanently deletes the definition and its ${count.toLocaleString("en-US")} recorded ${count === 1 ? "value" : "values"}. Runs and hours are untouched.`}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onDone} disabled={deleting}>
          Keep it
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={confirmDelete}
          disabled={deleting || count === null}
        >
          {deleting ? "Deleting…" : "Delete metric"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Add definition
// ---------------------------------------------------------------------------

function AddMetricDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState<MetricUnit>("count");
  const [saving, setSaving] = React.useState(false);

  const key = keyFromName(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await createMetricDefinitionAction(workspaceSlug, { name, unit });
    setSaving(false);
    if (result.ok) {
      toast.success(`Metric "${name.trim()}" added`, {
        description: `Send metrics: {${key}: …} on any run to record values.`,
      });
      setOpen(false);
      setName("");
      setUnit("count");
    } else {
      toast.error(result.error ?? "Could not create the metric.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> Add metric
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a metric</DialogTitle>
          <DialogDescription>
            Tools attach values to runs with this metric&apos;s key. The unit
            only changes how totals are formatted.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metric-name">Name</Label>
            <Input
              id="metric-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Proposals sent"
              maxLength={80}
              autoFocus
            />
            <p className="text-xs text-foreground-muted">
              key:{" "}
              <code className="rounded bg-subtle px-1 py-0.5 font-mono">
                {key || "…"}
              </code>
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metric-unit">Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as MetricUnit)}>
              <SelectTrigger id="metric-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={saving || key.length < 2}>
              {saving ? "Adding…" : "Add metric"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AddMetricDialog, MetricTile };
