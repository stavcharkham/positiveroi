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

const DOCS_LINK =
  "https://github.com/stavcharkham/positiveroi/blob/main/docs/api/ingestion.md";

/**
 * A paste-ready prompt for AI coding agents (Claude Code, Cursor, Codex),
 * per tool type. The prompt explains most of the wiring inline and links
 * the docs for the rest. Same trust rules everywhere: report only that a
 * run happened, never content; idempotency key against double counting;
 * failed runs are not logged. The prompt NEVER carries the ingest key —
 * the human sets it as an environment variable so the secret stays out of
 * AI conversations and their logs.
 */
export function agentPrompt(type: ToolType, ctx: SnippetContext): string {
  const { endpoint, toolSlug } = ctx;
  const shared = `PositiveROI counts the time this tool saves. Every successful run must report itself with one small POST: only "a run happened", never the run's content.

Rules:
- POST ${endpoint}/api/ingest with header "Authorization: Bearer <ingest key>" and JSON body {"tool": "${toolSlug}", "idempotency_key": "<stable unique id for this run>"}.
- Read the ingest key from the ${ENV_API_KEY} environment variable. The human sets it; it is deliberately not in this prompt. Never ask for it, never hardcode it.
- The idempotency_key stops double counting on retries: derive it once per run (an event id, a job id, or a timestamp captured once) and reuse it if the same run reports again.
- Log only successful runs. Never send prompts, inputs, outputs, or any other content.
- Full API reference: ${DOCS_LINK}`;

  switch (type) {
    case "automation":
      return `Add PositiveROI run logging to this automation.

${shared}

Do this:
1. Find where the automation finishes its work successfully.
2. Add the POST there (an HTTP step, a fetch call, whatever this stack uses).
3. Trigger the automation once to verify: the run appears on the tool's PositiveROI page within seconds.`;
    case "app":
      return `Add PositiveROI run logging to this app.

${shared}

Do this:
1. Find the one action that means "this tool did its job" (the submit, the send, the generate).
2. Fire the POST from the server side of that action, after it succeeds. Do not block or fail the action if the POST fails; log and continue.
3. Run the action once to verify: the run appears on the tool's PositiveROI page within seconds.`;
    case "skill":
      return `Connect this Claude Code skill to PositiveROI.

No code changes needed: the PositiveROI plugin captures skill runs automatically through a hook, sending only the tool name and a timestamp, never the conversation.

Do this:
1. In Claude Code run: ${PLUGIN_MARKETPLACE_ADD} then ${PLUGIN_INSTALL}
2. Run /positiveroi:impact-setup and paste the ingest key when asked. The key is deliberately not in this prompt; the human has it.
3. Register "${toolSlug}" as the trigger for this skill when the setup asks which skills to track.
4. Use the skill once to verify: the run appears on the tool's PositiveROI page marked "via hook".

Plugin guide: https://github.com/stavcharkham/positiveroi/blob/main/docs/quickstart/skill-plugin.md`;
    case "agent":
      return `Connect this agent to PositiveROI over MCP.

${shared}

Prefer MCP over raw HTTP: the PositiveROI MCP server gives the agent log_run, register_tool, list_tools, get_summary and list_metrics tools.

Do this:
1. Have the human set these in the agent's environment (the key stays out of this conversation):
   ${ENV_API_KEY}=<the ingest key>
   POSITIVEROI_ENDPOINT=${endpoint}
2. Add the PositiveROI MCP server to the agent's MCP config (see the repo's packages/mcp-server README).
3. Have the agent call log_run with tool "${toolSlug}" after each completed job; the idempotency key is handled for you.
4. Trigger one job to verify: the run appears on the tool's PositiveROI page marked "via mcp".`;
  }
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
