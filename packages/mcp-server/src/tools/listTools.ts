import type { PositiveROIConfig } from "../config.js";
import { SETUP_HINT } from "../config.js";
import { apiRequest, friendlyError } from "../http.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

export const listToolsDescription =
  "List the workspace's registered tools with their slugs — use this to resolve the " +
  "slug to pass to log_run, or to check whether a tool is already registered before " +
  "calling register_tool.";

interface SlimTool {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  minutes_saved_per_run: number;
}

export async function handleListTools(config: PositiveROIConfig | null): Promise<ToolResult> {
  if (!config) return errorResult(SETUP_HINT);
  let response;
  try {
    response = await apiRequest(config, "GET", "/api/v1/tools");
  } catch (cause) {
    return errorResult(cause instanceof Error ? cause.message : String(cause));
  }
  if (response.status !== 200) return errorResult(friendlyError(response.status, response.json));

  const tools = (response.json as { tools?: SlimTool[] } | null)?.tools ?? [];
  if (tools.length === 0) {
    return textResult("No tools are registered in this workspace yet — use register_tool to add the first one.");
  }
  const lines = tools.map(
    (t) =>
      `- \`${t.slug}\` — ${t.name} (${t.type}, ${t.status}): ${t.minutes_saved_per_run} credited min/run`,
  );
  return textResult(`Registered tools (${tools.length}):\n${lines.join("\n")}`);
}
