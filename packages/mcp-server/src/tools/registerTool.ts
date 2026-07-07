import { z } from "zod";
import { RAW_ESTIMATE_MAX_API, TOOL_TYPES } from "@positiveroi/core";
import type { PositiveROIConfig } from "../config.js";
import { SETUP_HINT } from "../config.js";
import { apiRequest, friendlyError } from "../http.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

export const registerToolDescription =
  "Register a new AI tool so its runs count toward measured impact. " +
  "Uses PositiveROI's conservative Undercount methodology: the claimed manual baseline " +
  "takes a 40% confidence cut, then a further 50% judgment cut when a human decision " +
  "remains in the loop. Registration returns the exact math so you can show the builder " +
  "how the credited minutes-per-run were derived. If the tool is already registered, " +
  "use log_run instead.";

export const registerToolInput = {
  name: z.string().min(1).max(100).describe("Human-readable tool name, e.g. 'Weekly pipeline digest'."),
  type: z
    .enum(TOOL_TYPES)
    .describe("What kind of tool this is: automation (runs by itself), skill (a Claude Code skill/command), agent (an autonomous agent), or app (an application people use)."),
  description: z.string().max(2000).optional().describe("One or two sentences on what the tool does."),
  raw_estimate_minutes: z
    .number()
    .int()
    .gt(0)
    .max(RAW_ESTIMATE_MAX_API)
    .describe(
      "The MOST CONSERVATIVE estimate of manual minutes one run replaces — if unsure between two numbers, use the lower. Capped at " +
        `${RAW_ESTIMATE_MAX_API} on this path; larger baselines must be set in the dashboard.`,
    ),
  high_judgment: z
    .boolean()
    .describe("Does a human still make a meaningful decision in this task? If yes, credit is halved."),
};

interface CreatedTool {
  id: string;
  slug: string;
  minutes_saved_per_run: number;
  methodology: string;
}

export async function handleRegisterTool(
  params: {
    name: string;
    type: (typeof TOOL_TYPES)[number];
    description?: string;
    raw_estimate_minutes: number;
    high_judgment: boolean;
  },
  config: PositiveROIConfig | null,
): Promise<ToolResult> {
  if (!config) return errorResult(SETUP_HINT);
  let response;
  try {
    response = await apiRequest(config, "POST", "/api/v1/tools", {
      name: params.name,
      type: params.type,
      ...(params.description !== undefined && { description: params.description }),
      raw_estimate_minutes: params.raw_estimate_minutes,
      high_judgment: params.high_judgment,
    });
  } catch (cause) {
    return errorResult(cause instanceof Error ? cause.message : String(cause));
  }

  if (response.status === 201) {
    const tool = (response.json as { tool: CreatedTool }).tool;
    return textResult(
      [
        `Registered "${params.name}" as \`${tool.slug}\`.`,
        `Methodology: ${tool.methodology}`,
        `Each run credits ${tool.minutes_saved_per_run} conservative minutes saved.`,
        `Log runs with log_run (tool: "${tool.slug}") after each completed run.`,
      ].join("\n"),
    );
  }

  const error = (response.json as { error?: { code?: string; details?: unknown[] } } | null)
    ?.error;
  if (response.status === 409 && error?.code === "slug_taken") {
    const details = error.details?.length ? `\nExisting tool: ${JSON.stringify(error.details)}` : "";
    return textResult(
      `"${params.name}" is already registered — use log_run to record its runs instead of registering it again.${details}`,
    );
  }
  return errorResult(friendlyError(response.status, response.json));
}
