import { workspaceStats } from "@/lib/aggregates";
import { getPublicWorkspace } from "@/lib/public-gate";
import { publicWindow } from "@/app/p/[slug]/public-data";

/**
 * Embeddable SVG badge. Resolves ONLY through getPublicWorkspace — unknown
 * or unpublished slugs 404 with no enumeration signal. The number comes from
 * the same trailing-90-day aggregate as the public page and the dashboards
 * (is_test excluded in SQL). Self-contained: system fonts, brand token hexes
 * inlined per theme, no external requests.
 */

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

interface BadgeTheme {
  bg: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
}

/** Hexes mirror the design tokens in globals.css (light/dark). */
const THEMES: Record<"light" | "dark", BadgeTheme> = {
  light: {
    bg: "#ffffff",
    border: "#e8e5df",
    text: "#21201c",
    muted: "#8f8b80",
    accent: "#0e7b58",
    accentSoft: "#e3f1ea",
  },
  dark: {
    bg: "#1b1a17",
    border: "#2c2b27",
    text: "#edeae3",
    muted: "#757064",
    accent: "#38ca92",
    accentSoft: "#16352a",
  },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await context.params;
  const slug = raw.endsWith(".svg") ? raw.slice(0, -".svg".length) : raw;

  const workspace = await getPublicWorkspace(slug);
  if (!workspace) return new Response("Not found", { status: 404 });

  const stats = await workspaceStats(workspace.id, publicWindow(workspace));
  const hours = new Intl.NumberFormat("en-US").format(Math.round(stats.hours));

  const themeParam = new URL(request.url).searchParams.get("theme");
  const theme = THEMES[themeParam === "dark" ? "dark" : "light"];

  return new Response(renderBadge(hours, theme), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function renderBadge(hours: string, t: BadgeTheme): string {
  // Widen slightly for large numbers so the text never clips.
  const width = 240 + Math.max(0, hours.length - 5) * 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="54" viewBox="0 0 ${width} 54" role="img" aria-label="${hours} hours saved in the last 90 days, counted with PositiveROI">
  <rect x="0.5" y="0.5" width="${width - 1}" height="53" rx="11.5" fill="${t.bg}" stroke="${t.border}"/>
  <rect x="12" y="13" width="28" height="28" rx="8" fill="${t.accentSoft}"/>
  <path transform="translate(18 19) scale(0.6667)" d="M13 2 4.5 13.5h5L10 22l8.5-11.5h-5L13 2Z" fill="${t.accent}"/>
  <text x="52" y="25" font-family="${FONT_STACK}" font-size="13.5" font-weight="600" fill="${t.text}">${hours}<tspan font-size="11.5" font-weight="500"> hrs saved · last 90 days</tspan></text>
  <text x="52" y="41" font-family="${FONT_STACK}" font-size="10" letter-spacing="0.3" fill="${t.muted}">PositiveROI · undercounted</text>
</svg>
`;
}
