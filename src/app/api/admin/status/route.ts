import { NextResponse } from "next/server";
import { getGitHubEnvConfig, loadZeroTraceConfig } from "@/lib/github-storage";
import {
  isAdminAuthConfigured,
  verifyAdminApiRequest,
  verifyTelegramWebhookSecret,
} from "@/lib/security/auth";
import { isPrivateOrReservedIp, validatePublicTargetUrl } from "@/lib/security/ssrf";
import {
  clearRuntimeEvents,
  getTelemetrySnapshot,
  recordSecurityEvent,
} from "@/lib/security/telemetry";
import { escapeHtml } from "@/lib/security/validation";
import { isTelegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: false });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ghEnv = getGitHubEnvConfig();
  const { config, syncState } = await loadZeroTraceConfig();
  const telemetry = getTelemetrySnapshot();

  const envReadiness = [
    { key: "TELEGRAM_BOT_TOKEN", configured: isTelegramConfigured(), group: "Telegram" },
    {
      key: "TELEGRAM_WEBHOOK_SECRET",
      configured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
      group: "Telegram",
    },
    {
      key: "TELEGRAM_BOT_USERNAME",
      configured: Boolean(process.env.TELEGRAM_BOT_USERNAME?.trim()),
      group: "Telegram",
    },
    {
      key: "ADMIN_EMAIL",
      configured: Boolean(process.env.ADMIN_EMAIL?.trim()),
      group: "Security",
    },
    {
      key: "ADMIN_PASSWORD_HASH",
      configured: Boolean(process.env.ADMIN_PASSWORD_HASH?.trim()),
      group: "Security",
    },
    { key: "GITHUB_TOKEN", configured: Boolean(ghEnv.token), group: "GitHub Storage" },
    { key: "GITHUB_OWNER", configured: Boolean(ghEnv.owner), group: "GitHub Storage" },
    { key: "GITHUB_REPO", configured: Boolean(ghEnv.repo), group: "GitHub Storage" },
    {
      key: "GITHUB_CONFIG_PATH",
      configured: Boolean(process.env.GITHUB_CONFIG_PATH?.trim()),
      group: "GitHub Storage",
    },
    {
      key: "MEDIA_STORAGE_URL",
      configured: Boolean(process.env.MEDIA_STORAGE_URL?.trim()),
      group: "Media Storage",
    },
    {
      key: "MEDIA_STORAGE_TOKEN",
      configured: Boolean(process.env.MEDIA_STORAGE_TOKEN?.trim()),
      group: "Media Storage",
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      configured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
      group: "Platform",
    },
  ];

  return NextResponse.json({
    ok: true,
    authEnforced: isAdminAuthConfigured(),
    envReadiness,
    syncState,
    telemetry,
    summary: {
      enabledApisCount: config.apis.filter((a) => a.enabled).length,
      totalApisCount: config.apis.length,
      onlineApisCount: config.apis.filter((a) => a.lastStatus === "online").length,
      buttonsCount: config.buttons.length,
      categoriesCount: config.categories.length,
      mediaCount: config.media.length,
      lastConfigUpdatedAt: config.updatedAt,
      configRevision: config.revision,
    },
  });
}

export async function POST(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { action?: "run_security_self_test" | "clear_logs" };

    if (body.action === "clear_logs") {
      clearRuntimeEvents(auth.session.email);
      return NextResponse.json({ ok: true, telemetry: getTelemetrySnapshot() });
    }

    if (body.action === "run_security_self_test") {
      const loopbackBlocked = isPrivateOrReservedIp("127.0.0.1");
      const metadataBlocked = isPrivateOrReservedIp("169.254.169.254");
      const rfc1918Blocked = isPrivateOrReservedIp("10.0.0.8") && isPrivateOrReservedIp("192.168.1.1");
      const ipv6LoopbackBlocked = isPrivateOrReservedIp("::1") && isPrivateOrReservedIp("::ffff:127.0.0.1");
      const fileSchemeCheck = await validatePublicTargetUrl("file:///etc/passwd", { skipDnsLookup: true });
      const localhostUrlCheck = await validatePublicTargetUrl("http://localhost:3000/admin", {
        skipDnsLookup: true,
      });

      const xssSample = escapeHtml('<script>alert("xss")</script>');
      const xssEscaped = !xssSample.includes("<script>");

      const fakeWebhookReq = new Request("https://example.com/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "invalid_forged_token_test" },
      });
      const forgedWebhookCheck = verifyTelegramWebhookSecret(fakeWebhookReq);

      const auditChecks = [
        {
          id: "ssrf-ipv4-loopback",
          nameAr: "حظر عناوين Loopback وCloud Metadata (127.0.0.1 / 169.254.169.254)",
          nameEn: "SSRF Loopback & Cloud Metadata Guard (127.0.0.1 / 169.254.169.254)",
          passed: loopbackBlocked && metadataBlocked && rfc1918Blocked,
        },
        {
          id: "ssrf-ipv6-mapped",
          nameAr: "حظر عناوين IPv6 الداخلية وIPv4-Mapped IPv6",
          nameEn: "SSRF IPv6 & IPv4-Mapped Private Range Blocker",
          passed: ipv6LoopbackBlocked,
        },
        {
          id: "ssrf-scheme-localhost",
          nameAr: "رفض بروتوكولات file:// ونطاقات localhost الداخلية",
          nameEn: "Disallowed Scheme (file://) & Localhost Rejection",
          passed: !fileSchemeCheck.valid && !localhostUrlCheck.valid,
        },
        {
          id: "xss-output-encoding",
          nameAr: "تطهير وترميز المخرجات ضد XSS",
          nameEn: "Anti-XSS HTML Entity Output Sanitization",
          passed: xssEscaped,
        },
        {
          id: "webhook-forged-token",
          nameAr: "رفض طلبات Webhook المزورة بدون Secret Token صحيح",
          nameEn: "Forged Telegram Webhook Secret Rejection",
          passed: !forgedWebhookCheck.valid,
        },
        {
          id: "admin-env-hash",
          nameAr: "تفعيل مصادقة المدير عبر ADMIN_EMAIL وADMIN_PASSWORD_HASH",
          nameEn: "Production Admin Env Credential Enforcement",
          passed: isAdminAuthConfigured(),
          warningIfFalse: true,
        },
      ];

      recordSecurityEvent({
        category: "AUTH",
        severity: "info",
        action: "security.self_test_executed",
        actor: auth.session.email,
        status: "success",
        details: `Ran ${auditChecks.length} defensive verification tests.`,
      });

      return NextResponse.json({
        ok: true,
        executedAt: new Date().toISOString(),
        checks: auditChecks,
      });
    }

    return NextResponse.json({ error: "Unknown status action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to run status action." }, { status: 400 });
  }
}
