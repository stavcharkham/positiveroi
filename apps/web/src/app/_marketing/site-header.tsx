import * as React from "react";
import Link from "next/link";
import { GITHUB_URL } from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import { isHosted } from "@/lib/flags";
import { Wordmark } from "./wordmark";

const navLinkClass =
  "rounded-md px-2.5 py-1.5 text-sm text-foreground-secondary transition-colors hover:text-foreground";

/** Shared marketing top nav — sticky, translucent, quiet. */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="PositiveROI home" className="rounded-md">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-0.5" aria-label="Main">
          <Link href="/methodology" className={navLinkClass}>
            Methodology
          </Link>
          {isHosted() && (
            <Link href="/pricing" className={navLinkClass}>
              Pricing
            </Link>
          )}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={`${navLinkClass} hidden sm:inline-block`}
          >
            GitHub
          </a>
          <Button asChild variant="secondary" size="sm" className="ml-2">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export { SiteHeader };
