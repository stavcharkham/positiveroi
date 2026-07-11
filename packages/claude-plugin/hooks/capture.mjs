#!/usr/bin/env node
/**
 * PositiveROI capture hook (UserPromptSubmit).
 *
 * Security posture (load-bearing — do not relax):
 *   - Sends ONLY: tool slug, timestamp, source "hook", a hash-derived
 *     idempotency key, and metadata.surface = "claude-code".
 *   - NEVER sends prompt text or substrings, arguments, file paths, cwd,
 *     or environment values.
 *   - NEVER writes to stdout (UserPromptSubmit stdout is injected into
 *     model context).
 *   - NEVER exits non-zero (a metrics hook must never block a prompt).
 *
 * Zero imports beyond node builtins.
 */

import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Per-fetch budget. The hook makes at most two sequential POSTs (drain, then
// the live event), and hooks.json caps the whole invocation at 5s — so this
// must stay under 2500ms or a hanging server could burn both fetches and get
// the process killed before the live event's catch queues it.
const TIMEOUT_MS = 2000;
const QUEUE_MAX_BYTES = 1024 * 1024; // 1MB cap — oldest lines dropped first
const DRAIN_BATCH = 20;
// Pinned to @positiveroi/core CONFIG_DIR_NAME / ENV_API_KEY / ENV_ENDPOINT
// (this script cannot import the package — it must stay dependency-free).
const CONFIG_DIR = ".positiveroi";
const ENV_API_KEY = "POSITIVEROI_API_KEY";
const ENV_ENDPOINT = "POSITIVEROI_ENDPOINT";

/**
 * Idempotency key: "hook:" + session + ":" + first 16 hex chars of
 * sha256(prompt). Format pinned by test/idempotency-fixtures.json and by
 * @positiveroi/core hookIdempotencyKey. Never contains prompt text.
 */
export function hookIdempotencyKey(sessionId, prompt) {
  const digest = createHash("sha256").update(String(prompt), "utf8").digest("hex").slice(0, 16);
  return `hook:${sessionId}:${digest}`;
}

/**
 * A trigger matches when the prompt starts with "/<trigger>" (or the
 * namespaced "/positiveroi:<trigger>") case-insensitively, followed by
 * whitespace or end-of-prompt (so trigger "report" never claims "/report-tool").
 */
export function matchTool(prompt, tools) {
  const lowered = String(prompt).toLowerCase();
  for (const [trigger, slug] of Object.entries(tools)) {
    const t = String(trigger).toLowerCase();
    for (const prefix of [`/${t}`, `/positiveroi:${t}`]) {
      const next = lowered.startsWith(prefix) ? lowered[prefix.length] : null;
      if (next === undefined || (next !== null && /\s/.test(next))) return slug;
    }
  }
  return null;
}

function configFilePath() {
  return join(homedir(), CONFIG_DIR, "config.json");
}

function queueFilePath() {
  return join(homedir(), CONFIG_DIR, "queue.ndjson");
}

function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(readFileSync(configFilePath(), "utf8"));
  } catch {
    // No config file — env vars may still configure endpoint/key.
  }
  const endpoint = process.env[ENV_ENDPOINT] || file.endpoint;
  const apiKey = process.env[ENV_API_KEY] || file.apiKey;
  if (!endpoint || !apiKey) return null;
  const tools = file.tools;
  if (!tools || typeof tools !== "object" || Object.keys(tools).length === 0) return null;
  return { endpoint: String(endpoint).replace(/\/+$/, ""), apiKey, tools };
}

/** POST to /api/ingest. Returns the Response; throws on network error/timeout. */
async function post(config, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${config.endpoint}/api/ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function readQueueLines() {
  try {
    return readFileSync(queueFilePath(), "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function writeQueueLines(lines) {
  try {
    if (lines.length === 0) {
      try {
        unlinkSync(queueFilePath());
      } catch {
        /* already gone */
      }
      return;
    }
    mkdirSync(dirname(queueFilePath()), { recursive: true });
    writeFileSync(queueFilePath(), lines.join("\n") + "\n");
  } catch {
    /* queueing is best-effort */
  }
}

function enqueue(event) {
  const line = JSON.stringify(event) + "\n";
  try {
    mkdirSync(dirname(queueFilePath()), { recursive: true });
    // Append, not read-modify-write: a single ≤4KB append is atomic on POSIX,
    // so two concurrent Claude sessions queuing while offline never clobber
    // each other's event. The 1MB cap is enforced lazily below and on drain.
    appendFileSync(queueFilePath(), line);
    let size = 0;
    try {
      size = statSync(queueFilePath()).size;
    } catch {
      /* just written — treat as within bounds */
    }
    if (size > QUEUE_MAX_BYTES) {
      // Over cap — compact by dropping the oldest lines. A rare concurrent
      // append here can at worst re-drop a line; it never loses a fresh one.
      const lines = readQueueLines();
      let total = lines.reduce((n, l) => n + Buffer.byteLength(l, "utf8") + 1, 0);
      while (lines.length > 0 && total > QUEUE_MAX_BYTES) {
        total -= Buffer.byteLength(lines[0], "utf8") + 1;
        lines.shift();
      }
      writeQueueLines(lines);
    }
  } catch {
    /* queueing is best-effort */
  }
}

/** Send up to DRAIN_BATCH queued events as one batch; remove them on success. */
async function drainQueue(config) {
  const lines = readQueueLines();
  if (lines.length === 0) return;
  const batch = lines.slice(0, DRAIN_BATCH);
  const events = [];
  for (const line of batch) {
    try {
      events.push(JSON.parse(line));
    } catch {
      /* corrupt line — dropped with its batch below */
    }
  }
  if (events.length === 0) {
    writeQueueLines(lines.slice(batch.length));
    return;
  }
  try {
    const response = await post(config, { events });
    // A 4xx (or a 2xx with per-event rejects) means the server judged the
    // batch — idempotency keys make replays safe and keeping rejected events
    // would poison the queue, so drop it. A 5xx means nothing was judged (a
    // proxy or a crashed server), so keep it, matching the live-event path.
    if (response.status >= 500) return;
    writeQueueLines(lines.slice(batch.length));
  } catch {
    /* still unreachable — leave the queue for the next invocation */
  }
}

async function main() {
  const input = await new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });

  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {
    return;
  }

  const config = loadConfig();
  if (!config) return; // no config or no tools map — exit silently

  await drainQueue(config); // always drain first; replays are idempotent

  const prompt = typeof payload.prompt === "string" ? payload.prompt : payload.user_prompt;
  const sessionId = payload.session_id;
  if (typeof prompt !== "string" || typeof sessionId !== "string" || sessionId === "") return;

  const slug = matchTool(prompt, config.tools);
  if (!slug) return;

  const event = {
    tool: slug,
    occurred_at: new Date().toISOString(),
    source: "hook",
    idempotency_key: hookIdempotencyKey(sessionId, prompt),
    metadata: { surface: "claude-code" },
  };

  try {
    const response = await post(config, event);
    // 5xx may succeed later — queue it. 4xx is permanent — drop it.
    if (response.status >= 500) enqueue(event);
  } catch {
    enqueue(event); // network error or timeout — queue for the next invocation
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .catch(() => {
      /* never fail the prompt */
    })
    .finally(() => process.exit(0));
}
