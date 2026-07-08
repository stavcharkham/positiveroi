import { describe, expect, it } from "vitest";
import {
  STATUS_BY_CODE,
  apiError,
  corsHeaders,
  errorEnvelope,
  forbiddenScope,
  internalError,
  notFoundError,
  payloadTooLarge,
  preflight,
  rateLimited,
  unauthorized,
  validationFailed,
} from "@/lib/errors";

describe("errorEnvelope", () => {
  it("builds the exact { error: { code, message } } shape", () => {
    expect(errorEnvelope("unauthorized", "nope")).toEqual({
      error: { code: "unauthorized", message: "nope" },
    });
  });

  it("includes details only when provided", () => {
    const withDetails = errorEnvelope("validation_failed", "bad", [{ a: 1 }]);
    expect(withDetails.error.details).toEqual([{ a: 1 }]);
    expect("details" in errorEnvelope("internal", "x").error).toBe(false);
  });
});

describe("status codes", () => {
  it("maps every contract code to its status", () => {
    expect(STATUS_BY_CODE.unauthorized).toBe(401);
    expect(STATUS_BY_CODE.forbidden_scope).toBe(403);
    expect(STATUS_BY_CODE.not_found).toBe(404);
    expect(STATUS_BY_CODE.slug_taken).toBe(409);
    expect(STATUS_BY_CODE.payload_too_large).toBe(413);
    expect(STATUS_BY_CODE.validation_failed).toBe(422);
    expect(STATUS_BY_CODE.rate_limited).toBe(429);
    expect(STATUS_BY_CODE.internal).toBe(500);
  });

  it.each([
    [unauthorized(), 401, "unauthorized"],
    [forbiddenScope("ingest"), 403, "forbidden_scope"],
    [notFoundError(), 404, "not_found"],
    [payloadTooLarge(256 * 1024), 413, "payload_too_large"],
    [validationFailed(), 422, "validation_failed"],
    [rateLimited(30), 429, "rate_limited"],
    [internalError(), 500, "internal"],
  ] as const)("helper returns %o", async (res, status, code) => {
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.error.code).toBe(code);
    expect(typeof body.error.message).toBe("string");
  });
});

describe("rateLimited", () => {
  it("sets a whole-second Retry-After header, minimum 1", async () => {
    expect(rateLimited(42.2).headers.get("Retry-After")).toBe("43");
    expect(rateLimited(0).headers.get("Retry-After")).toBe("1");
  });
});

describe("apiError", () => {
  it("threads extra headers through", () => {
    const res = apiError("not_found", "x", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("CORS", () => {
  it("corsHeaders exposes origin, headers, and methods", () => {
    const h = corsHeaders("GET, OPTIONS");
    expect(h["Access-Control-Allow-Origin"]).toBe("*");
    expect(h["Access-Control-Allow-Headers"]).toBe("Authorization, Content-Type");
    expect(h["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
  });

  it("preflight is a 204 with CORS headers", () => {
    const res = preflight("POST, OPTIONS");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });
});
