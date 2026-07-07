import { describe, expect, it } from "vitest";
import { hookIdempotencyKey, sdkIdempotencyKey } from "../src/idempotency.js";
import fixtures from "../../claude-plugin/test/idempotency-fixtures.json" with { type: "json" };

describe("hookIdempotencyKey", () => {
  it("is deterministic and prompt-blind", () => {
    const a = hookIdempotencyKey("sess-1", "/report-tool run the weekly numbers");
    const b = hookIdempotencyKey("sess-1", "/report-tool run the weekly numbers");
    expect(a).toBe(b);
    expect(a).toMatch(/^hook:sess-1:[0-9a-f]{16}$/);
    // The key must never contain prompt content.
    expect(a).not.toContain("report-tool");
    expect(a).not.toContain("weekly");
  });

  it("matches the shared fixture pinned with the plugin hook", () => {
    for (const f of fixtures) {
      expect(hookIdempotencyKey(f.session_id, f.prompt)).toBe(f.expected_key);
    }
  });
});

describe("sdkIdempotencyKey", () => {
  it("is unique per call", () => {
    expect(sdkIdempotencyKey()).not.toBe(sdkIdempotencyKey());
    expect(sdkIdempotencyKey()).toMatch(/^sdk:[0-9a-f-]{36}$/);
  });
});
