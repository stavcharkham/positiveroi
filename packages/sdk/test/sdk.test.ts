import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENV_API_KEY as CORE_ENV_API_KEY,
  ENV_ENDPOINT as CORE_ENV_ENDPOINT,
} from "@positiveroi/core";
import { ENV_API_KEY, ENV_ENDPOINT, LogRunResult, PositiveROI, logRun } from "../src/index.js";

const ENDPOINT = "https://roi.example.com";

function okResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      results: [
        {
          status: "accepted",
          event_id: "11111111-1111-4111-8111-111111111111",
          tool_totals: { tool: "demo-tool", owner_hours_30d: 42.5, multiplier_progress: 0.236 },
          ...overrides,
        },
      ],
      accepted: 1,
      duplicates: 0,
      rejected: 0,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function sentBody(call: unknown[]): Record<string, unknown> {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body));
}

describe("PositiveROI.logRun", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends the documented payload shape with source sdk and an auto sdk: key", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    const client = new PositiveROI({ apiKey: "roi_ingest_abc", endpoint: `${ENDPOINT}/` });
    const result = await client.logRun({
      tool: "demo-tool",
      minutesSaved: 3,
      metrics: { leads_generated: 2 },
      metadata: { surface: "app" },
      isTest: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}/api/ingest`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer roi_ingest_abc");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");

    const body = sentBody(fetchMock.mock.calls[0]);
    expect(body).toMatchObject({
      tool: "demo-tool",
      source: "sdk",
      minutes_saved: 3,
      metrics: { leads_generated: 2 },
      metadata: { surface: "app" },
      is_test: true,
    });
    expect(String(body.idempotency_key)).toMatch(
      /^sdk:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    expect(result).toEqual({ ok: true, status: "accepted", multiplierProgress: 0.236 });
  });

  it("omits optional fields that were not provided", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await new PositiveROI({ apiKey: "k", endpoint: ENDPOINT }).logRun({ tool: "demo-tool" });
    const body = sentBody(fetchMock.mock.calls[0]);
    expect(Object.keys(body).sort()).toEqual(["idempotency_key", "source", "tool"]);
  });

  it("retries exactly once on network error with the SAME idempotency key", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okResponse());
    const result = await new PositiveROI({ apiKey: "k", endpoint: ENDPOINT }).logRun({
      tool: "demo-tool",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = sentBody(fetchMock.mock.calls[0]);
    const second = sentBody(fetchMock.mock.calls[1]);
    expect(first.idempotency_key).toBe(second.idempotency_key);
    expect(result.ok).toBe(true);
  });

  it("retries exactly once on 5xx with the SAME idempotency key", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("oops", { status: 503 }))
      .mockResolvedValueOnce(okResponse({ status: "duplicate", tool_totals: undefined }));
    const result = await new PositiveROI({ apiKey: "k", endpoint: ENDPOINT }).logRun({
      tool: "demo-tool",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock.mock.calls[0]).idempotency_key).toBe(
      sentBody(fetchMock.mock.calls[1]).idempotency_key,
    );
    expect(result).toEqual({ ok: true, status: "duplicate", multiplierProgress: undefined });
  });

  it("does not retry on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "unauthorized", message: "bad key" } }), {
        status: 401,
      }),
    );
    const result = await new PositiveROI({ apiKey: "bad", endpoint: ENDPOINT }).logRun({
      tool: "demo-tool",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false });
  });

  it("aborts after 5s, retries once, and resolves { ok: false }", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );

    const pending: Promise<LogRunResult> = new PositiveROI({
      apiKey: "k",
      endpoint: ENDPOINT,
    }).logRun({ tool: "demo-tool" });

    await vi.advanceTimersByTimeAsync(5000); // first attempt times out
    await vi.advanceTimersByTimeAsync(5000); // retry times out
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false });
  });

  it("NEVER throws — resolves { ok: false } on repeated network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      new PositiveROI({ apiKey: "k", endpoint: ENDPOINT }).logRun({ tool: "demo-tool" }),
    ).resolves.toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("NEVER throws — resolves { ok: false } on an unparsable 2xx body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    await expect(
      new PositiveROI({ apiKey: "k", endpoint: ENDPOINT }).logRun({ tool: "demo-tool" }),
    ).resolves.toEqual({ ok: false });
  });

  it("NEVER throws when crypto.randomUUID is unavailable (insecure-context browser)", async () => {
    // Plain-HTTP internal tools have crypto.getRandomValues but no randomUUID.
    const realCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a),
    });
    fetchMock.mockResolvedValueOnce(okResponse());
    const result = await new PositiveROI({ apiKey: "k", endpoint: ENDPOINT }).logRun({
      tool: "demo-tool",
    });
    expect(result.ok).toBe(true);
    // Still a well-formed v4-shaped key so the server dedupes replays.
    expect(String(sentBody(fetchMock.mock.calls[0]).idempotency_key)).toMatch(
      /^sdk:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("one-shot logRun (env-configured)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("env var names stay pinned to @positiveroi/core", () => {
    expect(ENV_API_KEY).toBe(CORE_ENV_API_KEY);
    expect(ENV_ENDPOINT).toBe(CORE_ENV_ENDPOINT);
  });

  it("reads endpoint and key from the environment", async () => {
    vi.stubEnv(ENV_API_KEY, "roi_ingest_env");
    vi.stubEnv(ENV_ENDPOINT, ENDPOINT);
    fetchMock.mockResolvedValueOnce(okResponse());

    const result = await logRun({ tool: "demo-tool" });
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}/api/ingest`);
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer roi_ingest_env");
  });

  it("resolves { ok: false } without throwing when env is missing", async () => {
    vi.stubEnv(ENV_API_KEY, "");
    vi.stubEnv(ENV_ENDPOINT, "");
    await expect(logRun({ tool: "demo-tool" })).resolves.toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
