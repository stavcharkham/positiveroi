import type { PositiveROIConfig } from "../config.js";
import { SETUP_HINT } from "../config.js";
import { apiRequest, friendlyError } from "../http.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

export const listMetricsDescription =
  "List the workspace's business metric definitions (key, name, unit) — use this to " +
  "discover which metric keys you can attach as metrics: {key: value} when calling " +
  "log_run.";

interface MetricDefinition {
  key: string;
  name: string;
  unit: string;
}

export async function handleListMetrics(config: PositiveROIConfig | null): Promise<ToolResult> {
  if (!config) return errorResult(SETUP_HINT);
  let response;
  try {
    response = await apiRequest(config, "GET", "/api/v1/metric-definitions");
  } catch (cause) {
    return errorResult(cause instanceof Error ? cause.message : String(cause));
  }
  if (response.status !== 200) return errorResult(friendlyError(response.status, response.json));

  const metrics = (response.json as { metrics?: MetricDefinition[] } | null)?.metrics ?? [];
  if (metrics.length === 0) {
    return textResult(
      "No business metrics are defined in this workspace yet — an admin can add them on the dashboard's Metrics page.",
    );
  }
  const lines = metrics.map((m) => `- \`${m.key}\` — ${m.name} (${m.unit})`);
  return textResult(
    `Business metrics (${metrics.length}):\n${lines.join("\n")}\n\n` +
      "Attach these as metrics: {key: value} when calling log_run to credit business outcomes to a run.",
  );
}
