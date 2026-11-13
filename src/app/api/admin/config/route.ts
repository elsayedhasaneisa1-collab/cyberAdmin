import { NextResponse } from "next/server";
import { loadZeroTraceConfig, mutateZeroTraceConfig } from "@/lib/github-storage";
import { verifyAdminApiRequest } from "@/lib/security/auth";
import { checkRateLimit, extractClientIp } from "@/lib/security/rate-limit";
import { validatePublicTargetUrl } from "@/lib/security/ssrf";
import {
  sanitizePlainText,
  sanitizeRichTelegramHtml,
  TELEGRAM_LIMITS,
  validateBotCommandName,
} from "@/lib/security/validation";
import type {
  ApiServiceEntry,
  BotButtonItem,
  BotCommandItem,
  CategoryItem,
  MediaItem,
  ZeroTraceConfig,
} from "@/types/zero-trace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: false });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const { config, syncState } = await loadZeroTraceConfig({ forceRefresh });
  return NextResponse.json({
    ok: true,
    config,
    syncState,
  });
}

async function sanitizeIncomingButtons(buttons: BotButtonItem[]): Promise<BotButtonItem[]> {
  const clean: BotButtonItem[] = [];
  for (const b of buttons.slice(0, 120)) {
    let validUrl: string | undefined;
    if (b.type === "url" && b.url) {
      const urlCheck = await validatePublicTargetUrl(b.url, { skipDnsLookup: true });
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        throw new Error(`Invalid button URL (${b.labelEn || b.labelAr}): ${urlCheck.reason}`);
      }
      validUrl = urlCheck.normalizedUrl;
    }

    clean.push({
      id: sanitizePlainText(b.id, 64) || `btn_${Date.now()}`,
      labelAr: sanitizePlainText(b.labelAr, 64) || "زر",
      labelEn: sanitizePlainText(b.labelEn, 64) || "Button",
      type: ["submenu", "url", "tool", "media", "text"].includes(b.type) ? b.type : "text",
      parentId: b.parentId ? sanitizePlainText(b.parentId, 64) : null,
      categoryId: b.categoryId ? sanitizePlainText(b.categoryId, 64) : null,
      row: Math.max(0, Math.min(Number(b.row) || 0, 50)),
      order: Math.max(0, Math.min(Number(b.order) || 0, 50)),
      enabled: Boolean(b.enabled),
      url: validUrl,
      toolId: b.toolId,
      mediaId: b.mediaId ? sanitizePlainText(b.mediaId, 64) : undefined,
      responseTextAr: b.responseTextAr ? sanitizeRichTelegramHtml(b.responseTextAr, 3500) : undefined,
      responseTextEn: b.responseTextEn ? sanitizeRichTelegramHtml(b.responseTextEn, 3500) : undefined,
    });
  }
  return clean;
}

function sanitizeIncomingCommands(commands: BotCommandItem[]): BotCommandItem[] {
  return commands.slice(0, 100).map((c, idx) => {
    const cmdVal = validateBotCommandName(c.command);
    if (!cmdVal.valid || !cmdVal.command) {
      throw new Error(cmdVal.error || `Invalid command at index ${idx}`);
    }
    return {
      id: sanitizePlainText(c.id, 64) || `cmd_${idx}`,
      command: cmdVal.command,
      descriptionAr: sanitizePlainText(c.descriptionAr, 256) || cmdVal.command,
      descriptionEn: sanitizePlainText(c.descriptionEn, 256) || cmdVal.command,
      enabled: Boolean(c.enabled),
      linkedTool: c.linkedTool,
      responseTextAr: c.responseTextAr ? sanitizeRichTelegramHtml(c.responseTextAr, 3500) : undefined,
      responseTextEn: c.responseTextEn ? sanitizeRichTelegramHtml(c.responseTextEn, 3500) : undefined,
    };
  });
}

function sanitizeIncomingCategories(categories: CategoryItem[]): CategoryItem[] {
  return categories.slice(0, 50).map((cat, idx) => ({
    id: sanitizePlainText(cat.id, 64) || `cat_${idx}`,
    nameAr: sanitizePlainText(cat.nameAr, 80) || "قسم",
    nameEn: sanitizePlainText(cat.nameEn, 80) || "Category",
    descriptionAr: sanitizePlainText(cat.descriptionAr, 300),
    descriptionEn: sanitizePlainText(cat.descriptionEn, 300),
    icon: sanitizePlainText(cat.icon, 40) || "Folder",
    order: Math.max(0, Math.min(Number(cat.order) || idx, 100)),
    enabled: Boolean(cat.enabled),
  }));
}

