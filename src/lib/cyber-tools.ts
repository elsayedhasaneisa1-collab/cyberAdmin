import { createHash, createHmac } from "crypto";
import tls from "tls";
import type { CyberToolId, Language } from "@/types/zero-trace";
import { safeExternalFetch, validatePublicTargetUrl } from "./security/ssrf";
import { recordToolExecution } from "./security/telemetry";
import {
  escapeHtml,
  sanitizePlainText,
  validateDomainName,
  validatePublicIpInput,
} from "./security/validation";

export interface ToolExecutionResult {
  ok: boolean;
  toolId: CyberToolId;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  data: Record<string, unknown>;
  executedAt: string;
}

async function fetchJsonSafe(url: string, headers?: Record<string, string>, timeoutMs = 6000): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ZeroTrace-CyberIntel/1.0",
      ...(headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstream returned HTTP ${res.status}`);
  }
  return res.json();
}

async function runIpInfo(rawInput: string): Promise<Record<string, unknown>> {
  const check = validatePublicIpInput(rawInput);
  if (!check.valid || !check.ip) {
    throw new Error(check.error || "Invalid public IP address.");
  }
  const ip = check.ip;

  const [ipwhoSettled, ripeSettled, shodanSettled] = await Promise.allSettled([
    fetchJsonSafe(`https://ipwho.is/${encodeURIComponent(ip)}`),
    fetchJsonSafe(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`),
    fetchJsonSafe(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`),
  ]);

  const ipwho = ipwhoSettled.status === "fulfilled" ? (ipwhoSettled.value as Record<string, unknown>) : null;
  const ripe = ripeSettled.status === "fulfilled" ? (ripeSettled.value as Record<string, unknown>) : null;
  const shodan = shodanSettled.status === "fulfilled" ? (shodanSettled.value as Record<string, unknown>) : null;

  const ripeData = (ripe?.data as Record<string, unknown> | undefined) || {};
  const connection = (ipwho?.connection as Record<string, unknown> | undefined) || {};

  return {
    ip,
    country: ipwho?.country || "Unknown",
    countryCode: ipwho?.country_code || "",
    region: ipwho?.region || "",
    city: ipwho?.city || "",
    isp: connection.isp || connection.org || "Unknown",
    asn: connection.asn || ( Array.isArray(ripeData.asns) ? ripeData.asns[0] : null ),
    bgpPrefix: ripeData.prefix || null,
    openPorts: Array.isArray(shodan?.ports) ? shodan?.ports : [],
    hostnames: Array.isArray(shodan?.hostnames) ? shodan?.hostnames : [],
    cpes: Array.isArray(shodan?.cpes) ? shodan?.cpes : [],
    knownVulns: Array.isArray(shodan?.vulns) ? shodan?.vulns : [],
    tags: Array.isArray(shodan?.tags) ? shodan?.tags : [],
  };
}

