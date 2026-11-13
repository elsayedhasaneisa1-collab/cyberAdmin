import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { recordSecurityEvent } from "./telemetry";

export const SESSION_COOKIE_NAME = "zt_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const globalAuthRef = globalThis as unknown as {
  __zeroTraceEphemeralKey?: string;
};

function getRuntimeFallbackSecret(): string {
  if (!globalAuthRef.__zeroTraceEphemeralKey) {
    globalAuthRef.__zeroTraceEphemeralKey = randomBytes(32).toString("hex");
  }
  return globalAuthRef.__zeroTraceEphemeralKey;
}

export function isAdminAuthConfigured(): boolean {
  const email = process.env.ADMIN_EMAIL?.trim();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  return Boolean(email && hash);
}

function getSigningSecret(): Buffer {
  const configured = isAdminAuthConfigured();
  const material = configured
    ? [
        "zt-prod-v1",
        process.env.ADMIN_EMAIL?.trim() || "",
        process.env.ADMIN_PASSWORD_HASH?.trim() || "",
        process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "",
      ].join("::")
    : ["zt-bootstrap-v1", getRuntimeFallbackSecret()].join("::");

  return createHash("sha256").update(material).digest();
}

function safeCompareStrings(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB) && a.length === b.length;
}

export async function verifyPasswordAgainstHash(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  const trimmed = storedHash.trim();
  if (!trimmed || !plainPassword) return false;

  if (trimmed.startsWith("$2a$") || trimmed.startsWith("$2b$") || trimmed.startsWith("$2y$")) {
    return bcrypt.compare(plainPassword, trimmed);
  }

  if (trimmed.startsWith("scrypt:")) {
    const parts = trimmed.split(":");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (salt.length === 0 || expected.length === 0) return false;
    const derived = scryptSync(plainPassword, salt, expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }

  const rawHex = trimmed.startsWith("sha256:") ? trimmed.slice(7) : trimmed;
  if (/^[a-fA-F0-9]{64}$/.test(rawHex)) {
    const digestHex = createHash("sha256").update(plainPassword, "utf8").digest("hex");
    return safeCompareStrings(digestHex.toLowerCase(), rawHex.toLowerCase());
  }

  return false;
}

export async function generateBcryptHash(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 12);
}

export interface AdminSessionPayload {
  email: string;
  mode: "enforced" | "bootstrap";
  csrfToken: string;
  iat: number;
  exp: number;
}

export function createSignedSessionToken(email: string, mode: "enforced" | "bootstrap"): {
  token: string;
  payload: AdminSessionPayload;
} {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    email,
    mode,
    csrfToken: randomBytes(24).toString("hex"),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifySignedSessionToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, providedSig] = token.split(".");
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");

  if (!safeCompareStrings(providedSig, expectedSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as AdminSessionPayload;

    if (!decoded || typeof decoded.exp !== "number" || Date.now() > decoded.exp) {
      return null;
    }

    if (isAdminAuthConfigured() && decoded.mode !== "enforced") {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySignedSessionToken(rawToken);
}

function readCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

export function verifyAdminApiRequest(
  request: Request,
  options?: { requireCsrf?: boolean }
): { authorized: true; session: AdminSessionPayload } | { authorized: false; status: number; error: string } {
  const rawToken = readCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  const session = verifySignedSessionToken(rawToken);

  if (!session) {
    recordSecurityEvent({
      category: "AUTH",
      severity: "warning",
      action: "api.unauthorized",
      actor: "unauthenticated",
      status: "blocked",
      details: `Unauthorized access blocked on ${new URL(request.url).pathname}`,
    });
    return {
      authorized: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  const method = request.method.toUpperCase();
  const needsCsrf = options?.requireCsrf ?? ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (needsCsrf) {
    const originHeader = request.headers.get("origin");
    const hostHeader = request.headers.get("host");
    if (originHeader && hostHeader) {
      try {
        const originHost = new URL(originHeader).host;
        if (originHost !== hostHeader) {
          recordSecurityEvent({
            category: "SECURITY_BLOCK",
            severity: "critical",
            action: "csrf.origin_mismatch",
            actor: session.email,
            status: "blocked",
            details: `Cross-origin mutation blocked (${originHost} != ${hostHeader}).`,
          });
          return {
            authorized: false,
            status: 403,
            error: "Cross-site request blocked by Origin policy.",
          };
        }
      } catch {
        return {
          authorized: false,
          status: 403,
          error: "Invalid Origin header.",
        };
      }
    }

    const csrfHeader = request.headers.get("x-csrf-token") || "";
    if (!csrfHeader || !safeCompareStrings(csrfHeader, session.csrfToken)) {
      recordSecurityEvent({
        category: "SECURITY_BLOCK",
        severity: "warning",
        action: "csrf.token_invalid",
        actor: session.email,
        status: "blocked",
        details: `Missing or invalid CSRF token on ${new URL(request.url).pathname}`,
      });
      return {
        authorized: false,
        status: 403,
        error: "Invalid or missing CSRF protection token.",
      };
    }
  }

  return { authorized: true, session };
}

export function verifyTelegramWebhookSecret(request: Request): {
  valid: boolean;
  reason?: string;
} {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return {
      valid: false,
      reason: "TELEGRAM_WEBHOOK_SECRET is not configured on the server.",
    };
  }

  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!incomingSecret || !safeCompareStrings(incomingSecret, configuredSecret)) {
    return {
      valid: false,
      reason: "Invalid X-Telegram-Bot-Api-Secret-Token header.",
    };
  }

  return { valid: true };
}

export function verifyAdminCredentialsInput(email: string): boolean {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim();
  if (!configuredEmail) return false;
  return safeCompareStrings(email.trim().toLowerCase(), configuredEmail.toLowerCase());
}
