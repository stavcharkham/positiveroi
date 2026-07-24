import type { Metadata } from "next";
import Link from "next/link";
import {
  ENV_API_KEY,
  ENV_ENDPOINT,
  GITHUB_URL,
  MULTIPLIER_HOURS_30D,
  PLUGIN_INSTALL,
  PLUGIN_MARKETPLACE_ADD,
  PRODUCT_DOMAIN,
  TIERS,
  curlSnippet,
  type EventSource,
} from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { MultiplierRing } from "@/components/product/multiplier-ring";
import { RunsSparkline } from "@/components/product/runs-sparkline";
import { SourceBadge } from "@/components/product/source-badge";
import { UndercountedTag } from "@/components/product/stat-tile";
import { TierBadge } from "@/components/product/tier-badge";
import { isHosted } from "@/lib/flags";
import { DashboardPreview } from "./_marketing/dashboard-preview";
import { InViewMount, ReceiptReplay } from "./_marketing/in-view";
import { Reveal } from "./_marketing/reveal";
import { SiteFooter } from "./_marketing/site-footer";
import { SiteHeader } from "./_marketing/site-header";
import { LightningMark } from "./_marketing/wordmark";

export const metadata: Metadata = {
  title: { absolute: "PositiveROI · Prove what your AI tools are worth" },
  description:
    "Open-source impact tracking for the AI tools your team builds. Runs are measured, minutes are undercounted on purpose, and every number drills down to the runs behind it.",
};

const SELF_HOSTING_URL = `${GITHUB_URL}/blob/main/docs/self-hosting.md`;

const SNIPPET_CTX = {
  endpoint: `https://${PRODUCT_DOMAIN}`,
  toolSlug: "pipeline-digest",
  apiKey: "roi_ingest_...",
};

