import { describe, expect, it } from "vitest";
import {
  groupKeysByOwner,
  toKeyListItem,
  type ApiKeyDbRow,
} from "@/app/w/[slug]/settings/keys/group-keys";

const NOW = new Date("2026-07-10T12:00:00Z");

function row(overrides: Partial<ApiKeyDbRow> = {}): ApiKeyDbRow {
  return {
    id: "k1",
    name: "CI bot",
    scope: "ingest",
    key_prefix: "roi_ingest_3fk2",
    created_by: "user-a",
    created_at: "2026-07-01T12:00:00Z",
    last_used_at: null,
    revoked_at: null,
    ...overrides,
  };
}

describe("toKeyListItem", () => {
  it("maps a live never-used key", () => {
    const item = toKeyListItem(row(), NOW);
    expect(item).toEqual({
      id: "k1",
      name: "CI bot",
      scope: "ingest",
      prefix: "roi_ingest_3fk2",
      // Exact day depends on the machine's timezone; the year is stable.
      created: expect.stringContaining("2026"),
      lastUsed: null,
      revoked: false,
    });
  });

  it("marks revoked keys and formats last-used", () => {
    const item = toKeyListItem(
      row({
        last_used_at: "2026-07-10T09:00:00Z",
        revoked_at: "2026-07-10T10:00:00Z",
      }),
      NOW,
    );
    expect(item.revoked).toBe(true);
    expect(item.lastUsed).toBe("3h ago");
  });

  it("falls back to 'Untitled key' for empty names", () => {
    expect(toKeyListItem(row({ name: "" }), NOW).name).toBe("Untitled key");
    expect(toKeyListItem(row({ name: null }), NOW).name).toBe("Untitled key");
  });
});

describe("groupKeysByOwner", () => {
  const names = new Map([
    ["user-a", "Ziggy Alvarez"],
    ["user-b", "Ana Brook"],
  ]);

  it("groups per creator, sorted by display name", () => {
    const groups = groupKeysByOwner(
      [
        row({ id: "k1", created_by: "user-a" }),
        row({ id: "k2", created_by: "user-b" }),
        row({ id: "k3", created_by: "user-a" }),
      ],
      names,
      NOW,
    );
    expect(groups.map((g) => g.owner)).toEqual(["Ana Brook", "Ziggy Alvarez"]);
    expect(groups[1]?.keys.map((k) => k.id)).toEqual(["k1", "k3"]);
  });

  it("labels departed creators as former member", () => {
    const groups = groupKeysByOwner(
      [
        row({ id: "k1", created_by: "user-gone" }),
        row({ id: "k2", created_by: null }),
        row({ id: "k3", created_by: "user-a" }),
      ],
      names,
      NOW,
    );
    expect(groups.map((g) => g.owner)).toEqual([
      "former member",
      "former member",
      "Ziggy Alvarez",
    ]);
  });

  it("keeps separate groups for distinct departed creators", () => {
    const groups = groupKeysByOwner(
      [
        row({ id: "k1", created_by: "user-gone-1" }),
        row({ id: "k2", created_by: "user-gone-2" }),
        row({ id: "k3", created_by: "user-gone-1" }),
      ],
      new Map(),
      NOW,
    );
    expect(groups).toHaveLength(2);
    expect(groups.flatMap((g) => g.keys.map((k) => k.id)).sort()).toEqual([
      "k1",
      "k2",
      "k3",
    ]);
  });
});
