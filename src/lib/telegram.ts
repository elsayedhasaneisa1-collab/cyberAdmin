import type {
  BotButtonItem,
  CyberToolId,
  Language,
  MediaItem,
  MediaType,
  ZeroTraceConfig,
} from "@/types/zero-trace";
import { executeCyberTool, formatToolResultForTelegram } from "./cyber-tools";
import { loadZeroTraceConfig } from "./github-storage";
import { checkRateLimit } from "./security/rate-limit";
import { validatePublicTargetUrl } from "./security/ssrf";
import { claimTelegramUpdateId, recordSecurityEvent } from "./security/telemetry";
import {
  escapeHtml,
  sanitizeRichTelegramHtml,
  TELEGRAM_LIMITS,
  validateMediaConstraints,
} from "./security/validation";

interface PendingToolSession {
  toolId: CyberToolId;
  lang: Language;
  expiresAt: number;
}

const globalBotState = globalThis as unknown as {
  __zeroTracePendingTools?: Map<number, PendingToolSession>;
  __zeroTraceChatLang?: Map<number, Language>;
};

function getPendingTools(): Map<number, PendingToolSession> {
  if (!globalBotState.__zeroTracePendingTools) {
    globalBotState.__zeroTracePendingTools = new Map<number, PendingToolSession>();
  }
  return globalBotState.__zeroTracePendingTools;
}

function getChatLangMap(): Map<number, Language> {
  if (!globalBotState.__zeroTraceChatLang) {
    globalBotState.__zeroTraceChatLang = new Map<number, Language>();
  }
  return globalBotState.__zeroTraceChatLang;
}

export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function isTelegramConfigured(): boolean {
  return Boolean(getTelegramBotToken());
}

async function callTelegramJson<T = unknown>(
  method: string,
  payload?: Record<string, unknown>,
  timeoutMs = 8000
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured in environment variables.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  return data;
}

export async function getTelegramBotMe() {
  return callTelegramJson<{
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    can_join_groups?: boolean;
  }>("getMe");
}

export async function getTelegramWebhookStatus() {
  return callTelegramJson<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
  }>("getWebhookInfo");
}

