import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hookIdempotencyKey, matchTool } from "../hooks/capture.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CAPTURE = join(here, "..", "hooks", "capture.mjs");
const fixtures = JSON.parse(readFileSync(join(here, "idempotency-fixtures.json"), "utf8"));

/** Run capture.mjs as a child process with a controlled HOME and env. */
function runHook(stdinPayload, { home, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CAPTURE], {
      env: {
        PATH: process.env.PATH,
        HOME: home,
        // Make sure ambient config never leaks into tests:
        POSITIVEROI_API_KEY: "",
        POSITIVEROI_ENDPOINT: "",
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(typeof stdinPayload === "string" ? stdinPayload : JSON.stringify(stdinPayload));
  });
}

/** Local mock ingest server capturing raw request bodies. */
async function startMockServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization,
        rawBody: raw,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          results: [{ status: "accepted", event_id: "55555555-5555-4555-8555-555555555555" }],
          accepted: 1,
          duplicates: 0,
          rejected: 0,
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  return { server, endpoint, requests, close: () => new Promise((r) => server.close(r)) };
}

function makeHome(config) {
  const home = mkdtempSync(join(tmpdir(), "roi-hook-"));
  if (config) {
    mkdirSync(join(home, ".positiveroi"), { recursive: true });
    writeFileSync(join(home, ".positiveroi", "config.json"), JSON.stringify(config));
  }
  return home;
}

function assertSilent(result) {
  assert.equal(result.code, 0, `exit code must be 0 (stderr: ${result.stderr})`);
  assert.equal(result.stdout, "", "stdout must be EMPTY — it is injected into model context");
}

// ---------------------------------------------------------------------------
// Idempotency key format — pinned by the shared fixtures (all three, including
// the unicode prompt that never matches a trigger).
// ---------------------------------------------------------------------------

test("hookIdempotencyKey reproduces every pinned fixture", () => {
  for (const fixture of fixtures) {
    assert.equal(hookIdempotencyKey(fixture.session_id, fixture.prompt), fixture.expected_key);
  }
});

test("trigger matching: /<trigger> and /positiveroi:<trigger>, boundary-safe, case-insensitive", () => {
  const tools = { "report-tool": "weekly-numbers-bot", report: "other-slug" };
  assert.equal(matchTool("/report-tool run the weekly numbers", tools), "weekly-numbers-bot");
  assert.equal(matchTool("/REPORT-TOOL now", tools), "weekly-numbers-bot");
  assert.equal(matchTool("/positiveroi:report-tool", tools), "weekly-numbers-bot");
  assert.equal(matchTool("/report only", tools), "other-slug");
  assert.equal(matchTool("report-tool without slash", tools), null);
  assert.equal(matchTool("hello /report-tool", tools), null);
  // Boundary: a trigger never claims a longer command it merely prefixes.
  assert.equal(matchTool("/report-toolbox", { "report-tool": "x" }), null);
});

// ---------------------------------------------------------------------------
// Unconfigured → silent no-op
// ---------------------------------------------------------------------------

test("unconfigured: exit 0, empty stdout, no request, no queue file", async () => {
  const mock = await startMockServer();
  try {
    const home = makeHome(null); // no config.json at all
    const result = await runHook(
      { prompt: "/report-tool run the weekly numbers", session_id: "sess-1" },
      { home },
    );
    assertSilent(result);
    assert.equal(mock.requests.length, 0);
    assert.ok(!existsSync(join(home, ".positiveroi", "queue.ndjson")));
  } finally {
    await mock.close();
  }
});

