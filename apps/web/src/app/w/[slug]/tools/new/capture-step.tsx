"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Check } from "lucide-react";
import type { ToolType } from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/product/receipt";
import { SourceBadge } from "@/components/product/source-badge";
import { onboardingKeySlot } from "@/lib/profile";
import { SnippetsPanel } from "../snippets-panel";
import { fmtNum } from "../tool-meta";
import {
  getFirstRunAction,
  logManualRunAction,
  sendTestRunAction,
  type FirstRunPayload,
} from "./actions";

export interface CaptureStepProps {
  workspaceSlug: string;
  tool: { id: string; slug: string };
  type: ToolType;
  endpoint: string;
  rawMinutes: number;
  highJudgment: boolean;
  /** Builder-set credit when it differs from the suggestion. */
  overrideMinutes?: number;
  /** Fresh ingest key from onboarding — shown inline, embedded in snippets. */
  ingestKey?: string | null;
  /** Onboarding first-tool flow: confetti + tour when the first run lands. */
  onboarding?: boolean;
}

/**
 * Wizard step 4 — the aha moment. Type-specific snippets, then a live
 * "waiting for your first run" footer that polls a server action every 3s
 * and stamps the first real event in when it lands.
 */
function CaptureStep({
  workspaceSlug,
  tool,
  type,
  endpoint,
  rawMinutes,
  highJudgment,
  overrideMinutes,
  ingestKey = null,
  onboarding = false,
}: CaptureStepProps) {
  const [firstRun, setFirstRun] = React.useState<FirstRunPayload | null>(null);
  const [testSent, setTestSent] = React.useState(false);
  // Leaving the wizard for any reason (skip, navigation) drops the one
  // plaintext copy of the onboarding key. Display state is unaffected —
  // the wizard already read it.
  React.useEffect(() => {
    if (!onboarding) return;
    return () => {
      try {
        sessionStorage.removeItem(onboardingKeySlot(workspaceSlug));
      } catch {
        // Storage unavailable — nothing to clear.
      }
    };
  }, [onboarding, workspaceSlug]);
  const [pending, setPending] = React.useState<"test" | "manual" | null>(null);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    if (firstRun) return;
    const interval = setInterval(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await getFirstRunAction(workspaceSlug, tool.id);
        if (result.event) setFirstRun(result.event);
      } catch {
        // Transient network failure — the next tick retries.
      } finally {
        inFlight.current = false;
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [firstRun, workspaceSlug, tool.id]);

  async function sendTest() {
    setPending("test");
    try {
      const result = await sendTestRunAction(workspaceSlug, tool.id);
      if (result.ok) {
        setTestSent(true);
        toast.success("Test run landed. It is never counted in totals.");
      } else {
        toast.error(result.error ?? "The test run failed. Try again.");
      }
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  async function logManual() {
    setPending("manual");
    try {
      const result = await logManualRunAction(workspaceSlug, tool.id);
      if (result.ok) {
        toast.success("Run logged. It counts.");
        // Surface it immediately instead of waiting for the next poll tick.
        const first = await getFirstRunAction(workspaceSlug, tool.id);
        if (first.event) setFirstRun(first.event);
      } else {
        toast.error(result.error ?? "Could not log the run. Try again.");
      }
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  const toolPath = `/w/${workspaceSlug}/tools/${tool.id}`;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">
          Wire up the capture
        </h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Add this where the tool does its work, so every run reports itself.
        </p>
        <div className="mt-4">
          <SnippetsPanel
            type={type}
            toolSlug={tool.slug}
            endpoint={endpoint}
            workspaceSlug={workspaceSlug}
            ingestKey={ingestKey ?? undefined}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-xs">
        {firstRun ? (
          <FirstRunLanded
            firstRun={firstRun}
            rawMinutes={rawMinutes}
            highJudgment={highJudgment}
            overrideMinutes={overrideMinutes}
            toolPath={toolPath}
            workspaceSlug={workspaceSlug}
            onboarding={onboarding}
          />
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
              </span>
              <p className="text-sm font-medium text-foreground">
                Waiting for your first run…
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
              Trigger the tool once with the snippet above and the run appears
              here, receipt and all.
            </p>

            {testSent && (
              <div className="mt-4">
                <Receipt
                  rawMinutes={rawMinutes}
                  highJudgment={highJudgment}
                  overrideMinutes={overrideMinutes}
                  isTest
                  animate
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={sendTest}
                disabled={pending !== null}
              >
                {pending === "test" ? "Sending…" : "Send a test run"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={logManual}
                disabled={pending !== null}
              >
                {pending === "manual" ? "Logging…" : "Log a run manually"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-foreground-muted">
              A test run checks the connection and is never counted. A manual
              run is real and counts.
            </p>

            <div className="mt-5 border-t border-border pt-4">
              <Link
                href={toolPath}
                className="text-[0.8125rem] text-foreground-secondary transition-colors hover:text-foreground"
              >
                Skip for now, finish setup later
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function FirstRunLanded({
  firstRun,
  rawMinutes,
  highJudgment,
  overrideMinutes,
  toolPath,
  workspaceSlug,
  onboarding,
}: {
  firstRun: FirstRunPayload;
  rawMinutes: number;
  highJudgment: boolean;
  overrideMinutes?: number;
  toolPath: string;
  workspaceSlug: string;
  onboarding: boolean;
}) {
  // The whimsy moment: confetti when the very first run lands during
  // onboarding. Skipped for reduced-motion users; the key slot is cleared
  // either way — the tool is wired, the key has done its job.
  React.useEffect(() => {
    if (!onboarding) return;
    try {
      sessionStorage.removeItem(onboardingKeySlot(workspaceSlug));
    } catch {
      // Storage unavailable — nothing to clear.
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const fire = (particleRatio: number, opts: object) =>
        confetti({
          particleCount: Math.floor(160 * particleRatio),
          spread: 70,
          origin: { y: 0.6 },
          ...opts,
        });
      fire(0.4, {});
      fire(0.3, { spread: 100, decay: 0.91, scalar: 0.9 });
      fire(0.3, { spread: 120, startVelocity: 45, angle: 60, origin: { x: 0 } });
      fire(0.3, { spread: 120, startVelocity: 45, angle: 120, origin: { x: 1 } });
    });
    return () => {
      cancelled = true;
    };
  }, [onboarding, workspaceSlug]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft">
          <Check className="size-4.5 text-accent" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Your first run landed
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {new Date(firstRun.occurredAt).toLocaleString()} ·{" "}
            {fmtNum(firstRun.minutesSaved)} min saved
          </p>
        </div>
        <SourceBadge source={firstRun.source} />
      </div>

      <div className="mt-4">
        <Receipt
          rawMinutes={rawMinutes}
          highJudgment={highJudgment}
          overrideMinutes={overrideMinutes}
        />
      </div>

      {onboarding ? (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-sm font-semibold text-foreground">
            Your tool is on the board. Here&apos;s what&apos;s next:
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <TourCard
              href={`/w/${workspaceSlug}/settings/members`}
              title="Invite your team"
              body="Every builder's tools land on one dashboard."
            />
            <TourCard
              href={`/w/${workspaceSlug}/metrics`}
              title="Add business metrics"
              body="Track leads, revenue, touchpoints — not just time."
            />
            <TourCard
              href={`/w/${workspaceSlug}/settings/public`}
              title="Go public"
              body="An opt-in public page and badge for your impact."
            />
          </div>
          <Button asChild className="mt-4">
            <Link href={`/w/${workspaceSlug}`}>
              Go to your dashboard <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : (
        <Button asChild className="mt-5">
          <Link href={toolPath}>
            Go to the tool page <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}
    </motion.div>
  );
}

function TourCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-surface p-3 transition-colors hover:border-accent/40 hover:bg-subtle/60"
    >
      <span className="block text-[0.8125rem] font-medium text-foreground">
        {title}
      </span>
      <span className="mt-0.5 block text-xs leading-snug text-foreground-secondary">
        {body}
      </span>
    </Link>
  );
}

export { CaptureStep };
