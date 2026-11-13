import { NextResponse } from "next/server";
import { verifyTelegramWebhookSecret } from "@/lib/security/auth";
import { checkRateLimit, extractClientIp } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/telemetry";
import { handleTelegramWebhookUpdate, type TelegramUpdatePayload } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "ZERO TRACE Telegram Webhook Receiver",
    methodRequired: "POST",
    secretVerificationActive: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
  });
}

export async function POST(request: Request) {
  const ip = extractClientIp(request);
  const ipRate = checkRateLimit(`tg_webhook_ip:${ip}`, 180, 60_000);
  if (!ipRate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Webhook rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSeconds) } }
    );
  }

  const secretCheck = verifyTelegramWebhookSecret(request);
  if (!secretCheck.valid) {
    recordSecurityEvent({
      category: "SECURITY_BLOCK",
      severity: "critical",
      action: "webhook.secret_rejected",
      actor: ip,
      status: "blocked",
      details: secretCheck.reason || "Invalid webhook secret header.",
    });
    return NextResponse.json({ ok: false, error: "Unauthorized webhook request." }, { status: 401 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 256_000) {
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }

    const update = JSON.parse(rawBody) as TelegramUpdatePayload;
    const outcome = await handleTelegramWebhookUpdate(update);

    recordSecurityEvent({
      category: "WEBHOOK",
      severity: "info",
      action: `webhook.${outcome.action}`,
      actor: `update:${update.update_id}`,
      status: "success",
      details: outcome.duplicate
        ? `Duplicate Telegram update ${update.update_id} safely ignored.`
        : `Processed Telegram update ${update.update_id} (${outcome.action}).`,
    });

    return NextResponse.json({
      ok: true,
      duplicate: Boolean(outcome.duplicate),
      action: outcome.action,
    });
  } catch (err) {
    const safeMsg = err instanceof Error ? err.message : "Webhook processing failure.";
    recordSecurityEvent({
      category: "WEBHOOK",
      severity: "warning",
      action: "webhook.processing_error",
      actor: ip,
      status: "error",
      details: safeMsg,
    });
    return NextResponse.json({ ok: false, error: "Webhook payload rejected." }, { status: 400 });
  }
}
