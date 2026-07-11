import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRole } from "@positiveroi/core";

/**
 * Where a signed-in user lands. Queries run on the USER's RLS client:
 * zero visible memberships → /onboarding; otherwise the oldest workspace,
 * builders on /me, leads and admins on the company dashboard.
 */
export async function landingPath(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("members")
    .select("role, created_at, workspaces(slug)")
    .order("created_at", { ascending: true })
    .limit(1);

  const first = data?.[0] as
    | { role: MemberRole; workspaces: { slug: string } | null }
    | undefined;
  if (!first?.workspaces) return "/onboarding";

  const slug = first.workspaces.slug;
  return first.role === "builder" ? `/w/${slug}/me` : `/w/${slug}`;
}

/**
 * Only allow same-origin relative paths for post-auth redirects. A leading
 * "//" or "/\" is a protocol-relative URL that browsers (and new URL) resolve
 * off-origin, so a backslash or control/whitespace char anywhere is rejected
 * along with anything that is not a rooted path.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  // \ normalizes to / in browser URL parsing, so /\host → //host (off-origin).
  if (/[\\\x00-\x1f\x7f]/.test(next)) return null;
  return next;
}
