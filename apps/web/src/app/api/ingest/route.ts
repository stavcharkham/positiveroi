import type { NextRequest } from "next/server";
import { INGEST_BODY_MAX_BYTES } from "@positiveroi/core";
import { verifyApiKey } from "@/lib/api-keys";
import { checkRateLimit } from "@/lib/rate-limit";
import { ingestEvents } from "@/lib/ingest-core";
import {
  corsHeaders,
  forbiddenScope,
  internalFrom,
  payloadTooLarge,
  preflight,
  rateLimited,
  unauthorized,
  validationFailed,
} from "@/lib/errors";

const METHODS = "POST, OPTIONS";

export function OPTIONS() {
  return preflight(METHODS);
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(METHODS);
  try {
    const key = await verifyApiKey(request.headers.get("authorization"));
    if (!key) return unauthorized(headers);
    if (key.scope !== "ingest") return forbiddenScope("ingest", headers);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > INGEST_BODY_MAX_BYTES) {
      return payloadTooLarge(INGEST_BODY_MAX_BYTES, headers);
    }

    const limit = await checkRateLimit(key.keyId);
    if (limit.limited) return rateLimited(limit.retryAfterSeconds, headers);

    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > INGEST_BODY_MAX_BYTES) {
      return payloadTooLarge(INGEST_BODY_MAX_BYTES, headers);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return validationFailed([{ message: "body is not valid JSON" }], headers);
    }

    const outcome = await ingestEvents(
      { kind: "api", keyId: key.keyId, workspaceId: key.workspaceId },
      body,
    );
    if (!outcome.ok) return validationFailed(outcome.issues, headers);

    // 200 even when individual events were rejected — per-event status
    // lives in results[].
    return Response.json(outcome.response, { status: 200, headers });
  } catch (err) {
    return internalFrom(err, headers);
  }
}
