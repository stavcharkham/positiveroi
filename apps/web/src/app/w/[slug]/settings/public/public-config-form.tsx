"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PublicImpactView,
  type PublicImpactData,
} from "@/app/p/[slug]/public-impact-view";
import { updatePublicConfigAction } from "./actions";

const PUBLIC_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export interface PublicConfigInitial {
  enabled: boolean;
  publicSlug: string;
  showTools: boolean;
  showBuilders: boolean;
  showMoney: boolean;
}

function PublicConfigForm({
  slug,
  origin,
  initial,
  data,
}: {
  slug: string;
  origin: string;
  initial: PublicConfigInitial;
  data: PublicImpactData;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [publicSlug, setPublicSlug] = React.useState(initial.publicSlug);
  const [showTools, setShowTools] = React.useState(initial.showTools);
  const [showBuilders, setShowBuilders] = React.useState(initial.showBuilders);
  const [showMoney, setShowMoney] = React.useState(initial.showMoney);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const slugValid = PUBLIC_SLUG_RE.test(publicSlug);
  const publicUrl = `${origin}/p/${publicSlug}`;
  const badgeUrl = `${origin}/badge/${publicSlug}`;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await updatePublicConfigAction(slug, {
        enabled,
        publicSlug,
        showTools,
        showBuilders,
        showMoney,
      });
      if (result.ok) {
        toast.success(
          enabled ? "Saved. Your impact page is live." : "Saved. The page stays private.",
        );
        router.refresh();
      } else {
        setError(result.error ?? "Could not save. Try again.");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Public impact page</CardTitle>
          <CardDescription>
            A shareable proof page: hours saved in the last 90 days, counted with the
            Undercount. No names, no emails, nothing you do not opt into.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="public-enabled">Publish the page</Label>
              <p className="mt-0.5 text-xs text-foreground-muted">
                Off means a plain 404 for everyone.
              </p>
            </div>
            <Switch
              id="public-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="public-slug">Public address</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-xs text-foreground-muted">
                {origin}/p/
              </span>
              <Input
                id="public-slug"
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value.toLowerCase())}
                maxLength={40}
                className="font-mono text-xs"
                aria-invalid={!slugValid}
              />
            </div>
            {!slugValid && (
              <p className="text-xs text-destructive">
                3 to 40 characters: lowercase letters, numbers, and hyphens.
                Starts and ends with a letter or number.
              </p>
            )}
          </div>

          <div className="space-y-4 border-t border-border pt-5">
            <ToggleRow
              id="show-tools"
              label="Show top tools"
              hint="Tool names and hours only."
              checked={showTools}
              onCheckedChange={setShowTools}
            />
            <ToggleRow
              id="show-builders"
              label="Show builders"
              hint="Count of active builders and Multipliers earned. Never names."
              checked={showBuilders}
              onCheckedChange={setShowBuilders}
            />
            <ToggleRow
              id="show-money"
              label="Show money"
              hint="Hours times your hourly rate."
              checked={showMoney}
              onCheckedChange={setShowMoney}
            />
          </div>

          {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            {initial.enabled && (
              <Button asChild variant="ghost" size="sm">
                <a
                  href={`/p/${initial.publicSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View live page <ExternalLink aria-hidden />
                </a>
              </Button>
            )}
            <Button onClick={save} disabled={pending || !slugValid}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section aria-label="Preview">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">Preview</h2>
          <span className="font-mono text-[0.6875rem] text-foreground-muted">
            real numbers, live toggles
          </span>
        </div>
        <div className="relative mt-3 max-h-[560px] overflow-hidden rounded-lg border border-border bg-background">
          <div className="pointer-events-none select-none" aria-hidden>
            <div className="w-[182%] origin-top-left scale-[0.55]">
              <PublicImpactView
                data={data}
                config={{
                  show_tools: showTools,
                  show_builders: showBuilders,
                  show_money: showMoney,
                }}
              />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
          {!enabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[2px]">
              <span className="rounded-full border border-border bg-elevated px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                Not published
              </span>
              <p className="text-xs text-foreground-secondary">
                Turn on publishing to make this page live.
              </p>
            </div>
          )}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Badge</CardTitle>
          <CardDescription>
            Drop it in a README or on your site. It links back to the page and
            updates on its own. Add ?theme=dark for dark backgrounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <CodeBlock
            caption="Markdown"
            code={`[![Hours saved in the last 90 days](${badgeUrl})](${publicUrl})`}
          />
          <CodeBlock
            caption="HTML"
            code={`<a href="${publicUrl}"><img src="${badgeUrl}" alt="Hours saved in the last 90 days, counted with PositiveROI" /></a>`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export { PublicConfigForm };
