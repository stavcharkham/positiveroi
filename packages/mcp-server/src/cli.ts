#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configPath, resolveConfig, SETUP_HINT } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    // Help goes to stderr on purpose: when launched by an MCP client, stdout
    // must carry protocol frames only.
    const config = resolveConfig();
    process.stderr.write(
      [
        "positiveroi-mcp — PositiveROI MCP server (stdio)",
        "",
        "Runs as an MCP stdio server exposing: register_tool, log_run, list_tools, get_summary.",
        `Config: ${configPath()} (env POSITIVEROI_API_KEY / POSITIVEROI_ENDPOINT override it).`,
        "",
        config
          ? `Configured — endpoint: ${config.endpoint}`
          : SETUP_HINT,
        "",
      ].join("\n"),
    );
    return;
  }

  if (!resolveConfig()) {
    // Not fatal: tools return a setup hint until config exists, and config is
    // re-resolved on every call, so setup can happen while we're running.
    process.stderr.write(`positiveroi-mcp: ${SETUP_HINT}\n`);
  }

  const server = buildServer();
  await server.connect(new StdioServerTransport());
}

main().catch((cause) => {
  process.stderr.write(`positiveroi-mcp failed to start: ${cause instanceof Error ? cause.message : String(cause)}\n`);
  process.exit(1);
});
