import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME, ENV_API_KEY, ENV_ENDPOINT, KEY_PREFIX_INGEST } from "@positiveroi/core";

export interface PositiveROIConfig {
  endpoint: string;
  apiKey: string;
  /** Slash-command trigger → tool slug (used by the Claude Code plugin hook). */
  tools?: Record<string, string>;
  /** Slugs whose runs the plugin hook logs automatically — log_run refuses these. */
  hookCaptured?: string[];
}

export function configPath(home: string = homedir()): string {
  return join(home, CONFIG_DIR_NAME, "config.json");
}

/**
 * Resolve config: env POSITIVEROI_API_KEY / POSITIVEROI_ENDPOINT override
 * ~/.positiveroi/config.json. Returns null when no usable config exists.
 */
export function resolveConfig(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
): PositiveROIConfig | null {
  let file: Partial<PositiveROIConfig> = {};
  try {
    file = JSON.parse(readFileSync(configPath(home), "utf8")) as Partial<PositiveROIConfig>;
  } catch {
    // No config file (or unreadable) — env vars may still configure us.
  }
  const endpoint = env[ENV_ENDPOINT] || file.endpoint;
  const apiKey = env[ENV_API_KEY] || file.apiKey;
  if (!endpoint || !apiKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    apiKey,
    tools: file.tools,
    hookCaptured: file.hookCaptured,
  };
}

export const SETUP_HINT =
  "PositiveROI is not connected on this machine. " +
  "Run the impact-setup skill from the positiveroi Claude Code plugin, " +
  `or create ${configPath()} with {"endpoint": "https://your-server", "apiKey": "${KEY_PREFIX_INGEST}..."}, ` +
  `or set the ${ENV_API_KEY} and ${ENV_ENDPOINT} environment variables.`;
