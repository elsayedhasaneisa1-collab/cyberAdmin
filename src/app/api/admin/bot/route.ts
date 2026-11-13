import { NextResponse } from "next/server";
import { loadZeroTraceConfig } from "@/lib/github-storage";
import { verifyAdminApiRequest } from "@/lib/security/auth";
import { recordSecurityEvent } from "@/lib/security/telemetry";
import {
  getTelegramBotMe,
  getTelegramWebhookStatus,
  isTelegramConfigured,
  registerTelegramWebhook,
  removeTelegramWebhook,
  syncBotProfileToTelegram,
  uploadBotProfilePhotoToTelegram,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: false });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const configured = isTelegramConfigured();
  const webhookSecretConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim());
  const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || null;

  if (!configured) {
    return NextResponse.json({
      ok: true,
      tokenConfigured: false,
      webhookSecretConfigured,
      configuredUsername,
      botInfo: null,
      webhookInfo: null,
    });
  }

  try {
    const [meRes, hookRes] = await Promise.all([
      getTelegramBotMe(),
      getTelegramWebhookStatus(),
    ]);

    return NextResponse.json({
      ok: true,
      tokenConfigured: true,
      webhookSecretConfigured,
      configuredUsername,
      botInfo: meRes.ok ? meRes.result : null,
      botError: meRes.ok ? null : meRes.description,
      webhookInfo: hookRes.ok ? hookRes.result : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to reach Telegram Bot API.";
    return NextResponse.json({
      ok: false,
      tokenConfigured: true,
      webhookSecretConfigured,
      configuredUsername,
      botInfo: null,
      webhookInfo: null,
      error: msg,
    });
  }
}

export async function POST(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("photo");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Photo file is required." }, { status: 400 });
      }
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const res = await uploadBotProfilePhotoToTelegram({
        buffer,
        mimeType: file.type,
        fileName: file.name,
      });

      recordSecurityEvent({
        category: "BOT_SYNC",
        severity: res.ok ? "info" : "warning",
        action: "bot.set_profile_photo",
        actor: auth.session.email,
        status: res.ok ? "success" : "error",
        details: res.ok
          ? "Updated Telegram bot profile photo via official setMyProfilePhoto API."
          : res.description || "Telegram rejected profile photo.",
      });

      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.description || "Failed to update bot profile photo." },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Photo upload failed.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  try {
    const body = (await request.json()) as {
      action?: "sync_profile" | "set_webhook" | "delete_webhook";
      webhookUrl?: string;
    };

    if (body.action === "sync_profile") {
      const { config } = await loadZeroTraceConfig({ forceRefresh: true });
      const syncRes = await syncBotProfileToTelegram(config);
      recordSecurityEvent({
        category: "BOT_SYNC",
        severity: syncRes.ok ? "info" : "warning",
        action: "bot.sync_profile_commands",
        actor: auth.session.email,
        status: syncRes.ok ? "success" : "error",
        details: `Synced name, descriptions, and ${config.commands.filter((c) => c.enabled).length} commands to Telegram.`,
      });
      return NextResponse.json(syncRes);
    }

    if (body.action === "set_webhook") {
      const siteUrl =
        body.webhookUrl?.trim() ||
        (process.env.NEXT_PUBLIC_SITE_URL?.trim()
          ? `${process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "")}/api/telegram/webhook`
          : "");
      if (!siteUrl) {
        return NextResponse.json(
          { error: "Provide an HTTPS Webhook URL or set NEXT_PUBLIC_SITE_URL." },
          { status: 400 }
        );
      }
      const res = await registerTelegramWebhook(siteUrl);
      recordSecurityEvent({
        category: "BOT_SYNC",
        severity: res.ok ? "info" : "warning",
        action: "bot.set_webhook",
        actor: auth.session.email,
        status: res.ok ? "success" : "error",
        details: res.ok ? `Registered Telegram Webhook: ${siteUrl}` : res.description || "Webhook registration failed.",
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.description }, { status: 400 });
      }
      return NextResponse.json({ ok: true, webhookUrl: siteUrl });
    }

    if (body.action === "delete_webhook") {
      const res = await removeTelegramWebhook();
      recordSecurityEvent({
        category: "BOT_SYNC",
        severity: "warning",
        action: "bot.delete_webhook",
        actor: auth.session.email,
        status: res.ok ? "success" : "error",
        details: "Removed active Telegram Webhook.",
      });
      return NextResponse.json({ ok: res.ok, description: res.description });
    }

    return NextResponse.json({ error: "Unsupported bot action." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Telegram bot operation failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
