import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — every caller is responsible
 * for authorization BEFORE touching it (requireMember for humans,
 * verifyApiKey for machines, getPublicWorkspace for the public page).
 *
 * Import is server-only; the key never reaches the browser bundle.
 */

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to apps/web/.env.local (see .env.example).",
    );
  }
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Writes and aggregate reads require the " +
        "service-role key from your Supabase project (Settings -> API). Add it to " +
        "apps/web/.env.local — never expose it to the browser.",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
