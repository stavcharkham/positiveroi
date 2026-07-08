import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RATE_LIMIT_PER_MINUTE } from "@positiveroi/core";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit: RATE_LIMIT_PER_MINUTE requests per key per
 * UTC minute, counted in the rate_limits table via roi_rate_limit_hit
 * (atomic upsert-increment; self-cleans old windows probabilistically).
 */

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  keyId: string,
  client?: SupabaseClient,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const supabase = client ?? getAdminClient();
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

  const { data, error } = await supabase.rpc("roi_rate_limit_hit", {
    p_key: keyId,
    p_window: windowStart.toISOString(),
  });
  if (error) {
    // Counting failure must not take ingestion down — fail open.
    return { limited: false, retryAfterSeconds: 0 };
  }

  const count = typeof data === "number" ? data : Number(data);
  if (count <= RATE_LIMIT_PER_MINUTE) {
    return { limited: false, retryAfterSeconds: 0 };
  }
  const windowEnd = windowStart.getTime() + 60_000;
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
  };
}
