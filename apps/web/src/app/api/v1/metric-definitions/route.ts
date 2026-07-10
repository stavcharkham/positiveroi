import type { NextRequest } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  corsHeaders,
  internalFrom,
  preflight,
  unauthorized,
} from "@/lib/errors";

const METHODS = "GET, OPTIONS";

export function OPTIONS() {
  return preflight(METHODS);
}

interface MetricDefinitionRow {
  key: string;
  name: string;
  unit: string;
}

/**
 * GET — BOTH scopes. Metric definitions only (key, name, unit) so agents can
 * discover which keys to attach as `metrics` when logging runs. No values,
 * no totals — comparable sensitivity to the slim tools list ingest keys get.
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("metric_definitions")
      .select("key, name, unit")
      .eq("workspace_id", key.workspaceId)
      .order("created_at");
    if (error) throw new Error(`metric definitions list failed: ${error.message}`);
    const rows = (data ?? []) as MetricDefinitionRow[];

    return Response.json(
      {
        metrics: rows.map(({ key: metricKey, name, unit }) => ({
          key: metricKey,
          name,
          unit,
        })),
      },
      { headers },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}
