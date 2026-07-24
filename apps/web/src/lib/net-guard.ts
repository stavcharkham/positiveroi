/**
 * Address guard for the one server-side fetch that follows user input (the
 * favicon lookup): every resolved IP must be public. Blocks SSRF into
 * loopback, RFC1918, link-local/metadata, CGNAT, and IPv6 private ranges.
 */

export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — judge the IPv4 part.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivateIp(mapped[1]!);

  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    // fc00::/7 (unique local), fe80::/10 (link-local)
    return (
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // unparseable = not provably public
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}