test("config without a tools map: silent no-op", async () => {
  const mock = await startMockServer();
  try {
    const home = makeHome({ endpoint: mock.endpoint, apiKey: "roi_ingest_x" }); // no tools
    const result = await runHook(
      { prompt: "/report-tool run the weekly numbers", session_id: "sess-1" },
      { home },
    );
    assertSilent(result);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

// ---------------------------------------------------------------------------
// Happy path — exact payload, never containing prompt text
// ---------------------------------------------------------------------------

test("matched prompt sends the exact payload with the pinned idempotency key", async () => {
  const mock = await startMockServer();
  try {
    const fixture = fixtures[0]; // "/report-tool run the weekly numbers" / sess-1
    const home = makeHome({
      endpoint: mock.endpoint,
      apiKey: "roi_ingest_x",
      tools: { "report-tool": "weekly-numbers-bot" },
    });
    const result = await runHook(
      { prompt: fixture.prompt, session_id: fixture.session_id },
      { home },
    );
    assertSilent(result);

    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/ingest");
    assert.equal(request.authorization, "Bearer roi_ingest_x");

    const body = JSON.parse(request.rawBody);
    assert.deepEqual(Object.keys(body).sort(), [
      "idempotency_key",
      "metadata",
      "occurred_at",
      "source",
      "tool",
    ]);
    assert.equal(body.tool, "weekly-numbers-bot");
    assert.equal(body.source, "hook");
    assert.equal(body.idempotency_key, fixture.expected_key);
    assert.deepEqual(body.metadata, { surface: "claude-code" });
    assert.ok(!Number.isNaN(Date.parse(body.occurred_at)), "occurred_at must be a valid ISO timestamp");

    // Security assertion on the RAW bytes: no prompt text or substrings ever leave.
    assert.ok(!request.rawBody.includes(fixture.prompt), "raw body must not contain the prompt");
    assert.ok(!request.rawBody.includes("run the weekly numbers"), "raw body must not contain prompt substrings");
    assert.ok(!request.rawBody.includes("weekly numbers"));
  } finally {
    await mock.close();
  }
});

test("namespaced /positiveroi:<trigger> form matches and keys correctly", async () => {
  const mock = await startMockServer();
  try {
    const fixture = fixtures[1]; // "/positiveroi:register-tool" / abc123
    const home = makeHome({
      endpoint: mock.endpoint,
      apiKey: "roi_ingest_x",
      tools: { "register-tool": "onboarding-bot" },
    });
    const result = await runHook(
      // user_prompt variant of the stdin field must be handled too:
      { user_prompt: fixture.prompt, session_id: fixture.session_id },
      { home },
    );
    assertSilent(result);
    assert.equal(mock.requests.length, 1);
    const body = JSON.parse(mock.requests[0].rawBody);
    assert.equal(body.tool, "onboarding-bot");
    assert.equal(body.idempotency_key, fixture.expected_key);
  } finally {
    await mock.close();
  }
});

test("non-matching prompt: no request, exit 0", async () => {
  const mock = await startMockServer();
  try {
    const home = makeHome({
      endpoint: mock.endpoint,
      apiKey: "roi_ingest_x",
      tools: { "report-tool": "weekly-numbers-bot" },
    });
    const result = await runHook(
      { prompt: "just chatting, no command here", session_id: "sess-9" },
      { home },
    );
    assertSilent(result);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test("malformed stdin: exit 0, empty stdout", async () => {
  const result = await runHook("this is not json{", { home: makeHome(null) });
  assertSilent(result);
});

// ---------------------------------------------------------------------------
// Offline queue: network-down enqueues, next invocation drains
// ---------------------------------------------------------------------------

test("network down → event queued; next run drains the queue as a batch", async () => {
  const fixture = fixtures[0];
  // Step 1: endpoint points at a closed port — send fails, event is queued.
  const home = makeHome({
    endpoint: "http://127.0.0.1:1",
    apiKey: "roi_ingest_x",
    tools: { "report-tool": "weekly-numbers-bot" },
  });
  const offline = await runHook(
    { prompt: fixture.prompt, session_id: fixture.session_id },
    { home },
  );
  assertSilent(offline);

  const queuePath = join(home, ".positiveroi", "queue.ndjson");
  assert.ok(existsSync(queuePath), "queue.ndjson must be written when the network is down");
  const queued = readFileSync(queuePath, "utf8").split("\n").filter(Boolean).map(JSON.parse);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].tool, "weekly-numbers-bot");
  assert.equal(queued[0].idempotency_key, fixture.expected_key);
  assert.ok(!readFileSync(queuePath, "utf8").includes("weekly numbers"), "queue must not contain prompt text");

  // Step 2: server is back (env endpoint overrides the file — also proves
  // env-over-file precedence in the hook). A non-matching prompt still drains.
  const mock = await startMockServer();
  try {
    const drain = await runHook(
      { prompt: "unrelated prompt", session_id: "sess-later" },
      { home, env: { POSITIVEROI_ENDPOINT: mock.endpoint } },
    );
    assertSilent(drain);
    assert.equal(mock.requests.length, 1, "drain sends exactly one batched request");
    const body = JSON.parse(mock.requests[0].rawBody);
    assert.ok(Array.isArray(body.events), "queued events are sent as one {events:[...]} batch");
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].idempotency_key, fixture.expected_key);
    assert.ok(!existsSync(queuePath), "queue file is removed after a successful drain");
  } finally {
    await mock.close();
  }
});

test("queue is capped at 1MB by dropping the oldest lines", async () => {
  const home = makeHome({
    endpoint: "http://127.0.0.1:1", // unreachable — every send queues
    apiKey: "roi_ingest_x",
    tools: { "report-tool": "weekly-numbers-bot" },
  });
  // Pre-fill the queue slightly OVER the cap with fat padding events so the
  // next enqueue is guaranteed to hit the drop-oldest path.
  const queuePath = join(home, ".positiveroi", "queue.ndjson");
  const padding = JSON.stringify({ tool: "old-event", pad: "x".repeat(4000) });
  const lines = [];
  while (lines.length * (padding.length + 1) <= 1024 * 1024) lines.push(padding);
  writeFileSync(queuePath, lines.join("\n") + "\n");

  const result = await runHook(
    { prompt: "/report-tool go", session_id: "sess-cap" },
    { home },
  );
  assertSilent(result);

  const after = readFileSync(queuePath, "utf8");
  assert.ok(Buffer.byteLength(after, "utf8") <= 1024 * 1024, "queue must stay under 1MB");
  const parsed = after.split("\n").filter(Boolean).map(JSON.parse);
  assert.ok(parsed.length < lines.length + 1, "oldest lines were dropped");
  assert.equal(parsed[parsed.length - 1].tool, "weekly-numbers-bot", "newest event survives the cap");
});
