"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateHourlyRateAction } from "../actions";

/**
 * Admin-only inline edit for the workspace hourly rate, living inside the
 * Value stat tile. Rendered conditionally by the server page.
 */
function RateEdit({
  workspaceSlug,
  hourlyRateCents,
  currency,
}: {
  workspaceSlug: string;
  /** null = no rate set yet — the trigger reads "set rate". */
  hourlyRateCents: number | null;
  currency: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(
    hourlyRateCents === null ? "" : String(hourlyRateCents / 100),
  );
  const [saving, setSaving] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await updateHourlyRateAction(workspaceSlug, {
      hourlyRateDollars: value,
    });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      toast.success("Hourly rate updated", {
        description: "Every money figure now uses the new rate.",
      });
    } else {
      toast.error(result.error ?? "Could not save the rate.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-foreground-muted transition-colors hover:bg-subtle hover:text-foreground"
        aria-label="Edit hourly rate"
      >
        <Pencil className="size-3" aria-hidden />
        {hourlyRateCents === null ? "set rate" : "edit rate"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hourly-rate">Hourly rate ({currency})</Label>
            <Input
              id="hourly-rate"
              type="number"
              min={0}
              max={1_000_000}
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-foreground-muted">
              Used to convert saved hours to money. Changeable anytime.
            </p>
          </div>
          <Button type="submit" size="sm" disabled={saving || value.trim() === ""}>
            {saving ? "Saving…" : "Save rate"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export { RateEdit };
