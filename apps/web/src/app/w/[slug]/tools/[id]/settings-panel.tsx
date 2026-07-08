"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RAW_ESTIMATE_MAX_DASHBOARD } from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Receipt } from "@/components/product/receipt";
import { BaselineField } from "../baseline-field";
import { fmtNum } from "../tool-meta";
import { setToolStatusAction, updateBaselineAction } from "./actions";

export interface SettingsPanelProps {
  workspaceSlug: string;
  toolId: string;
  toolName: string;
  initialRawMinutes: number;
  initialHighJudgment: boolean;
  status: "active" | "archived";
}

/**
 * Lead/admin tool settings: the audited baseline edit (the Receipt re-renders
 * live as the draft changes) and archive/unarchive.
 */
function SettingsPanel({
  workspaceSlug,
  toolId,
  toolName,
  initialRawMinutes,
  initialHighJudgment,
  status,
}: SettingsPanelProps) {
  const router = useRouter();
  const [rawMinutes, setRawMinutes] = React.useState(initialRawMinutes);
  const [highJudgment, setHighJudgment] = React.useState(initialHighJudgment);
  const [saving, setSaving] = React.useState(false);
  const [statusPending, setStatusPending] = React.useState(false);

  const dirty =
    rawMinutes !== initialRawMinutes || highJudgment !== initialHighJudgment;
  const valid = rawMinutes > 0 && rawMinutes <= RAW_ESTIMATE_MAX_DASHBOARD;

  async function save() {
    setSaving(true);
    const result = await updateBaselineAction(workspaceSlug, toolId, {
      rawEstimateMinutes: rawMinutes,
      highJudgment,
    });
    if (result.ok && result.creditedPerRun !== undefined) {
      toast.success(
        `Baseline saved. Each run now credits ${fmtNum(result.creditedPerRun)} minutes.`,
      );
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not save the baseline.");
    }
    setSaving(false);
  }

  async function setStatus(next: "active" | "archived") {
    setStatusPending(true);
    const result = await setToolStatusAction(workspaceSlug, toolId, next);
    if (result.ok) {
      toast.success(
        next === "archived"
          ? "Tool archived. New runs are rejected; history stays."
          : "Tool unarchived. It accepts runs again.",
      );
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not update the tool.");
    }
    setStatusPending(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">Baseline</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Minutes one round took by hand, before this tool. Every change is
          recorded: who, when, old and new.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <BaselineField
              value={rawMinutes}
              onChange={setRawMinutes}
              id="settings-baseline"
            />

            <div className="mt-5 flex items-center gap-3">
              <Switch
                id="settings-judgment"
                checked={highJudgment}
                onCheckedChange={setHighJudgment}
              />
              <Label htmlFor="settings-judgment" className="cursor-pointer">
                A human decision stays in the loop (credit halved)
              </Label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={save} disabled={!dirty || !valid || saving}>
                {saving ? "Saving…" : "Save baseline"}
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRawMinutes(initialRawMinutes);
                    setHighJudgment(initialHighJudgment);
                  }}
                  disabled={saving}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div>
            <Receipt rawMinutes={rawMinutes} highJudgment={highJudgment} />
            <p className="mt-2 text-xs text-foreground-muted">
              The receipt updates as you edit. Past runs keep the credit they
              already earned.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">
          {status === "active" ? "Archive" : "Unarchive"}
        </h2>
        {status === "active" ? (
          <>
            <p className="mt-1 text-sm text-foreground-secondary">
              Archiving stops new runs from being accepted. History and totals
              stay exactly as they are.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="mt-4" disabled={statusPending}>
                  Archive this tool
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive {toolName}?</DialogTitle>
                  <DialogDescription>
                    New runs will be rejected from the moment you archive. Every
                    run already logged keeps counting in history. You can
                    unarchive anytime.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={() => setStatus("archived")}
                    >
                      Archive
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-foreground-secondary">
              This tool is archived and rejects new runs. Unarchive it to start
              counting again.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setStatus("active")}
              disabled={statusPending}
            >
              {statusPending ? "Working…" : "Unarchive"}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

export { SettingsPanel };
