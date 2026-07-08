import type { NextRequest } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import {
  PeriodError,
  getWorkspace,
  metricTotals,
  resolvePeriod,
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

/** GET — read scope only. Business-metric totals for the period. */
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

    const totals = await metricTotals(key.workspaceId, period);
    return Response.json(
      {
        metrics: totals.map((m) => ({
          key: m.key,
          name: m.name,
          unit: m.unit,
          total: m.total,
        })),
      },
      { headers },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}
