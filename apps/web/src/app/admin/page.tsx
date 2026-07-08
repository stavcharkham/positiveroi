import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isHosted } from "@/lib/flags";
import { requireUser } from "@/lib/guards";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Hosted-deployment stub: a bare workspace table for the operator. 404s on
 * self-hosted installs and for anyone not in HOSTED_ADMIN_EMAILS — no signal
 * that the route exists.
 */

export const metadata: Metadata = { title: "Admin" };

interface AdminWorkspaceRow {
  id: string;
  name: string;
  created_at: string;
  members: { count: number }[];
  events: { count: number }[];
}

export default async function AdminPage() {
  if (!isHosted()) notFound();

  const user = await requireUser();
  const allowed = (process.env.HOSTED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!user.email || !allowed.includes(user.email.toLowerCase())) notFound();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .select("id, name, created_at, members(count), events(count)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`admin workspace list failed: ${error.message}`);
  const rows = (data ?? []) as unknown as AdminWorkspaceRow[];

  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Workspaces
      </h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        {rows.length === 1 ? "1 workspace" : `${rows.length} workspaces`} on
        this deployment.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 font-medium text-foreground-secondary">
                Workspace
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-foreground-secondary">
                Members
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-foreground-secondary">
                Events
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-foreground-secondary">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {row.name}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-foreground-secondary">
                  {row.members[0]?.count ?? 0}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-foreground-secondary">
                  {row.events[0]?.count ?? 0}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-foreground-muted">
                  {dateFormat.format(new Date(row.created_at))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-foreground-muted"
                >
                  No workspaces yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