async function queryDohType(domain: string, recordType: string): Promise<{
  adFlag: boolean;
  answers: Array<{ name: string; type: number; ttl: number; data: string }>;
}> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(recordType)}`;
  const raw = (await fetchJsonSafe(url, { Accept: "application/dns-json" })) as {
    AD?: boolean;
    Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
  };
  return {
    adFlag: Boolean(raw.AD),
    answers: (raw.Answer || []).map((a) => ({
      name: a.name,
      type: a.type,
      ttl: a.TTL,
      data: a.data,
    })),
  };
}

async function runDnsLookup(rawInput: string): Promise<Record<string, unknown>> {
  const check = validateDomainName(rawInput);
  if (!check.valid || !check.domain) {
    throw new Error(check.error || "Invalid domain name.");
  }
  const domain = check.domain;
  const types = ["A", "AAAA", "MX", "NS", "TXT", "CAA"];

  const results = await Promise.allSettled(types.map((t) => queryDohType(domain, t)));
  const dmarcRes = await queryDohType(`_dmarc.${domain}`, "TXT").catch(() => ({ adFlag: false, answers: [] }));

  const recordsByType: Record<string, Array<{ ttl: number; data: string }>> = {};
  let dnssecValidated = false;

  types.forEach((t, idx) => {
    const item = results[idx];
    if (item && item.status === "fulfilled") {
      if (item.value.adFlag) dnssecValidated = true;
      recordsByType[t] = item.value.answers.map((ans) => ({ ttl: ans.ttl, data: ans.data }));
    } else {
      recordsByType[t] = [];
    }
  });

  const txtValues = (recordsByType.TXT || []).map((r) => r.data);
  const hasSpf = txtValues.some((v) => v.toLowerCase().includes("v=spf1"));
  const hasDmarc = dmarcRes.answers.some((v) => v.data.toLowerCase().includes("v=dmarc1"));

  return {
    domain,
    dnssecValidated,
    emailPosture: {
      spfConfigured: hasSpf,
      dmarcConfigured: hasDmarc,
      dmarcRecords: dmarcRes.answers.map((a) => a.data),
    },
    records: recordsByType,
  };
}

async function runWhoisLookup(rawInput: string): Promise<Record<string, unknown>> {
  const ipCheck = validatePublicIpInput(rawInput);
  let endpoint = "";
  let targetLabel = "";

  if (ipCheck.valid && ipCheck.ip) {
    targetLabel = ipCheck.ip;
    endpoint = `https://rdap.org/ip/${encodeURIComponent(ipCheck.ip)}`;
  } else {
    const domCheck = validateDomainName(rawInput);
    if (!domCheck.valid || !domCheck.domain) {
      throw new Error("Provide a valid public domain name or public IP address.");
    }
    targetLabel = domCheck.domain;
    endpoint = `https://rdap.org/domain/${encodeURIComponent(domCheck.domain)}`;
  }

  const rdap = (await fetchJsonSafe(endpoint, { Accept: "application/rdap+json, application/json" }, 7500)) as {
    ldhName?: string;
    handle?: string;
    name?: string;
    status?: string[];
    events?: Array<{ eventAction?: string; eventDate?: string }>;
    nameservers?: Array<{ ldhName?: string }>;
    secureDNS?: { delegationSigned?: boolean };
    entities?: Array<{ roles?: string[]; vcardArray?: unknown[] }>;
  };

  const events: Record<string, string> = {};
  for (const ev of rdap.events || []) {
    if (ev.eventAction && ev.eventDate) {
      events[ev.eventAction] = ev.eventDate;
    }
  }

  let domainAgeDays: number | null = null;
  if (events.registration) {
    const regTime = Date.parse(events.registration);
    if (!Number.isNaN(regTime)) {
      domainAgeDays = Math.max(0, Math.floor((Date.now() - regTime) / (1000 * 60 * 60 * 24)));
    }
  }

  let registrar = "Redacted / Registry";
  for (const ent of rdap.entities || []) {
    if (ent.roles?.includes("registrar") && Array.isArray(ent.vcardArray) && Array.isArray(ent.vcardArray[1])) {
      for (const prop of ent.vcardArray[1] as unknown[][]) {
        if (prop[0] === "fn" && typeof prop[3] === "string") {
          registrar = prop[3];
        }
      }
    }
  }

  return {
    target: targetLabel,
    handle: rdap.handle || rdap.ldhName || targetLabel,
    networkName: rdap.name || null,
    registrar,
    status: rdap.status || [],
    events,
    domainAgeDays,
    dnssecSigned: Boolean(rdap.secureDNS?.delegationSigned),
    nameservers: (rdap.nameservers || []).map((ns) => ns.ldhName).filter(Boolean),
    protocol: "IETF Official RDAP over HTTPS",
  };
}

