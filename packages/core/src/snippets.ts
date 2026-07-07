import { ENV_API_KEY, PLUGIN_INSTALL, PLUGIN_MARKETPLACE_ADD } from "./constants.js";
import type { ToolType } from "./constants.js";

/**
 * Capture snippets rendered in the wizard's Setup step and in the docs
 * quickstarts — single source so the two never drift.
 */

export interface SnippetContext {
  endpoint: string;
  toolSlug: string;
  /** Real key when rendered in the dashboard; placeholder in docs. */
  apiKey: string;
}

export function curlSnippet({ endpoint, toolSlug, apiKey }: SnippetContext): string {
  return `curl -X POST ${endpoint}/api/ingest \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "${toolSlug}", "idempotency_key": "run-'"$(date +%s)"'"}'`;
}

export function sdkSnippet({ endpoint, toolSlug, apiKey }: SnippetContext): string {
  return `import { PositiveROI } from "@positiveroi/sdk";

const roi = new PositiveROI({ apiKey: "${apiKey}", endpoint: "${endpoint}" });

// Call this from the key action your tool performs:
await roi.logRun({ tool: "${toolSlug}" });`;
}

export function fetchSnippet({ endpoint, toolSlug, apiKey }: SnippetContext): string {
  return `await fetch("${endpoint}/api/ingest", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ tool: "${toolSlug}" }),
});`;
}

export function pluginSnippet(_ctx: SnippetContext): string {
  return `# In Claude Code, install the PositiveROI plugin:
${PLUGIN_MARKETPLACE_ADD}
${PLUGIN_INSTALL}

# Then connect it (paste your ingest key when asked):
/positiveroi:impact-setup`;
}

export function mcpEnvSnippet({ endpoint, apiKey }: SnippetContext): string {
  return `# Agents log runs through the PositiveROI MCP server.
# Set these in the agent's environment:
${ENV_API_KEY}=${apiKey}
POSITIVEROI_ENDPOINT=${endpoint}`;
}

/** The snippet set shown for a given tool type, in display order. */
export function snippetsForType(
  type: ToolType,
  ctx: SnippetContext,
): Array<{ label: string; language: string; code: string }> {
  switch (type) {
    case "automation":
      return [
        { label: "Webhook (curl)", language: "bash", code: curlSnippet(ctx) },
        { label: "JavaScript (fetch)", language: "typescript", code: fetchSnippet(ctx) },
      ];
    case "app":
      return [
        { label: "SDK", language: "typescript", code: sdkSnippet(ctx) },
        { label: "Raw fetch", language: "typescript", code: fetchSnippet(ctx) },
      ];
    case "skill":
      return [
        { label: "Claude Code plugin", language: "bash", code: pluginSnippet(ctx) },
      ];
    case "agent":
      return [
        { label: "MCP server", language: "bash", code: mcpEnvSnippet(ctx) },
        { label: "REST fallback", language: "bash", code: curlSnippet(ctx) },
      ];
  }
}
