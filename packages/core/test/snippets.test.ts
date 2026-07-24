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
      // The key must NEVER ride inside a prompt destined for an AI chat —
      // the human sets it out of band (env var / impact-setup).
      expect(prompt).not.toContain(ctx.apiKey);
      // The skill path goes through the plugin; endpoint config lives in
      // its setup flow, not the prompt.
      if (type !== "skill") expect(prompt).toContain(ctx.endpoint);
      if (type === "automation" || type === "app" || type === "agent") {
        expect(prompt).toContain("POSITIVEROI_API_KEY");
      }
      // Every prompt links the docs or the repo for the rest.
      expect(prompt).toMatch(/github\.com\/stavcharkham\/positiveroi/);
    }
  });

  it("REST-based prompts check the env var first and state the no-content rule", () => {
    for (const type of ["automation", "app", "agent"] as const) {
      const prompt = agentPrompt(type, ctx);
      expect(prompt).toContain("/api/ingest");
      expect(prompt).toMatch(/check that the POSITIVEROI_API_KEY/);
      expect(prompt.toLowerCase()).toContain("never send prompts");
    }
  });

  it("the agent prompt wires a deterministic call, not MCP", () => {
    const prompt = agentPrompt("agent", ctx);
    expect(prompt).not.toContain("MCP");
    expect(prompt).toContain("not a step the model decides");
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
