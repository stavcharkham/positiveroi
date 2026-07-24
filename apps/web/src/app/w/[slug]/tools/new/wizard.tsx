"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Wand2,
  Zap,
} from "lucide-react";
import {
  RAW_ESTIMATE_MAX_DASHBOARD,
  TOOL_TYPES,
  computeMinutesSavedPerRun,
  normalizeCreditOverride,
  type ToolType,
} from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReceiptFlow } from "@/components/product/receipt-flow";
import { cn } from "@/lib/utils";
import { BaselineField } from "../baseline-field";
import { CreditField } from "../credit-field";
import { TOOL_TYPE_META, fmtNum } from "../tool-meta";
import { createToolAction } from "./actions";
import { CaptureStep } from "./capture-step";

const TYPE_ICONS: Record<ToolType, React.ComponentType<{ className?: string }>> = {
  automation: Zap,
  skill: Wand2,
  agent: Bot,
  app: AppWindow,
};

const STEP_TITLES = ["What is it", "Time by hand", "Your number", "Connect it"] as const;

export interface ToolWizardProps {
  workspaceSlug: string;
  self: { id: string; name: string };
  /** All workspace members — empty unless canPickOwner. */
  members: { id: string; name: string }[];
  canPickOwner: boolean;
  endpoint: string;
}

/**
 * The 4-step registration wizard — one decision per step, with the live
 * Receipt alongside so the builder watches their claim become a credited
 * number. Step 3 → 4 creates the tool; step 4 waits for the first run.
 */
