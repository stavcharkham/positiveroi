"use server";

import { z } from "zod";
import {
  DEFAULT_CURRENCY,
  DEFAULT_HOURLY_RATE_CENTS,
  SEEDED_METRICS,
} from "@positiveroi/core";
import { generateApiKey } from "@/lib/api-keys";
import { requireUser } from "@/lib/guards";
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
  hourlyRateDollars: z.coerce.number().min(0).max(1_000_000),
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
  const { name, displayName, hourlyRateDollars } = parsed.data;
  const timezone = validTimezone(parsed.data.timezone) ?? "UTC";
  const hourlyRateCents = Math.round(hourlyRateDollars * 100) || DEFAULT_HOURLY_RATE_CENTS;

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
        hourly_rate_cents: hourlyRateCents,
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
