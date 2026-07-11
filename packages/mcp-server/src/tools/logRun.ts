import { z } from "zod";
import type { IngestResponse } from "@positiveroi/core";
import type { PositiveROIConfig } from "../config.js";
import { SETUP_HINT } from "../config.js";
import { apiRequest, friendlyError } from "../http.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

export const logRunDescription =
  "Log one run of a registered tool AFTER its work completes. Each run credits the " +
  "tool's conservative minutes-saved-per-run toward the builder's measured impact. " +
  "Call it once per completed run — idempotency keys make accidental repeats safe. " +
  "Do NOT call it for tools captured automatically by the PositiveROI plugin hook.";

export const logRunInput = {
  tool: z.string().min(1).max(100).describe("The registered tool's slug (see list_tools)."),
  minutes_saved: z
    .number()
    .min(0)
    .optional()
    .describe(
      "Per-run override for a run that did more or less than usual. The server clamps it to [0, the tool's raw baseline minutes]; leave it unset to credit the tool's normal per-run amount.",
    ),
  metrics: z
    .record(z.number())
    .optional()
    .describe("Business metrics for this run, metric key → number, e.g. {\"leads_generated\": 3}."),
  metadata: z.record(z.unknown()).optional().describe("Free-form context for this run."),
  idempotency_key: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe("Provide to dedupe retries of the same run."),
  force: z
    .boolean()
    .optional()
    .describe("Override the guard for tools whose runs are captured automatically by the plugin hook."),
};

export function hookCapturedRefusal(slug: string): string {
  return (
    `Not logged: runs of \`${slug}\` are logged automatically by the PositiveROI plugin hook — ` +
    "logging it here too would double-count. Pass force: true only if you're sure this run wasn't captured (for example, it ran outside Claude Code)."
  );
}

export async function handleLogRun(
  params: {
    tool: string;
    minutes_saved?: number;
    metrics?: Record<string, number>;
    metadata?: Record<string, unknown>;
    idempotency_key?: string;
    force?: boolean;
  },
  config: PositiveROIConfig | null,
): Promise<ToolResult> {
  if (!config) return errorResult(SETUP_HINT);
  if (config.hookCaptured?.includes(params.tool) && !params.force) {
    return errorResult(hookCapturedRefusal(params.tool));
  }

  let response;
  try {
    response = await apiRequest(config, "POST", "/api/ingest", {
      tool: params.tool,
      source: "mcp",
      ...(params.minutes_saved !== undefined && { minutes_saved: params.minutes_saved }),
      ...(params.metrics !== undefined && { metrics: params.metrics }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
      ...(params.idempotency_key !== undefined && { idempotency_key: params.idempotency_key }),
    });
  } catch (cause) {
    return errorResult(cause instanceof Error ? cause.message : String(cause));
  }

  if (response.status !== 200) {
    return errorResult(friendlyError(response.status, response.json));
  }

  const result = (response.json as IngestResponse | null)?.results?.[0];
  if (!result) return errorResult("The server returned an unexpected response — no result for the event.");

  switch (result.status) {
    case "accepted": {
      const totals = result.tool_totals;
      let text = "Logged.";
      if (totals) {
        const pct = Math.round(totals.multiplier_progress * 100);
        text = `Logged. ${totals.owner_hours_30d} credited hours in the last 30 days — ${pct}% of the way to Multiplier.`;
      }
      if (result.warnings?.length) text += `\nWarnings: ${result.warnings.join("; ")}`;
      return textResult(text);
    }
    case "duplicate":
      return textResult(
        "This run was already logged (same idempotency key) — nothing was double-counted.",
      );
    default:
      return errorResult(
        `The server rejected this run${result.error ? `: ${result.error.message} (${result.error.code})` : "."}`,
      );
  }
}
