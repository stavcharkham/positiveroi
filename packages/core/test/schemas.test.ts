import { describe, expect, it } from "vitest";
import {
  ingestBodySchema,
  ingestEventSchema,
  normalizeIngestBody,
  slugify,
  toolCreateApiSchema,
  toolCreateSchema,
} from "../src/schemas.js";

describe("ingestEventSchema", () => {
  it("accepts a minimal event and applies defaults", () => {
    const parsed = ingestEventSchema.parse({ tool: "weekly-digest" });
    expect(parsed.source).toBe("rest");
    expect(parsed.is_test).toBe(false);
    expect(parsed.metadata).toEqual({});
    expect(parsed.metrics).toEqual({});
  });

  it("rejects manual as an API source", () => {
    expect(() => ingestEventSchema.parse({ tool: "x", source: "manual" })).toThrow();
  });

  it("rejects oversized idempotency keys and bad metrics keys", () => {
    expect(() =>
      ingestEventSchema.parse({ tool: "x", idempotency_key: "k".repeat(129) }),
    ).toThrow();
    expect(() =>
      ingestEventSchema.parse({ tool: "x", metrics: { "Bad Key!": 1 } }),
    ).toThrow();
  });

  it("accepts metrics maps and overrides", () => {
    const parsed = ingestEventSchema.parse({
      tool: "x",
      minutes_saved: 3,
      metrics: { leads_generated: 4 },
    });
    expect(parsed.minutes_saved).toBe(3);
    expect(parsed.metrics.leads_generated).toBe(4);
  });
});

describe("ingestBodySchema", () => {
  it("normalizes a bare event and a batch identically", () => {
    const single = normalizeIngestBody(ingestBodySchema.parse({ tool: "x" }));
    const batch = normalizeIngestBody(ingestBodySchema.parse({ events: [{ tool: "x" }] }));
    expect(single).toHaveLength(1);
    expect(batch).toHaveLength(1);
    expect(single[0]?.tool).toBe("x");
  });

  it("rejects empty and oversized batches", () => {
    expect(() => ingestBodySchema.parse({ events: [] })).toThrow();
    expect(() =>
      ingestBodySchema.parse({ events: Array.from({ length: 101 }, () => ({ tool: "x" })) }),
    ).toThrow();
  });
});

describe("tool creation caps", () => {
  it("dashboard caps at 480, API at 120", () => {
    const base = { name: "T", type: "automation", high_judgment: false } as const;
    expect(toolCreateSchema.parse({ ...base, raw_estimate_minutes: 480 })).toBeTruthy();
    expect(() => toolCreateSchema.parse({ ...base, raw_estimate_minutes: 481 })).toThrow();
    expect(toolCreateApiSchema.parse({ ...base, raw_estimate_minutes: 120 })).toBeTruthy();
    expect(() => toolCreateApiSchema.parse({ ...base, raw_estimate_minutes: 121 })).toThrow();
  });
});

describe("slugify", () => {
  it("produces DDL-valid slugs", () => {
    const pattern = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/;
    for (const name of [
      "Weekly pipeline digest",
      "  éclair Générator!! ",
      "A",
      "---x---",
      "Tool #42 (v2)",
      "x".repeat(200),
    ]) {
      expect(slugify(name)).toMatch(pattern);
    }
    expect(slugify("Weekly pipeline digest")).toBe("weekly-pipeline-digest");
  });
});