function ToolWizard({
  workspaceSlug,
  self,
  members,
  canPickOwner,
  endpoint,
}: ToolWizardProps) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [ownerId, setOwnerId] = React.useState(self.id);
  const [type, setType] = React.useState<ToolType | null>(null);
  const [rawMinutes, setRawMinutes] = React.useState(15);
  const [highJudgment, setHighJudgment] = React.useState<boolean | null>(null);
  /** Builder-edited credit; null = the suggestion, untouched. */
  const [creditMinutes, setCreditMinutes] = React.useState<number | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tool, setTool] = React.useState<{ id: string; slug: string } | null>(null);

  const step1Valid = name.trim().length > 0 && type !== null;
  const step2Valid = rawMinutes > 0 && rawMinutes <= RAW_ESTIMATE_MAX_DASHBOARD;

  // The suggestion the credit editor is prefilled with — defined once the
  // baseline is valid and the judgment question is answered.
  const suggested =
    step2Valid && highJudgment !== null
      ? computeMinutesSavedPerRun(rawMinutes, highJudgment)
      : null;
  const creditValid =
    creditMinutes === null ||
    (creditMinutes > 0 && creditMinutes <= RAW_ESTIMATE_MAX_DASHBOARD);
  const overrideForDisplay =
    suggested !== null && creditValid
      ? (normalizeCreditOverride(suggested, creditMinutes) ?? undefined)
      : undefined;

  // Editing the inputs that feed the suggestion discards a stale override.
  function changeRawMinutes(next: number) {
    setRawMinutes(next);
    setCreditMinutes(null);
  }
  function chooseJudgment(next: boolean) {
    setHighJudgment(next);
    setCreditMinutes(null);
  }

  async function create() {
    if (!type || highJudgment === null || suggested === null || !creditValid || creating) {
      return;
    }
    setCreating(true);
    setError(null);
    const override = normalizeCreditOverride(suggested, creditMinutes);
    try {
      const result = await createToolAction(workspaceSlug, {
        name: name.trim(),
        description: description.trim(),
        type,
        raw_estimate_minutes: rawMinutes,
        high_judgment: highJudgment,
        owner_id: ownerId,
        ...(override !== null ? { minutes_saved_override: override } : {}),
      });
      if (result.ok && result.toolId && result.toolSlug) {
        setTool({ id: result.toolId, slug: result.toolSlug });
        setStep(3);
      } else {
        setError(result.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/w/${workspaceSlug}/tools`}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> All tools
        </Link>
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEP_TITLES.map((title, i) => (
            <div
              key={title}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                step >= i ? "w-7 bg-accent" : "w-3.5 bg-subtle",
              )}
            />
          ))}
        </div>
      </div>

      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-foreground-muted">
        Step {step + 1} of 4
      </p>
      <h1 className="numeral mt-1 text-3xl text-foreground">{STEP_TITLES[step]}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {step === 0 && (
            <WhatIsItStep
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              ownerId={ownerId}
              setOwnerId={setOwnerId}
              type={type}
              setType={setType}
              self={self}
              members={members}
              canPickOwner={canPickOwner}
              onNext={() => setStep(1)}
              valid={step1Valid}
            />
          )}
          {step === 1 && (
            <BaselineStep
              rawMinutes={rawMinutes}
              setRawMinutes={changeRawMinutes}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
              valid={step2Valid}
            />
          )}
          {step === 2 && (
            <CutsStep
              highJudgment={highJudgment}
              setHighJudgment={chooseJudgment}
              suggested={suggested}
              creditMinutes={creditMinutes}
              setCreditMinutes={setCreditMinutes}
              creditValid={creditValid}
              onBack={() => setStep(1)}
              onCreate={create}
              creating={creating}
              error={error}
            />
          )}
          {step === 3 && tool && type && (
            <CaptureStep
              workspaceSlug={workspaceSlug}
              tool={tool}
              type={type}
              endpoint={endpoint}
              rawMinutes={rawMinutes}
              highJudgment={highJudgment === true}
              overrideMinutes={overrideForDisplay}
            />
          )}
        </motion.div>

        {step >= 1 && (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <ReceiptFlow
              key={`${step >= 2}-${highJudgment}`}
              rawMinutes={rawMinutes}
              highJudgment={step >= 2 ? highJudgment : null}
              overrideMinutes={overrideForDisplay}
              closingLine={step >= 2 && highJudgment !== null}
              onAdjust={
                step === 2 && highJudgment !== null
                  ? () => {
                      const el = document.getElementById("tool-credit");
                      el?.scrollIntoView({ block: "center", behavior: "smooth" });
                      el?.focus({ preventScroll: true });
                    }
                  : undefined
              }
            />
            <p className="mt-2.5 text-xs leading-relaxed text-foreground-muted">
              {step < 2
                ? "This receipt is what one run of your tool earns. It updates as you answer."
                : "Every number on your dashboard traces back to a receipt like this."}
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — what is it
// ---------------------------------------------------------------------------

function WhatIsItStep({
  name,
  setName,
  description,
  setDescription,
  ownerId,
  setOwnerId,
  type,
  setType,
  self,
  members,
  canPickOwner,
  onNext,
  valid,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  ownerId: string;
  setOwnerId: (v: string) => void;
  type: ToolType | null;
  setType: (v: ToolType) => void;
  self: { id: string; name: string };
  members: { id: string; name: string }[];
  canPickOwner: boolean;
  onNext: () => void;
  valid: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tool-name">Name</Label>
          <Input
            id="tool-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Invoice triage bot"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tool-description">What does it do? (optional)</Label>
          <textarea
            id="tool-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Reads incoming invoices and files them with the right approver."
            className={cn(
              "flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors",
              "placeholder:text-foreground-muted",
              "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
            )}
          />
        </div>

        {canPickOwner ? (
          <div className="space-y-1.5">
            <Label htmlFor="tool-owner">Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger id="tool-owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.id === self.id ? " (you)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-foreground-muted">
              The owner gets credit for this tool&apos;s hours.
            </p>
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">
            Owner: {self.name}. You get credit for this tool&apos;s hours.
          </p>
        )}

        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOOL_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t];
              const selected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={selected}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left transition-colors",
                    selected
                      ? "border-accent bg-accent-soft/50"
                      : "border-border bg-surface hover:border-accent/40 hover:bg-subtle/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                      selected ? "bg-accent-soft text-accent" : "bg-subtle text-foreground-muted",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {TOOL_TYPE_META[t].label}
                      {selected && <Check className="size-3.5 text-accent" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-foreground-secondary">
                      {TOOL_TYPE_META[t].blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-foreground-muted">
            Type changes the setup instructions, not the math.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!valid}>
          Continue <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — baseline
// ---------------------------------------------------------------------------

function BaselineStep({
  rawMinutes,
  setRawMinutes,
  onBack,
  onNext,
  valid,
}: {
  rawMinutes: number;
  setRawMinutes: (v: number) => void;
  onBack: () => void;
  onNext: () => void;
  valid: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">
        Before this tool, how long did this take by hand, each time?
      </h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        One honest number, in minutes. Watch what happens to it on your receipt.
      </p>

      <BaselineField
        value={rawMinutes}
        onChange={setRawMinutes}
        id="tool-baseline"
        className="mt-5"
      />

      <p className="mt-4 text-xs text-foreground-muted">
        Unsure between two numbers? Take the lower one.
      </p>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid}>
          Continue <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — the cuts
// ---------------------------------------------------------------------------

const JUDGMENT_EXAMPLES = [
  "A draft gets reviewed before it goes out",
  "Someone approves the final call",
  "The output is edited before it is used",
];

function CutsStep({
  highJudgment,
  setHighJudgment,
  suggested,
  creditMinutes,
  setCreditMinutes,
  creditValid,
  onBack,
  onCreate,
  creating,
  error,
}: {
  highJudgment: boolean | null;
  setHighJudgment: (v: boolean) => void;
  /** The suggested Undercount; null until baseline + judgment are answered. */
  suggested: number | null;
  creditMinutes: number | null;
  setCreditMinutes: (v: number | null) => void;
  creditValid: boolean;
  onBack: () => void;
  onCreate: () => void;
  creating: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">
        Does a person still check each run?
      </h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        If someone still reviews, edits, or approves what comes out, we halve
        the credit.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setHighJudgment(true)}
          aria-pressed={highJudgment === true}
          className={cn(
            "cursor-pointer rounded-md border p-4 text-left transition-colors",
            highJudgment === true
              ? "border-accent bg-accent-soft/50"
              : "border-border bg-surface hover:border-accent/40 hover:bg-subtle/60",
          )}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Yes, a person still decides
            {highJudgment === true && <Check className="size-3.5 text-accent" aria-hidden />}
          </span>
          <ul className="mt-2 space-y-1">
            {JUDGMENT_EXAMPLES.map((example) => (
              <li key={example} className="text-xs leading-snug text-foreground-secondary">
                · {example}
              </li>
            ))}
          </ul>
          <span className="mt-2 block font-mono text-[0.6875rem] text-foreground-muted">
            credit ÷ 2
          </span>
        </button>

        <button
          type="button"
          onClick={() => setHighJudgment(false)}
          aria-pressed={highJudgment === false}
          className={cn(
            "cursor-pointer rounded-md border p-4 text-left transition-colors",
            highJudgment === false
              ? "border-accent bg-accent-soft/50"
              : "border-border bg-surface hover:border-accent/40 hover:bg-subtle/60",
          )}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            No, it runs start to finish
            {highJudgment === false && <Check className="size-3.5 text-accent" aria-hidden />}
          </span>
          <p className="mt-2 text-xs leading-snug text-foreground-secondary">
            The output is used as-is, without a human check along the way.
          </p>
          <span className="mt-2 block font-mono text-[0.6875rem] text-foreground-muted">
            no extra cut
          </span>
        </button>
      </div>

      <Link
        href="/methodology"
        className="mt-4 inline-block text-[0.8125rem] font-medium text-accent hover:underline"
      >
        How the cut works
      </Link>

      {suggested !== null && (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-[0.9375rem] font-semibold text-foreground">
            Your credited minutes per run
          </h3>
          <p className="mt-1 text-sm text-foreground-secondary">
            We suggest {fmtNum(suggested)} min, the number on your receipt. If
            you know the real number, set it yourself.
          </p>
          <CreditField
            suggested={suggested}
            value={creditMinutes}
            onChange={setCreditMinutes}
            id="tool-credit"
            className="mt-4"
          />
        </div>
      )}

      {error && <p className="mt-3 text-[0.8125rem] text-destructive">{error}</p>}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={creating}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <Button
          onClick={onCreate}
          disabled={highJudgment === null || !creditValid || creating}
        >
          {creating ? "Creating…" : "Create the tool"}
          {!creating && <ArrowRight aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

export { ToolWizard };
