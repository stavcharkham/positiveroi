/**
 * API error envelope + CORS helpers for the machine-facing routes.
 * Contract: every error body is { error: { code, message, details? } }.
 */

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden_scope"
  | "not_found"
  | "payload_too_large"
  | "validation_failed"
  | "rate_limited"
  | "slug_taken"
  | "internal";

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden_scope: 403,
  not_found: 404,
  slug_taken: 409,
  payload_too_large: 413,
  validation_failed: 422,
  rate_limited: 429,
  internal: 500,
};

export interface ErrorEnvelope {
  error: { code: ApiErrorCode; message: string; details?: unknown[] };
}

/** Pure envelope builder (unit-testable without Response objects). */
export function errorEnvelope(
  code: ApiErrorCode,
  message: string,
  details?: unknown[],
): ErrorEnvelope {
  return {
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
}

export interface ApiErrorOptions {
  details?: unknown[];
  headers?: Record<string, string>;
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  opts: ApiErrorOptions = {},
): Response {
  return Response.json(errorEnvelope(code, message, opts.details), {
    status: STATUS_BY_CODE[code],
    headers: opts.headers,
  });
}

export function unauthorized(headers?: Record<string, string>): Response {
  return apiError("unauthorized", "Missing or invalid API key.", { headers });
}

export function forbiddenScope(
  required: "ingest" | "read",
  headers?: Record<string, string>,
): Response {
  return apiError(
    "forbidden_scope",
    `This endpoint requires a key with the "${required}" scope.`,
    { headers },
  );
}

export function notFoundError(
  message = "Not found.",
  headers?: Record<string, string>,
): Response {
  return apiError("not_found", message, { headers });
}

export function payloadTooLarge(
  maxBytes: number,
  headers?: Record<string, string>,
): Response {
  return apiError(
    "payload_too_large",
    `Request body exceeds the ${Math.floor(maxBytes / 1024)}KB limit.`,
    { headers },
  );
}

export function validationFailed(
  details?: unknown[],
  headers?: Record<string, string>,
): Response {
  return apiError("validation_failed", "Request failed validation.", {
    details,
    headers,
  });
}

export function rateLimited(
  retryAfterSeconds: number,
  headers?: Record<string, string>,
): Response {
  return apiError(
    "rate_limited",
    "Rate limit exceeded. Slow down and retry.",
    {
      headers: {
        ...headers,
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
      },
    },
  );
}

export function internalError(headers?: Record<string, string>): Response {
  return apiError("internal", "Something went wrong on our side.", { headers });
}

/**
 * Map an unexpected exception to a 500. Configuration errors (missing
 * Supabase env) surface their message so self-hosters can fix setup;
 * everything else stays generic and goes to the server log.
 */
export function internalFrom(
  err: unknown,
  headers?: Record<string, string>,
): Response {
  if (
    err instanceof Error &&
    /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/.test(err.message)
  ) {
    return apiError("internal", err.message, { headers });
  }
  console.error("[api] internal error:", err);
  return internalError(headers);
}

// ---------------------------------------------------------------------------
// CORS — machine API routes are callable from anywhere.
// ---------------------------------------------------------------------------

export function corsHeaders(methods: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": methods,
    // Retry-After is not CORS-safelisted, so browser SDK callers cannot read
    // it off a 429 without this — and the docs tell them to honor it.
    "Access-Control-Expose-Headers": "Retry-After",
  };
}

/** Standard OPTIONS preflight response for an API route. */
export function preflight(methods: string): Response {
  return new Response(null, { status: 204, headers: corsHeaders(methods) });
}
