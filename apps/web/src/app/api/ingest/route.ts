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

/**
 * Read a request body to a string, aborting once it exceeds `maxBytes` so
 * memory stays bounded regardless of Content-Length. Returns null when over
 * the cap.
 */
async function readBodyBounded(
  request: NextRequest,
  maxBytes: number,
): Promise<string | null> {
  const stream = request.body;
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
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

    // Read with a running byte counter and abort past the cap, so a chunked
    // request with no Content-Length can't buffer an arbitrary body into
    // memory on a self-hosted `next start` (Vercel caps bodies; bare Node
    // does not).
    const text = await readBodyBounded(request, INGEST_BODY_MAX_BYTES);
    if (text === null) return payloadTooLarge(INGEST_BODY_MAX_BYTES, headers);
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
