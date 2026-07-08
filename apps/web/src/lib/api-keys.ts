import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KEY_PREFIX_INGEST, KEY_PREFIX_READ } from "@positiveroi/core";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Machine auth plane. Secrets are shown once at creation; only the sha256
 * hash and a 4-char display prefix are stored.
 */

export type ApiKeyScope = "ingest" | "read";

const SECRET_LENGTH = 40;
const BASE62 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export interface GeneratedApiKey {
  /** Full secret, e.g. roi_ingest_<40 base62 chars>. Shown once, never stored. */
  secret: string;
  /** Display prefix stored in api_keys.key_prefix, e.g. "roi_ingest_3fk2". */
  prefix: string;
  /** sha256 hex of the FULL secret — the stored lookup key. */
  hash: string;
}

/** Unbiased base62 string from crypto.randomBytes (rejection sampling). */
function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const byte of bytes) {
      // 248 = 62 * 4 — reject the tail to avoid modulo bias.
      if (byte < 248) out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function generateApiKey(scope: ApiKeyScope): GeneratedApiKey {
  const scopePrefix = scope === "ingest" ? KEY_PREFIX_INGEST : KEY_PREFIX_READ;
  const body = randomBase62(SECRET_LENGTH);
  const secret = `${scopePrefix}${body}`;
  return {
    secret,
    prefix: `${scopePrefix}${body.slice(0, 4)}`,
    hash: hashApiKey(secret),
  };
}

export interface VerifiedApiKey {
  keyId: string;
  workspaceId: string;
  scope: ApiKeyScope;
  /** User who created the key — owner for API-registered tools. */
  createdBy: string;
}

const LAST_USED_THROTTLE_MS = 60_000;

/**
 * Verify a `Bearer <secret>` Authorization header against api_keys.
 * Returns null for anything invalid (missing header, unknown hash, revoked).
 * Updates last_used_at at most once a minute, fire-and-forget.
 */
export async function verifyApiKey(
  authorizationHeader: string | null,
  client?: SupabaseClient,
): Promise<VerifiedApiKey | null> {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
  if (!match) return null;
  const secret = match[1] as string;
  if (!secret.startsWith(KEY_PREFIX_INGEST) && !secret.startsWith(KEY_PREFIX_READ)) {
    return null;
  }

  const supabase = client ?? getAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, workspace_id, scope, created_by, last_used_at")
    .eq("key_hash", hashApiKey(secret))
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;

  const lastUsed = data.last_used_at ? Date.parse(data.last_used_at) : null;
  if (lastUsed === null || Date.now() - lastUsed > LAST_USED_THROTTLE_MS) {
    // Fire-and-forget; a lost update only delays the display timestamp.
    void supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return {
    keyId: data.id,
    workspaceId: data.workspace_id,
    scope: data.scope as ApiKeyScope,
    createdBy: data.created_by,
  };
}
