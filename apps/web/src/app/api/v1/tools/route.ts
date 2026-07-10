import type { NextRequest } from "next/server";
import {
  effectiveMinutesSavedPerRun,
  methodologyReceipt,
  slugify,
  toolCreateApiSchema,
} from "@positiveroi/core";
import { verifyApiKey } from "@/lib/api-keys";
import { getAdminClient } from "@/lib/supabase/admin";
import { toolStats } from "@/lib/aggregates";
import {
  apiError,
  corsHeaders,
  forbiddenScope,
  internalFrom,
  preflight,
  unauthorized,
  validationFailed,
} from "@/lib/errors";

const METHODS = "GET, POST, OPTIONS";
const UNIQUE_VIOLATION = "23505";

export function OPTIONS() {
  return preflight(METHODS);
}

interface ToolListRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  minutes_saved_per_run: number;
  minutes_saved_override: number | null;
  owner_id: string;
}

/** The credited minutes new runs snapshot — builder-set when one is set. */
function creditedPerRun(row: ToolListRow): number {
  return effectiveMinutesSavedPerRun(
    Number(row.minutes_saved_per_run),
    row.minutes_saved_override === null ? null : Number(row.minutes_saved_override),
  );
}

/** GET — both scopes; read keys get the enriched shape. */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("tools")
      .select(
        "id, slug, name, type, status, minutes_saved_per_run, minutes_saved_override, owner_id",
      )
      .eq("workspace_id", key.workspaceId)
      .order("name");
    if (error) throw new Error(`tools list failed: ${error.message}`);
    const rows = (data ?? []) as ToolListRow[];

    if (key.scope === "ingest") {
      return Response.json(
        {
          tools: rows.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            type: t.type,
            status: t.status,
            minutes_saved_per_run: creditedPerRun(t),
          })),
        },
        { headers },
      );
    }

    // read scope: attach owner names + rollups.
    const [stats, membersResult] = await Promise.all([
      toolStats(key.workspaceId, supabase),
      supabase
        .from("members")
        .select("user_id, display_name")
        .eq("workspace_id", key.workspaceId),
    ]);
    if (membersResult.error) {
      throw new Error(`members lookup failed: ${membersResult.error.message}`);
    }
    const nameByUser = new Map(
      ((membersResult.data ?? []) as { user_id: string; display_name: string }[]).map(
        (m) => [m.user_id, m.display_name],
      ),
    );

    return Response.json(
      {
        tools: rows.map((t) => {
          const s = stats.get(t.id);
          return {
            id: t.id,
            slug: t.slug,
            name: t.name,
            type: t.type,
            status: t.status,
            minutes_saved_per_run: creditedPerRun(t),
            owner_display_name: nameByUser.get(t.owner_id) ?? "",
            runs_30d: s?.runs30d ?? 0,
            hours_all_time: s?.hoursAllTime ?? 0,
            last_run_at: s?.lastRunAt ?? null,
          };
        }),
      },
      { headers },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}

/** POST — ingest scope; register a tool from the machine plane. */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);
    if (key.scope !== "ingest") return forbiddenScope("ingest", headers);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationFailed([{ message: "body is not valid JSON" }], headers);
    }
    const parsed = toolCreateApiSchema.safeParse(body);
    if (!parsed.success) return validationFailed(parsed.error.issues, headers);
    const input = parsed.data;
    const slug = slugify(input.name);

    const supabase = getAdminClient();
    const { data: tool, error } = await supabase
      .from("tools")
      .insert({
        workspace_id: key.workspaceId,
        owner_id: key.createdBy,
        name: input.name,
        slug,
        description: input.description,
        type: input.type,
        raw_estimate_minutes: input.raw_estimate_minutes,
        high_judgment: input.high_judgment,
        origin: "api",
      })
      .select("id, slug, minutes_saved_per_run")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        const { data: existing } = await supabase
          .from("tools")
          .select("id, slug")
          .eq("workspace_id", key.workspaceId)
          .eq("slug", slug)
          .maybeSingle();
        return apiError(
          "slug_taken",
          `A tool with slug "${slug}" already exists in this workspace.`,
          { details: existing ? [existing] : [], headers },
        );
      }
      throw new Error(`tool insert failed: ${error.message}`);
    }

    // Baseline audit trail: creation row with null "old" values.
    await supabase.from("baseline_history").insert({
      workspace_id: key.workspaceId,
      tool_id: tool.id,
      changed_by: key.createdBy,
      old_raw_estimate: null,
      new_raw_estimate: input.raw_estimate_minutes,
      old_high_judgment: null,
      new_high_judgment: input.high_judgment,
    });

    return Response.json(
      {
        tool: {
          id: tool.id,
          slug: tool.slug,
          minutes_saved_per_run: tool.minutes_saved_per_run,
          methodology: methodologyReceipt(
            input.raw_estimate_minutes,
            input.high_judgment,
          ),
        },
      },
      { status: 201, headers },
    );
  } catch (err) {
    return internalFrom(err, headers);
  }
}