async function inspectLiveTlsCertificate(hostname: string): Promise<Record<string, unknown>> {
  const check = await validatePublicTargetUrl(`https://${hostname}`);
  if (!check.valid) {
    throw new Error(check.reason || "Target blocked by SSRF policy.");
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;
          const protocol = socket.getProtocol();
          const cipher = socket.getCipher();
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            reject(new Error("No TLS peer certificate returned by remote host."));
            return;
          }

          const validToMs = Date.parse(cert.valid_to);
          const daysRemaining = Number.isNaN(validToMs)
            ? null
            : Math.floor((validToMs - Date.now()) / (1000 * 60 * 60 * 24));

          const sanList = cert.subjectaltname
            ? cert.subjectaltname
                .split(",")
                .map((s) => s.trim().replace(/^DNS:/, ""))
                .slice(0, 25)
            : [];

          resolve({
            hostname,
            trustedChain: authorized,
            tlsProtocol: protocol,
            cipherSuite: cipher?.name || "Unknown",
            subjectCN: cert.subject?.CN || hostname,
            issuerOrg: cert.issuer?.O || cert.issuer?.CN || "Unknown",
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining,
            fingerprint256: cert.fingerprint256,
            serialNumber: cert.serialNumber,
            subjectAltNames: sanList,
          });
        } catch (err) {
          socket.destroy();
          reject(err);
        }
      }
    );

    socket.setTimeout(5500, () => {
      socket.destroy();
      reject(new Error("TLS handshake timed out."));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

async function runSslChecker(rawInput: string): Promise<Record<string, unknown>> {
  const check = validateDomainName(rawInput);
  if (!check.valid || !check.domain) {
    throw new Error(check.error || "Invalid domain name.");
  }
  const domain = check.domain;
  const liveCert = await inspectLiveTlsCertificate(domain);

  let ctLogEntriesCount = 0;
  try {
    const ctRaw = await fetchJsonSafe(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, {}, 4500);
    if (Array.isArray(ctRaw)) {
      ctLogEntriesCount = ctRaw.length;
    }
  } catch {
    ctLogEntriesCount = 0;
  }

  return {
    ...liveCert,
    certificateTransparencyEntries: ctLogEntriesCount,
  };
}

async function runSecurityHeadersAnalyzer(rawInput: string): Promise<Record<string, unknown>> {
  const normalizedInput = /^https?:\/\//i.test(rawInput.trim())
    ? rawInput.trim()
    : `https://${rawInput.trim()}`;

  const res = await safeExternalFetch(normalizedInput, {
    method: "GET",
    maxBytes: 16_384,
    timeoutMs: 6500,
  });

  const checks = [
    {
      header: "strict-transport-security",
      weight: 20,
      present: Boolean(res.headers["strict-transport-security"]),
      value: res.headers["strict-transport-security"] || null,
      recommendationAr: "أضف Strict-Transport-Security لفرض HTTPS ومنع هجمات خفض التشفير.",
      recommendationEn: "Add Strict-Transport-Security (HSTS) to enforce HTTPS connections.",
    },
    {
      header: "content-security-policy",
      weight: 25,
      present: Boolean(res.headers["content-security-policy"]),
      value: res.headers["content-security-policy"] || null,
      recommendationAr: "أضف سياسة Content-Security-Policy للحد من مخاطر حقن السكربتات XSS.",
      recommendationEn: "Implement Content-Security-Policy (CSP) to mitigate XSS injection vectors.",
    },
    {
      header: "x-content-type-options",
      weight: 15,
      present: (res.headers["x-content-type-options"] || "").toLowerCase() === "nosniff",
      value: res.headers["x-content-type-options"] || null,
      recommendationAr: "اضبط X-Content-Type-Options على nosniff لمنع تخمين نوع الملفات.",
      recommendationEn: "Set X-Content-Type-Options: nosniff to prevent MIME-sniffing.",
    },
    {
      header: "x-frame-options",
      weight: 15,
      present:
        Boolean(res.headers["x-frame-options"]) ||
        (res.headers["content-security-policy"] || "").includes("frame-ancestors"),
      value: res.headers["x-frame-options"] || null,
      recommendationAr: "أضف X-Frame-Options: DENY أو frame-ancestors للحماية من Clickjacking.",
      recommendationEn: "Add X-Frame-Options or CSP frame-ancestors to block Clickjacking.",
    },
    {
      header: "referrer-policy",
      weight: 15,
      present: Boolean(res.headers["referrer-policy"]),
      value: res.headers["referrer-policy"] || null,
      recommendationAr: "أضف Referrer-Policy لحماية مسارات الروابط عند الانتقال الخارجي.",
      recommendationEn: "Define Referrer-Policy (e.g., strict-origin-when-cross-origin).",
    },
    {
      header: "permissions-policy",
      weight: 10,
      present: Boolean(res.headers["permissions-policy"]),
      value: res.headers["permissions-policy"] || null,
      recommendationAr: "حدد Permissions-Policy لتقييد صلاحيات المتصفح الحساسة كالكاميرا والموقع.",
      recommendationEn: "Add Permissions-Policy to restrict sensitive browser APIs.",
    },
  ];

  const score = checks.reduce((acc, item) => acc + (item.present ? item.weight : 0), 0);
  const grade =
    score >= 90 ? "A+" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

  return {
    finalUrl: res.finalUrl,
    httpStatus: res.status,
    durationMs: res.durationMs,
    score,
    grade,
    serverBannerExposed: Boolean(res.headers["server"] || res.headers["x-powered-by"]),
    serverHeader: res.headers["server"] || null,
    poweredByHeader: res.headers["x-powered-by"] || null,
    checks,
  };
}

async function runUrlReputation(rawInput: string): Promise<Record<string, unknown>> {
  const candidate = /^https?:\/\//i.test(rawInput.trim()) ? rawInput.trim() : `https://${rawInput.trim()}`;
  const ssrf = await validatePublicTargetUrl(candidate);
  if (!ssrf.valid || !ssrf.normalizedUrl || !ssrf.hostname) {
    throw new Error(ssrf.reason || "Invalid or disallowed URL.");
  }

  const parsed = new URL(ssrf.normalizedUrl);
  const riskSignals: string[] = [];
  let riskScore = 0;

  if (parsed.protocol !== "https:") {
    riskSignals.push("Unencrypted HTTP transport");
    riskScore += 20;
  }
  if (parsed.hostname.includes("xn--")) {
    riskSignals.push("Punycode IDN hostname detected (potential homograph vector)");
    riskScore += 25;
  }
  if (parsed.hostname.split(".").length > 4) {
    riskSignals.push("Deeply nested subdomain structure");
    riskScore += 15;
  }
  if (parsed.pathname.length > 120 || parsed.search.length > 180) {
    riskSignals.push("Unusually long URL path/query parameters");
    riskScore += 10;
  }

  let domainAgeDays: number | null = null;
  try {
    const whois = await runWhoisLookup(ssrf.hostname);
    if (typeof whois.domainAgeDays === "number") {
      domainAgeDays = whois.domainAgeDays;
      if (domainAgeDays < 30) {
        riskSignals.push(`Newly registered domain (${domainAgeDays} days old)`);
        riskScore += 30;
      }
    }
  } catch {
    domainAgeDays = null;
  }

  let urlhausStatus = "not_queried";
  const abuseChKey = process.env.ABUSECH_AUTH_KEY?.trim();
  if (abuseChKey) {
    try {
      const formBody = new URLSearchParams({ url: ssrf.normalizedUrl }).toString();
      const resp = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        headers: {
          "Auth-Key": abuseChKey,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ZeroTrace-CyberIntel/1.0",
        },
        body: formBody,
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const json = (await resp.json()) as { query_status?: string; threat?: string };
        urlhausStatus = json.query_status || "checked";
        if (json.query_status === "ok") {
          riskSignals.push(`Listed in abuse.ch URLhaus (${json.threat || "malware"})`);
          riskScore = Math.min(100, riskScore + 70);
        }
      }
    } catch {
      urlhausStatus = "unavailable";
    }
  }

  const verdict = riskScore >= 60 ? "HIGH_RISK" : riskScore >= 25 ? "MODERATE_CAUTION" : "LOW_RISK";

  return {
    normalizedUrl: ssrf.normalizedUrl,
    hostname: ssrf.hostname,
    resolvedIps: ssrf.resolvedIps || [],
    httpsEnabled: parsed.protocol === "https:",
    domainAgeDays,
    urlhausStatus,
    riskScore: Math.min(100, riskScore),
    verdict,
    riskSignals,
  };
}

function runHashGenerator(rawInput: string, hmacSecret?: string): Record<string, unknown> {
  const text = rawInput;
  if (!text) {
    throw new Error("Input text is required to compute cryptographic digests.");
  }

  const digests: Record<string, string> = {
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    sha384: createHash("sha384").update(text, "utf8").digest("hex"),
    sha512: createHash("sha512").update(text, "utf8").digest("hex"),
    sha3_256: createHash("sha3-256").update(text, "utf8").digest("hex"),
    sha1_legacy: createHash("sha1").update(text, "utf8").digest("hex"),
    md5_legacy_non_cryptographic: createHash("md5").update(text, "utf8").digest("hex"),
  };

  if (hmacSecret && hmacSecret.trim()) {
    digests.hmac_sha256 = createHmac("sha256", hmacSecret.trim()).update(text, "utf8").digest("hex");
  }

  return {
    byteLength: Buffer.byteLength(text, "utf8"),
    digests,
    securityNote: "Prefer SHA-256, SHA-512, or SHA3-256 for integrity; use bcrypt/scrypt/Argon2id for passwords.",
  };
}

function runBase64Codec(rawInput: string, mode = "encode"): Record<string, unknown> {
  if (!rawInput) {
    throw new Error("Provide input text or Base64 payload.");
  }
  const normalizedMode = mode.toLowerCase();
  if (normalizedMode === "decode") {
    const cleaned = rawInput.trim();
    const decoded = Buffer.from(cleaned, "base64").toString("utf8");
    return {
      mode: "decode",
      output: decoded,
      hexOutput: Buffer.from(cleaned, "base64").toString("hex"),
    };
  }
  const buf = Buffer.from(rawInput, "utf8");
  return {
    mode: "encode",
    base64: buf.toString("base64"),
    base64Url: buf.toString("base64url"),
    hex: buf.toString("hex"),
  };
}

async function runPasswordStrength(password: string): Promise<Record<string, unknown>> {
  if (!password) {
    throw new Error("Provide a candidate password to evaluate.");
  }
  const length = password.length;
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;

  const entropyBits = pool > 0 ? Math.round(length * Math.log2(pool) * 10) / 10 : 0;

  const sha1Full = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix5 = sha1Full.slice(0, 5);
  const suffix = sha1Full.slice(5);

  let breachExposures = 0;
  let kAnonymityChecked = false;

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix5}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "ZeroTrace-PasswordAudit/1.0",
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) {
      kAnonymityChecked = true;
      const text = await res.text();
      for (const line of text.split(/\r?\n/)) {
        const [hashSuffix, countStr] = line.split(":");
        if (hashSuffix?.trim().toUpperCase() === suffix) {
          breachExposures = parseInt(countStr?.trim() || "0", 10) || 0;
          break;
        }
      }
    }
  } catch {
    kAnonymityChecked = false;
  }

  let rating =
    entropyBits >= 80 ? "EXCELLENT" : entropyBits >= 60 ? "STRONG" : entropyBits >= 40 ? "MODERATE" : "WEAK";
  if (breachExposures > 0) {
    rating = "COMPROMISED_IN_PUBLIC_BREACHES";
  }

  return {
    length,
    characterPoolSize: pool,
    entropyBits,
    rating,
    kAnonymityChecked,
    breachExposures,
    privacyGuarantee: "Only the 5-character SHA-1 prefix was sent via k-Anonymity; the password was never transmitted or stored.",
  };
}

