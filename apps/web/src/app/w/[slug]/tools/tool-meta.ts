import type { ToolType } from "@positiveroi/core";

/**
 * Client-safe copy and number formatting for the tools pages. Keep this file
 * free of server-only imports — the wizard and settings panel bundle it.
 */

export const TOOL_TYPE_META: Record<ToolType, { label: string; blurb: string }> = {
  automation: {
    label: "Automation",
    blurb: "Runs on a trigger: Zapier, n8n, cron, a webhook.",
  },
  skill: {
    label: "Skill",
    blurb: "A Claude Code skill or slash command.",
  },
  agent: {
    label: "Agent",
    blurb: "An autonomous agent that logs its own runs over MCP.",
  },
  app: {
    label: "App",
    blurb: "An internal app or script with the SDK inside.",
  },
};

/** Trim a number to at most 2 decimals without trailing zeros: 13.5, 27, 4.05. */
export function fmtNum(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Credited minutes → display hours: one decimal under 100h, whole above. */
export function fmtHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 100) return String(Math.round(hours));
  return fmtNum(Math.round(hours * 10) / 10);
}
