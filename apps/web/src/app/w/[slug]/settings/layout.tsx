import { requireMember } from "@/lib/guards";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "./settings-nav";

/**
 * Settings is reachable by every member: API keys are user-level, so builders
 * and leads manage their own keys here. General, Members, and Public stay
 * admin-only — each of those pages enforces requireMember(slug, "admin")
 * itself; this layout only proves membership and trims the nav.
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { member } = await requireMember(slug);
  const isAdmin = member.role === "admin";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? "Workspace, members, API keys, and your public page."
            : "Your API keys."
        }
        className="pb-5"
      />
      <SettingsNav slug={slug} isAdmin={isAdmin} />
      <div className="py-8">{children}</div>
    </div>
  );
}
