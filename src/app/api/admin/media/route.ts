import { NextResponse } from "next/server";
import { loadZeroTraceConfig, mutateZeroTraceConfig } from "@/lib/github-storage";
import { verifyAdminApiRequest } from "@/lib/security/auth";
import { validatePublicTargetUrl } from "@/lib/security/ssrf";
import { recordSecurityEvent } from "@/lib/security/telemetry";
import {
  escapeHtml,
  sanitizePlainText,
  validateMediaConstraints,
} from "@/lib/security/validation";
import {
  isTelegramConfigured,
  sendMediaItemToChat,
  uploadDirectBufferToTelegramChat,
} from "@/lib/telegram";
import type { MediaType } from "@/types/zero-trace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const file = form.get("file");
      const mediaTypeRaw = String(form.get("type") || "video") as MediaType;
      const mediaType: MediaType = ["video", "photo", "document"].includes(mediaTypeRaw)
        ? mediaTypeRaw
        : "document";
      const targetChatId = sanitizePlainText(form.get("chatId"), 64);
      const title = sanitizePlainText(form.get("title"), 120) || "ZERO TRACE Media";

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No media file selected." }, { status: 400 });
      }

      const sizeValidation = validateMediaConstraints({
        type: mediaType,
        fileSizeBytes: file.size,
        mimeType: file.type,
        deliveryMethod: "upload",
      });

      if (!sizeValidation.valid) {
        return NextResponse.json({ error: sizeValidation.error }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const storageUrl = process.env.MEDIA_STORAGE_URL?.trim() || "";
      const storageToken = process.env.MEDIA_STORAGE_TOKEN?.trim() || "";

      let uploadedExternalUrl = "";
      let telegramFileId = "";

      if (storageUrl && storageToken) {
        const safeCheck = await validatePublicTargetUrl(storageUrl, {
          requireHttps: true,
          skipDnsLookup: true,
        });
        if (!safeCheck.valid || !safeCheck.normalizedUrl) {
          return NextResponse.json({ error: "Configured MEDIA_STORAGE_URL is invalid." }, { status: 500 });
        }

        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const targetEndpoint = `${safeCheck.normalizedUrl.replace(/\/$/, "")}/${Date.now()}_${safeFileName}`;

        const putRes = await fetch(targetEndpoint, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${storageToken}`,
            "Content-Type": file.type || "application/octet-stream",
            "x-add-random-suffix": "1",
          },
          body: new Uint8Array(buffer),
          signal: AbortSignal.timeout(25_000),
        });

        if (!putRes.ok) {
          return NextResponse.json(
            { error: `External media storage returned HTTP ${putRes.status}.` },
            { status: 502 }
          );
        }

        const resContentType = putRes.headers.get("content-type") || "";
        if (resContentType.includes("application/json")) {
          const json = (await putRes.json()) as { url?: string; downloadUrl?: string };
          uploadedExternalUrl = json.url || json.downloadUrl || targetEndpoint;
        } else {
          uploadedExternalUrl = targetEndpoint;
        }
      }

      if (targetChatId && isTelegramConfigured()) {
        const tgUpload = await uploadDirectBufferToTelegramChat({
          chatId: targetChatId,
          type: mediaType,
          buffer,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          caption: `<b>${escapeHtml(title)}</b>`,
        });
        if (!tgUpload.ok) {
          return NextResponse.json(
            { error: tgUpload.description || "Telegram upload failed." },
            { status: 400 }
          );
        }
        telegramFileId = tgUpload.fileId || "";
      }

      if (!uploadedExternalUrl && !telegramFileId) {
        return NextResponse.json(
          {
            error:
              "Configure MEDIA_STORAGE_URL + MEDIA_STORAGE_TOKEN in Environment Variables for external cloud storage, or provide a Telegram Chat ID with TELEGRAM_BOT_TOKEN to register a Telegram file_id.",
          },
          { status: 400 }
        );
      }

      recordSecurityEvent({
        category: "MEDIA",
        severity: "info",
        action: "media.upload_complete",
        actor: auth.session.email,
        status: "success",
        details: `Uploaded ${mediaType} (${Math.round(file.size / 1024)} KB).`,
      });

      return NextResponse.json({
        ok: true,
        externalUrl: uploadedExternalUrl,
        telegramFileId,
        mimeType: file.type,
        fileSizeBytes: file.size,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Media upload error.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  try {
    const body = (await request.json()) as {
      action?: "send_test";
      mediaId?: string;
      chatId?: string;
    };

    if (body.action === "send_test" && body.mediaId && body.chatId) {
      if (!isTelegramConfigured()) {
        return NextResponse.json(
          { error: "TELEGRAM_BOT_TOKEN is not configured on the server." },
          { status: 400 }
        );
      }

      const { config } = await loadZeroTraceConfig();
      const item = config.media.find((m) => m.id === body.mediaId);
      if (!item) {
        return NextResponse.json({ error: "Media item not found." }, { status: 404 });
      }

      const res = await sendMediaItemToChat({
        chatId: body.chatId.trim(),
        media: item,
        lang: config.botProfile.defaultLanguage || "ar",
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: res.description || "Failed to send media via Telegram." },
          { status: 400 }
        );
      }

      if (res.fileId && !item.telegramFileId) {
        await mutateZeroTraceConfig({
          actor: auth.session.email,
          reason: "media.cache_telegram_file_id",
          mutator: (draft) => {
            const target = draft.media.find((m) => m.id === item.id);
            if (target) {
              target.telegramFileId = res.fileId;
            }
            return draft;
          },
        });
      }

      recordSecurityEvent({
        category: "MEDIA",
        severity: "info",
        action: "media.telegram_send",
        actor: auth.session.email,
        status: "success",
        details: `Delivered ${item.type} "${item.titleEn || item.titleAr}" to chat ${body.chatId}.`,
      });

      return NextResponse.json({
        ok: true,
        fileId: res.fileId,
      });
    }

    return NextResponse.json({ error: "Invalid media operation." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Media operation failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
