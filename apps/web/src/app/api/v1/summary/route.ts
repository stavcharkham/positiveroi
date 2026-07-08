import type { NextRequest } from "next/server";
import { TRAILING_WINDOW_DAYS } from "@positiveroi/core";
import { verifyApiKey } from "@/lib/api-keys";
import { getWorkspace, workspaceStats } from "@/lib/aggregates";
import {
  corsHeaders,
  internalFrom,
  notFoundError,
  preflight,
  unauthorized,
} from "@/lib/errors";

const METHODS = "GET, OPTIONS";

export function OPTIONS() {
  return preflight(METHODS);
}

/**
 * GET — BOTH scopes, deliberately narrow: headline numbers only.
 * No money, no breakdowns — that's what the read scope's /stats is for.
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);

    const workspace = await getWorkspace(key.workspaceId);
    if (!workspace) return notFoundError("Workspace not found.", headers);

    const now = new Date();
    const stats = await workspaceStats(key.workspaceId, {
      fromUtc: new Date(
        now.getTime() - TRAILING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ),
      toUtc: now,
      periodDays: TRAILING_WINDOW_DAYS,
    });

    return Response.json(
      {
        workspace: workspace.name,
        runs_30d: stats.runs,
        hours_30d: stats.hours,
        active_tools: stats.activeTools,
        builders: stats.builders,
      },
      { headers },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}
