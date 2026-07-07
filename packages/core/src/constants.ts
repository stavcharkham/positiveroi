/**
 * Every name-derived and methodology-defining constant lives here.
 * Changing the methodology numbers is a product decision, not a code cleanup —
 * PRs that touch CONSERVATISM_FACTOR / JUDGMENT_FACTOR / MULTIPLIER_HOURS_30D
 * will be declined (open an issue instead).
 */

export const PRODUCT_NAME = "PositiveROI";
export const PRODUCT_DOMAIN = "positiveroi.dev";
export const GITHUB_REPO = "stavcharkham/positiveroi";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

export const CONFIG_DIR_NAME = ".positiveroi";
export const ENV_API_KEY = "POSITIVEROI_API_KEY";
export const ENV_ENDPOINT = "POSITIVEROI_ENDPOINT";

export const KEY_PREFIX_INGEST = "roi_ingest_";
export const KEY_PREFIX_READ = "roi_read_";

/** Plugin distribution (printed verbatim in the dashboard Connect panel). */
export const PLUGIN_MARKETPLACE_ADD = `/plugin marketplace add ${GITHUB_REPO}`;
export const PLUGIN_INSTALL = "/plugin install positiveroi@positiveroi";

// ---------------------------------------------------------------------------
// The Undercount — methodology constants
// ---------------------------------------------------------------------------

/** Confidence Cut: only 60% of the claimed baseline is ever credited. */
export const CONSERVATISM_FACTOR = 0.6;
/** Judgment Cut: halve credit when a human decision remains in the loop. */
export const JUDGMENT_FACTOR = 0.5;

/** Credited hours in the trailing window that equal one full-time job. */
export const MULTIPLIER_HOURS_30D = 180;
export const TRAILING_WINDOW_DAYS = 30;
/** Average days per month, used to pro-rate FTE math over arbitrary periods. */
export const DAYS_PER_MONTH = 30.44;

/** Baseline caps (raw manual minutes per run). */
export const RAW_ESTIMATE_MAX_DASHBOARD = 480;
export const RAW_ESTIMATE_MAX_API = 120;
/** Soft warning threshold in the registration wizard. */
export const RAW_ESTIMATE_SOFT_WARNING = 240;

// ---------------------------------------------------------------------------
// Ingestion limits
// ---------------------------------------------------------------------------

export const INGEST_BATCH_MAX = 100;
export const INGEST_BODY_MAX_BYTES = 256 * 1024;
export const METADATA_MAX_BYTES = 8 * 1024;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const RATE_LIMIT_PER_MINUTE = 120;
/** occurred_at bounds on the API path. */
export const OCCURRED_AT_MAX_FUTURE_MS = 5 * 60 * 1000;
export const OCCURRED_AT_MAX_PAST_DAYS = 90;

// ---------------------------------------------------------------------------
// Workspace defaults
// ---------------------------------------------------------------------------

export const DEFAULT_HOURLY_RATE_CENTS = 6000;
export const DEFAULT_CURRENCY = "USD";

export const SEEDED_METRICS = [
  { key: "revenue_influenced", name: "Revenue influenced", unit: "currency" },
  { key: "leads_generated", name: "Leads generated", unit: "count" },
  { key: "client_touchpoints", name: "Client touchpoints", unit: "count" },
] as const;

// ---------------------------------------------------------------------------
// Badge tiers — display-only labels computed from trailing-30d credited hours.
// Only "multiplier" is ever stored.
// ---------------------------------------------------------------------------

export const TIERS = [
  { key: "first_run", label: "First Run", hours: 0 },
  { key: "saver", label: "Saver", hours: 9 },
  { key: "operator", label: "Operator", hours: 45 },
  { key: "heavy_lifter", label: "Heavy Lifter", hours: 90 },
  { key: "multiplier", label: "Multiplier", hours: MULTIPLIER_HOURS_30D },
  { key: "multiplier_x2", label: "Multiplier ×2", hours: 360 },
  { key: "multiplier_x3", label: "Multiplier ×3", hours: 540 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export const TOOL_TYPES = ["automation", "skill", "agent", "app"] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const EVENT_SOURCES = ["rest", "mcp", "hook", "sdk", "manual"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];
/** Sources accepted from API keys — `manual` is dashboard-internal only. */
export const API_EVENT_SOURCES = ["rest", "mcp", "hook", "sdk"] as const;

export const MEMBER_ROLES = ["admin", "lead", "builder"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const METRIC_UNITS = ["currency", "count", "duration"] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];