async function sanitizeIncomingMedia(mediaList: MediaItem[]): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  for (const m of mediaList.slice(0, 200)) {
    let checkedUrl = "";
    if (m.externalUrl && m.externalUrl.trim()) {
      const check = await validatePublicTargetUrl(m.externalUrl, {
        requireHttps: true,
        skipDnsLookup: true,
      });
      if (!check.valid || !check.normalizedUrl) {
        throw new Error(`Invalid external media URL (${m.titleEn || m.titleAr}): ${check.reason}`);
      }
      checkedUrl = check.normalizedUrl;
    }

    if (!checkedUrl && !m.telegramFileId?.trim()) {
      throw new Error(`Media item "${m.titleEn || m.titleAr}" requires a valid HTTPS external URL or Telegram file_id.`);
    }

    out.push({
      id: sanitizePlainText(m.id, 64) || `med_${Date.now()}`,
      titleAr: sanitizePlainText(m.titleAr, 140) || "ملف تعليمي",
      titleEn: sanitizePlainText(m.titleEn, 140) || "Educational Media",
      descriptionAr: sanitizePlainText(m.descriptionAr, TELEGRAM_LIMITS.CAPTION_MAX_CHARS),
      descriptionEn: sanitizePlainText(m.descriptionEn, TELEGRAM_LIMITS.CAPTION_MAX_CHARS),
      type: ["video", "photo", "document"].includes(m.type) ? m.type : "document",
      categoryId: m.categoryId ? sanitizePlainText(m.categoryId, 64) : null,
      linkedButtonId: m.linkedButtonId ? sanitizePlainText(m.linkedButtonId, 64) : null,
      externalUrl: checkedUrl,
      telegramFileId: m.telegramFileId ? sanitizePlainText(m.telegramFileId, 200) : undefined,
      mimeType: sanitizePlainText(m.mimeType, 80),
      fileSizeBytes: Math.max(0, Number(m.fileSizeBytes) || 0),
      published: Boolean(m.published),
      createdAt: sanitizePlainText(m.createdAt, 40) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return out;
}

async function sanitizeIncomingApis(apis: ApiServiceEntry[]): Promise<ApiServiceEntry[]> {
  const out: ApiServiceEntry[] = [];
  for (const api of apis.slice(0, 100)) {
    if (api.docsUrl) {
      const docCheck = await validatePublicTargetUrl(api.docsUrl, {
        requireHttps: true,
        skipDnsLookup: true,
      });
      if (!docCheck.valid) {
        throw new Error(`Invalid official docs URL for ${api.name}`);
      }
    }

    out.push({
      id: sanitizePlainText(api.id, 64) || `api_${Date.now()}`,
      name: sanitizePlainText(api.name, 100) || "API Service",
      category: api.category,
      endpointPattern: sanitizePlainText(api.endpointPattern, 260),
      probeUrl: sanitizePlainText(api.probeUrl, 260),
      docsUrl: sanitizePlainText(api.docsUrl, 260),
      requiresKey: Boolean(api.requiresKey),
      envKeyName: api.envKeyName
        ? sanitizePlainText(api.envKeyName, 64).replace(/[^A-Z0-9_]/gi, "").toUpperCase()
        : undefined,
      freeTierLimit: sanitizePlainText(api.freeTierLimit, 200),
      termsSummaryAr: sanitizePlainText(api.termsSummaryAr, 300),
      termsSummaryEn: sanitizePlainText(api.termsSummaryEn, 300),
      enabled: Boolean(api.enabled),
      verifiedSource: sanitizePlainText(api.verifiedSource, 120),
      lastStatus: api.lastStatus || "untested",
      lastLatencyMs: api.lastLatencyMs,
      lastCheckedAt: api.lastCheckedAt,
    });
  }
  return out;
}

export async function PUT(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = extractClientIp(request);
  const rate = checkRateLimit(`admin_config_put:${ip}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many configuration updates." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json()) as {
      section?: string;
      expectedSha?: string | null;
      strictShaMatch?: boolean;
      patch?: Partial<ZeroTraceConfig>;
    };

    if (!body.patch || typeof body.patch !== "object") {
      return NextResponse.json({ error: "Missing configuration patch object." }, { status: 400 });
    }

    const patch = body.patch;
    const sanitizedButtons = patch.buttons ? await sanitizeIncomingButtons(patch.buttons) : undefined;
    const sanitizedCommands = patch.commands ? sanitizeIncomingCommands(patch.commands) : undefined;
    const sanitizedCategories = patch.categories
      ? sanitizeIncomingCategories(patch.categories)
      : undefined;
    const sanitizedMedia = patch.media ? await sanitizeIncomingMedia(patch.media) : undefined;
    const sanitizedApis = patch.apis ? await sanitizeIncomingApis(patch.apis) : undefined;

    const result = await mutateZeroTraceConfig({
      actor: auth.session.email,
      reason: sanitizePlainText(body.section || "config.update", 60),
      expectedSha: body.expectedSha,
      strictShaMatch: Boolean(body.strictShaMatch),
      mutator: (draft) => {
        if (patch.botProfile) {
          draft.botProfile = {
            displayNameAr: sanitizePlainText(
              patch.botProfile.displayNameAr,
              TELEGRAM_LIMITS.BOT_NAME_MAX_CHARS
            ),
            displayNameEn: sanitizePlainText(
              patch.botProfile.displayNameEn,
              TELEGRAM_LIMITS.BOT_NAME_MAX_CHARS
            ),
            shortDescriptionAr: sanitizePlainText(
              patch.botProfile.shortDescriptionAr,
              TELEGRAM_LIMITS.BOT_SHORT_DESC_MAX_CHARS
            ),
            shortDescriptionEn: sanitizePlainText(
              patch.botProfile.shortDescriptionEn,
              TELEGRAM_LIMITS.BOT_SHORT_DESC_MAX_CHARS
            ),
            descriptionAr: sanitizePlainText(
              patch.botProfile.descriptionAr,
              TELEGRAM_LIMITS.BOT_DESC_MAX_CHARS
            ),
            descriptionEn: sanitizePlainText(
              patch.botProfile.descriptionEn,
              TELEGRAM_LIMITS.BOT_DESC_MAX_CHARS
            ),
            welcomeMessageAr: sanitizeRichTelegramHtml(patch.botProfile.welcomeMessageAr, 3800),
            welcomeMessageEn: sanitizeRichTelegramHtml(patch.botProfile.welcomeMessageEn, 3800),
            helpMessageAr: sanitizeRichTelegramHtml(patch.botProfile.helpMessageAr, 3800),
            helpMessageEn: sanitizeRichTelegramHtml(patch.botProfile.helpMessageEn, 3800),
            defaultLanguage: patch.botProfile.defaultLanguage === "en" ? "en" : "ar",
          };
        }

        if (patch.botFeatures) {
          draft.botFeatures = {
            botEnabled: Boolean(patch.botFeatures.botEnabled),
            maintenanceMode: Boolean(patch.botFeatures.maintenanceMode),
            inlineMenuEnabled: Boolean(patch.botFeatures.inlineMenuEnabled),
            cyberToolsEnabled: Boolean(patch.botFeatures.cyberToolsEnabled),
            mediaDeliveryEnabled: Boolean(patch.botFeatures.mediaDeliveryEnabled),
            antiSpamEnabled: Boolean(patch.botFeatures.antiSpamEnabled),
            maxRequestsPerMinutePerUser: Math.max(
              3,
              Math.min(Number(patch.botFeatures.maxRequestsPerMinutePerUser) || 15, 120)
            ),
          };
        }

        if (sanitizedCommands) draft.commands = sanitizedCommands;
        if (sanitizedCategories) draft.categories = sanitizedCategories;
        if (sanitizedButtons) draft.buttons = sanitizedButtons;
        if (sanitizedMedia) {
          draft.media = sanitizedMedia;
          for (const med of sanitizedMedia) {
            if (med.linkedButtonId) {
              const linkedBtn = draft.buttons.find((b) => b.id === med.linkedButtonId);
              if (linkedBtn) {
                linkedBtn.type = "media";
                linkedBtn.mediaId = med.id;
              }
            }
          }
        }
        if (sanitizedApis) draft.apis = sanitizedApis;

        if (patch.settings) {
          draft.settings = {
            platformTitle:
              sanitizePlainText(patch.settings.platformTitle, 100) ||
              "ZERO TRACE — ELITE CYBER INTELLIGENCE SYSTEM",
            defaultLocale: patch.settings.defaultLocale === "en" ? "en" : "ar",
            authorizedScopeNoticeAr: sanitizePlainText(patch.settings.authorizedScopeNoticeAr, 400),
            authorizedScopeNoticeEn: sanitizePlainText(patch.settings.authorizedScopeNoticeEn, 400),
            telegramChannelUrl: sanitizePlainText(patch.settings.telegramChannelUrl, 200),
            githubPublicUrl: sanitizePlainText(patch.settings.githubPublicUrl, 200),
            apiRateLimitPerMinute: Math.max(
              5,
              Math.min(Number(patch.settings.apiRateLimitPerMinute) || 40, 300)
            ),
            strictSsrfProtection: patch.settings.strictSsrfProtection !== false,
          };
        }

        return draft;
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          conflict: Boolean(result.conflict),
          error: result.error || "Failed to persist configuration.",
          config: result.config,
          syncState: result.syncState,
        },
        { status: result.conflict ? 409 : 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      config: result.config,
      syncState: result.syncState,
    });
  } catch (err) {
    const safeMsg = err instanceof Error ? err.message : "Invalid configuration payload.";
    return NextResponse.json({ error: safeMsg }, { status: 400 });
  }
}
