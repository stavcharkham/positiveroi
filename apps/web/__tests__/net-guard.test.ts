import { describe, expect, it } from "vitest";
import { isPrivateIp } from "@/lib/net-guard";

describe("isPrivateIp", () => {
  it("blocks loopback, RFC1918, link-local, CGNAT, and reserved ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("blocks private IPv6 and mapped-IPv4 forms", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "104.18.0.1", "172.15.0.1", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("treats garbage as private", () => {
    expect(isPrivateIp("999.1.1.1")).toBe(true);
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});
