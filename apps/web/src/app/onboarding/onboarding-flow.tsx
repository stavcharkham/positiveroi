"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import {
  createWorkspaceAction,
  saveWorkspaceProfileAction,
} from "@/lib/actions/workspaces";
import { BUILDER_TYPES, COMPANY_SIZES, onboardingKeySlot } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = "create" | "profile";
const STEPS: Step[] = ["create", "profile"];

/**
 * Two light screens, then straight into connecting the first tool: create
 * the workspace (name + your name), answer three profile questions, and
 * the tool wizard takes over with the fresh ingest key carried along in
 * sessionStorage — never in a URL. Invites come after the first run lands.
 */
function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("create");
  const [slug, setSlug] = React.useState("");
  const [ingestKey, setIngestKey] = React.useState("");

  function enterWorkspace() {
    try {
      sessionStorage.setItem(onboardingKeySlot(slug), ingestKey);
    } catch {
      // Storage unavailable — the wizard falls back to the placeholder key.
    }
    router.push(`/w/${slug}/tools/new?onboarding=1`);
  }

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
              setStep("profile");
            }}
          />
        )}
        {step === "profile" && (
          <ProfileStep slug={slug} onDone={enterWorkspace} />
        )}
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
    try {
      const result = await createWorkspaceAction({
        name: String(form.get("name") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (result.ok && result.slug && result.ingestKey) {
        onCreated(result.slug, result.ingestKey);
        return;
      }
      setError(result.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
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
          <Label htmlFor="name">Company name</Label>
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

function ProfileStep({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [website, setWebsite] = React.useState("");
  const [size, setSize] = React.useState<string | null>(null);
  const [builderType, setBuilderType] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await saveWorkspaceProfileAction(slug, {
        ...(website.trim() ? { website } : {}),
        ...(size ? { companySize: size } : {}),
        ...(builderType ? { builderType } : {}),
      });
    } catch {
      // Profile answers are a signal, not a gate — never block the flow.
    }
    onDone();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h1 className="numeral text-2xl text-foreground">A little about you</h1>
      <p className="mt-1.5 text-sm text-foreground-secondary">
        Thirty seconds, all optional. Then we connect your first tool.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="website">Company website</Label>
          <Input
            id="website"
            name="website"
            placeholder="acme.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            inputMode="url"
          />
          <p className="text-xs text-foreground-muted">
            We pull your logo from it, so the workspace feels like yours.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Company size</Label>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_SIZES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setSize(size === option.value ? null : option.value)
                }
                aria-pressed={size === option.value}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-colors",
                  size === option.value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-foreground-secondary hover:border-accent/50 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Are you a technical or a non-technical builder?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUILDER_TYPES.map((option) => {
              const selected = builderType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setBuilderType(selected ? null : option.value)
                  }
                  aria-pressed={selected}
                  className={cn(
                    "cursor-pointer rounded-md border p-3 text-left transition-colors",
                    selected
                      ? "border-accent bg-accent-soft/50"
                      : "border-border bg-surface hover:border-accent/40 hover:bg-subtle/60",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {option.label}
                    {selected && <Check className="size-3.5 text-accent" aria-hidden />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-foreground-secondary">
                    {option.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Connect your first tool"}
        </Button>
      </form>
    </div>
  );
}

export { OnboardingFlow };
