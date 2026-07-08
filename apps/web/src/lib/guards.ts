import "server-only";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { MemberRole } from "@positiveroi/core";
import { createClient } from "@/lib/supabase/server";

/**
 * Human auth plane. Guards run on the user's RLS client so membership is
 * PROVEN by row visibility, not asserted by app code. Only after that do
 * callers reach for the service-role client.
 */

const ROLE_ORDER: Record<MemberRole, number> = {
  builder: 0,
  lead: 1,
  admin: 2,
};

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  hourly_rate_cents: number;
  currency: string;
  public_enabled: boolean;
  public_slug: string | null;
  public_config: {
    show_tools: boolean;
    show_builders: boolean;
    show_money: boolean;
  };
  created_at: string;
}

export interface MemberRow {
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string;
  created_at: string;
}

/** Signed-in user or redirect to /login. */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Membership guard for /w/[slug] surfaces. The workspace row is fetched with
 * the USER's client — RLS only returns it to members, so a hit is proof.
 * Insufficient role redirects to the workspace home rather than erroring.
 */
export async function requireMember(
  workspaceSlug: string,
  minRole: MemberRole = "builder",
): Promise<{ user: User; workspace: WorkspaceRow; member: MemberRow }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (!workspace) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) notFound();

  const role = member.role as MemberRole;
  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
    redirect(`/w/${workspaceSlug}`);
  }

  return {
    user,
    workspace: workspace as WorkspaceRow,
    member: member as MemberRow,
  };
}
