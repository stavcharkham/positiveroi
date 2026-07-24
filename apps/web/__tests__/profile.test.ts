import { describe, expect, it } from "vitest";
import { normalizeWebsite } from "@/lib/profile";

describe("normalizeWebsite", () => {
  it("adds https and strips paths", () => {
    expect(normalizeWebsite("acme.com")).toBe("https://acme.com");
    expect(normalizeWebsite("www.acme.com/about?x=1")).toBe(
      "https://www.acme.com",
    );
    expect(normalizeWebsite("http://acme.io")).toBe("http://acme.io");
  });

  it("keeps explicit ports", () => {
    expect(normalizeWebsite("https://acme.com:8443")).toBe(
      "https://acme.com:8443",
    );
  });

  it("rejects empties and non-domains", () => {
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite("   ")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("not a url")).toBeNull();
  });
});
