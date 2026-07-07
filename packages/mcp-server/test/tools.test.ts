import http from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { methodologyReceipt, computeMinutesSavedPerRun, slugify } from "@positiveroi/core";
import type { PositiveROIConfig } from "../src/config.js";
import { SETUP_HINT } from "../src/config.js";
import { handleGetSummary } from "../src/tools/getSummary.js";
import { handleListTools } from "../src/tools/listTools.js";
import { handleLogRun } from "../src/tools/logRun.js";
import { handleRegisterTool } from "../src/tools/registerTool.js";
import type { ToolResult } from "../src/tools/result.js";

interface CapturedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: unknown;
}

let server: http.Server;
let config: PositiveROIConfig;
const requests: CapturedRequest[] = [];

function text(result: ToolResult): string {
  return result.content[0]!.text;
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({
        method: req.method!,
        url: req.url!,
        authorization: req.headers.authorization,
        body,
      });
      const respond = (status: number, json: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(json));
      };

      if (req.method === "POST" && req.url === "/api/v1/tools") {
        if (body.name === "Existing Tool") {
          return respond(409, {
            error: {
              code: "slug_taken",
              message: "a tool with this slug already exists",
              details: [{ slug: "existing-tool", name: "Existing Tool" }],
            },
          });
        }
        const minutes = computeMinutesSavedPerRun(body.raw_estimate_minutes, body.high_judgment);
        return respond(201, {
          tool: {
            id: "22222222-2222-4222-8222-222222222222",
            slug: slugify(body.name),
            minutes_saved_per_run: minutes,
            methodology: methodologyReceipt(body.raw_estimate_minutes, body.high_judgment),
          },
        });
      }
      if (req.method === "POST" && req.url === "/api/ingest") {
        return respond(200, {
          results: [
            {
              status: "accepted",
              event_id: "33333333-3333-4333-8333-333333333333",
              tool_totals: { tool: body.tool, owner_hours_30d: 42.5, multiplier_progress: 0.236 },
            },
          ],
          accepted: 1,
          duplicates: 0,
          rejected: 0,
        });
      }
      if (req.method === "GET" && req.url === "/api/v1/tools") {
        return respond(200, {
          tools: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              slug: "weekly-digest",
              name: "Weekly digest",
              type: "automation",
              status: "active",
              minutes_saved_per_run: 18,
            },
          ],
        });
      }
      if (req.method === "GET" && req.url === "/api/v1/summary") {
        return respond(200, {
          workspace: "Acme",
          runs_30d: 120,
          hours_30d: 36.5,
          active_tools: 4,
          builders: 3,
        });
      }
      respond(404, { error: { code: "not_found", message: "no such route" } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  config = {
    endpoint: `http://127.0.0.1:${port}`,
    apiKey: "roi_ingest_test",
    hookCaptured: ["hook-captured-tool"],
  };
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  requests.length = 0;
});

describe("register_tool", () => {
  it("registers a tool and returns the methodology verbatim", async () => {
    const result = await handleRegisterTool(
      {
        name: "Weekly Pipeline Digest",
        type: "automation",
        description: "Summarizes the pipeline",
        raw_estimate_minutes: 30,
        high_judgment: true,
      },
      config,
    );

    expect(result.isError).toBeUndefined();
    // Methodology string from the server, shown verbatim: 30 → -40% → 18 → ÷2 → 9.
    expect(text(result)).toContain(methodologyReceipt(30, true));
    expect(text(result)).toContain("weekly-pipeline-digest");
    expect(text(result)).toContain("9");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/tools",
      authorization: "Bearer roi_ingest_test",
      body: {
        name: "Weekly Pipeline Digest",
        type: "automation",
        description: "Summarizes the pipeline",
        raw_estimate_minutes: 30,
        high_judgment: true,
      },
    });
  });

  it("on 409 slug_taken points to log_run with the existing tool info", async () => {
    const result = await handleRegisterTool(
      { name: "Existing Tool", type: "skill", raw_estimate_minutes: 10, high_judgment: false },
      config,
    );
    expect(text(result)).toContain("already registered");
    expect(text(result)).toContain("log_run");
    expect(text(result)).toContain("existing-tool");
  });

  it("returns the setup hint when unconfigured", async () => {
    const result = await handleRegisterTool(
      { name: "X", type: "app", raw_estimate_minutes: 5, high_judgment: false },
      null,
    );
    expect(text(result)).toBe(SETUP_HINT);
    expect(text(result)).toContain("impact-setup");
    expect(requests).toHaveLength(0);
  });
});

describe("log_run", () => {
  it("refuses hook-captured tools without force and sends no request", async () => {
    const result = await handleLogRun({ tool: "hook-captured-tool" }, config);
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("logged automatically by the PositiveROI plugin hook");
    expect(text(result)).toContain("force: true");
    expect(requests).toHaveLength(0);
  });

  it("force: true overrides the hook-captured guard and logs with source mcp", async () => {
    const result = await handleLogRun({ tool: "hook-captured-tool", force: true }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toBe(
      "Logged. 42.5 credited hours in the last 30 days — 24% of the way to Multiplier.",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/api/ingest",
      body: { tool: "hook-captured-tool", source: "mcp" },
    });
    // force is client-side only — never sent to the server.
    expect((requests[0]!.body as Record<string, unknown>).force).toBeUndefined();
  });

  it("logs non-hook-captured tools normally and narrates progress", async () => {
    const result = await handleLogRun(
      { tool: "weekly-digest", metrics: { leads_generated: 2 }, idempotency_key: "run-7" },
      config,
    );
    expect(text(result)).toContain("24% of the way to Multiplier");
    expect(requests[0]!.body).toMatchObject({
      tool: "weekly-digest",
      source: "mcp",
      metrics: { leads_generated: 2 },
      idempotency_key: "run-7",
    });
  });

  it("returns a friendly error when the server is unreachable", async () => {
    const result = await handleLogRun(
      { tool: "weekly-digest" },
      { endpoint: "http://127.0.0.1:1", apiKey: "roi_ingest_test" },
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Could not reach the PositiveROI server");
  });
});

describe("list_tools and get_summary", () => {
  it("list_tools resolves slugs from the slim list", async () => {
    const result = await handleListTools(config);
    expect(text(result)).toContain("`weekly-digest`");
    expect(text(result)).toContain("18 credited min/run");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/tools" });
  });

  it("get_summary reports live numbers and points money/timeseries at a read key", async () => {
    const result = await handleGetSummary(config);
    expect(text(result)).toContain("Workspace: Acme");
    expect(text(result)).toContain("120 runs");
    expect(text(result)).toContain("36.5 credited hours");
    expect(text(result)).toContain("read-scoped key");
    expect(text(result)).toContain("dashboard");
  });

  it("both return the setup hint when unconfigured", async () => {
    expect(text(await handleListTools(null))).toBe(SETUP_HINT);
    expect(text(await handleGetSummary(null))).toBe(SETUP_HINT);
    expect(requests).toHaveLength(0);
  });
});
