"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export interface ApiKeyListItem {
  id: string;
  name: string;
  scope: "ingest" | "read";
  /** Display prefix, e.g. "roi_ingest_3fk2". */
  prefix: string;
  /** Preformatted creation date. */
  created: string;
  /** Preformatted "3h ago", or null when never used. */
  lastUsed: string | null;
  revoked: boolean;
}

/** Another member's keys, labeled with their display name. */
export interface KeyGroup {
  owner: string;
  keys: ApiKeyListItem[];
}

function KeysPanel({
  slug,
  isAdmin,
  myKeys,
  otherGroups,
}: {
  slug: string;
  isAdmin: boolean;
  myKeys: ApiKeyListItem[];
  otherGroups: KeyGroup[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyListItem | null>(
    null,
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Your API keys</CardTitle>
            <CardDescription>
              Ingest keys log runs. Rotate by creating a new key, switching,
              then revoking the old one.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus aria-hidden /> Create key
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {myKeys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              body="Create an ingest key and drop it into a tool. Every run it logs lands on the dashboard."
            >
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden /> Create key
              </Button>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {myKeys.map((key) => (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  onRevoke={() => setRevokeTarget(key)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>All workspace keys</CardTitle>
            <CardDescription>
              Every other member&apos;s keys, grouped by owner. You can revoke
              any of them.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {otherGroups.length === 0 ? (
              <p className="text-sm text-foreground-muted">
                No one else has created a key yet.
              </p>
            ) : (
              <div className="space-y-5">
                {otherGroups.map((group, i) => (
                  <div key={`${group.owner}-${i}`}>
                    <p className="pb-1 text-xs font-medium text-foreground-secondary">
                      {group.owner}
                    </p>
                    <ul className="divide-y divide-border">
                      {group.keys.map((key) => (
                        <KeyRow
                          key={key.id}
                          apiKey={key}
                          onRevoke={() => setRevokeTarget(key)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-foreground-muted">
        Keys belong to you. When someone leaves, revoke their keys and nothing
        else changes.
      </p>

      <CreateKeyDialog
        slug={slug}
        canCreateRead={isAdmin}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) router.refresh();
        }}
      />
      <RevokeKeyDialog
        slug={slug}
        target={revokeTarget}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}

function KeyRow({
  apiKey,
  onRevoke,
}: {
  apiKey: ApiKeyListItem;
  onRevoke: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              apiKey.revoked
                ? "text-sm font-medium text-foreground-muted line-through"
                : "text-sm font-medium text-foreground"
            }
          >
            {apiKey.name}
          </span>
          <Badge variant={apiKey.scope === "ingest" ? "accent" : "neutral"}>
            {apiKey.scope}
          </Badge>
          {apiKey.revoked ? (
            <Badge variant="destructive">revoked</Badge>
          ) : apiKey.lastUsed === null ? (
            <Badge variant="warning">
              <TriangleAlert aria-hidden /> never used
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 font-mono text-xs text-foreground-muted">
          {apiKey.prefix}…{" · "}created {apiKey.created}
          {apiKey.lastUsed !== null && ` · last used ${apiKey.lastUsed}`}
        </p>
      </div>
      {!apiKey.revoked && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          className="text-destructive hover:text-destructive"
        >
          Revoke
        </Button>
      )}
    </li>
  );
}

function CreateKeyDialog({
  slug,
  canCreateRead,
  open,
  onOpenChange,
}: {
  slug: string;
  canCreateRead: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scope, setScope] = React.useState<"ingest" | "read">("ingest");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);

  function close() {
    onOpenChange(false);
    // Reset after the close animation; the secret must not linger in state.
    setTimeout(() => {
      setSecret(null);
      setError(null);
      setScope("ingest");
    }, 300);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await createApiKeyAction(slug, {
      name: String(form.get("name") ?? ""),
      scope,
    });
    if (result.ok && result.secret) {
      setSecret(result.secret);
    } else {
      setError(result.error ?? "Could not create the key. Try again.");
    }
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent>
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>Key created</DialogTitle>
              <DialogDescription>
                Copy it now. This is the only time the key is shown; only a
                fingerprint is stored.
              </DialogDescription>
            </DialogHeader>
            <CodeBlock code={secret} caption={`${scope} key`} />
            <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
              />
              <p className="text-[0.8125rem] leading-relaxed text-foreground">
                If you lose it, revoke this key and create a new one.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={close}>I saved it</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>
                The secret is shown once, right after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                name="name"
                maxLength={80}
                placeholder="Support triage bot"
                autoFocus
              />
            </div>
            {canCreateRead ? (
              <div className="space-y-1.5">
                <Label htmlFor="key-scope">Scope</Label>
                <Select
                  value={scope}
                  onValueChange={(v) => setScope(v as "ingest" | "read")}
                >
                  <SelectTrigger id="key-scope" aria-label="Key scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingest">
                      Ingest — tools log runs
                    </SelectItem>
                    <SelectItem value="read">
                      Read — pull stats and reports
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-foreground-muted">
                  An ingest key can never read money or per-builder numbers.
                </p>
              </div>
            ) : (
              <p className="text-xs text-foreground-muted">
                This creates an ingest key. It logs runs and can never read
                money or per-builder numbers. Read keys are created by admins.
              </p>
            )}
            {error && (
              <p className="text-[0.8125rem] text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevokeKeyDialog({
  slug,
  target,
  onClose,
}: {
  slug: string;
  target: ApiKeyListItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function revoke() {
    if (!target) return;
    setPending(true);
    const result = await revokeApiKeyAction(slug, target.id);
    if (result.ok) {
      toast.success("Key revoked. It stops working immediately.");
      router.refresh();
      onClose();
    } else {
      toast.error(result.error ?? "Could not revoke the key.");
    }
    setPending(false);
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {target?.name}?</DialogTitle>
          <DialogDescription>
            Anything using {target?.prefix}… stops reporting immediately. Runs
            it already logged stay counted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={revoke} disabled={pending}>
            {pending ? "Revoking…" : "Revoke key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { KeysPanel };
