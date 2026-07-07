import type { PositiveROIConfig } from "./config.js";

const TIMEOUT_MS = 5000;

export interface ApiResponse {
  status: number;
  /** Parsed JSON body, or null when the body was not JSON. */
  json: unknown;
}

/**
 * Thin fetch client. Resolves with { status, json } for any HTTP response;
 * throws an Error with a friendly, actionable message on timeout or network failure.
 */
export async function apiRequest(
  config: PositiveROIConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  const url = `${config.endpoint}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error(
        `The PositiveROI server at ${config.endpoint} did not respond within 5 seconds — check the endpoint URL and your network, then try again.`,
      );
    }
    throw new Error(
      `Could not reach the PositiveROI server at ${config.endpoint} (${cause instanceof Error ? cause.message : "network error"}) — check the endpoint URL and your network.`,
    );
  } finally {
    clearTimeout(timer);
  }
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON body — callers fall back to a status-based message.
  }
  return { status: response.status, json };
}

/** Turn an error response into a friendly, actionable one-liner. */
export function friendlyError(status: number, json: unknown): string {
  const error = (json as { error?: { code?: string; message?: string } } | null)?.error;
  switch (status) {
    case 401:
      return "The PositiveROI server rejected this API key (401 unauthorized) — re-run the impact-setup skill with a fresh ingest key from the dashboard (Settings → API Keys).";
    case 403:
      return "This API key does not have the required scope (403 forbidden_scope) — use a workspace ingest key (roi_ingest_...), not a read key.";
    case 422:
      return `The server rejected the request as invalid (422 validation_failed)${error?.message ? `: ${error.message}` : ""}.`;
    case 429:
      return "The PositiveROI server is rate-limiting this key (429) — wait a minute and try again.";
    default:
      return `PositiveROI server error (${status})${error?.message ? `: ${error.message}` : ""}.`;
  }
}
