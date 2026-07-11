"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateWorkspaceSettingsAction } from "./actions";

export interface GeneralFormInitial {
  name: string;
  hourlyRateDollars: number;
  currency: string;
  timezone: string;
}

function GeneralForm({
  slug,
  initial,
}: {
  slug: string;
  initial: GeneralFormInitial;
}) {
  const router = useRouter();
  const [timezone, setTimezone] = React.useState(initial.timezone);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const result = await updateWorkspaceSettingsAction(slug, {
        name: String(form.get("name") ?? ""),
        hourlyRateDollars: Number(form.get("rate") ?? 0),
        currency: String(form.get("currency") ?? ""),
        timezone,
      });
      if (result.ok) {
        toast.success("Settings saved.");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Name, money math, and the timezone your calendar ranges use.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={80}
              defaultValue={initial.name}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rate">Hourly rate</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                min={0}
                max={1_000_000}
                step="0.01"
                required
                defaultValue={initial.hourlyRateDollars}
              />
              <p className="text-xs text-foreground-muted">
                Hours times rate is every money figure, past and future.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                required
                maxLength={3}
                pattern="[A-Za-z]{3}"
                title="3-letter code, e.g. USD"
                defaultValue={initial.currency}
                className="uppercase"
              />
              <p className="text-xs text-foreground-muted">
                3-letter code, e.g. USD or EUR. Formatting only.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" aria-label="Timezone">
                <SelectValue placeholder="Pick a timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezoneOptions(initial.timezone).map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Full IANA list where the runtime has it, always including the current value. */
function timezoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export { GeneralForm };
