import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { GITHUB_URL } from "@positiveroi/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isHosted } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { SiteFooter } from "../_marketing/site-footer";
import { SiteHeader } from "../_marketing/site-header";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free while in beta. Free up to 5 builders, Team at $29 a month flat, or self-host forever under MIT. The methodology is identical on every plan.",
};

const UPGRADE_MAILTO =
  "mailto:stav@verticalbuilders.dev?subject=PositiveROI%20Team%20upgrade";

interface Plan {
  name: string;
  price: string;
  priceSub: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  highlighted?: boolean;
  chip?: string;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    priceSub: "per month",
    blurb: "For teams getting their first numbers on the board.",
    features: [
      "Up to 5 builders",
      "Unlimited tools and runs",
      "All four capture paths",
      "Public page and badge",
      "The full Undercount methodology",
    ],
    cta: { label: "Start free", href: "/login" },
    chip: "free while in beta",
  },
  {
    name: "Team",
    price: "$29",
    priceSub: "per month, flat",
    blurb: "For companies that want everyone counted.",
    features: [
      "Unlimited builders",
      "Full read API",
      "Everything in Free",
    ],
    cta: { label: "Contact to upgrade", href: UPGRADE_MAILTO, external: true },
    highlighted: true,
  },
  {
    name: "Self-hosted",
    price: "MIT",
    priceSub: "free forever",
    blurb: "The whole platform, on your infrastructure.",
    features: [
      "Your database, your data",
      "Unlimited everything",
      "The same frozen methodology",
      "No telemetry, no phone-home",
    ],
    cta: { label: "View on GitHub", href: GITHUB_URL, external: true },
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Who owns the data?",
    a: "You do. Runs, baselines, and metrics belong to your workspace, and nothing is public unless an admin turns the public page on and chooses exactly what it shows. If you want the strongest guarantee, self-host: everything stays in your own database.",
  },
  {
    q: "What happens after the beta?",
    a: "The plans above are the plan. Free stays for teams of up to 5 builders, Team billing turns on at $29 a month flat, and existing workspaces hear from us before anything changes. Self-hosted is MIT licensed; no beta ending can touch it.",
  },
  {
    q: "What counts as a builder?",
    a: "The person who built the tools. Teammates who only view dashboards don't count against the limit.",
  },
  {
    q: "Is the math different on paid plans?",
    a: "No. The Undercount is identical everywhere: free, paid, and self-hosted. A methodology that varies by plan is a methodology no one can cite.",
  },
];

export default function PricingPage() {
  if (!isHosted()) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Pricing
          </p>
          <h1 className="numeral mt-4 text-balance text-5xl leading-none text-foreground sm:text-6xl">
            Free while in beta.
          </h1>
          <p className="mt-5 text-pretty text-base leading-relaxed text-foreground-secondary sm:text-lg">
            Billing isn&rsquo;t live yet; every hosted workspace is free during
            the beta. The methodology is identical on every plan, because a
            number that changes with the price is worth nothing.
          </p>
        </header>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        <section className="mx-auto mt-24 max-w-2xl">
          <h2 className="numeral text-3xl text-foreground">Questions</h2>
          <dl className="mt-8 space-y-8">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="border-t border-dashed border-border pt-6"
              >
                <dt className="text-[0.9375rem] font-semibold text-foreground">
                  {item.q}
                </dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-foreground-secondary">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 border-t border-dashed border-border pt-6 text-[0.9375rem] text-foreground-secondary">
            Something else?{" "}
            <a
              href={UPGRADE_MAILTO}
              className="font-medium text-accent hover:underline"
            >
              Get in touch
            </a>{" "}
            or read{" "}
            <Link
              href="/methodology"
              className="font-medium text-accent hover:underline"
            >
              the methodology
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border bg-surface p-6",
        plan.highlighted ? "border-accent shadow-md" : "border-border shadow-xs",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{plan.name}</h2>
        {plan.chip && <Badge variant="accent">{plan.chip}</Badge>}
        {plan.highlighted && <Badge variant="accent">free during beta</Badge>}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="numeral text-5xl leading-none text-foreground">
          {plan.price}
        </span>
        <span className="font-mono text-xs text-foreground-muted">
          {plan.priceSub}
        </span>
      </div>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-foreground-secondary">
        {plan.blurb}
      </p>
      <ul className="mt-5 space-y-2.5 border-t border-dashed border-border pt-5">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-[0.875rem] text-foreground-secondary"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <Button
          asChild
          variant={plan.highlighted ? "primary" : "secondary"}
          className="w-full"
        >
          {plan.cta.external ? (
            <a
              href={plan.cta.href}
              {...(plan.cta.href.startsWith("http")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {plan.cta.label}
            </a>
          ) : (
            <Link href={plan.cta.href}>{plan.cta.label}</Link>
          )}
        </Button>
      </div>
    </div>
  );
}