export default function Home() {
  const hosted = isHosted();

  return (
    <>
      <SiteHeader />
      <main>
        <Hero hosted={hosted} />
        <UndercountSection />
        <CaptureSection />
        <MultiplierSection />
        <ProofSection />
        <OpenSourceSection />
        <FinalCta hosted={hosted} />
      </main>
      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ hosted }: { hosted: boolean }) {
  return (
    <section className="relative overflow-hidden">
      {/* Ledger-ruled paper, fading out below the fold */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] opacity-60 [mask-image:radial-gradient(120%_100%_at_50%_0%,black_25%,transparent_78%)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 31px, var(--border) 31px, var(--border) 32px)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted">
            Open source · The Undercount methodology
          </p>
          <h1 className="numeral mt-5 text-balance text-5xl leading-[1.05] text-foreground sm:text-6xl">
            Your team is building AI tools.
            <br />
            Prove what they&rsquo;re{" "}
            <em className="italic text-accent">worth</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-foreground-secondary sm:text-lg">
            PositiveROI counts every run your tools make and credits time saved
            so conservatively that no one can argue it down. Dashboards, a
            public page, and a badge worth earning follow from there.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {hosted ? (
              <>
                <Button asChild size="lg">
                  <Link href="/login">Start measuring for free</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href={SELF_HOSTING_URL} target="_blank" rel="noreferrer">
                    Deploy your own
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  <a href={SELF_HOSTING_URL} target="_blank" rel="noreferrer">
                    Deploy your own
                  </a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
          <p className="mt-4 font-mono text-xs text-foreground-muted">
            {hosted
              ? "free while in beta · MIT licensed · self-hostable"
              : "MIT licensed · your infrastructure, your data"}
          </p>
        </div>

        <Reveal className="mx-auto mt-14 max-w-4xl" delay={0.1}>
          <DashboardPreview />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The Undercount                                                      */
/* ------------------------------------------------------------------ */

const UNDERCOUNT_POINTS = [
  {
    n: "01",
    title: "The conservatism cut removes 40%",
    body: "It absorbs estimation optimism, the runs that partially fail, and the overhead every estimate forgets.",
  },
  {
    n: "02",
    title: "The judgment cut halves what is left",
    body: "When a human still reviews, approves, or edits, the tool removed part of the work, not all of it.",
  },
  {
    n: "03",
    title: "What survives wins arguments",
    body: "The first challenge is where inflated figures die. An undercounted number holds, and trust compounds from there.",
  },
];

function UndercountSection() {
  return (
    <section className="border-y border-border bg-surface/60">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            The Undercount
          </p>
          <h2 className="numeral mt-4 text-balance text-3xl leading-tight text-foreground sm:text-4xl">
            Every number takes two cuts before anyone sees it.
          </h2>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-foreground-secondary">
            Builders state the most conservative baseline for one run of their
            tool. Then the methodology cuts it. Twice.
          </p>
          <ul className="mt-8 space-y-6">
            {UNDERCOUNT_POINTS.map((point) => (
              <li key={point.n} className="flex gap-4">
                <span className="font-mono text-xs leading-6 text-accent">
                  {point.n}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {point.title}
                  </h3>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-foreground-secondary">
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <ReceiptReplay className="mx-auto w-full max-w-sm" />
          <p className="mx-auto mt-3 max-w-sm text-center font-mono text-xs text-foreground-muted">
            the receipt every saved minute traces back to
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */

function CaptureCard({
  source,
  title,
  note,
  children,
}: {
  source: EventSource;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <SourceBadge source={source} />
      </div>
      <div className="mt-3">{children}</div>
      {note && (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-foreground-muted">
          {note}
        </p>
      )}
    </div>
  );
}

function CaptureSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Capture
        </p>
        <h2 className="numeral mt-4 text-balance text-3xl leading-tight text-foreground sm:text-4xl">
          Builders never log by hand.
        </h2>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground-secondary">
          Instrument once, at the moment the tool does its work. Four ways in,
          one endpoint, one ledger.
        </p>
      </Reveal>

      <Reveal className="mt-12 grid gap-4 md:grid-cols-2" delay={0.05}>
        <CaptureCard
          source="rest"
          title="Any webhook or script"
          note="One POST from the last step of a Zapier zap, a cron job, or a shell script."
        >
          <CodeBlock code={curlSnippet(SNIPPET_CTX)} caption="bash" />
        </CaptureCard>
        <CaptureCard
          source="hook"
          title="Claude Code plugin"
          note="Registered skills are captured automatically from the session hook. Prompt content never leaves the machine; the hook sends only the tool, the timestamp, and a hashed key."
        >
          <CodeBlock
            code={`${PLUGIN_MARKETPLACE_ADD}\n${PLUGIN_INSTALL}`}
            caption="Claude Code"
          />
        </CaptureCard>
        <CaptureCard
          source="sdk"
          title="Inside your app"
          note="A zero-dependency client. Call it from the key action your tool performs."
        >
          <CodeBlock
            code={`await roi.logRun({ tool: "pipeline-digest" });`}
            caption="@positiveroi/sdk"
          />
        </CaptureCard>
        <CaptureCard
          source="mcp"
          title="For agents"
          note="Agents log through the MCP server's log_run tool. Two environment variables and they count themselves."
        >
          <CodeBlock
            code={`${ENV_API_KEY}=roi_ingest_...\n${ENV_ENDPOINT}=https://${PRODUCT_DOMAIN}`}
            caption="env"
          />
        </CaptureCard>
      </Reveal>

      <Reveal className="mt-2 flex flex-col items-center" delay={0.1}>
        <span aria-hidden className="h-9 w-px border-l border-dashed border-border" />
        <span className="rounded-full border border-border bg-surface px-4 py-1.5 font-mono text-xs text-foreground shadow-xs">
          POST /api/ingest
        </span>
        <p className="mt-2.5 text-center text-[0.8125rem] text-foreground-muted">
          One endpoint. Idempotent. Test runs never touch the totals.
        </p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Multiplier                                                          */
/* ------------------------------------------------------------------ */

function MultiplierSection() {
  return (
    <section className="border-y border-border bg-surface/60">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[auto_1fr] lg:gap-20">
        <Reveal className="order-last lg:order-first">
          <InViewMount
            className="flex justify-center"
            fallback={<div className="h-[300px] w-[220px]" aria-hidden />}
          >
            <MultiplierRing hours30d={187} totalRuns={2412} size={220} />
          </InViewMount>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            The Multiplier
          </p>
          <h2 className="numeral mt-4 text-balance text-3xl leading-tight text-foreground sm:text-4xl">
            {MULTIPLIER_HOURS_30D} hours in 30 days is a full-time job.
          </h2>
          <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-foreground-secondary">
            Reach {MULTIPLIER_HOURS_30D} saved hours in a trailing 30 days,
            roughly 42 hours a week at the undercounted rate, and you have
            earned the Multiplier: your tools are doing a full-time job&rsquo;s
            worth of work. The window rolls and the ring decays honestly as
            runs age out. Tiers along the way are labels. The badge is earned,
            permanent, and drills to the exact 30 days of runs behind it.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-4">
            {TIERS.map((tier) => (
              <li key={tier.key} className="flex flex-col items-center gap-1.5">
                <TierBadge tierKey={tier.key} />
                <span className="font-mono text-[0.6875rem] text-foreground-muted">
                  {tier.hours === 0 ? "run 1" : `${tier.hours}h`}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Proof                                                               */
/* ------------------------------------------------------------------ */

function ProofSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Proof
        </p>
        <h2 className="numeral mt-4 text-balance text-3xl leading-tight text-foreground sm:text-4xl">
          A number you can publish.
        </h2>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground-secondary">
          Turn on the public page and put the badge in your README. Every claim
          links back to the methodology that undercounted it.
        </p>
      </Reveal>

      <Reveal className="mt-12 grid gap-4 md:grid-cols-2" delay={0.05}>
        {/* Public page mock */}
        <div className="flex flex-col rounded-lg border border-border bg-surface p-6 shadow-xs">
          <span className="self-start rounded-md border border-border/70 bg-background px-2.5 py-0.5 font-mono text-[0.6875rem] text-foreground-muted">
            positiveroi.dev/p/acme
          </span>
          <p className="numeral mt-5 text-balance text-2xl leading-snug text-foreground sm:text-[1.75rem]">
            Acme&rsquo;s builders saved 342 hours in the last 90 days{" "}
            <UndercountedTag className="translate-y-[-0.2em]" />
          </p>
          <RunsSparkline
            values={[3, 5, 4, 7, 6, 9, 8, 12, 11, 14, 13, 16]}
            width={224}
            height={40}
            aria-label="Sample 90-day run trend"
            className="mt-5"
          />
          <p className="mt-3 font-mono text-xs text-foreground-secondary">
            1,204 runs · 12 builders · 2 Multipliers
          </p>
          <p className="mt-auto pt-6 text-[0.8125rem] text-foreground-muted">
            Counted with PositiveROI · The Undercount methodology
          </p>
        </div>

        {/* Badge embed */}
        <div className="flex flex-col rounded-lg border border-border bg-surface p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">
            The embeddable badge
          </h3>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-foreground-secondary">
            A flat SVG served from your workspace, light and dark themed,
            linking to the public page.
          </p>
          <div className="mt-6 flex flex-1 items-center justify-center rounded-md border border-dashed border-border bg-background p-8">
            <span className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-surface py-2 pl-2.5 pr-4 shadow-sm">
              <LightningMark />
              <span className="flex flex-col">
                <span className="text-sm font-semibold leading-tight text-foreground">
                  342 hrs saved · last 90 days
                </span>
                <span className="font-mono text-[0.6875rem] leading-tight text-foreground-muted">
                  PositiveROI · undercounted
                </span>
              </span>
            </span>
          </div>
          <CodeBlock
            code={`![AI hours saved](https://${PRODUCT_DOMAIN}/badge/acme.svg)`}
            caption="README.md"
            className="mt-6"
          />
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Open source                                                         */
/* ------------------------------------------------------------------ */

function OpenSourceSection() {
  return (
    <section className="border-y border-border bg-surface/60">
      <Reveal className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8 sm:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Open source
        </p>
        <h2 className="numeral mt-4 text-balance text-3xl leading-tight text-foreground sm:text-4xl">
          Yours to inspect, yours to run.
        </h2>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground-secondary">
          The whole platform is MIT licensed: the app, the capture clients, and
          the methodology itself. Self-host it and the numbers work exactly the
          same way, because the constants are frozen in public and pull
          requests that change them get declined. Self-hosted deployments send
          nothing back to us. No telemetry, no phone-home.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="secondary">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          </Button>
          <Button asChild variant="ghost">
            <a href={SELF_HOSTING_URL} target="_blank" rel="noreferrer">
              Self-hosting guide
            </a>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta({ hosted }: { hosted: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="numeral text-balance text-4xl leading-tight text-foreground sm:text-5xl">
          Start the count.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-relaxed text-foreground-secondary">
          Register a tool, take the cuts, and watch the first run land. Under
          five minutes to a number you can defend.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {hosted ? (
            <Button asChild size="lg">
              <Link href="/login">Start measuring for free</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <a href={SELF_HOSTING_URL} target="_blank" rel="noreferrer">
                Deploy your own
              </a>
            </Button>
          )}
          <Button asChild variant="secondary" size="lg">
            <Link href="/methodology">Read the methodology</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
