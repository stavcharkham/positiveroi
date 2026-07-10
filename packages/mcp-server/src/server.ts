import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveConfig } from "./config.js";
import { handleGetSummary, getSummaryDescription } from "./tools/getSummary.js";
import { handleListMetrics, listMetricsDescription } from "./tools/listMetrics.js";
import { handleListTools, listToolsDescription } from "./tools/listTools.js";
import { handleLogRun, logRunDescription, logRunInput } from "./tools/logRun.js";
import {
  handleRegisterTool,
  registerToolDescription,
  registerToolInput,
} from "./tools/registerTool.js";

/**
 * Build the MCP server with the five PositiveROI tools. Config is resolved on
 * every call so a fresh ~/.positiveroi/config.json (written by impact-setup)
 * is picked up without restarting the server.
 */
export function buildServer(): McpServer {
  const server = new McpServer({ name: "positiveroi", version: "0.1.0" });

  server.registerTool(
    "register_tool",
    { description: registerToolDescription, inputSchema: registerToolInput },
    async (params) => handleRegisterTool(params, resolveConfig()),
  );

  server.registerTool(
    "log_run",
    { description: logRunDescription, inputSchema: logRunInput },
    async (params) => handleLogRun(params, resolveConfig()),
  );

  server.registerTool(
    "list_tools",
    { description: listToolsDescription },
    async () => handleListTools(resolveConfig()),
  );

  server.registerTool(
    "list_metrics",
    { description: listMetricsDescription },
    async () => handleListMetrics(resolveConfig()),
  );

  server.registerTool(
    "get_summary",
    { description: getSummaryDescription },
    async () => handleGetSummary(resolveConfig()),
  );

  return server;
}
