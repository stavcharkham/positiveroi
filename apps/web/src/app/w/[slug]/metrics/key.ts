/**
 * Metric key derivation — must satisfy the DB check `^[a-z0-9_]{2,40}$`.
 * Shared by the add-metric form (live preview) and the server action
 * (source of truth at insert time).
 */
export function keyFromName(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return key;
}

export function isValidMetricKey(key: string): boolean {
  return /^[a-z0-9_]{2,40}$/.test(key);
}
