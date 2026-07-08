import * as React from "react";
import Link from "next/link";
import { GITHUB_URL } from "@positiveroi/core";
import { isHosted } from "@/lib/flags";
import { Wordmark } from "./wordmark";

const footerLinkClass =
  "text-sm text-foreground-secondary transition-colors hover:text-foreground";

/** Shared marketing footer — MIT, GitHub, methodology. */
function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-foreground-secondary">
            Runs are measured. Minutes are estimates that survived two cuts.
          </p>
          <p className="mt-4 font-mono text-xs text-foreground-muted">
            MIT licensed · no telemetry
          </p>
        </div>
        <div className="flex gap-16">
          <nav aria-label="Product" className="flex flex-col gap-2.5">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-foreground-muted">
              Product
            </span>
            <Link href="/methodology" className={footerLinkClass}>
              Methodology
            </Link>
            {isHosted() && (
              <Link href="/pricing" className={footerLinkClass}>
                Pricing
              </Link>
            )}
            <Link href="/login" className={footerLinkClass}>
              Sign in
            </Link>
          </nav>
          <nav aria-label="Open source" className="flex flex-col gap-2.5">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-foreground-muted">
              Open source
            </span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className={footerLinkClass}
            >
              GitHub
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/docs/self-hosting.md`}
              target="_blank"
              rel="noreferrer"
              className={footerLinkClass}
            >
              Self-hosting guide
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className={footerLinkClass}
            >
              MIT license
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
