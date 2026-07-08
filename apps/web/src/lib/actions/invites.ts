"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { MemberRole } from "@positiveroi/core";
import { requireMember, requireUser } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Link invites. The URL token is random and only its sha256 lands in the
 * database; acceptance derives workspace and role strictly from the token row.
 */

export interface CreateInviteResult {
  ok: boolean;
  error?: string;
  /** Full invite URL — the only time the token leaves the server. */
  url?: string;
}

export async function createInviteAction(
  workspaceSlug: string,
  role: MemberRole = "builder",
): Promise<CreateInviteResult> {
  const { user, workspace } = await requireMember(workspaceSlug, "admin");

  const token = randomBytes(24).toString("base64url");
  const admin = getAdminClient();
  const { error } = await admin.from("invites").insert({
    workspace_id: workspace.id,
    role,
    token_hash: sha256(token),
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not create the invite link. Try again." };

  return { ok: true, url: `${await requestOrigin()}/invite/${token}` };
}

export interface InviteLookup {
  workspaceName: string;
  workspaceSlug: string;
  role: MemberRole;
  alreadyMember: boolean;
}

/** Validate a token for display. Returns null for anything not acceptable. */
export async function lookupInvite(token: string): Promise<InviteLookup | null> {
  const invite = await fetchValidInvite(token);
  if (!invite) return null;

  const user = await requireUser();
  const admin = getAdminClient();
  const { data: existing } = await admin
    .from("members")
    .select("user_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    workspaceName: invite.workspaces.name,
    workspaceSlug: invite.workspaces.slug,
    role: invite.role,
    alreadyMember: Boolean(existing),
  };
}

export async function acceptInviteAction(token: string): Promise<void> {
  const user = await requireUser();
  const invite = await fetchValidInvite(token);
  if (!invite) redirect("/invite/invalid");

  const admin = getAdminClient();
  const slug = invite.workspaces.slug;
  const home = invite.role === "builder" ? `/w/${slug}/me` : `/w/${slug}`;

  const { data: existing } = await admin
    .from("members")
    .select("user_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect(home);

  const { error: insertError } = await admin.from("members").insert({
    workspace_id: invite.workspace_id,
    user_id: user.id,
    role: invite.role,
    display_name: defaultDisplayName(user.email, user.user_metadata),
  });
  if (insertError) redirect("/invite/invalid");

  // Optimistic use-count bump; a concurrent accept just retries once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: current } = await admin
      .from("invites")
      .select("use_count")
      .eq("id", invite.id)
      .single();
    if (!current) break;
    const { data: updated } = await admin
      .from("invites")
      .update({ use_count: current.use_count + 1 })
      .eq("id", invite.id)
      .eq("use_count", current.use_count)
      .select("id");
    if (updated?.length) break;
  }

  redirect(home);
}

interface ValidInviteRow {
  id: string;
  workspace_id: string;
  role: MemberRole;
  workspaces: { name: string; slug: string };
}

async function fetchValidInvite(token: string): Promise<ValidInviteRow | null> {
  if (!token || token.length > 128) return null;
  const admin = getAdminClient();
  const { data } = await admin
    .from("invites")
    .select(
      "id, workspace_id, role, max_uses, use_count, expires_at, revoked_at, workspaces(name, slug)",
    )
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (
    !data ||
    data.revoked_at ||
    new Date(data.expires_at).getTime() < Date.now() ||
    data.use_count >= data.max_uses ||
    !data.workspaces
  ) {
    return null;
  }
  return data as unknown as ValidInviteRow;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function defaultDisplayName(
  email: string | undefined,
  metadata: Record<string, unknown>,
): string {
  const full = metadata?.full_name;
  if (typeof full === "string" && full.trim()) return full.trim().slice(0, 60);
  return (email?.split("@")[0] ?? "member").slice(0, 60);
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