export async function registerTelegramWebhook(webhookUrl: string) {
  const check = await validatePublicTargetUrl(webhookUrl, {
    requireHttps: true,
    skipDnsLookup: true,
  });
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.reason || "Webhook URL must be a valid public HTTPS address.");
  }

  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secretToken) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET must be set in environment variables before registering webhook.");
  }

  return callTelegramJson<boolean>("setWebhook", {
    url: check.normalizedUrl,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
}

export async function removeTelegramWebhook() {
  return callTelegramJson<boolean>("deleteWebhook", {
    drop_pending_updates: false,
  });
}

export async function syncBotProfileToTelegram(config: ZeroTraceConfig): Promise<{
  ok: boolean;
  steps: Array<{ step: string; ok: boolean; detail?: string }>;
}> {
  const steps: Array<{ step: string; ok: boolean; detail?: string }> = [];

  const nameDefault = config.botProfile.displayNameEn.slice(0, TELEGRAM_LIMITS.BOT_NAME_MAX_CHARS);
  const nameAr = config.botProfile.displayNameAr.slice(0, TELEGRAM_LIMITS.BOT_NAME_MAX_CHARS);

  const rNameEn = await callTelegramJson("setMyName", { name: nameDefault });
  steps.push({ step: "setMyName (default)", ok: rNameEn.ok, detail: rNameEn.description });

  const rNameAr = await callTelegramJson("setMyName", { name: nameAr, language_code: "ar" });
  steps.push({ step: "setMyName (ar)", ok: rNameAr.ok, detail: rNameAr.description });

  const rDescEn = await callTelegramJson("setMyDescription", {
    description: config.botProfile.descriptionEn.slice(0, TELEGRAM_LIMITS.BOT_DESC_MAX_CHARS),
  });
  steps.push({ step: "setMyDescription (default)", ok: rDescEn.ok, detail: rDescEn.description });

  const rDescAr = await callTelegramJson("setMyDescription", {
    description: config.botProfile.descriptionAr.slice(0, TELEGRAM_LIMITS.BOT_DESC_MAX_CHARS),
    language_code: "ar",
  });
  steps.push({ step: "setMyDescription (ar)", ok: rDescAr.ok, detail: rDescAr.description });

  const rShortEn = await callTelegramJson("setMyShortDescription", {
    short_description: config.botProfile.shortDescriptionEn.slice(0, TELEGRAM_LIMITS.BOT_SHORT_DESC_MAX_CHARS),
  });
  steps.push({ step: "setMyShortDescription (default)", ok: rShortEn.ok, detail: rShortEn.description });

  const rShortAr = await callTelegramJson("setMyShortDescription", {
    short_description: config.botProfile.shortDescriptionAr.slice(0, TELEGRAM_LIMITS.BOT_SHORT_DESC_MAX_CHARS),
    language_code: "ar",
  });
  steps.push({ step: "setMyShortDescription (ar)", ok: rShortAr.ok, detail: rShortAr.description });

  const enabledCommands = config.commands.filter((c) => c.enabled);
  const commandsEn = enabledCommands.map((c) => ({
    command: c.command.toLowerCase().replace(/^\//, ""),
    description: (c.descriptionEn || c.descriptionAr).slice(0, 256),
  }));
  const commandsAr = enabledCommands.map((c) => ({
    command: c.command.toLowerCase().replace(/^\//, ""),
    description: (c.descriptionAr || c.descriptionEn).slice(0, 256),
  }));

  const rCmdEn = await callTelegramJson("setMyCommands", { commands: commandsEn });
  steps.push({ step: "setMyCommands (default)", ok: rCmdEn.ok, detail: rCmdEn.description });

  const rCmdAr = await callTelegramJson("setMyCommands", {
    commands: commandsAr,
    language_code: "ar",
  });
  steps.push({ step: "setMyCommands (ar)", ok: rCmdAr.ok, detail: rCmdAr.description });

  return {
    ok: steps.every((s) => s.ok),
    steps,
  };
}

export async function uploadBotProfilePhotoToTelegram(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ ok: boolean; description?: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  if (!["image/jpeg", "image/png"].includes(params.mimeType.toLowerCase())) {
    throw new Error("Telegram profile photos must be static JPEG or PNG images.");
  }

  if (params.buffer.byteLength > TELEGRAM_LIMITS.UPLOAD_PHOTO_MAX_BYTES) {
    throw new Error("Profile photo exceeds Telegram 10 MB photo upload limit.");
  }

  const form = new FormData();
  form.append(
    "photo",
    JSON.stringify({
      type: "static",
      photo: "attach://profile_photo_asset",
    })
  );
  const uint8 = new Uint8Array(params.buffer);
  const blob = new Blob([uint8], { type: params.mimeType });
  form.append("profile_photo_asset", blob, params.fileName || "avatar.jpg");

  const response = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(12_000),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };
  return data;
}

export function buildInlineKeyboardRows(
  buttons: BotButtonItem[],
  parentId: string | null,
  lang: Language
): Array<Array<{ text: string; url?: string; callback_data?: string }>> {
  const filtered = buttons
    .filter((b) => b.enabled && (b.parentId || null) === parentId)
    .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.order - b.order));

  const grouped = new Map<number, BotButtonItem[]>();
  for (const btn of filtered) {
    const rowItems = grouped.get(btn.row) || [];
    rowItems.push(btn);
    grouped.set(btn.row, rowItems);
  }

  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
  for (const [, rowBtns] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    const row = rowBtns.map((btn) => {
      const label = (lang === "ar" ? btn.labelAr : btn.labelEn) || btn.labelAr || btn.labelEn;
      if (btn.type === "url" && btn.url && /^https?:\/\//i.test(btn.url)) {
        return { text: label, url: btn.url };
      }
      if (btn.type === "submenu") {
        return { text: label, callback_data: `menu:${btn.id}`.slice(0, 64) };
      }
      return { text: label, callback_data: `btn:${btn.id}`.slice(0, 64) };
    });
    if (row.length > 0) rows.push(row);
  }

  if (parentId !== null) {
    const parentBtn = buttons.find((b) => b.id === parentId);
    const backTarget = parentBtn?.parentId ? `menu:${parentBtn.parentId}` : "root";
    rows.push([
      {
        text: lang === "ar" ? "⬅️ رجوع للقائمة السابقة" : "⬅️ Back to Menu",
        callback_data: backTarget,
      },
    ]);
  } else {
    rows.push([
      {
        text: lang === "ar" ? "🌐 English" : "🌐 العربية",
        callback_data: lang === "ar" ? "lang:en" : "lang:ar",
      },
    ]);
  }

  return rows;
}

