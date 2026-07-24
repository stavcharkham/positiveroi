import { describe, expect, it } from "vitest";
import { TOOL_TYPES, agentPrompt, snippetsForType } from "../src/index.js";

const ctx = {
  endpoint: "https://roi.example.com",
  toolSlug: "invoice-triage",
  apiKey: "YOUR_INGEST_KEY",
};

describe("agentPrompt", () => {
  it("exists for every tool type and carries the wiring facts", () => {
    for (const type of TOOL_TYPES) {
      const prompt = agentPrompt(type, ctx);
      expect(prompt).toContain(ctx.toolSlug);
      expect(prompt).toContain(ctx.apiKey);
      // The skill path goes through the plugin; endpoint config lives in
      // its setup flow, not the prompt.
      if (type !== "skill") expect(prompt).toContain(ctx.endpoint);
      // Every prompt links the docs or the repo for the rest.
      expect(prompt).toMatch(/github\.com\/stavcharkham\/positiveroi/);
    }
  });

  it("REST-based prompts state the idempotency and no-content rules", () => {
    for (const type of ["automation", "app", "agent"] as const) {
      const prompt = agentPrompt(type, ctx);
      expect(prompt).toContain("idempotency_key");
      expect(prompt.toLowerCase()).toContain("never");
    }
  });

  it("skill prompt goes through the plugin, not raw HTTP", () => {
    const prompt = agentPrompt("skill", ctx);
    expect(prompt).toContain("/positiveroi:impact-setup");
    expect(prompt).not.toContain("/api/ingest");
  });
});

describe("snippetsForType", () => {
  it("still renders a non-empty set for every type", () => {
    for (const type of TOOL_TYPES) {
      expect(snippetsForType(type, ctx).length).toBeGreaterThan(0);
    }
  });
});
