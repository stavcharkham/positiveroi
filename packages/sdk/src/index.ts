/**
 * @positiveroi/sdk — tiny capture client for browser and node.
 * Zero runtime dependencies. A metrics client must never break the host app:
 * logRun never throws and never takes longer than ~10s (5s timeout × 2 attempts).
 */

// Pinned to @positiveroi/core ENV_API_KEY / ENV_ENDPOINT (this package has zero
// runtime deps, so the strings are duplicated; a test asserts they stay in sync).
export const ENV_API_KEY = "POSITIVEROI_API_KEY";
export const ENV_ENDPOINT = "POSITIVEROI_ENDPOINT";

const TIMEOUT_MS = 5000;

export interface LogRunOptions {
  /** Registered tool slug. */
  tool: string;
  /** Only to LOWER credit for a partial run; clamped server-side. */
  minutesSaved?: number;
  metrics?: Record<string, number>;
  metadata?: Record<string, unknown>;
  /** Provide your own to dedupe across process restarts; otherwise auto-generated. */
  idempotencyKey?: string;
  isTest?: boolean;
}

export interface LogRunResult {
  ok: boolean;
  status?: "accepted" | "duplicate";
  multiplierProgress?: number;
}

export class PositiveROI {
  constructor(private readonly config: { apiKey: string; endpoint: string }) {}

  async logRun(run: LogRunOptions): Promise<LogRunResult> {
    // Auto key (format pinned to @positiveroi/core sdkIdempotencyKey) — generated
    // once per call, so the retry below replays with the SAME key.
    const idempotencyKey = run.idempotencyKey ?? `sdk:${crypto.randomUUID()}`;
    const body = JSON.stringify({
      tool: run.tool,
      source: "sdk",
      idempotency_key: idempotencyKey,
      ...(run.minutesSaved !== undefined && { minutes_saved: run.minutesSaved }),
      ...(run.metrics !== undefined && { metrics: run.metrics }),
      ...(run.metadata !== undefined && { metadata: run.metadata }),
      ...(run.isTest !== undefined && { is_test: run.isTest }),
    });
    const url = `${this.config.endpoint.replace(/\/+$/, "")}/api/ingest`;

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${this.config.apiKey}`,
              "content-type": "application/json",
            },
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      } catch {
        continue; // network error or timeout — one retry, same idempotency key
      }
      if (response.status >= 500) continue; // transient server error — one retry
      if (!response.ok) return { ok: false };
      try {
        const json = (await response.json()) as {
          results?: Array<{
            status?: string;
            tool_totals?: { multiplier_progress?: number };
          }>;
        };
        const result = json?.results?.[0];
        if (result?.status === "accepted" || result?.status === "duplicate") {
          return {
            ok: true,
            status: result.status,
            multiplierProgress: result.tool_totals?.multiplier_progress,
          };
        }
      } catch {
        /* unparsable 2xx body — treated as failure below */
      }
      return { ok: false };
    }
    return { ok: false };
  }
}

/** One-shot convenience for node: reads POSITIVEROI_API_KEY / POSITIVEROI_ENDPOINT. */
export async function logRun(run: LogRunOptions): Promise<LogRunResult> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const apiKey = env?.[ENV_API_KEY];
  const endpoint = env?.[ENV_ENDPOINT];
  if (!apiKey || !endpoint) return { ok: false };
  return new PositiveROI({ apiKey, endpoint }).logRun(run);
}
