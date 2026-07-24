import type { NextRequest } from "next/server";
import { METHODOLOGY, fteEquivalent, moneyValueCents } from "@positiveroi/core";
import { verifyApiKey } from "@/lib/api-keys";
import {
  PeriodError,
  getWorkspace,
  resolvePeriod,
  workspaceStats,
} from "@/lib/aggregates";
import {
  corsHeaders,
  forbiddenScope,
  internalFrom,
  notFoundError,
  preflight,
  unauthorized,
  validationFailed,
} from "@/lib/errors";

const METHODS = "GET, OPTIONS";

export function OPTIONS() {
  return preflight(METHODS);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** GET — read scope only. The full picture, methodology attached. */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);
    if (key.scope !== "read") return forbiddenScope("read", headers);

    const workspace = await getWorkspace(key.workspaceId);
    if (!workspace) return notFoundError("Workspace not found.", headers);

    const params = request.nextUrl.searchParams;
    let period;
    try {
      period = resolvePeriod(
        {
          period: params.get("period"),
          from: params.get("from"),
          to: params.get("to"),
        },
        workspace.timezone,
        workspace.created_at,
      );
    } catch (err) {
      if (err instanceof PeriodError) {
        return validationFailed([{ message: err.message }], headers);
      }
      throw err;
    }

    const stats = await workspaceStats(key.workspaceId, period);
    // money_value is null when the workspace has no hourly rate set.
    const moneyValue =
      workspace.hourly_rate_cents === null
        ? null
        : {
            amount: round2(
              moneyValueCents(stats.hours, workspace.hourly_rate_cents) / 100,
            ),
            currency: workspace.currency,
            hourly_rate: round2(workspace.hourly_rate_cents / 100),
          };

    return Response.json(
      {
        range: {
          from: period.fromUtc.toISOString(),
          to: period.toUtc.toISOString(),
        },
        runs: stats.runs,
        minutes_saved: stats.minutes,
        hours_saved: stats.hours,
        fte_equivalent: round2(fteEquivalent(stats.hours, period.periodDays)),
        money_value: moneyValue,
        active_tools: stats.activeTools,
        builders: stats.builders,
        methodology: METHODOLOGY.description,
      },
      { headers: { ...headers, "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}
