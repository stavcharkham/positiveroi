import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { acceptInviteAction, lookupInvite } from "@/lib/actions/invites";
import { BUILDER_TYPES } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);

  const invite = await lookupInvite(token);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        {invite ? (
          <>
            <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-accent-soft">
              <UserPlus className="size-5 text-accent" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-foreground">
              Join {invite.workspaceName}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
              {invite.alreadyMember
                ? "You are already a member of this workspace."
                : `You've been invited as a ${invite.role}. Your runs and credited time will appear on this workspace's dashboards.`}
            </p>
            {invite.alreadyMember ? (
              <Button asChild className="mt-5 w-full">
                <Link href={`/w/${invite.workspaceSlug}`}>Open workspace</Link>
              </Button>
            ) : (
              <form action={acceptInviteAction.bind(null, token)}>
                <fieldset className="mt-5 text-left">
                  <legend className="text-[0.8125rem] font-medium text-foreground">
                    How do you build? (optional)
                  </legend>
                  <div className="mt-2 grid gap-2">
                    {BUILDER_TYPES.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface p-3 transition-colors hover:border-accent/40 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/50"
                      >
                        <input
                          type="radio"
                          name="builder_type"
                          value={option.value}
                          className="mt-0.5 accent-[var(--color-accent)]"
                        />
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-foreground-secondary">
                            {option.blurb}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" className="mt-4 w-full">
                  Accept invitation
                </Button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              This invite link isn&apos;t valid
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
              It may have expired, been revoked, or reached its use limit. Ask
              the person who sent it for a new one.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