async function runHttpAnalyzer(rawInput: string): Promise<Record<string, unknown>> {
  const candidate = /^https?:\/\//i.test(rawInput.trim()) ? rawInput.trim() : `https://${rawInput.trim()}`;
  const res = await safeExternalFetch(candidate, {
    method: "GET",
    maxBytes: 32_768,
    timeoutMs: 6500,
  });

  return {
    finalUrl: res.finalUrl,
    status: res.status,
    statusText: res.statusText,
    durationMs: res.durationMs,
    redirectChain: res.redirectChain,
    contentType: res.headers["content-type"] || "unknown",
    cacheControl: res.headers["cache-control"] || "not set",
    corsAllowOrigin: res.headers["access-control-allow-origin"] || "not set",
    headers: res.headers,
  };
}

async function runDomainInfo(rawInput: string): Promise<Record<string, unknown>> {
  const check = validateDomainName(rawInput);
  if (!check.valid || !check.domain) {
    throw new Error(check.error || "Invalid domain name.");
  }
  const [dnsData, whoisData] = await Promise.all([
    runDnsLookup(check.domain),
    runWhoisLookup(check.domain).catch(() => ({ registrar: "Unavailable", status: [] })),
  ]);

  return {
    domain: check.domain,
    dns: dnsData,
    registration: whoisData,
  };
}

