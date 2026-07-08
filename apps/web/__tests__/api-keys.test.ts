import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateApiKey, hashApiKey, verifyApiKey } from "@/lib/api-keys";

interface KeyRow {
  id: string;
  workspace_id: string;
  scope: string;
  created_by: string;
  last_used_at: string | null;
}

/**
 * Chainable mock of the admin client covering the two query shapes
 * verifyApiKey issues: the select-by-hash lookup and the fire-and-forget
 * last_used_at update.
 */
function mockAdmin(rowByHash: Record<string, KeyRow>) {
  const updates: Record<string, unknown>[] = [];
  const lookups: string[] = [];
  const client = {
    from() {
      let hash: string | null = null;
      const chain = {
        select() {
          return chain;
        },
        eq(_col: string, value: string) {
          hash = value;
          lookups.push(value);
          return chain;
        },
        is() {
          return chain;
        },
        async maybeSingle() {
          return { data: (hash && rowByHash[hash]) || null, error: null };
        },
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          return {
            eq: () => Promise.resolve({ data: null, error: null }),
          };
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, updates, lookups };
}

describe("generateApiKey", () => {
  it("produces roi_ingest_<40 base62> secrets", () => {
    const key = generateApiKey("ingest");
    expect(key.secret).toMatch(/^roi_ingest_[A-Za-z0-9]{40}$/);
  });

  it("produces roi_read_<40 base62> secrets", () => {
    const key = generateApiKey("read");
    expect(key.secret).toMatch(/^roi_read_[A-Za-z0-9]{40}$/);
  });

  it("prefix is the scope prefix plus the first 4 secret chars", () => {
    const key = generateApiKey("ingest");
    const body = key.secret.slice("roi_ingest_".length);
    expect(key.prefix).toBe(`roi_ingest_${body.slice(0, 4)}`);
  });

  it("hash is sha256 hex of the FULL secret", () => {
    const key = generateApiKey("read");
    const expected = createHash("sha256")
      .update(key.secret, "utf8")
      .digest("hex");
    expect(key.hash).toBe(expected);
    expect(hashApiKey(key.secret)).toBe(expected);
  });

  it("secrets are unique across calls", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => generateApiKey("ingest").secret),
    );
    expect(seen.size).toBe(50);
  });
});

describe("verifyApiKey", () => {
  const row: KeyRow = {
    id: "key-1",
    workspace_id: "ws-1",
    scope: "ingest",
    created_by: "user-1",
    last_used_at: null,
  };

  it("round-trips a generated key against the stored hash", async () => {
    const key = generateApiKey("ingest");
    const { client, lookups } = mockAdmin({ [key.hash]: row });
    const verified = await verifyApiKey(`Bearer ${key.secret}`, client);
    expect(verified).toEqual({
      keyId: "key-1",
      workspaceId: "ws-1",
      scope: "ingest",
      createdBy: "user-1",
    });
    expect(lookups).toContain(key.hash);
  });

  it("returns the read scope for read keys", async () => {
    const key = generateApiKey("read");
    const { client } = mockAdmin({ [key.hash]: { ...row, scope: "read" } });
    const verified = await verifyApiKey(`Bearer ${key.secret}`, client);
    expect(verified?.scope).toBe("read");
  });

  it("rejects a wrong secret (hash miss)", async () => {
    const key = generateApiKey("ingest");
    const other = generateApiKey("ingest");
    const { client } = mockAdmin({ [key.hash]: row });
    expect(await verifyApiKey(`Bearer ${other.secret}`, client)).toBeNull();
  });

  it("rejects missing and malformed Authorization headers", async () => {
    const { client, lookups } = mockAdmin({});
    expect(await verifyApiKey(null, client)).toBeNull();
    expect(await verifyApiKey("", client)).toBeNull();
    expect(await verifyApiKey("Basic abc", client)).toBeNull();
    expect(await verifyApiKey("Bearer not_a_roi_key_at_all", client)).toBeNull();
    // Non-roi secrets never even hit the database.
    expect(lookups).toHaveLength(0);
  });

  it("accepts case-insensitive Bearer", async () => {
    const key = generateApiKey("ingest");
    const { client } = mockAdmin({ [key.hash]: row });
    expect(await verifyApiKey(`bearer ${key.secret}`, client)).not.toBeNull();
  });

  it("touches last_used_at when null or stale, not when fresh", async () => {
    const key = generateApiKey("ingest");

    const fresh = mockAdmin({
      [key.hash]: { ...row, last_used_at: new Date().toISOString() },
    });
    await verifyApiKey(`Bearer ${key.secret}`, fresh.client);
    expect(fresh.updates).toHaveLength(0);

    const stale = mockAdmin({
      [key.hash]: {
        ...row,
        last_used_at: new Date(Date.now() - 120_000).toISOString(),
      },
    });
    await verifyApiKey(`Bearer ${key.secret}`, stale.client);
    expect(stale.updates).toHaveLength(1);

    const never = mockAdmin({ [key.hash]: { ...row, last_used_at: null } });
    await verifyApiKey(`Bearer ${key.secret}`, never.client);
    expect(never.updates).toHaveLength(1);
  });
});
