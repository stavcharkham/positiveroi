import { requireMember } from "@/lib/guards";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "./settings-nav";

/**
 * Settings is an admin surface: viewing and every mutation require the admin
 * role. Non-admins land back on the workspace home (requireMember redirects).
 * Each child page re-runs the guard — the layout gate is just the front door.
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireMember(slug, "admin");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title="Settings"
        description="Workspace, members, API keys, and your public page."
        className="pb-5"
      />
      <SettingsNav slug={slug} />
      <div className="py-8">{children}</div>
    </div>
  );
}
