import type { PositiveROIConfig } from "../config.js";
import { SETUP_HINT } from "../config.js";
import { apiRequest, friendlyError } from "../http.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

export const getSummaryDescription =
  "Get the workspace's live impact summary: runs and credited hours over the trailing " +
  "30 days, active tools, and builder count. Also the quickest way to verify the " +
  "connection is working.";

interface Summary {
  workspace: string;
  runs_30d: number;
  hours_30d: number;
  active_tools: number;
  builders: number;
}

export async function handleGetSummary(config: PositiveROIConfig | null): Promise<ToolResult> {
  if (!config) return errorResult(SETUP_HINT);
  let response;
  try {
    response = await apiRequest(config, "GET", "/api/v1/summary");
  } catch (cause) {
    return errorResult(cause instanceof Error ? cause.message : String(cause));
  }
  if (response.status !== 200) return errorResult(friendlyError(response.status, response.json));

  const s = response.json as Summary;
  return textResult(
    [
      `Workspace: ${s.workspace}`,
      `Last 30 days: ${s.runs_30d} runs, ${s.hours_30d} credited hours saved`,
      `Active tools: ${s.active_tools} · Builders: ${s.builders}`,
      "",
      "Money value and time-series breakdowns need a read-scoped key (roi_read_...) — create one in the dashboard; this ingest key only sees the live counters.",
    ].join("\n"),
  );
}
