/**
 * Workspace/member profile vocabulary — the onboarding questions. Values
 * match the check constraints in migration 0010.
 */

export const COMPANY_SIZES = [
  { value: "just_me", label: "Just me" },
  { value: "2_10", label: "2–10" },
  { value: "11_50", label: "11–50" },
  { value: "51_plus", label: "51+" },
] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number]["value"];

export const BUILDER_TYPES = [
  {
    value: "non_technical",
    label: "I build without writing code",
    blurb: "Claude Code, no-code tools, prompts — the AI writes the code.",
  },
  {
    value: "technical",
    label: "I write code",
    blurb: "Comfortable in a codebase, with or without AI help.",
  },
] as const;
export type BuilderType = (typeof BUILDER_TYPES)[number]["value"];

/** sessionStorage slot carrying the fresh ingest key from onboarding to the wizard. */
export function onboardingKeySlot(slug: string): string {
  return `roi-onboarding-key-${slug}`;
}

/**
 * Normalize a user-typed website ("acme.com", "http://acme.com/about") to
 * a bare https origin, or null when it cannot be one. Matches the DB check
 * on workspaces.website.
 */
export function normalizeWebsite(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    const origin = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
    return origin.length <= 208 ? origin : null;
  } catch {
    return null;
  }
}
