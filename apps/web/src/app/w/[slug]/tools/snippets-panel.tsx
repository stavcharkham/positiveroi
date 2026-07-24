import * as React from "react";
import Link from "next/link";
import { agentPrompt, snippetsForType, type ToolType } from "@positiveroi/core";
import { CodeBlock } from "@/components/ui/code-block";

export const KEY_PLACEHOLDER = "YOUR_INGEST_KEY";

export interface SnippetsPanelProps {
  type: ToolType;
  toolSlug: string;
  endpoint: string;
  workspaceSlug: string;
  /**
   * Real ingest key, when the caller just created one (onboarding).
   * Embedded into the prompt and snippets and shown in its own box with
   * the shown-once warning. Absent = placeholder + pointer to Settings.
   */
  ingestKey?: string;
}

/**
 * Capture instructions for a tool. The paste-ready AI-agent prompt leads —
 * builders hand it to Claude Code, Cursor, or Codex and the agent does the
 * wiring. The raw snippets stay one click away for hand-wiring. All content
 * renders from @positiveroi/core so the wizard, the Setup tab, and the docs
 * never drift.
 */
function SnippetsPanel({
  type,
  toolSlug,
  endpoint,
  workspaceSlug,
  ingestKey,
}: SnippetsPanelProps) {
  const apiKey = ingestKey ?? KEY_PLACEHOLDER;
  const prompt = agentPrompt(type, { endpoint, toolSlug, apiKey });
  const snippets = snippetsForType(type, { endpoint, toolSlug, apiKey });
  const needsKey =
    ingestKey === undefined &&
    (prompt.includes(KEY_PLACEHOLDER) ||
      snippets.some((s) => s.code.includes(KEY_PLACEHOLDER)));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          Building with AI? Paste this into Claude Code, Cursor, or Codex
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
          The prompt carries everything the agent needs to wire this tool up.
        </p>
        <CodeBlock className="mt-2.5" code={prompt} caption="Prompt" />
      </div>

      {ingestKey !== undefined && (
        <div>
          <CodeBlock code={ingestKey} caption="Your ingest key" />
          <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
            Treat this like a password. It is shown only once, and it is
            deliberately not in the prompt above. Set it where the tool runs
            (as the{" "}
            <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[0.6875rem] text-foreground-secondary">
              POSITIVEROI_API_KEY
            </code>{" "}
            environment variable, or pasted into the snippet yourself) and
            never into an AI chat. Lose it and you create a new one in
            Settings → Keys.
          </p>
        </div>
      )}

      {type === "skill" ? (
        // For skills the plugin IS the capture — its commands stay visible,
        // never folded behind a toggle.
        <div className="space-y-4">
          {snippets.map((snippet) => (
            <CodeBlock key={snippet.label} code={snippet.code} caption={snippet.label} />
          ))}
        </div>
      ) : (
        <details className="group">
          <summary className="cursor-pointer list-none text-[0.8125rem] font-medium text-accent hover:underline">
            <span className="group-open:hidden">Wiring it by hand? Show the code</span>
            <span className="hidden group-open:inline">Hide the code</span>
          </summary>
          <div className="mt-3 space-y-4">
            {snippets.map((snippet) => (
              <CodeBlock key={snippet.label} code={snippet.code} caption={snippet.label} />
            ))}
          </div>
        </details>
      )}

      {needsKey && (
        <p className="text-xs leading-relaxed text-foreground-muted">
          Replace{" "}
          <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[0.6875rem] text-foreground-secondary">
            {KEY_PLACEHOLDER}
          </code>{" "}
          with an ingest key from{" "}
          <Link
            href={`/w/${workspaceSlug}/settings/keys`}
            className="font-medium text-accent hover:underline"
          >
            Settings → Keys
          </Link>
          . Keys are shown once when created, so if you did not save one,
          create a new key there.
        </p>
      )}
    </div>
  );
}

export { SnippetsPanel };