function calculateIpv4Cidr(cidrInput: string): Record<string, unknown> | null {
  const match = cidrInput.trim().match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (!match) return null;
  const [, ipStr, prefixStr] = match;
  const prefix = Number(prefixStr);
  if (prefix < 0 || prefix > 32) return null;
  const octets = ipStr.split(".").map(Number);
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return null;

  const ipInt = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;

  const intToIp = (n: number) =>
    `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;

  const usableHosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.pow(2, 32 - prefix) - 2;

  return {
    cidr: `${intToIp(networkInt)}/${prefix}`,
    subnetMask: intToIp(maskInt),
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstHost: prefix >= 31 ? intToIp(networkInt) : intToIp((networkInt + 1) >>> 0),
    lastHost: prefix >= 31 ? intToIp(broadcastInt) : intToIp((broadcastInt - 1) >>> 0),
    usableHosts,
  };
}

async function runNetworkEducation(rawInput: string): Promise<Record<string, unknown>> {
  const query = sanitizePlainText(rawInput || "192.168.10.0/24", 60);
  const cidrCalc = calculateIpv4Cidr(query);

  let linuxManual: string | null = null;
  const cleanCmd = query.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cidrCalc && cleanCmd) {
    for (const folder of ["common", "linux"]) {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/tldr-pages/tldr/main/pages/${folder}/${cleanCmd}.md`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (res.ok) {
          linuxManual = await res.text();
          break;
        }
      } catch {
        linuxManual = null;
      }
    }
  }

  return {
    query,
    subnetCalculation: cidrCalc,
    linuxTldrManual: linuxManual,
    osiModelSummary: [
      { layer: 7, name: "Application", protocols: "HTTPS, DNS, SSH, SMTP", defense: "WAF, CSP, Input Validation, mTLS" },
      { layer: 6, name: "Presentation", protocols: "TLS 1.3, X.509, UTF-8", defense: "Strong Ciphers, Certificate Pinning" },
      { layer: 5, name: "Session", protocols: "RPC, NetBIOS, Sockets", defense: "Signed Session Tokens, Idle Expiration" },
      { layer: 4, name: "Transport", protocols: "TCP, UDP, QUIC", defense: "SYN Cookies, Strict Port Filtering" },
      { layer: 3, name: "Network", protocols: "IPv4, IPv6, ICMP, IPSec", defense: "BGP RPKI, Egress SSRF Filtering" },
      { layer: 2, name: "Data Link", protocols: "Ethernet, ARP, VLAN", defense: "Dynamic ARP Inspection, 802.1X" },
      { layer: 1, name: "Physical", protocols: "Fiber, Copper, RF", defense: "Physical Access Controls, Tamper Audits" },
    ],
  };
}

