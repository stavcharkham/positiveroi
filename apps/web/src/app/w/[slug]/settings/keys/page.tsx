import type { Metadata } from "next";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { formatDate, timeAgo } from "../format";
import { KeysPanel, type ApiKeyListItem } from "./keys-panel";

export const metadata: Metadata = { title: "API keys" };

export default async function KeysSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireMember(slug, "admin");

  const admin = getAdminClient();
  const { data: keyRows } = await admin
    .from("api_keys")
    .select("id, name, scope, key_prefix, created_at, last_used_at, revoked_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const keys: ApiKeyListItem[] = (keyRows ?? []).map((k) => ({
    id: k.id as string,
    name: (k.name as string) || "Untitled key",
    scope: k.scope as "ingest" | "read",
    prefix: k.key_prefix as string,
    created: formatDate(k.created_at as string),
    lastUsed: k.last_used_at ? timeAgo(k.last_used_at as string) : null,
    revoked: Boolean(k.revoked_at),
  }));

  return <KeysPanel slug={slug} keys={keys} />;
}
