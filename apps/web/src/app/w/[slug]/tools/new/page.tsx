import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { ToolWizard } from "./wizard";

export const metadata: Metadata = { title: "Register a tool" };

export default async function NewToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { slug } = await params;
  const { onboarding } = await searchParams;
  const { user, workspace, member } = await requireMember(slug);

  // Leads and admins can register a tool on behalf of another member.
  const canPickOwner = member.role !== "builder";
  let members: { id: string; name: string }[] = [];
  if (canPickOwner) {
    const admin = getAdminClient();
    const { data } = await admin
      .from("members")
      .select("user_id, display_name")
      .eq("workspace_id", workspace.id)
      .order("display_name");
    members = ((data ?? []) as { user_id: string; display_name: string }[]).map(
      (m) => ({ id: m.user_id, name: m.display_name }),
    );
  }

  return (
    <ToolWizard
      workspaceSlug={slug}
      self={{ id: user.id, name: member.display_name || "You" }}
      members={members}
      canPickOwner={canPickOwner}
      endpoint={await requestOrigin()}
      onboarding={onboarding === "1"}
    />
  );
}

/** Origin of the current request — inlined into the capture snippets. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
