import { formatDate, timeAgo } from "../format";
import type { ApiKeyListItem, KeyGroup } from "./keys-panel";

/**
 * Pure shaping for the keys page: db rows to display items, and the admin
 * view's per-owner grouping. Kept out of the page so it can be unit-tested.
 */

export interface ApiKeyDbRow {
  id: string;
  name: string | null;
  scope: "ingest" | "read";
  key_prefix: string;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function toKeyListItem(k: ApiKeyDbRow, now?: Date): ApiKeyListItem {
  return {
    id: k.id,
    name: k.name || "Untitled key",
    scope: k.scope,
    prefix: k.key_prefix,
    created: formatDate(k.created_at),
    lastUsed: k.last_used_at ? timeAgo(k.last_used_at, now) : null,
    revoked: Boolean(k.revoked_at),
  };
}

const FORMER_MEMBER = "former member";

/**
 * One group per creator, sorted by owner name; rows keep their incoming
 * (created-desc) order. Creators who left the workspace show as
 * "former member".
 */
export function groupKeysByOwner(
  rows: ApiKeyDbRow[],
  nameByUser: Map<string, string>,
  now?: Date,
): KeyGroup[] {
  const groups = new Map<string, KeyGroup>();
  for (const row of rows) {
    const ownerId = row.created_by ?? "unknown";
    const owner =
      (row.created_by && nameByUser.get(row.created_by)) || FORMER_MEMBER;
    const group = groups.get(ownerId) ?? { owner, keys: [] };
    group.keys.push(toKeyListItem(row, now));
    groups.set(ownerId, group);
  }
  return [...groups.values()].sort((a, b) => a.owner.localeCompare(b.owner));
}
