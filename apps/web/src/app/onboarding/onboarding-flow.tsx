"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Copy, KeyRound, Link2 } from "lucide-react";
import { createInviteAction } from "@/lib/actions/invites";
import { createWorkspaceAction } from "@/lib/actions/workspaces";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = "create" | "key" | "invite" | "done";
const STEPS: Step[] = ["create", "key", "invite", "done"];

/**
 * One-screen-per-decision onboarding: workspace → ingest key (shown once) →
 * skippable invite link → first-tool prompt. Timezone is captured silently.
 */
function OnboardingFlow() {
  const [step, setStep] = React.useState<Step>("create");
  const [slug, setSlug] = React.useState("");
  const [ingestKey, setIngestKey] = React.useState("");

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              STEPS.indexOf(step) >= i ? "w-8 bg-accent" : "w-4 bg-subtle",
            )}
          />
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {step === "create" && (
          <CreateStep
            onCreated={(s, key) => {
              setSlug(s);
              setIngestKey(key);
              setStep("key");
            }}
          />
        )}
        {step === "key" && (
          <KeyStep ingestKey={ingestKey} onNext={() => setStep("invite")} />
        )}
        {step === "invite" && (
          <InviteStep slug={slug} onNext={() => setStep("done")} />
        )}
        {step === "done" && <DoneStep slug={slug} />}
      </motion.div>
    </div>
  );
}

function CreateStep({
  onCreated,
}: {
  onCreated: (slug: string, ingestKey: string) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await createWorkspaceAction({
      name: String(form.get("name") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (result.ok && result.slug && result.ingestKey) {
      onCreated(result.slug, result.ingestKey);
    } else {
      setError(result.error ?? "Something went wrong. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h1 className="numeral text-2xl text-foreground">Create your workspace</h1>
      <p className="mt-1.5 text-sm text-foreground-secondary">
        Where your team&apos;s AI tools and their numbers live.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" name="name" required maxLength={80} placeholder="Acme" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            name="displayName"
            required
            maxLength={60}
            placeholder="Dana Levi"
            autoComplete="name"
          />
        </div>
        {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </div>
  );
}

function KeyStep({ ingestKey, onNext }: { ingestKey: string; onNext: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft">
        <KeyRound className="size-5 text-accent" aria-hidden />
      </div>
      <h1 className="numeral mt-4 text-2xl text-foreground">Your ingest key</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
        Tools use this key to report their runs. This is the only time
        it&apos;s shown — copy it somewhere safe. You can create more keys in
        Settings.
      </p>
      <CodeBlock code={ingestKey} caption="Default ingest key" className="mt-4" />
      <Button onClick={onNext} className="mt-5 w-full">
        I saved it <ArrowRight aria-hidden />
      </Button>
    </div>
  );
}

function InviteStep({ slug, onNext }: { slug: string; onNext: () => void }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function createLink() {
    setPending(true);
    setError(null);
    const result = await createInviteAction(slug);
    if (result.ok && result.url) setUrl(result.url);
    else setError(result.error ?? "Could not create the link.");
    setPending(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the link is visible to copy by hand.
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft">
        <Link2 className="size-5 text-accent" aria-hidden />
      </div>
      <h1 className="numeral mt-4 text-2xl text-foreground">Invite your builders</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
        Anyone with this link joins as a builder. It works 25 times and
        expires in 14 days.
      </p>

      {url ? (
        <div className="mt-4 flex items-center gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button variant="secondary" size="md" onClick={copy} className="shrink-0">
            {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={createLink}
          disabled={pending}
          className="mt-4 w-full"
        >
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      )}
      {error && <p className="mt-2 text-[0.8125rem] text-destructive">{error}</p>}

      <Button onClick={onNext} className="mt-5 w-full">
        {url ? "Continue" : "Skip for now"} <ArrowRight aria-hidden />
      </Button>
    </div>
  );
}

function DoneStep({ slug }: { slug: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
      <h1 className="numeral text-2xl text-foreground">Register your first tool</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-foreground-secondary">
        Name it, set an honest baseline, and watch the first run land. Takes
        about two minutes.
      </p>
      <Button asChild className="mt-5 w-full">
        <Link href={`/w/${slug}/tools/new`}>
          Register a tool <ArrowRight aria-hidden />
        </Link>
      </Button>
      <Button asChild variant="ghost" className="mt-2 w-full">
        <Link href={`/w/${slug}`}>Go to the dashboard</Link>
      </Button>
    </div>
  );
}

export { OnboardingFlow };
