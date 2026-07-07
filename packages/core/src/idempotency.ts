import { createHash, randomUUID } from "node:crypto";

/**
 * Idempotency key formats are pinned here and mirrored by a fixture test in
 * packages/claude-plugin (the hook script cannot import this package — the
 * shared fixture keeps the two implementations identical).
 */

/** Hook capture: one key per (session, prompt) pair. Never contains prompt text. */
export function hookIdempotencyKey(sessionId: string, prompt: string): string {
  const digest = createHash("sha256").update(prompt, "utf8").digest("hex").slice(0, 16);
  return `hook:${sessionId}:${digest}`;
}

/** SDK auto-key: unique per logRun() call, stable across that call's retry. */
export function sdkIdempotencyKey(): string {
  return `sdk:${randomUUID()}`;
}
