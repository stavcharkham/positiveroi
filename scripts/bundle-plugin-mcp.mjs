/**
 * Bundle the MCP server CLI into the Claude Code plugin as a single
 * self-contained ESM file (vendored on purpose — npm publish is deferred).
 *
 *   node scripts/bundle-plugin-mcp.mjs
 *   → packages/claude-plugin/mcp/server.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chmodSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
// esbuild lives in the mcp-server workspace package, not at the repo root.
const require = createRequire(join(repoRoot, "packages/mcp-server/package.json"));
const esbuild = require("esbuild");

const outfile = join(repoRoot, "packages/claude-plugin/mcp/server.mjs");

await esbuild.build({
  entryPoints: [join(repoRoot, "packages/mcp-server/src/cli.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: [], // fully self-contained
  banner: {
    // Bundled CJS dependencies (inside @modelcontextprotocol/sdk's tree) call
    // require() at runtime; ESM output needs this shim for them to work.
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

chmodSync(outfile, 0o755);
console.log(`bundled → ${outfile}`);