export async function sendMediaItemToChat(params: {
  chatId: number | string;
  media: MediaItem;
  lang: Language;
}): Promise<{ ok: boolean; fileId?: string; description?: string }> {
  const { chatId, media, lang } = params;
  const title = lang === "ar" ? media.titleAr : media.titleEn || media.titleAr;
  const desc = lang === "ar" ? media.descriptionAr : media.descriptionEn || media.descriptionAr;
  const caption = `<b>${escapeHtml(title)}</b>\n${escapeHtml(desc)}`.slice(
    0,
    TELEGRAM_LIMITS.CAPTION_MAX_CHARS
  );

  const methodMap: Record<MediaType, { method: string; field: string }> = {
    video: { method: "sendVideo", field: "video" },
    photo: { method: "sendPhoto", field: "photo" },
    document: { method: "sendDocument", field: "document" },
  };

  const spec = methodMap[media.type];

  if (media.telegramFileId && media.telegramFileId.trim()) {
    const resp = await callTelegramJson<Record<string, unknown>>(spec.method, {
      chat_id: chatId,
      [spec.field]: media.telegramFileId.trim(),
      caption,
      parse_mode: "HTML",
    });
    return { ok: resp.ok, fileId: media.telegramFileId, description: resp.description };
  }

  const sizeCheck = validateMediaConstraints({
    type: media.type,
    fileSizeBytes: media.fileSizeBytes || 0,
    mimeType: media.mimeType || "",
    deliveryMethod: "url",
  });
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.error);
  }

  const urlCheck = await validatePublicTargetUrl(media.externalUrl, { requireHttps: true });
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    throw new Error(urlCheck.reason || "Invalid external media URL.");
  }

  const resp = await callTelegramJson<Record<string, unknown>>(
    spec.method,
    {
      chat_id: chatId,
      [spec.field]: urlCheck.normalizedUrl,
      caption,
      parse_mode: "HTML",
    },
    14_000
  );

  let returnedFileId: string | undefined;
  const resultObj = resp.result || {};
  if (media.type === "video" && resultObj.video && typeof resultObj.video === "object") {
    returnedFileId = (resultObj.video as { file_id?: string }).file_id;
  } else if (media.type === "document" && resultObj.document && typeof resultObj.document === "object") {
    returnedFileId = (resultObj.document as { file_id?: string }).file_id;
  } else if (media.type === "photo" && Array.isArray(resultObj.photo) && resultObj.photo.length > 0) {
    const largest = resultObj.photo[resultObj.photo.length - 1] as { file_id?: string };
    returnedFileId = largest?.file_id;
  }

  return { ok: resp.ok, fileId: returnedFileId, description: resp.description };
}

