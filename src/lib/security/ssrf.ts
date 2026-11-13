import { lookup } from "dns/promises";
import { isIP } from "net";

function parseIpv4ToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    acc = (acc << 8) | n;
  }
  return acc >>> 0;
}

function inCidrV4(ipNum: number, baseIp: string, prefix: number): boolean {
  const base = parseIpv4ToUint32(baseIp);
  if (base === null) return false;
  if (prefix === 0) return true;
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) >>> 0 === (base & mask) >>> 0;
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const version = isIP(ip);

  if (version === 4) {
    const num = parseIpv4ToUint32(ip);
    if (num === null) return true;
    const blockedRanges: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return blockedRanges.some(([cidrBase, prefix]) => inCidrV4(num, cidrBase, prefix));
  }

  if (version === 6) {
    if (ip === "::" || ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip === "0:0:0:0:0:0:0:0") {
      return true;
    }
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
    if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) {
      return true;
    }
    if (ip.startsWith("ff")) return true;
    if (ip.startsWith("2001:db8:") || ip.startsWith("2001:0db8:")) return true;

    if (ip.startsWith("::ffff:")) {
      const tail = ip.slice(7);
      if (isIP(tail) === 4) {
        return isPrivateOrReservedIp(tail);
      }
      const hexParts = tail.split(":");
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isPrivateOrReservedIp(v4);
        }
      }
      return true;
    }
    return false;
  }

  return true;
}

function isSuspiciousHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!lower) return true;
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".home.arpa") ||
    lower === "metadata.google.internal" ||
    lower === "instance-data"
  ) {
    return true;
  }
  if (/^\d+$/.test(lower) || /^0x[0-9a-f]+$/i.test(lower)) {
    return true;
  }
  if (/^[0-7]+\.[0-7]+\.[0-7]+\.[0-7]+$/.test(lower) && lower.startsWith("0")) {
    return true;
  }
  return false;
}

export interface SsrfValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  resolvedIps?: string[];
  reason?: string;
}

export async function validatePublicTargetUrl(
  rawUrl: string,
  options?: { requireHttps?: boolean; skipDnsLookup?: boolean }
): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Invalid URL syntax." };
  }

  const allowedProtocols = options?.requireHttps ? ["https:"] : ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return { valid: false, reason: `Disallowed URL scheme: ${parsed.protocol}` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "Embedded credentials in URLs are prohibited." };
  }

  const cleanHost = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isSuspiciousHostname(cleanHost)) {
    return { valid: false, reason: "Blocked internal or loopback hostname." };
  }

  if (parsed.port) {
    const portNum = Number(parsed.port);
    if (![80, 443, 8080, 8443].includes(portNum)) {
      return { valid: false, reason: `Port ${portNum} is outside allowed web diagnostic ports (80, 443, 8080, 8443).` };
    }
  }

  const ipVer = isIP(cleanHost);
  if (ipVer !== 0) {
    if (isPrivateOrReservedIp(cleanHost)) {
      return { valid: false, reason: "Private, loopback, link-local, or reserved IP addresses are strictly blocked." };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      hostname: cleanHost,
      resolvedIps: [cleanHost],
    };
  }

  if (options?.skipDnsLookup) {
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      hostname: cleanHost,
      resolvedIps: [],
    };
  }

  try {
    const records = await lookup(cleanHost, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: "Hostname did not resolve to any public DNS address." };
    }
    const resolvedIps = records.map((r) => r.address);
    for (const addr of resolvedIps) {
      if (isPrivateOrReservedIp(addr)) {
        return {
          valid: false,
          reason: "DNS resolution pointed to a private or reserved network address (SSRF blocked).",
        };
      }
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      hostname: cleanHost,
      resolvedIps,
    };
  } catch {
    return { valid: false, reason: "Unable to resolve target hostname safely." };
  }
}

export async function safeExternalFetch(
  rawUrl: string,
  options?: {
    method?: "GET" | "HEAD" | "POST";
    headers?: Record<string, string>;
    body?: string;
    requireHttps?: boolean;
    timeoutMs?: number;
    maxRedirects?: number;
    maxBytes?: number;
  }
): Promise<{
  status: number;
  statusText: string;
  finalUrl: string;
  redirectChain: string[];
  headers: Record<string, string>;
  bodyText: string;
  durationMs: number;
}> {
  const maxRedirects = options?.maxRedirects ?? 3;
  const timeoutMs = options?.timeoutMs ?? 6500;
  const maxBytes = options?.maxBytes ?? 262_144;
  const redirectChain: string[] = [];
  let currentUrl = rawUrl;
  const started = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await validatePublicTargetUrl(currentUrl, {
      requireHttps: options?.requireHttps,
    });
    if (!check.valid || !check.normalizedUrl) {
      throw new Error(check.reason || "Blocked target URL");
    }

    const response = await fetch(check.normalizedUrl, {
      method: hop === 0 ? options?.method || "GET" : "GET",
      headers: {
        "User-Agent": "ZeroTrace-Defensive-Inspector/1.0",
        ...(options?.headers || {}),
      },
      body: hop === 0 ? options?.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing Location header.");
      }
      const nextUrl = new URL(location, check.normalizedUrl).toString();
      redirectChain.push(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    const headerMap: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headerMap[k.toLowerCase()] = v;
    });

    let bodyText = "";
    if ((options?.method || "GET") !== "HEAD" && response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            chunks.push(value.slice(0, Math.max(0, maxBytes - (total - value.byteLength))));
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      const merged = new Uint8Array(chunks.reduce((sum, c) => sum + c.byteLength, 0));
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      bodyText = new TextDecoder("utf-8", { fatal: false }).decode(merged);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      finalUrl: check.normalizedUrl,
      redirectChain,
      headers: headerMap,
      bodyText,
      durationMs: Date.now() - started,
    };
  }

  throw new Error("Maximum safe redirect count exceeded.");
}
