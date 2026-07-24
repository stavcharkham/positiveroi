import { requireMember } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, workspace, member } = await requireMember(slug);

  // Every workspace this user belongs to, for the switcher (RLS-scoped).
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("members")
    .select("created_at, workspaces(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const workspaces = (memberships ?? [])
    .map((m) => m.workspaces as unknown as { name: string; slug: string } | null)
    .filter((w): w is { name: string; slug: string } => Boolean(w));

  return (
    <AppShell
      workspace={{
        name: workspace.name,
        slug: workspace.slug,
        logoUrl: workspace.logo_url,
      }}
      workspaces={workspaces}
      role={member.role}
      displayName={member.display_name || (user.email?.split("@")[0] ?? "You")}
      email={user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
