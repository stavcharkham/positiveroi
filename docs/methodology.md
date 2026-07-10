# The Undercount

This page is written for the most skeptical reader in the building. Usually that's the CFO.

## The problem with impact numbers

Every "AI saved us 4,000 hours" claim fails the same way: someone multiplied an optimistic guess by a big number of runs, and the first person to poke at the guess collapsed the whole figure. Once one number is caught inflated, every number after it is dead.

PositiveROI's answer is to undercount on purpose. Every number in the product is deliberately lower than the honest estimate, so that no one can argue it down.

## The two cuts

When a builder registers a tool, they state a **baseline**: the most conservative estimate of manual minutes one run of the tool replaces. The wizard explicitly nudges: "unsure between two numbers? take the lower one."

That baseline then takes two cuts before a single minute is credited:

1. **Confidence Cut.** Only 60% of the baseline is credited. This absorbs estimation optimism, the runs that partially fail, and the overhead the estimate forgot.
2. **Judgment Cut.** If a human still makes a meaningful decision in the task (reviewing, approving, editing before send), credit is halved again. The tool did not remove the work; it removed part of it.

### Worked example

A weekly pipeline digest that used to take 45 minutes by hand, where a person still reviews the output before sending:

```
45 min baseline
× 0.6  (Confidence Cut, −40%)  = 27 min
× 0.5  (Judgment Cut, ÷2)      = 13.5 credited min/run
```

The tool gets credit for 13.5 of the 45 minutes claimed. The receipt string shown in the product reads:

> 45 min baseline − 40% confidence cut = 27 min ÷ 2 judgment cut = 13.5 credited min/run

The computation lives in exactly two places that are tested to agree: a Postgres generated column and one TypeScript function in `packages/core` (`computeMinutesSavedPerRun`). There is no third implementation to drift.

## What is measured vs. what is estimated

The vocabulary is strict, everywhere in the product:

- **Runs are measured.** Each run is a real logged event with a timestamp, a source (`rest`, `sdk`, `mcp`, `hook`, `manual`), and attribution to the API key or person that logged it. Run counts are facts.
- **Minutes are estimates, and labeled as such.** Every hours figure carries an `undercounted` tag. The headline framing is always "measured runs × credited minutes per run."
- **Test runs never count.** Events flagged `is_test` are excluded from every aggregate, every leaderboard, the public page, the badge, and badge awards. They appear in drill-downs with a visible test label.

## The suggestion is a default, not a lock

The Undercount is what every tool starts with, and what most tools keep. But the builder knows their tool better than a formula does, so the final credited minutes per run is editable — in the registration wizard and later on the tool's settings tab — anywhere in (0, 480].

Transparency replaces the lock: a credit that differs from the suggestion is labeled **builder-set** on every receipt and drill-down, next to the suggestion it replaced, and every change is audited (who, when, old, new). Only the dashboard can set it — tools registered through the API always start on the suggestion.

## The drill-down guarantee (the Receipt)

Every number in the product opens. Company hours drill to per-tool hours, per-tool hours drill to the runs table, and each run expands to its full record: when it ran, what logged it, what the credit was and why. Badges drill to the exact 30 days of runs that earned them. Nothing is a dead-end aggregate.

This is the credibility model: not "trust our math" but "here are the rows, check them."

## Why overrides can only lower credit

An ingest call may pass `minutes_saved` to override the per-run credit, for example when a run only did half the job. The override is clamped server-side to the range `[0, baseline]`. It can reduce credit; it can never raise it above what the registered baseline allows. There is no API path to inflate a run.

The baseline itself is bounded and audited:

- Hard cap of **480 raw minutes** per run in the dashboard, with a soft warning at 240.
- Tools created through the API are capped at **120 raw minutes** and stamped `origin: api` for review.
- Every baseline set or change writes an audit row: who, when, old value, new value. Baseline edits are restricted to leads and admins, and baseline-change markers appear in the runs drill-down.

## The FTE math

**180 credited hours in a trailing 30 days equals one full-time job.** That is roughly 42 hours a week after the two cuts have already been applied, so it is a hard threshold to reach. A builder who crosses it earns the **Multiplier** badge.

The window is a rolling 30 days, not a calendar month. The progress ring decays honestly as runs age out; it never resets on a month boundary.

For arbitrary reporting periods, FTE is pro-rated using a 30.44-day average month:

```
fte_equivalent = credited_hours / (180 × period_days / 30.44)
```

So 360 credited hours over a 91-day quarter is 360 / (180 × 91 / 30.44) ≈ 0.67 FTE, not 2.

Money value is the simplest possible conversion: credited hours × the workspace hourly rate (default $60/hour, editable by admins, shown next to the number). It is presented as secondary, because the rate is the one input PositiveROI does not measure.

## Changing the constants

The 0.6, the 0.5, and the 180 are product decisions, not tuning parameters. Pull requests that change them are declined (see [CONTRIBUTING.md](../CONTRIBUTING.md)). A methodology that varies by deployment is a methodology no one can cite.
