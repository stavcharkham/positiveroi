import * as React from "react";
import Link from "next/link";
import { snippetsForType, type ToolType } from "@positiveroi/core";
import { CodeBlock } from "@/components/ui/code-block";

export const KEY_PLACEHOLDER = "YOUR_INGEST_KEY";

export interface SnippetsPanelProps {
  type: ToolType;
  toolSlug: string;
  endpoint: string;
  workspaceSlug: string;
}

/**
 * The type-specific capture snippets, rendered from @positiveroi/core so the
 * wizard, the Setup tab, and the docs never drift. Plaintext keys are never
 * retrievable, so the key is always the placeholder plus a pointer to
 * Settings → Keys.
 */
function SnippetsPanel({ type, toolSlug, endpoint, workspaceSlug }: SnippetsPanelProps) {
  const snippets = snippetsForType(type, {
    endpoint,
    toolSlug,
    apiKey: KEY_PLACEHOLDER,
  });
  const needsKey = snippets.some((s) => s.code.includes(KEY_PLACEHOLDER));

  return (
    <div className="space-y-4">
      {snippets.map((snippet) => (
        <CodeBlock key={snippet.label} code={snippet.code} caption={snippet.label} />
      ))}
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
