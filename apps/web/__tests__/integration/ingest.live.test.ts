import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateApiKey } from "@/lib/api-keys";
import { checkRateLimit } from "@/lib/rate-limit";
import { ingestEvents } from "@/lib/ingest-core";

/**
 * Live round trip against the real Supabase project. Runs only when
 * SUPABASE_SERVICE_ROLE_KEY is present (loaded from .env.local by
 * vitest.config.ts); creates a scratch workspace + user and removes
 * every trace afterwards (workspace delete cascades; user deleted last).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!SUPABASE_URL || !SERVICE_KEY)("ingest-core (live Supabase)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let workspaceId: string;
  let toolSlug: string;
  let archivedSlug: string;
  let keyId: string;

  const stamp = Date.now();

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } =
      await admin.auth.admin.createUser({
        email: `test+ingest-${stamp}@positiveroi.dev`,
        email_confirm: true,
      });
    if (userError) throw userError;
    userId = userData.user.id;

    const { data: ws, error: wsError } = await admin
      .from("workspaces")
      .insert({ name: "Ingest Test", slug: `test-ingest-${stamp}` })
      .select("id")
      .single();
    if (wsError) throw wsError;
    workspaceId = ws.id;

    const { error: memberError } = await admin.from("members").insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "admin",
      display_name: "Test Builder",
    });
    if (memberError) throw memberError;

    const { error: metricError } = await admin.from("metric_definitions").insert({
      workspace_id: workspaceId,
      key: "leads_generated",
      name: "Leads generated",
      unit: "count",
    });
    if (metricError) throw metricError;

    // 60 raw minutes, no judgment cut -> 36 credited minutes per run.
    toolSlug = `ingest-tool-${stamp}`;
    const { error: toolError } = await admin.from("tools").insert({
      workspace_id: workspaceId,
      owner_id: userId,
      name: "Ingest Tool",
      slug: toolSlug,
      type: "automation",
      raw_estimate_minutes: 60,
      high_judgment: false,
    });
    if (toolError) throw toolError;

    archivedSlug = `archived-tool-${stamp}`;
    const { error: archivedError } = await admin.from("tools").insert({
      workspace_id: workspaceId,
      owner_id: userId,
      name: "Archived Tool",
      slug: archivedSlug,
      type: "automation",
      status: "archived",
      raw_estimate_minutes: 30,
      high_judgment: false,
    });
    if (archivedError) throw archivedError;

    const generated = generateApiKey("ingest");
    const { data: keyRow, error: keyError } = await admin
      .from("api_keys")
      .insert({
        workspace_id: workspaceId,
        name: "test key",
        scope: "ingest",
        key_prefix: generated.prefix,
        key_hash: generated.hash,
        created_by: userId,
      })
      .select("id")
      .single();
    if (keyError) throw keyError;
    keyId = keyRow.id;
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    // Workspace delete cascades tools/events/keys/metrics/badges; the user
    // must go second (events.created_by and tools.owner_id restrict).
    if (workspaceId) {
      await admin.from("workspaces").delete().eq("id", workspaceId);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  const apiCtx = () =>
    ({ kind: "api", keyId, workspaceId }) as const;

  it("accepts a batch, attaches tool_totals to the last accepted event, and replays as duplicates", async () => {
    const body = {
      events: [1, 2, 3].map((n) => ({
        tool: toolSlug,
        idempotency_key: `live-${stamp}-batch-${n}`,
      })),
    };

    const first = await ingestEvents(apiCtx(), body, admin);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.response.accepted).toBe(3);
    expect(first.response.duplicates).toBe(0);
    expect(first.response.rejected).toBe(0);
    const firstIds = first.response.results.map((r) => r.event_id);
    expect(firstIds.every(Boolean)).toBe(true);

    // tool_totals only on the LAST accepted event of the tool.
    expect(first.response.results[0]?.tool_totals).toBeUndefined();
    expect(first.response.results[1]?.tool_totals).toBeUndefined();
    const totals = first.response.results[2]?.tool_totals;
    expect(totals?.tool).toBe(toolSlug);
    expect(totals?.owner_hours_30d).toBe(1.8); // 3 runs x 36 credited min
    expect(totals?.multiplier_progress).toBe(0.01); // 1.8 / 180

    const replay = await ingestEvents(apiCtx(), body, admin);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.response.accepted).toBe(0);
    expect(replay.response.duplicates).toBe(3);
    expect(replay.response.results.map((r) => r.status)).toEqual([
      "duplicate",
      "duplicate",
      "duplicate",
    ]);
    expect(replay.response.results.map((r) => r.event_id)).toEqual(firstIds);
  });

  it("clamps minutes_saved overrides to [0, raw_estimate_minutes]", async () => {
    const outcome = await ingestEvents(
      apiCtx(),
      {
        events: [
          { tool: toolSlug, minutes_saved: 400, idempotency_key: `live-${stamp}-clamp-hi` },
          { tool: toolSlug, minutes_saved: 10, idempotency_key: `live-${stamp}-clamp-in` },
          { tool: toolSlug, idempotency_key: `live-${stamp}-clamp-none` },
        ],
      },
      admin,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.response.accepted).toBe(3);

    const ids = outcome.response.results.map((r) => r.event_id);
    const { data: rows } = await admin
      .from("events")
      .select("id, minutes_saved, minutes_overridden")
      .in("id", ids as string[]);
    const byId = new Map(rows!.map((r) => [r.id, r]));

    const hi = byId.get(ids[0]);
    expect(Number(hi!.minutes_saved)).toBe(60); // clamped to raw estimate
    expect(hi!.minutes_overridden).toBe(true);

    const within = byId.get(ids[1]);
    expect(Number(within!.minutes_saved)).toBe(10);
    expect(within!.minutes_overridden).toBe(true);

    const none = byId.get(ids[2]);
    expect(Number(none!.minutes_saved)).toBe(36); // The Undercount default
    expect(none!.minutes_overridden).toBe(false);
  });

  it("warns on unknown metric keys and writes values for known ones", async () => {
    const outcome = await ingestEvents(
      apiCtx(),
      {
        tool: toolSlug,
        idempotency_key: `live-${stamp}-metrics`,
        metrics: { leads_generated: 3, nonexistent_metric: 5 },
      },
      admin,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const result = outcome.response.results[0]!;
    expect(result.status).toBe("accepted");
    expect(result.warnings).toEqual(["unknown_metric:nonexistent_metric"]);

    const { data: values } = await admin
      .from("metric_values")
      .select("value")
      .eq("event_id", result.event_id!);
    expect(values).toHaveLength(1);
    expect(Number(values![0]!.value)).toBe(3);
  });

  it("rejects unknown tools, archived tools, and out-of-range occurred_at", async () => {
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const outcome = await ingestEvents(
      apiCtx(),
      {
        events: [
          { tool: "no-such-tool" },
          { tool: archivedSlug },
          { tool: toolSlug, occurred_at: hundredDaysAgo },
        ],
      },
      admin,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.response.rejected).toBe(3);
    expect(outcome.response.results.map((r) => r.error?.code)).toEqual([
      "unknown_tool",
      "tool_archived",
      "occurred_at_out_of_range",
    ]);
  });

  it("member ctx forces manual source, sets created_by, and has no 90-day lower bound", async () => {
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const outcome = await ingestEvents(
      { kind: "member", userId, workspaceId, source: "manual" },
      { tool: toolSlug, occurred_at: hundredDaysAgo, idempotency_key: `live-${stamp}-manual` },
      admin,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const result = outcome.response.results[0]!;
    expect(result.status).toBe("accepted");

    const { data: row } = await admin
      .from("events")
      .select("source, created_by, api_key_id")
      .eq("id", result.event_id!)
      .single();
    expect(row!.source).toBe("manual");
    expect(row!.created_by).toBe(userId);
    expect(row!.api_key_id).toBeNull();
  });

  it("excludes is_test events from roi_workspace_stats", async () => {
    const window = {
      ws: workspaceId,
      p_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_to: new Date(Date.now() + 60_000).toISOString(),
    };
    const { data: before } = await admin.rpc("roi_workspace_stats", window);

    const outcome = await ingestEvents(
      apiCtx(),
      { tool: toolSlug, is_test: true, idempotency_key: `live-${stamp}-test-run` },
      admin,
    );
    expect(outcome.ok && outcome.response.accepted).toBe(1);

    const { data: after } = await admin.rpc("roi_workspace_stats", window);
    expect(Number(after![0].runs)).toBe(Number(before![0].runs));
    expect(Number(after![0].minutes)).toBe(Number(before![0].minutes));
  });

  it("rate limit counter increments per key per minute window", async () => {
    const first = await checkRateLimit(keyId, admin);
    expect(first.limited).toBe(false);

    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const { data: count } = await admin.rpc("roi_rate_limit_hit", {
      p_key: keyId,
      p_window: windowStart.toISOString(),
    });
    expect(Number(count)).toBeGreaterThanOrEqual(2);
  });
});
