"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The code to display and copy. */
  code: string;
  /** Optional short label rendered in the header bar, e.g. "bash" or "Ingest key". */
  caption?: string;
  /** Hide the copy button. */
  hideCopy?: boolean;
}

function CodeBlock({ code, caption, hideCopy = false, className, ...props }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — leave state as-is.
    }
  }

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-subtle/60",
        className,
      )}
      {...props}
    >
      {(caption || !hideCopy) && (
        <div className="flex h-9 items-center justify-between border-b border-border px-3">
          <span className="font-mono text-xs text-foreground-muted">{caption}</span>
          {!hideCopy && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
              aria-label="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-success" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy
                </>
              )}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-3 text-[0.8125rem] leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

export { CodeBlock };
