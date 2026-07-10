import type { Metadata } from "next";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  groupKeysByOwner,
  toKeyListItem,
  type ApiKeyDbRow,
} from "./group-keys";
import { KeysPanel, type KeyGroup } from "./keys-panel";

export const metadata: Metadata = { title: "API keys" };

/**
 * Keys are user-level: every member sees and manages their own. Admins also
 * see everyone's, grouped by owner. Reads go through the service-role client
 * because requireMember already proved membership via RLS.
 */
export default async function KeysSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, workspace, member } = await requireMember(slug);
  const isAdmin = member.role === "admin";

  const admin = getAdminClient();
  let query = admin
    .from("api_keys")
    .select(
      "id, name, scope, key_prefix, created_by, created_at, last_used_at, revoked_at",
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("created_by", user.id);
  const { data: keyRows } = await query;

  const rows = (keyRows ?? []) as ApiKeyDbRow[];
  const myKeys = rows
    .filter((k) => k.created_by === user.id)
    .map((k) => toKeyListItem(k));

  let otherGroups: KeyGroup[] = [];
  if (isAdmin) {
    const otherRows = rows.filter((k) => k.created_by !== user.id);
    if (otherRows.length > 0) {
      const { data: memberRows } = await admin
        .from("members")
        .select("user_id, display_name")
        .eq("workspace_id", workspace.id);
      const nameByUser = new Map(
        (memberRows ?? []).map((m) => [
          m.user_id as string,
          m.display_name as string,
        ]),
      );
      otherGroups = groupKeysByOwner(otherRows, nameByUser);
    }
  }

  return (
    <KeysPanel
      slug={slug}
      isAdmin={isAdmin}
      myKeys={myKeys}
      otherGroups={otherGroups}
    />
  );
}
