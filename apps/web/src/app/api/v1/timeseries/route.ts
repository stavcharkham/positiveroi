import type { NextRequest } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  PeriodError,
  getWorkspace,
  resolvePeriod,
  timeseries,
  type TimeseriesBucketName,
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
const BUCKETS: TimeseriesBucketName[] = ["day", "week", "month"];

export function OPTIONS() {
  return preflight(METHODS);
}

/** GET — read scope only. Bucketed runs + minutes for charting. */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);
    if (key.scope !== "read") return forbiddenScope("read", headers);

    const workspace = await getWorkspace(key.workspaceId);
    if (!workspace) return notFoundError("Workspace not found.", headers);

    const params = request.nextUrl.searchParams;
    const bucket = (params.get("bucket") ?? "day") as TimeseriesBucketName;
    if (!BUCKETS.includes(bucket)) {
      return validationFailed(
        [{ message: `invalid bucket "${bucket}" — expected day, week, or month` }],
        headers,
      );
    }

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

    let toolId: string | undefined;
    const toolSlug = params.get("tool");
    if (toolSlug) {
      const { data: tool } = await getAdminClient()
        .from("tools")
        .select("id")
        .eq("workspace_id", key.workspaceId)
        .eq("slug", toolSlug)
        .maybeSingle();
      if (!tool) {
        return notFoundError(`No tool "${toolSlug}" in this workspace.`, headers);
      }
      toolId = tool.id as string;
    }

    const buckets = await timeseries(key.workspaceId, bucket, period, toolId);
    return Response.json(
      {
        buckets: buckets.map((b) => ({
          start: b.start,
          runs: b.runs,
          minutes_saved: b.minutes,
        })),
      },
      { headers },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}
