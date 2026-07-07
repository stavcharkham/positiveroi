import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONFIG_DIR_NAME, ENV_API_KEY, ENV_ENDPOINT } from "@positiveroi/core";
import { resolveConfig } from "../src/config.js";

function homeWithConfig(config: unknown): string {
  const home = mkdtempSync(join(tmpdir(), "roi-config-"));
  mkdirSync(join(home, CONFIG_DIR_NAME), { recursive: true });
  writeFileSync(join(home, CONFIG_DIR_NAME, "config.json"), JSON.stringify(config));
  return home;
}

describe("resolveConfig", () => {
  it("reads ~/.positiveroi/config.json", () => {
    const home = homeWithConfig({
      endpoint: "https://file.example.com/",
      apiKey: "roi_ingest_file",
      tools: { "report-tool": "weekly-report" },
      hookCaptured: ["weekly-report"],
    });
    const config = resolveConfig({}, home);
    expect(config).toEqual({
      endpoint: "https://file.example.com", // trailing slash stripped
      apiKey: "roi_ingest_file",
      tools: { "report-tool": "weekly-report" },
      hookCaptured: ["weekly-report"],
    });
  });

  it("env vars override the file (tools/hookCaptured still come from the file)", () => {
    const home = homeWithConfig({
      endpoint: "https://file.example.com",
      apiKey: "roi_ingest_file",
      tools: { "report-tool": "weekly-report" },
      hookCaptured: ["weekly-report"],
    });
    const config = resolveConfig(
      { [ENV_API_KEY]: "roi_ingest_env", [ENV_ENDPOINT]: "https://env.example.com" },
      home,
    );
    expect(config?.endpoint).toBe("https://env.example.com");
    expect(config?.apiKey).toBe("roi_ingest_env");
    expect(config?.tools).toEqual({ "report-tool": "weekly-report" });
    expect(config?.hookCaptured).toEqual(["weekly-report"]);
  });

  it("env alone is enough (no file)", () => {
    const home = mkdtempSync(join(tmpdir(), "roi-nofile-"));
    const config = resolveConfig(
      { [ENV_API_KEY]: "roi_ingest_env", [ENV_ENDPOINT]: "https://env.example.com" },
      home,
    );
    expect(config).toEqual({
      endpoint: "https://env.example.com",
      apiKey: "roi_ingest_env",
      tools: undefined,
      hookCaptured: undefined,
    });
  });

  it("returns null when neither file nor env configures endpoint AND key", () => {
    const home = mkdtempSync(join(tmpdir(), "roi-empty-"));
    expect(resolveConfig({}, home)).toBeNull();
    expect(resolveConfig({ [ENV_API_KEY]: "roi_ingest_only_key" }, home)).toBeNull();
  });

  it("survives a corrupt config file", () => {
    const home = mkdtempSync(join(tmpdir(), "roi-corrupt-"));
    mkdirSync(join(home, CONFIG_DIR_NAME), { recursive: true });
    writeFileSync(join(home, CONFIG_DIR_NAME, "config.json"), "{not json");
    expect(resolveConfig({}, home)).toBeNull();
    expect(
      resolveConfig(
        { [ENV_API_KEY]: "roi_ingest_env", [ENV_ENDPOINT]: "https://env.example.com" },
        home,
      )?.apiKey,
    ).toBe("roi_ingest_env");
  });
});
