import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  createSignedSessionToken,
  getServerSession,
  isAdminAuthConfigured,
  SESSION_COOKIE_NAME,
  verifyAdminApiRequest,
  verifyAdminCredentialsInput,
  verifyPasswordAgainstHash,
} from "@/lib/security/auth";
import { checkRateLimit, extractClientIp } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/telemetry";
import { sanitizePlainText } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const authEnforced = isAdminAuthConfigured();
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      authEnforced,
    });
  }

  return NextResponse.json({
    authenticated: true,
    authEnforced,
    email: session.email,
    mode: session.mode,
    csrfToken: session.csrfToken,
    expiresAt: new Date(session.exp).toISOString(),
  });
}

export async function POST(request: Request) {
  const ip = extractClientIp(request);
  const rate = checkRateLimit(`auth_login:${ip}`, 8, 60_000);
  if (!rate.allowed) {
    recordSecurityEvent({
      category: "SECURITY_BLOCK",
      severity: "critical",
      action: "auth.login_rate_limited",
      actor: ip,
      status: "blocked",
      details: `Login brute-force protection triggered. Retry in ${rate.retryAfterSeconds}s.`,
    });
    return NextResponse.json(
      { error: "Too many login attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      bootstrapSession?: boolean;
    };

    const authEnforced = isAdminAuthConfigured();

    if (!authEnforced && body.bootstrapSession === true) {
      const { token, payload } = createSignedSessionToken("setup-operator@local", "bootstrap");
      recordSecurityEvent({
        category: "AUTH",
        severity: "warning",
        action: "auth.bootstrap_session_created",
        actor: ip,
        status: "success",
        details: "Bootstrap setup session started because ADMIN_EMAIL/ADMIN_PASSWORD_HASH are unset.",
      });

      const response = NextResponse.json({
        ok: true,
        authenticated: true,
        authEnforced: false,
        email: payload.email,
        mode: payload.mode,
        csrfToken: payload.csrfToken,
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8,
      });

      return response;
    }

    if (!authEnforced) {
      return NextResponse.json(
        {
          error:
            "ADMIN_EMAIL and ADMIN_PASSWORD_HASH are not configured yet. Configure them in Environment Variables or enter Setup Mode.",
        },
        { status: 400 }
      );
    }

    const email = sanitizePlainText(body.email, 160);
    const password = typeof body.password === "string" ? body.password.slice(0, 256) : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const emailMatches = verifyAdminCredentialsInput(email);
    const storedHash = process.env.ADMIN_PASSWORD_HASH?.trim() || "";
    const passwordMatches = await verifyPasswordAgainstHash(password, storedHash);

    if (!emailMatches || !passwordMatches) {
      await new Promise((r) => setTimeout(r, 200 + (randomBytes(1)[0] % 150)));
      recordSecurityEvent({
        category: "AUTH",
        severity: "warning",
        action: "auth.login_failed",
        actor: email || ip,
        status: "blocked",
        details: "Invalid administrator email or password hash verification failed.",
      });
      return NextResponse.json({ error: "Invalid administrator credentials." }, { status: 401 });
    }

    const { token, payload } = createSignedSessionToken(email.toLowerCase(), "enforced");
    recordSecurityEvent({
      category: "AUTH",
      severity: "info",
      action: "auth.login_success",
      actor: email.toLowerCase(),
      status: "success",
      details: "Administrator authenticated with verified password hash.",
    });

    const response = NextResponse.json({
      ok: true,
      authenticated: true,
      authEnforced: true,
      email: payload.email,
      mode: payload.mode,
      csrfToken: payload.csrfToken,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Malformed authentication request." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  recordSecurityEvent({
    category: "AUTH",
    severity: "info",
    action: "auth.logout",
    actor: auth.session.email,
    status: "success",
    details: "Administrator terminated session.",
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
