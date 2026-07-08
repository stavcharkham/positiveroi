import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Load apps/web/.env.local into process.env for integration tests
// (SUPABASE_SERVICE_ROLE_KEY gates the live-DB suite). Never overrides
// variables already present in the environment.
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1] as string;
    const value = (m[2] as string).replace(/^["']|["']$/g, "");
    if (value !== "" && process.env[key] === undefined) process.env[key] = value;
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // "server-only" throws outside React Server Components; stub it in tests.
      "server-only": path.join(root, "__tests__", "helpers", "server-only-stub.ts"),
    },
  },
});
