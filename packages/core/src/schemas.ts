import { z } from "zod";
import {
  API_EVENT_SOURCES,
  EVENT_SOURCES,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  INGEST_BATCH_MAX,
  MEMBER_ROLES,
  METRIC_UNITS,
  RAW_ESTIMATE_MAX_API,
  RAW_ESTIMATE_MAX_DASHBOARD,
  TOOL_TYPES,
} from "./constants.js";

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

export const toolTypeSchema = z.enum(TOOL_TYPES);
export const eventSourceSchema = z.enum(EVENT_SOURCES);
export const apiEventSourceSchema = z.enum(API_EVENT_SOURCES);
export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const metricUnitSchema = z.enum(METRIC_UNITS);

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/, "invalid slug");

const metricsMapSchema = z
  .record(z.string().regex(/^[a-z0-9_]{2,40}$/), z.number().finite())
  .refine((m) => Object.keys(m).length <= 20, "at most 20 metrics per event");

// ---------------------------------------------------------------------------
// Ingestion (POST /api/ingest)
// ---------------------------------------------------------------------------

export const ingestEventSchema = z.object({
  /** Tool slug or uuid. */
  tool: z.string().min(1).max(100),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  source: apiEventSourceSchema.optional().default("rest"),
  idempotency_key: z.string().min(1).max(IDEMPOTENCY_KEY_MAX_LENGTH).optional(),
  /** Optional override — may only LOWER credit; clamped server-side. */
  minutes_saved: z.number().min(0).max(RAW_ESTIMATE_MAX_DASHBOARD).optional(),
  is_test: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional().default({}),
  metrics: metricsMapSchema.optional().default({}),
});

export type IngestEvent = z.infer<typeof ingestEventSchema>;

/** Body accepts one bare event or `{ events: [...] }` (1..INGEST_BATCH_MAX). */
export const ingestBodySchema = z.union([
  z.object({ events: z.array(ingestEventSchema).min(1).max(INGEST_BATCH_MAX) }),
  ingestEventSchema,
]);

export function normalizeIngestBody(body: z.infer<typeof ingestBodySchema>): IngestEvent[] {
  return "events" in body && Array.isArray((body as { events?: unknown }).events)
    ? (body as { events: IngestEvent[] }).events
    : [body as IngestEvent];
}

export const ingestResultSchema = z.object({
  status: z.enum(["accepted", "duplicate", "rejected"]),
  event_id: z.string().uuid().optional(),
  warnings: z.array(z.string()).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  tool_totals: z
    .object({
      tool: z.string(),
      owner_hours_30d: z.number(),
      multiplier_progress: z.number(),
    })
    .optional(),
});

export type IngestResult = z.infer<typeof ingestResultSchema>;

export const ingestResponseSchema = z.object({
  results: z.array(ingestResultSchema),
  accepted: z.number().int(),
  duplicates: z.number().int(),
  rejected: z.number().int(),
});

export type IngestResponse = z.infer<typeof ingestResponseSchema>;

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const toolCreateBase = z.object({
  name: z.string().min(1).max(100),
  type: toolTypeSchema,
  description: z.string().max(2000).optional().default(""),
  high_judgment: z.boolean(),
});

/**
 * Builder-set credited minutes per run — replaces the suggested Undercount
 * when it differs. Dashboard plane only; the API tool schema never carries it.
 */
export const creditOverrideSchema = z
  .number()
  .gt(0)
  .max(RAW_ESTIMATE_MAX_DASHBOARD)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "credited minutes support at most 2 decimal places",
  });

/** Dashboard path: cap 480 raw minutes; optional builder-set credit. */
export const toolCreateSchema = toolCreateBase.extend({
  raw_estimate_minutes: z.number().gt(0).max(RAW_ESTIMATE_MAX_DASHBOARD),
  minutes_saved_override: creditOverrideSchema.optional(),
});

/** API path (POST /api/v1/tools): hard cap 120 raw minutes. */
export const toolCreateApiSchema = toolCreateBase.extend({
  raw_estimate_minutes: z
    .number()
    .gt(0)
    .max(
      RAW_ESTIMATE_MAX_API,
      `API-registered tools are capped at ${RAW_ESTIMATE_MAX_API} raw minutes; larger baselines must be set in the dashboard`,
    ),
});

export type ToolCreate = z.infer<typeof toolCreateSchema>;

// ---------------------------------------------------------------------------
// Metric definitions (GET /api/v1/metric-definitions)
// ---------------------------------------------------------------------------

export const metricDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(1),
  unit: metricUnitSchema,
});

export type MetricDefinition = z.infer<typeof metricDefinitionSchema>;

export const metricDefinitionsResponseSchema = z.object({
  metrics: z.array(metricDefinitionSchema),
});

export type MetricDefinitionsResponse = z.infer<typeof metricDefinitionsResponseSchema>;

// ---------------------------------------------------------------------------
// API error envelope
// ---------------------------------------------------------------------------

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slugify a tool or workspace name to match the DDL slug constraint. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug.length >= 1 ? slug : "tool";
}