export async function uploadDirectBufferToTelegramChat(params: {
  chatId: string | number;
  type: MediaType;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  caption: string;
}): Promise<{ ok: boolean; fileId?: string; description?: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const constraint = validateMediaConstraints({
    type: params.type,
    fileSizeBytes: params.buffer.byteLength,
    mimeType: params.mimeType,
    deliveryMethod: "upload",
  });
  if (!constraint.valid) {
    throw new Error(constraint.error);
  }

  const methodMap: Record<MediaType, { method: string; field: string }> = {
    video: { method: "sendVideo", field: "video" },
    photo: { method: "sendPhoto", field: "photo" },
    document: { method: "sendDocument", field: "document" },
  };
  const spec = methodMap[params.type];

  const form = new FormData();
  form.append("chat_id", String(params.chatId));
  form.append("caption", params.caption.slice(0, TELEGRAM_LIMITS.CAPTION_MAX_CHARS));
  form.append("parse_mode", "HTML");
  const uint8 = new Uint8Array(params.buffer);
  form.append(spec.field, new Blob([uint8], { type: params.mimeType }), params.fileName);

  const response = await fetch(`https://api.telegram.org/bot${token}/${spec.method}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(25_000),
  });

  const data = (await response.json()) as {
    ok: boolean;
    result?: Record<string, unknown>;
    description?: string;
  };

  let fileId: string | undefined;
  const r = data.result || {};
  if (params.type === "video" && r.video && typeof r.video === "object") {
    fileId = (r.video as { file_id?: string }).file_id;
  } else if (params.type === "document" && r.document && typeof r.document === "object") {
    fileId = (r.document as { file_id?: string }).file_id;
  } else if (params.type === "photo" && Array.isArray(r.photo) && r.photo.length > 0) {
    fileId = (r.photo[r.photo.length - 1] as { file_id?: string })?.file_id;
  }

  return { ok: data.ok, fileId, description: data.description };
}

function getToolPromptMessage(toolId: CyberToolId, lang: Language): string {
  const prompts: Record<CyberToolId, { ar: string; en: string }> = {
    ip_info: {
      ar: "📍 أرسل عنوان IP العام المراد فحصه (مثال: <code>1.1.1.1</code>):",
      en: "📍 Send the public IP address to inspect (e.g. <code>1.1.1.1</code>):",
    },
    dns_lookup: {
      ar: "🧭 أرسل اسم النطاق المصرح بفحص سجلات DNS له (مثال: <code>cloudflare.com</code>):",
      en: "🧭 Send the authorized domain name for DNS lookup (e.g. <code>cloudflare.com</code>):",
    },
    whois_lookup: {
      ar: "📋 أرسل النطاق أو عنوان IP لاستعلام RDAP الرسمي (مثال: <code>example.com</code>):",
      en: "📋 Send the domain or public IP for official RDAP lookup (e.g. <code>example.com</code>):",
    },
    ssl_checker: {
      ar: "🔒 أرسل اسم النطاق لفحص شهادة SSL/TLS (مثال: <code>github.com</code>):",
      en: "🔒 Send the domain name to inspect its SSL/TLS certificate (e.g. <code>github.com</code>):",
    },
    security_headers: {
      ar: "🧱 أرسل رابط الموقع المصرح بفحص ترويسات الأمان الخاصة به (مثال: <code>https://example.com</code>):",
      en: "🧱 Send the authorized URL to evaluate HTTP security headers (e.g. <code>https://example.com</code>):",
    },
    url_reputation: {
      ar: "🔎 أرسل الرابط المراد تقييم سمعته ومؤشراته الأمنية:",
      en: "🔎 Send the URL to evaluate structural and domain-age risk indicators:",
    },
    hash_generator: {
      ar: "🧬 أرسل النص المراد توليد بصمات SHA-256 وSHA-512 له:",
      en: "🧬 Send the text to generate SHA-256 and SHA-512 cryptographic digests:",
    },
    base64_codec: {
      ar: "🔄 أرسل النص لترميزه بصيغة Base64 وHex:",
      en: "🔄 Send the text to encode into Base64 and Hexadecimal:",
    },
    password_strength: {
      ar: "🔑 أرسل كلمة المرور لاختبار الإنتروبيا وفحص التسريبات بنموذج k-Anonymity الآمن:",
      en: "🔑 Send a password candidate for entropy and k-Anonymity breach verification:",
    },
    http_analyzer: {
      ar: "📡 أرسل رابط الموقع العام المصرح بفحص استجابة HTTP له:",
      en: "📡 Send the authorized public URL for HTTP response analysis:",
    },
    domain_info: {
      ar: "🏢 أرسل اسم النطاق للحصول على ملف النطاق الشامل (DNS + RDAP):",
      en: "🏢 Send the domain name for a combined DNS + RDAP profile:",
    },
    network_education: {
      ar: "🖧 أرسل نطاق CIDR مثل <code>192.168.1.0/24</code> أو اسم أمر Linux مثل <code>ssh</code>:",
      en: "🖧 Send an IPv4 CIDR like <code>192.168.1.0/24</code> or a Linux command like <code>ssh</code>:",
    },
    learning_center: {
      ar: "📚 جاري تحميل مركز التعلم السيبراني...",
      en: "📚 Loading Cybersecurity Learning Center...",
    },
  };

  return lang === "ar" ? prompts[toolId].ar : prompts[toolId].en;
}

export interface TelegramUpdatePayload {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string; language_code?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string; language_code?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

export async function handleTelegramWebhookUpdate(update: TelegramUpdatePayload): Promise<{
  handled: boolean;
  duplicate?: boolean;
  action: string;
}> {
  if (typeof update.update_id !== "number") {
    return { handled: false, action: "invalid_update_id" };
  }

  if (!claimTelegramUpdateId(update.update_id)) {
    return { handled: true, duplicate: true, action: "duplicate_ignored" };
  }

  const { config } = await loadZeroTraceConfig();

  if (!config.botFeatures.botEnabled) {
    return { handled: true, action: "bot_disabled" };
  }

  const chatId =
    update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  const userId = update.message?.from?.id ?? update.callback_query?.from.id ?? chatId;

  if (!chatId || !userId) {
    return { handled: false, action: "no_chat_context" };
  }

  const langMap = getChatLangMap();
  const lang: Language = langMap.get(chatId) || config.botProfile.defaultLanguage || "ar";

  if (config.botFeatures.antiSpamEnabled) {
    const rate = checkRateLimit(
      `tg_user:${userId}`,
      config.botFeatures.maxRequestsPerMinutePerUser || 15,
      60_000
    );
    if (!rate.allowed) {
      recordSecurityEvent({
        category: "SECURITY_BLOCK",
        severity: "warning",
        action: "telegram.rate_limit",
        actor: `tg:${userId}`,
        status: "blocked",
        details: `Telegram user throttled; retry in ${rate.retryAfterSeconds}s`,
      });
      if (update.callback_query) {
        await callTelegramJson("answerCallbackQuery", {
          callback_query_id: update.callback_query.id,
          text: lang === "ar" ? "يرجى التمهل قليلاً قبل المحاولة مجددًا." : "Please wait a moment before sending more requests.",
          show_alert: false,
        });
      }
      return { handled: true, action: "rate_limited" };
    }
  }

  if (config.botFeatures.maintenanceMode) {
    if (isTelegramConfigured()) {
      await callTelegramJson("sendMessage", {
        chat_id: chatId,
        text:
          lang === "ar"
            ? "⚙️ النظام في وضع الصيانة المجدولة حاليًا. يرجى المحاولة لاحقًا."
            : "⚙️ ZERO TRACE is currently in scheduled maintenance mode.",
        parse_mode: "HTML",
      });
    }
    return { handled: true, action: "maintenance_mode" };
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || "";
    const msgId = cb.message?.message_id;

    if (isTelegramConfigured()) {
      await callTelegramJson("answerCallbackQuery", { callback_query_id: cb.id }).catch(() => null);
    }

    if (data === "lang:ar" || data === "lang:en") {
      const nextLang: Language = data === "lang:ar" ? "ar" : "en";
      langMap.set(chatId, nextLang);
      const welcomeText = sanitizeRichTelegramHtml(
        nextLang === "ar" ? config.botProfile.welcomeMessageAr : config.botProfile.welcomeMessageEn
      );
      const keyboard = config.botFeatures.inlineMenuEnabled
        ? buildInlineKeyboardRows(config.buttons, null, nextLang)
        : [];
      if (isTelegramConfigured() && msgId) {
        await callTelegramJson("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: welcomeText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
      return { handled: true, action: `switch_lang:${nextLang}` };
    }

    if (data === "root") {
      const welcomeText = sanitizeRichTelegramHtml(
        lang === "ar" ? config.botProfile.welcomeMessageAr : config.botProfile.welcomeMessageEn
      );
      const keyboard = config.botFeatures.inlineMenuEnabled
        ? buildInlineKeyboardRows(config.buttons, null, lang)
        : [];
      if (isTelegramConfigured() && msgId) {
        await callTelegramJson("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: welcomeText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
      return { handled: true, action: "menu_root" };
    }

    if (data.startsWith("menu:")) {
      const submenuId = data.slice(5);
      const targetBtn = config.buttons.find((b) => b.id === submenuId && b.enabled);
      if (targetBtn && isTelegramConfigured() && msgId) {
        const title = lang === "ar" ? targetBtn.labelAr : targetBtn.labelEn;
        const keyboard = buildInlineKeyboardRows(config.buttons, submenuId, lang);
        await callTelegramJson("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: `<b>${escapeHtml(title)}</b>\n${lang === "ar" ? "اختر من القائمة الفرعية:" : "Select an option below:"}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
      return { handled: true, action: `submenu:${submenuId}` };
    }

    if (data.startsWith("btn:")) {
      const btnId = data.slice(4);
      const btn = config.buttons.find((b) => b.id === btnId && b.enabled);
      if (!btn) return { handled: false, action: "button_not_found" };

      if (btn.type === "media" && btn.mediaId) {
        if (!config.botFeatures.mediaDeliveryEnabled) {
          return { handled: true, action: "media_disabled" };
        }
        const mediaItem = config.media.find((m) => m.id === btn.mediaId && m.published);
        if (mediaItem && isTelegramConfigured()) {
          await sendMediaItemToChat({ chatId, media: mediaItem, lang });
        }
        return { handled: true, action: `media:${btn.mediaId}` };
      }

      if (btn.type === "text") {
        const txt = sanitizeRichTelegramHtml(
          lang === "ar" ? btn.responseTextAr || btn.responseTextEn : btn.responseTextEn || btn.responseTextAr
        );
        if (txt && isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: txt,
            parse_mode: "HTML",
          });
        }
        return { handled: true, action: `text:${btn.id}` };
      }

      if (btn.type === "tool" && btn.toolId) {
        if (!config.botFeatures.cyberToolsEnabled) {
          return { handled: true, action: "tools_disabled" };
        }
        if (btn.toolId === "learning_center") {
          const result = await executeCyberTool({
            toolId: "learning_center",
            input: "live",
            actor: `tg:${userId}`,
          });
          if (isTelegramConfigured()) {
            await callTelegramJson("sendMessage", {
              chat_id: chatId,
              text: formatToolResultForTelegram(result, lang),
              parse_mode: "HTML",
            });
          }
          return { handled: true, action: "tool:learning_center" };
        }

        getPendingTools().set(chatId, {
          toolId: btn.toolId,
          lang,
          expiresAt: Date.now() + 1000 * 60 * 5,
        });

        if (isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: getToolPromptMessage(btn.toolId, lang),
            parse_mode: "HTML",
          });
        }
        return { handled: true, action: `prompt_tool:${btn.toolId}` };
      }
    }
  }

  if (update.message?.text) {
    const rawText = update.message.text.trim();
    const firstName = escapeHtml(update.message.from?.first_name || "Operator");

    if (rawText.startsWith("/")) {
      getPendingTools().delete(chatId);
      const parts = rawText.split(/\s+/);
      const cmdToken = (parts[0] || "").replace(/^\//, "").split("@")[0]?.toLowerCase() || "";
      const cmdArg = parts.slice(1).join(" ").trim();

      if (cmdToken === "start") {
        const welcomeRaw =
          lang === "ar" ? config.botProfile.welcomeMessageAr : config.botProfile.welcomeMessageEn;
        const personalized = sanitizeRichTelegramHtml(welcomeRaw.replace(/\{name\}/g, firstName));
        const keyboard = config.botFeatures.inlineMenuEnabled
          ? buildInlineKeyboardRows(config.buttons, null, lang)
          : [];
        if (isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: personalized,
            parse_mode: "HTML",
            reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
          });
        }
        return { handled: true, action: "cmd:start" };
      }

      if (cmdToken === "help") {
        const helpText = sanitizeRichTelegramHtml(
          lang === "ar" ? config.botProfile.helpMessageAr : config.botProfile.helpMessageEn
        );
        if (isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: helpText,
            parse_mode: "HTML",
          });
        }
        return { handled: true, action: "cmd:help" };
      }

      const matchedCmd = config.commands.find(
        (c) => c.enabled && c.command.toLowerCase() === cmdToken
      );

      if (matchedCmd) {
        if (matchedCmd.linkedTool && config.botFeatures.cyberToolsEnabled) {
          if (!cmdArg && matchedCmd.linkedTool !== "learning_center") {
            getPendingTools().set(chatId, {
              toolId: matchedCmd.linkedTool,
              lang,
              expiresAt: Date.now() + 1000 * 60 * 5,
            });
            if (isTelegramConfigured()) {
              await callTelegramJson("sendMessage", {
                chat_id: chatId,
                text: getToolPromptMessage(matchedCmd.linkedTool, lang),
                parse_mode: "HTML",
              });
            }
            return { handled: true, action: `cmd_prompt:${matchedCmd.command}` };
          }

          try {
            const res = await executeCyberTool({
              toolId: matchedCmd.linkedTool,
              input: cmdArg || "live",
              actor: `tg:${userId}`,
            });
            if (isTelegramConfigured()) {
              await callTelegramJson("sendMessage", {
                chat_id: chatId,
                text: formatToolResultForTelegram(res, lang),
                parse_mode: "HTML",
              });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Invalid input.";
            if (isTelegramConfigured()) {
              await callTelegramJson("sendMessage", {
                chat_id: chatId,
                text: `⚠️ ${escapeHtml(msg)}`,
                parse_mode: "HTML",
              });
            }
          }
          return { handled: true, action: `cmd_tool:${matchedCmd.command}` };
        }

        const customReply = sanitizeRichTelegramHtml(
          lang === "ar"
            ? matchedCmd.responseTextAr || matchedCmd.responseTextEn
            : matchedCmd.responseTextEn || matchedCmd.responseTextAr
        );
        if (customReply && isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: customReply,
            parse_mode: "HTML",
          });
        }
        return { handled: true, action: `cmd_custom:${matchedCmd.command}` };
      }
    }

    const pending = getPendingTools().get(chatId);
    if (pending && Date.now() <= pending.expiresAt && config.botFeatures.cyberToolsEnabled) {
      getPendingTools().delete(chatId);
      try {
        const res = await executeCyberTool({
          toolId: pending.toolId,
          input: rawText,
          actor: `tg:${userId}`,
        });
        if (isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: formatToolResultForTelegram(res, pending.lang),
            parse_mode: "HTML",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tool execution failed.";
        if (isTelegramConfigured()) {
          await callTelegramJson("sendMessage", {
            chat_id: chatId,
            text: `⚠️ ${escapeHtml(msg)}`,
            parse_mode: "HTML",
          });
        }
      }
      return { handled: true, action: `fulfilled_tool:${pending.toolId}` };
    }
  }

  return { handled: true, action: "noop" };
}
