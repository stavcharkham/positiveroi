import type { Metadata } from "next";
import Link from "next/link";
import {
  CONSERVATISM_FACTOR,
  DAYS_PER_MONTH,
  GITHUB_URL,
  JUDGMENT_FACTOR,
  MULTIPLIER_HOURS_30D,
  RAW_ESTIMATE_MAX_API,
  RAW_ESTIMATE_MAX_DASHBOARD,
  RAW_ESTIMATE_SOFT_WARNING,
  TRAILING_WINDOW_DAYS,
} from "@positiveroi/core";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/product/receipt";
import { UndercountedTag } from "@/components/product/stat-tile";
import { isHosted } from "@/lib/flags";
import { SiteFooter } from "../_marketing/site-footer";
import { SiteHeader } from "../_marketing/site-header";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "The Undercount: how PositiveROI counts time saved. Every claim takes a 40% trust cut, then a judgment cut when a person still checks, and every number drills down to its runs.",
};

const CONFIDENCE_CUT_PCT = Math.round((1 - CONSERVATISM_FACTOR) * 100);
const CREDITED_PCT = Math.round(CONSERVATISM_FACTOR * 100);

export default function MethodologyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
        {/* Document header */}
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Methodology
          </p>
          <h1 className="numeral mt-4 text-5xl leading-none text-foreground sm:text-6xl">
            The Undercount
          </h1>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-foreground-secondary">
            This page is written for the most skeptical reader in the building.
            Usually that&rsquo;s the CFO.
          </p>
          <p className="mt-4 font-mono text-xs text-foreground-muted">
            applies identically to hosted and self-hosted deployments ·
            constants frozen in public
          </p>
        </header>

        <Section n="01" title="The problem with impact numbers">
          <p>
            Every &ldquo;AI saved us 4,000 hours&rdquo; claim fails the same
            way: someone multiplied an optimistic guess by a big number of
            runs, and the first person to poke at the guess collapsed the whole
            figure. Once one number is caught inflated, every number after it
            is dead.
          </p>
          <p>
            PositiveROI&rsquo;s answer is to undercount on purpose. Every
            number in the product is deliberately lower than the honest
            estimate, so that no one can argue it down.
          </p>
        </Section>

        <Section n="02" title="The two cuts">
          <p>
            When a builder registers a tool, they state a{" "}
            <strong className="font-semibold text-foreground">baseline</strong>
            : the most conservative estimate of manual minutes one run of the
            tool replaces. The wizard explicitly nudges: unsure between two
            numbers? Take the lower one.
          </p>
          <p>
            That baseline then takes two cuts before a single minute counts:
          </p>
          <ol className="space-y-4">
            <li className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <p className="font-mono text-xs text-accent">
                cut 1 · −{CONFIDENCE_CUT_PCT}%
              </p>
              <p className="mt-1.5">
                <strong className="font-semibold text-foreground">
                  The trust cut.
                </strong>{" "}
                Only {CREDITED_PCT}% of the baseline counts. This absorbs
                estimation optimism, the runs that partially fail, and the
                overhead the estimate forgot.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <p className="font-mono text-xs text-accent">cut 2 · ÷2</p>
              <p className="mt-1.5">
                <strong className="font-semibold text-foreground">
                  The judgment cut.
                </strong>{" "}
                If a person still makes a real decision in the task
                (reviewing, approving, editing before send), the saved time
                is halved again. The tool did not remove the work; it removed
                part of it.
              </p>
            </li>
          </ol>

          <p>
            Worked example: a weekly pipeline digest that used to take 45
            minutes by hand, where a person still reviews the output before
            sending.
          </p>
          <Receipt rawMinutes={45} highJudgment className="my-2" />
          <p>
            The tool is counted as saving 13.5 of the 45 minutes claimed. The
            receipt above appears wherever that number appears.
          </p>
          <Aside>
            The computation lives in exactly two places that are tested to
            agree: a Postgres generated column and one TypeScript function,{" "}
            <code className="font-mono text-[0.8125rem] text-foreground">
              computeMinutesSavedPerRun
            </code>
            . There is no third implementation to drift.
          </Aside>
        </Section>

        <Section n="03" title="What is measured vs. what is estimated">
          <p>The vocabulary is strict, everywhere in the product:</p>
          <ul className="space-y-4">
            <li>
              <strong className="font-semibold text-foreground">
                Runs are measured.
              </strong>{" "}
              Each run is a real logged event with a timestamp, a source
              (rest, sdk, mcp, hook, manual), and attribution to the API key or
              person that logged it. Run counts are facts.
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Minutes are estimates, and labeled as such.
              </strong>{" "}
              Every hours figure carries an <UndercountedTag /> tag. The
              headline framing is always measured runs × saved minutes per
              run.
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Test runs never count.
              </strong>{" "}
              Events flagged as tests are excluded from every aggregate, every
              leaderboard, the public page, and badge awards. They appear in
              drill-downs with a visible test label.
            </li>
          </ul>
        </Section>

        <Section n="04" title="The Multiplier">
          <p>
            <strong className="font-semibold text-foreground">
              {MULTIPLIER_HOURS_30D} saved hours in a trailing{" "}
              {TRAILING_WINDOW_DAYS} days equals one full-time job.
            </strong>{" "}
            That is roughly 42 hours a week after the two cuts have already
            been applied, so it is a hard threshold to reach. A builder who
            crosses it earns the Multiplier badge.
          </p>
          <p>
            The window is a rolling {TRAILING_WINDOW_DAYS} days, not a calendar
            month. The progress ring decays honestly as runs age out; it never
            resets on a month boundary.
          </p>
          <p>
            For arbitrary reporting periods, FTE is pro-rated using a{" "}
            {DAYS_PER_MONTH}-day average month:
          </p>
          <Formula>
            fte_equivalent = saved_hours / ({MULTIPLIER_HOURS_30D} ×
            period_days / {DAYS_PER_MONTH})
          </Formula>
          <p>
            So 360 saved hours over a 91-day quarter is about 0.67 FTE, not
            2.
          </p>
          <p>
            Money value is the simplest possible conversion: saved hours ×
            the workspace hourly rate (default $60/hour, editable by admins,
            shown next to the number). It is presented as secondary, because
            the rate is the one input PositiveROI does not measure.
          </p>
        </Section>

        <Section n="05" title="A default, not a lock">
          <p>
            The Undercount is what every tool starts with, and what most tools
            keep. But the builder knows their tool better than a formula does,
            so the final saved minutes per run is editable — in the
            registration wizard and later on the tool&apos;s settings tab.
          </p>
          <p>
            Transparency replaces the lock: a number that differs from the
            suggestion is labeled <em>builder-set</em> on every receipt and
            drill-down, next to the suggestion it replaced, and every change is
            audited — who, when, old, new. Only the dashboard can set it; tools
            registered through the API always start on the suggestion.
          </p>
        </Section>

        <Section n="06" title="Every number drills to its runs">
          <p>
            Every number in the product opens. Company hours drill to per-tool
            hours, per-tool hours drill to the runs table, and each run expands
            to its full record: when it ran, what logged it, what the credit
            was and why. Badges drill to the exact {TRAILING_WINDOW_DAYS} days
            of runs that earned them. Nothing is a dead-end aggregate.
          </p>
          <p>
            This is the credibility model: not &ldquo;trust our math&rdquo; but
            &ldquo;here are the rows, check them.&rdquo;
          </p>
        </Section>

        <Section n="07" title="Caps and audits">
          <p>
            An ingest call may override the per-run saved time downward, for
            example when a run only did half the job. The override is clamped
            server-side to the range [0, baseline]. It can reduce credit; it
            can never raise it. There is no API path to inflate a run.
          </p>
          <p>The baseline itself is bounded and audited:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Hard cap of {RAW_ESTIMATE_MAX_DASHBOARD} raw minutes per run in
              the dashboard, with a soft warning at{" "}
              {`${RAW_ESTIMATE_SOFT_WARNING}.`}
            </li>
            <li>
              Tools created through the API are capped at{" "}
              {RAW_ESTIMATE_MAX_API} raw minutes and stamped as API-created for
              review.
            </li>
            <li>
              Every baseline set or change writes an audit row: who, when, old
              value, new value. Baseline edits are restricted to leads and
              admins, and change markers appear in the runs drill-down.
            </li>
          </ul>
        </Section>

        <Section n="08" title="Changing the constants">
          <p>
            The {CONSERVATISM_FACTOR}, the {JUDGMENT_FACTOR}, and the{" "}
            {MULTIPLIER_HOURS_30D} are product decisions, not tuning
            parameters. Pull requests that change them are declined. A
            methodology that varies by deployment is a methodology no one can
            cite.
          </p>
        </Section>

        {/* Closing CTA */}
        <div className="mt-16 border-t border-dashed border-border pt-10 text-center">
          <p className="numeral text-2xl text-foreground">
            Count your own.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {isHosted() ? (
              <Button asChild>
                <Link href="/login">Start measuring for free</Link>
              </Button>
            ) : (
              <Button asChild>
                <a
                  href={`${GITHUB_URL}/blob/main/docs/self-hosting.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Deploy your own
                </a>
              </Button>
            )}
            <Button asChild variant="secondary">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                Read the source
              </a>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Document primitives                                                 */
/* ------------------------------------------------------------------ */

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-dashed border-border pt-10">
      <div className="flex items-baseline gap-3.5">
        <span className="font-mono text-xs text-accent">{n}</span>
        <h2 className="numeral text-[1.75rem] leading-tight text-foreground">
          {title}
        </h2>
      </div>
      <div className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed text-foreground-secondary">
        {children}
      </div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <p className="overflow-x-auto rounded-md border border-border bg-subtle/60 px-4 py-3 font-mono text-[0.8125rem] text-foreground">
      {children}
    </p>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-accent/40 pl-4 text-[0.875rem] leading-relaxed text-foreground-muted">
      {children}
    </p>
  );
}
