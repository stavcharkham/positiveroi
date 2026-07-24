"use server";

import { z } from "zod";
import { DEFAULT_CURRENCY, SEEDED_METRICS } from "@positiveroi/core";
import { generateApiKey } from "@/lib/api-keys";
import { requireMember, requireUser } from "@/lib/guards";
import { isPrivateIp } from "@/lib/net-guard";
import { normalizeWebsite } from "@/lib/profile";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Workspace creation — the one write that happens before any membership
 * exists. requireUser() proves the human; everything else runs on the
 * service role. On any partial failure the workspace row is deleted and
 * the cascade removes the rest.
 */

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(60),
  timezone: z.string().trim().max(60).optional(),
});

export interface CreateWorkspaceResult {
  ok: boolean;
  error?: string;
  slug?: string;
  /** Default ingest key plaintext — shown once, never retrievable. */
  ingestKey?: string;
}

export async function createWorkspaceAction(
  input: unknown,
): Promise<CreateWorkspaceResult> {
  const user = await requireUser();

  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form — something is missing or out of range." };
  }
  const { name, displayName } = parsed.data;
  const timezone = validTimezone(parsed.data.timezone) ?? "UTC";

  const admin = getAdminClient();

  // Insert the workspace, retrying with a numbered suffix on slug collision.
  const base = slugify(name);
  let workspace: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 5 && !workspace; attempt++) {
    const slug = attempt === 0 ? base : `${base.slice(0, 36)}-${attempt + 1}`;
    const { data, error } = await admin
      .from("workspaces")
      .insert({
        name,
        slug,
        timezone,
        currency: DEFAULT_CURRENCY,
      })
      .select("id, slug")
      .single();
    if (data) workspace = data;
    else if (error && error.code !== "23505") {
      return { ok: false, error: "Could not create the workspace. Try again." };
    }
  }
  if (!workspace) {
    return { ok: false, error: "That name is taken too many times over — try another." };
  }

  try {
    const { error: memberError } = await admin.from("members").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "admin",
      display_name: displayName,
    });
    if (memberError) throw memberError;

    const { error: metricsError } = await admin.from("metric_definitions").insert(
      SEEDED_METRICS.map((m) => ({
        workspace_id: workspace!.id,
        key: m.key,
        name: m.name,
        unit: m.unit,
      })),
    );
    if (metricsError) throw metricsError;

    const key = generateApiKey("ingest");
    const { error: keyError } = await admin.from("api_keys").insert({
      workspace_id: workspace.id,
      name: "Default ingest key",
      scope: "ingest",
      key_prefix: key.prefix,
      key_hash: key.hash,
      created_by: user.id,
    });
    if (keyError) throw keyError;

    return { ok: true, slug: workspace.slug, ingestKey: key.secret };
  } catch {
    await admin.from("workspaces").delete().eq("id", workspace.id);
    return { ok: false, error: "Could not finish setting up the workspace. Try again." };
  }
}

const profileSchema = z.object({
  website: z.string().trim().max(300).optional(),
  companySize: z.enum(["just_me", "2_10", "11_50", "51_plus"]).optional(),
  builderType: z.enum(["non_technical", "technical"]).optional(),
});

export interface ProfileActionResult {
  ok: boolean;
  error?: string;
}

/**
 * The onboarding questions, saved after the workspace exists. builder_type
 * belongs to the calling member (anyone sets their own); website and
 * company size belong to the workspace (admins only — during onboarding
 * the creator is one). The logo is fetched from the website's favicon,
 * silently skipped when the site has none.
 */
export async function saveWorkspaceProfileAction(
  workspaceSlug: string,
  input: unknown,
): Promise<ProfileActionResult> {
  const { user, workspace, member } = await requireMember(workspaceSlug);

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form and try again." };
  }
  const admin = getAdminClient();

  if (parsed.data.builderType) {
    const { error } = await admin
      .from("members")
      .update({ builder_type: parsed.data.builderType })
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Could not save. Try again." };
  }

  const isAdmin = member.role === "admin";
  const website =
    parsed.data.website !== undefined
      ? normalizeWebsite(parsed.data.website)
      : null;
  if (
    parsed.data.website !== undefined &&
    parsed.data.website.trim() !== "" &&
    website === null
  ) {
    return { ok: false, error: "That website doesn't look like a web address." };
  }
  if (isAdmin && (website || parsed.data.companySize)) {
    const update: Record<string, string> = {};
    if (website) {
      update.website = website;
      const logo = await findFavicon(website);
      if (logo) update.logo_url = logo;
    }
    if (parsed.data.companySize) update.company_size = parsed.data.companySize;
    const { error } = await admin
      .from("workspaces")
      .update(update)
      .eq("id", workspace.id);
    if (error) return { ok: false, error: "Could not save. Try again." };
  }

  return { ok: true };
}

/**
 * The workspace's own /favicon.ico, when it answers with an image within
 * 3s. No third-party lookup services — the only request goes to the site
 * the admin just typed. Guarded against SSRF: https only, default port,
 * every resolved IP must be public, and redirects are not followed.
 */
async function findFavicon(websiteOrigin: string): Promise<string | null> {
  try {
    const origin = new URL(websiteOrigin);
    if (origin.protocol !== "https:" || origin.port !== "") return null;
    const { lookup } = await import("node:dns/promises");
    const addresses = await lookup(origin.hostname, { all: true });
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
      return null;
    }
    const url = `https://${origin.hostname}/favicon.ico`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal, redirect: "manual" });
    clearTimeout(timer);
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && (type.startsWith("image/") || type.includes("icon"))) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  // DB check requires 3–40 chars starting/ending alphanumeric.
  return slug.length >= 3 ? slug : `${slug}${"ws".repeat(2)}`.slice(0, 6);
}

function validTimezone(tz: string | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}
