import type { Metadata } from "next";
import type { MemberRole } from "@positiveroi/core";
import { requireMember } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { expiresIn, formatDate } from "../format";
import { InvitePanel, type InviteListItem } from "./invite-panel";

export const metadata: Metadata = { title: "Members" };

const ROLE_BADGE: Record<MemberRole, "accent" | "outline" | "neutral"> = {
  admin: "accent",
  lead: "outline",
  builder: "neutral",
};

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireMember(slug, "admin");

  const admin = getAdminClient();
  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    admin
      .from("members")
      .select("user_id, role, display_name, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    admin
      .from("invites")
      .select("id, role, max_uses, use_count, expires_at, created_at")
      .eq("workspace_id", workspace.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const members = (memberRows ?? []) as {
    user_id: string;
    role: MemberRole;
    display_name: string;
    created_at: string;
  }[];

  const invites = activeInvites(inviteRows ?? []);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length === 1
              ? "1 person in this workspace."
              : `${members.length} people in this workspace.`}{" "}
            Role changes are coming; for now, invite links carry the role.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar name={member.display_name || "Member"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.display_name || "Member"}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    Joined {formatDate(member.created_at)}
                  </p>
                </div>
                <Badge variant={ROLE_BADGE[member.role]}>{member.role}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <InvitePanel slug={slug} invites={invites} />
    </div>
  );
}

interface InviteRow {
  id: string;
  role: string;
  max_uses: number;
  use_count: number;
  expires_at: string;
  created_at: string;
}

/** Usable invites only: not revoked (filtered in SQL), not expired, not used up. */
function activeInvites(rows: InviteRow[]): InviteListItem[] {
  const now = Date.now();
  return rows
    .filter(
      (i) => new Date(i.expires_at).getTime() > now && i.use_count < i.max_uses,
    )
    .map((i) => ({
      id: i.id,
      role: i.role as MemberRole,
      uses: `${i.use_count} of ${i.max_uses} used`,
      expires: expiresIn(i.expires_at),
    }));
}