async function runLearningCenter(): Promise<Record<string, unknown>> {
  const [ctfSettled, kevSettled] = await Promise.allSettled([
    fetchJsonSafe("https://ctftime.org/api/v1/events/?limit=5", {}, 5500),
    fetchJsonSafe("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", {}, 6500),
  ]);

  let upcomingCtfs: Array<Record<string, unknown>> = [];
  if (ctfSettled.status === "fulfilled" && Array.isArray(ctfSettled.value)) {
    upcomingCtfs = ctfSettled.value.slice(0, 5).map((ev: Record<string, unknown>) => ({
      title: ev.title,
      format: ev.format,
      start: ev.start,
      finish: ev.finish,
      url: ev.url || ev.ctftime_url,
      weight: ev.weight,
    }));
  }

  let latestKevAdvisories: Array<Record<string, unknown>> = [];
  if (kevSettled.status === "fulfilled" && kevSettled.value && typeof kevSettled.value === "object") {
    const kevObj = kevSettled.value as { vulnerabilities?: Array<Record<string, unknown>> };
    const vulns = Array.isArray(kevObj.vulnerabilities) ? kevObj.vulnerabilities : [];
    latestKevAdvisories = vulns.slice(-5).reverse().map((v) => ({
      cveID: v.cveID,
      vendorProject: v.vendorProject,
      product: v.product,
      vulnerabilityName: v.vulnerabilityName,
      dateAdded: v.dateAdded,
      dueDate: v.dueDate,
    }));
  }

  return {
    curriculumTracks: [
      {
        id: "track-owasp",
        titleAr: "حماية تطبيقات الويب (OWASP Top 10)",
        titleEn: "Web Application Hardening (OWASP Top 10)",
        referenceUrl: "https://owasp.org/www-project-top-ten/",
      },
      {
        id: "track-blueteam",
        titleAr: "الاستجابة للحوادث والتحليل الجنائي الرقمي",
        titleEn: "Blue Team Incident Response & Triage",
        referenceUrl: "https://attack.mitre.org/",
      },
      {
        id: "track-linux",
        titleAr: "تحصين خوادم Linux وإدارة الصلاحيات",
        titleEn: "Linux Server Hardening & Least Privilege",
        referenceUrl: "https://github.com/tldr-pages/tldr",
      },
    ],
    upcomingCtfs,
    latestKevAdvisories,
  };
}

