"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RAW_ESTIMATE_MAX_DASHBOARD,
  normalizeCreditOverride,
} from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import { CreditField } from "../credit-field";
import { fmtNum } from "../tool-meta";
import { updateCreditAction } from "./actions";

export interface CreditPanelProps {
  workspaceSlug: string;
  toolId: string;
  /** The suggested Undercount from the current baseline. */
  suggested: number;
  /** Current builder-set credit; null = the suggestion applies. */
  initialOverride: number | null;
}

/**
 * The credited-minutes editor on the settings tab. The tool's owner edits
 * their own credit; leads and admins edit any. Every change is audited.
 */
function CreditPanel({
  workspaceSlug,
  toolId,
  suggested,
  initialOverride,
}: CreditPanelProps) {
  const router = useRouter();
  const [credit, setCredit] = React.useState<number | null>(initialOverride);
  const [saving, setSaving] = React.useState(false);

  // Compare on the normalized value: a typed number equal to the suggestion
  // stores as null (no override), so it must not read as a pending change.
  const dirty = normalizeCreditOverride(suggested, credit) !== initialOverride;
  const valid =
    credit === null || (credit > 0 && credit <= RAW_ESTIMATE_MAX_DASHBOARD);

  async function save() {
    setSaving(true);
    try {
      const result = await updateCreditAction(workspaceSlug, toolId, {
        creditMinutes: credit,
      });
      if (result.ok && result.creditedPerRun !== undefined) {
        toast.success(
          `Credit saved. Each new run now credits ${fmtNum(result.creditedPerRun)} minutes.`,
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not save the credit.");
      }
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">
        Time saved per run
      </h2>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-foreground-secondary">
        We suggest {fmtNum(suggested)} min, based on your by-hand time and
        the cuts. Set your own number and every receipt labels it builder-set.
        Past runs keep the time they already earned.
      </p>

      <CreditField
        suggested={suggested}
        value={credit}
        onChange={setCredit}
        id="settings-credit"
        className="mt-5"
      />

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || !valid || saving}>
          {saving ? "Saving…" : "Save credit"}
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => setCredit(initialOverride)}
            disabled={saving}
          >
            Reset
          </Button>
        )}
      </div>
    </section>
  );
}

export { CreditPanel };
