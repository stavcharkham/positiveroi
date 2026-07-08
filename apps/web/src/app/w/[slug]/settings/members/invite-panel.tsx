"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { MemberRole } from "@positiveroi/core";
import { createInviteAction } from "@/lib/actions/invites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { revokeInviteAction } from "./actions";

export interface InviteListItem {
  id: string;
  role: MemberRole;
  /** Preformatted, e.g. "3 of 25 used". */
  uses: string;
  /** Preformatted, e.g. "expires in 9 days". */
  expires: string;
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "builder", label: "Builder" },
  { value: "lead", label: "Lead" },
  { value: "admin", label: "Admin" },
];

function InvitePanel({
  slug,
  invites,
}: {
  slug: string;
  invites: InviteListItem[];
}) {
  const router = useRouter();
  const [role, setRole] = React.useState<MemberRole>("builder");
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  async function createLink() {
    setPending(true);
    setError(null);
    setUrl(null);
    const result = await createInviteAction(slug, role);
    if (result.ok && result.url) {
      setUrl(result.url);
      router.refresh();
    } else {
      setError(result.error ?? "Could not create the link.");
    }
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

  async function revoke(id: string) {
    setRevokingId(id);
    const result = await revokeInviteAction(slug, id);
    if (result.ok) {
      toast.success("Invite revoked. The link no longer works.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not revoke the invite.");
    }
    setRevokingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite links</CardTitle>
        <CardDescription>
          Anyone with a link joins with the role it carries. Links work 25
          times and expire after 14 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={role}
            onValueChange={(v) => setRole(v as MemberRole)}
          >
            <SelectTrigger className="sm:w-36" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={createLink}
            disabled={pending}
            className="sm:flex-1"
          >
            <Link2 aria-hidden />
            {pending ? "Creating…" : "Create invite link"}
          </Button>
        </div>

        {url && (
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button variant="secondary" onClick={copy} className="shrink-0">
              {copied ? (
                <Check className="text-success" aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
        {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}

        {invites.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 py-3">
                <Badge variant="outline">{invite.role}</Badge>
                <span className="text-sm text-foreground-secondary">
                  {invite.uses}
                </span>
                <span className="flex-1 text-sm text-foreground-muted">
                  {invite.expires}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(invite.id)}
                  disabled={revokingId === invite.id}
                  className="text-destructive hover:text-destructive"
                >
                  {revokingId === invite.id ? "Revoking…" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { InvitePanel };