export async function executeCyberTool(params: {
  toolId: CyberToolId;
  input: string;
  secondaryInput?: string;
  actor: string;
}): Promise<ToolExecutionResult> {
  const cleanInput = sanitizePlainText(params.input, 1000);
  const executedAt = new Date().toISOString();

  try {
    let data: Record<string, unknown> = {};
    let titleAr = "";
    let titleEn = "";
    let summaryAr = "";
    let summaryEn = "";

    switch (params.toolId) {
      case "ip_info":
        data = await runIpInfo(cleanInput);
        titleAr = "تقرير عنوان IP";
        titleEn = "IP Intelligence Report";
        summaryAr = `تم جلب بيانات الشبكة والمنافذ السلبية للعنوان ${data.ip}`;
        summaryEn = `Retrieved passive ASN, geolocation, and exposure profile for ${data.ip}`;
        break;
      case "dns_lookup":
        data = await runDnsLookup(cleanInput);
        titleAr = "تقرير سجلات DNS";
        titleEn = "DNS & DNSSEC Diagnostic";
        summaryAr = `تم تحليل سجلات DNS وسياسات البريد للنطاق ${data.domain}`;
        summaryEn = `Resolved DNS records and email authentication posture for ${data.domain}`;
        break;
      case "whois_lookup":
        data = await runWhoisLookup(cleanInput);
        titleAr = "استعلام RDAP / WHOIS";
        titleEn = "Official RDAP Registration Report";
        summaryAr = `تم جلب بيانات التسجيل الرسمية للهدف ${data.target}`;
        summaryEn = `Retrieved authoritative ICANN RDAP registration data for ${data.target}`;
        break;
      case "ssl_checker":
        data = await runSslChecker(cleanInput);
        titleAr = "فحص شهادة SSL/TLS";
        titleEn = "SSL/TLS Certificate Inspection";
        summaryAr = `الشهادة صالحة لـ ${data.daysRemaining ?? "?"} يومًا عبر ${data.tlsProtocol}`;
        summaryEn = `Certificate valid for ${data.daysRemaining ?? "?"} days over ${data.tlsProtocol}`;
        break;
      case "security_headers":
        data = await runSecurityHeadersAnalyzer(cleanInput);
        titleAr = "تحليل ترويسات الأمان";
        titleEn = "HTTP Security Headers Audit";
        summaryAr = `التقييم الدفاعي: ${data.grade} (${data.score}/100)`;
        summaryEn = `Defensive posture grade: ${data.grade} (${data.score}/100)`;
        break;
      case "url_reputation":
        data = await runUrlReputation(cleanInput);
        titleAr = "تحليل سمعة الرابط";
        titleEn = "URL Reputation & Risk Triage";
        summaryAr = `مستوى المخاطر المقدر: ${data.verdict} (${data.riskScore}/100)`;
        summaryEn = `Assessed risk verdict: ${data.verdict} (${data.riskScore}/100)`;
        break;
      case "hash_generator":
        data = runHashGenerator(params.input.slice(0, 4000), params.secondaryInput);
        titleAr = "البصمات التشفيرية";
        titleEn = "Cryptographic Hash Digests";
        summaryAr = "تم توليد بصمات SHA-256 وSHA-512 وSHA3-256 بنجاح.";
        summaryEn = "Generated SHA-256, SHA-512, and SHA3-256 digests.";
        break;
      case "base64_codec":
        data = runBase64Codec(params.input.slice(0, 4000), params.secondaryInput || "encode");
        titleAr = "محول الترميز Base64";
        titleEn = "Base64 & Hex Codec";
        summaryAr = `تم تنفيذ عملية ${data.mode} بنجاح.`;
        summaryEn = `Completed ${data.mode} transformation successfully.`;
        break;
      case "password_strength":
        data = await runPasswordStrength(params.input.slice(0, 256));
        titleAr = "تقييم قوة كلمة المرور";
        titleEn = "Password Entropy & k-Anonymity Audit";
        summaryAr = `التصنيف: ${data.rating} — الإنتروبيا: ${data.entropyBits} بت`;
        summaryEn = `Rating: ${data.rating} — Entropy: ${data.entropyBits} bits`;
        break;
      case "http_analyzer":
        data = await runHttpAnalyzer(cleanInput);
        titleAr = "تحليل استجابة HTTP";
        titleEn = "SSRF-Guarded HTTP Response Analysis";
        summaryAr = `الحالة HTTP ${data.status} خلال ${data.durationMs} مللي ثانية`;
        summaryEn = `HTTP ${data.status} received in ${data.durationMs} ms`;
        break;
      case "domain_info":
        data = await runDomainInfo(cleanInput);
        titleAr = "ملف النطاق الشامل";
        titleEn = "Comprehensive Domain Profile";
        summaryAr = `تم دمج فحوصات DNS وRDAP للنطاق ${data.domain}`;
        summaryEn = `Compiled DNS and RDAP intelligence for ${data.domain}`;
        break;
      case "network_education":
        data = await runNetworkEducation(cleanInput);
        titleAr = "حاسبة الشبكات ودليل Linux";
        titleEn = "Network Subnetting & Linux Reference";
        summaryAr = "تم تجهيز المرجع التعليمي للشبكات وأوامر النظام.";
        summaryEn = "Prepared subnetting calculation and Linux command manual.";
        break;
      case "learning_center":
        data = await runLearningCenter();
        titleAr = "مركز التعلم السيبراني وCTF";
        titleEn = "Cybersecurity Learning & Live CTF Feed";
        summaryAr = "تم جلب أحدث مسابقات CTF وتنبيهات الثغرات من CISA KEV.";
        summaryEn = "Loaded live CTFtime events and CISA KEV advisories.";
        break;
      default:
        throw new Error("Unsupported tool identifier.");
    }

    recordToolExecution(params.toolId, params.actor, true, summaryEn);

    return {
      ok: true,
      toolId: params.toolId,
      titleAr,
      titleEn,
      summaryAr,
      summaryEn,
      data,
      executedAt,
    };
  } catch (err) {
    const safeMsg = err instanceof Error ? err.message : "Tool execution error.";
    recordToolExecution(params.toolId, params.actor, false, safeMsg);
    throw new Error(safeMsg);
  }
}

export function formatToolResultForTelegram(result: ToolExecutionResult, lang: Language): string {
  const title = lang === "ar" ? result.titleAr : result.titleEn;
  const summary = lang === "ar" ? result.summaryAr : result.summaryEn;
  const d = result.data;
  const lines: string[] = [
    `🛡️ <b>${escapeHtml(title)}</b>`,
    `<i>${escapeHtml(summary)}</i>`,
    "━━━━━━━━━━━━━━━━━━",
  ];

  if (result.toolId === "ip_info") {
    lines.push(`• <b>IP:</b> <code>${escapeHtml(String(d.ip || ""))}</code>`);
    lines.push(`• <b>Country:</b> ${escapeHtml(String(d.country || ""))} (${escapeHtml(String(d.countryCode || ""))})`);
    lines.push(`• <b>ISP / Org:</b> ${escapeHtml(String(d.isp || ""))}`);
    lines.push(`• <b>ASN / Prefix:</b> <code>${escapeHtml(String(d.asn || "-"))}</code> | <code>${escapeHtml(String(d.bgpPrefix || "-"))}</code>`);
    const ports = Array.isArray(d.openPorts) ? d.openPorts.join(", ") : "";
    lines.push(`• <b>Passive Ports:</b> <code>${escapeHtml(ports || "None indexed")}</code>`);
  } else if (result.toolId === "security_headers") {
    lines.push(`• <b>URL:</b> <code>${escapeHtml(String(d.finalUrl || ""))}</code>`);
    lines.push(`• <b>Grade:</b> <b>${escapeHtml(String(d.grade || ""))}</b> (${escapeHtml(String(d.score || 0))}/100)`);
    lines.push(`• <b>HTTP Status:</b> <code>${escapeHtml(String(d.httpStatus || ""))}</code>`);
  } else if (result.toolId === "ssl_checker") {
    lines.push(`• <b>Host:</b> <code>${escapeHtml(String(d.hostname || ""))}</code>`);
    lines.push(`• <b>Issuer:</b> ${escapeHtml(String(d.issuerOrg || ""))}`);
    lines.push(`• <b>Protocol:</b> <code>${escapeHtml(String(d.tlsProtocol || ""))}</code>`);
    lines.push(`• <b>Days Remaining:</b> <b>${escapeHtml(String(d.daysRemaining ?? "?"))}</b>`);
  } else if (result.toolId === "hash_generator") {
    const digests = (d.digests as Record<string, string>) || {};
    lines.push(`• <b>SHA-256:</b>\n<code>${escapeHtml(digests.sha256 || "")}</code>`);
    lines.push(`• <b>SHA-512:</b>\n<code>${escapeHtml((digests.sha512 || "").slice(0, 64))}...</code>`);
  } else {
    const jsonSnippet = JSON.stringify(d, null, 2).slice(0, 1800);
    lines.push(`<pre>${escapeHtml(jsonSnippet)}</pre>`);
  }

  return lines.join("\n").slice(0, 3950);
}
