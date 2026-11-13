"use client";

import React, { useEffect, useState } from "react";
import {
  Bot,
  Camera,
  CheckCircle2,
  Plus,
  Save,
  Send,
  Trash2,
  Unlink,
  Webhook,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type {
  BotCommandItem,
  BotFeatureFlags,
  BotProfileSettings,
  CyberToolId,
} from "@/types/zero-trace";

const TOOL_OPTIONS: Array<{ id: CyberToolId; label: string }> = [
  { id: "ip_info", label: "IP Information" },
  { id: "dns_lookup", label: "DNS Lookup" },
  { id: "whois_lookup", label: "WHOIS / RDAP" },
  { id: "ssl_checker", label: "SSL Certificate Checker" },
  { id: "security_headers", label: "Security Headers Analyzer" },
  { id: "url_reputation", label: "URL Reputation Checker" },
  { id: "hash_generator", label: "Hash Generator" },
  { id: "base64_codec", label: "Base64 Codec" },
  { id: "password_strength", label: "Password Strength" },
  { id: "http_analyzer", label: "HTTP Response Analyzer" },
  { id: "domain_info", label: "Domain Information" },
  { id: "network_education", label: "Network & Linux Education" },
  { id: "learning_center", label: "Cyber Learning & CTF" },
];

export default function BotManagementPage() {
  const {
    lang,
    config,
    saving,
    botLive,
    saveConfigPatch,
    apiFetch,
    refreshAll,
    notify,
  } = useZeroTrace();

  const [profile, setProfile] = useState<BotProfileSettings>(config.botProfile);
  const [features, setFeatures] = useState<BotFeatureFlags>(config.botFeatures);
  const [commands, setCommands] = useState<BotCommandItem[]>(config.commands);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [syncingTelegram, setSyncingTelegram] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setProfile(config.botProfile);
    setFeatures(config.botFeatures);
    setCommands(config.commands);
  }, [config]);

  useEffect(() => {
    if (botLive?.webhookInfo?.url) {
      setWebhookUrl(botLive.webhookInfo.url);
    } else if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/telegram/webhook`);
    }
  }, [botLive]);

  const handleSaveAllBotSettings = async () => {
    await saveConfigPatch("bot.management", {
      botProfile: profile,
      botFeatures: features,
      commands,
    });
  };

  const handleSyncToTelegram = async () => {
    setSyncingTelegram(true);
    try {
      const saved = await saveConfigPatch("bot.sync_prepare", {
        botProfile: profile,
        botFeatures: features,
        commands,
      });
      if (!saved) return;

      const res = await apiFetch("/api/admin/bot", {
        method: "POST",
        body: JSON.stringify({ action: "sync_profile" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await refreshAll(false);
        notify(
          "success",
          lang === "ar"
            ? "تم تحديث اسم البوت والوصف وقائمة الأوامر مباشرة في خوادم تيليجرام!"
            : "Synced display name, descriptions, and commands directly to Telegram!"
        );
      } else {
        notify("error", data.error || "Telegram API sync reported an error.");
      }
    } finally {
      setSyncingTelegram(false);
    }
  };

  const handleSetWebhook = async () => {
    setSyncingTelegram(true);
    try {
      const res = await apiFetch("/api/admin/bot", {
        method: "POST",
        body: JSON.stringify({ action: "set_webhook", webhookUrl }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await refreshAll(false);
        notify(
          "success",
          lang === "ar"
            ? "تم ربط Webhook وتأمينه بـ Secret Token بنجاح."
            : "Webhook registered with Secret Token successfully."
        );
      } else {
        notify("error", data.error || "Failed to register webhook.");
      }
    } finally {
      setSyncingTelegram(false);
    }
  };

  const handleDeleteWebhook = async () => {
    setSyncingTelegram(true);
    try {
      const res = await apiFetch("/api/admin/bot", {
        method: "POST",
        body: JSON.stringify({ action: "delete_webhook" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await refreshAll(false);
        notify("info", lang === "ar" ? "تم إلغاء ربط Webhook." : "Webhook removed.");
      } else {
        notify("error", data.error || "Failed to delete webhook.");
      }
    } finally {
      setSyncingTelegram(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify(
        "error",
        lang === "ar"
          ? "حجم الصورة يتجاوز الحد الرسمي (10 ميجابايت)."
          : "Photo exceeds official 10 MB Telegram limit."
      );
      return;
    }

    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await apiFetch("/api/admin/bot", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        notify(
          "success",
          lang === "ar"
            ? "تم تحديث الصورة الشخصية للبوت عبر setMyProfilePhoto!"
            : "Bot profile photo updated via official setMyProfilePhoto!"
        );
      } else {
        notify("error", json.error || "Failed to update bot photo.");
      }
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const addCommand = () => {
    setCommands((prev) => [
      ...prev,
      {
        id: `cmd_${Date.now()}`,
        command: `custom_${prev.length + 1}`,
        descriptionAr: "أمر مخصص جديد",
        descriptionEn: "New custom command",
        enabled: true,
        responseTextAr: "مرحبًا بك في الأمر المخصص.",
        responseTextEn: "Custom command response.",
      },
    ]);
  };

  const updateCommand = (idx: number, patch: Partial<BotCommandItem>) => {
    setCommands((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCommand = (idx: number) => {
    setCommands((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            TELEGRAM BOT COMMANDER
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar" ? "إدارة البوت الكاملة" : "Complete Bot Management"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveAllBotSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88] transition hover:bg-[#00ff88]/20"
          >
            <Save className="h-4 w-4" />
            <span>{lang === "ar" ? "حفظ الإعدادات" : "Save Config"}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncToTelegram}
            disabled={syncingTelegram || !botLive?.tokenConfigured}
            className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          >
            <Send className="h-4 w-4" />
            <span>
              {syncingTelegram
                ? lang === "ar"
                  ? "جاري المزامنة..."
                  : "Syncing..."
                : lang === "ar"
                ? "مزامنة فورية مع Telegram API"
                : "Push Live to Telegram API"}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="cyber-glass rounded-2xl p-6 lg:col-span-7">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <Bot className="h-5 w-5 text-[#00ff88]" />
            <span>
              {lang === "ar" ? "الهوية والرسائل التفاعلية" : "Bot Identity & Core Messages"}
            </span>
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "اسم العرض (عربي)" : "Display Name (Arabic)"}
              </label>
              <input
                type="text"
                maxLength={64}
                value={profile.displayNameAr}
                onChange={(e) => setProfile({ ...profile, displayNameAr: e.target.value })}
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "اسم العرض (إنجليزي)" : "Display Name (English)"}
              </label>
              <input
                type="text"
                maxLength={64}
                value={profile.displayNameEn}
                onChange={(e) => setProfile({ ...profile, displayNameEn: e.target.value })}
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "الوصف المختصر (عربي)" : "Short Description (AR)"}
              </label>
              <input
                type="text"
                maxLength={120}
                value={profile.shortDescriptionAr}
                onChange={(e) => setProfile({ ...profile, shortDescriptionAr: e.target.value })}
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "الوصف المختصر (إنجليزي)" : "Short Description (EN)"}
              </label>
              <input
                type="text"
                maxLength={120}
                value={profile.shortDescriptionEn}
                onChange={(e) => setProfile({ ...profile, shortDescriptionEn: e.target.value })}
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "وصف البوت الكامل (عربي)" : "Full Description (AR)"}
              </label>
              <textarea
                rows={3}
                maxLength={512}
                value={profile.descriptionAr}
                onChange={(e) => setProfile({ ...profile, descriptionAr: e.target.value })}
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "وصف البوت الكامل (إنجليزي)" : "Full Description (EN)"}
              </label>
              <textarea
                rows={3}
                maxLength={512}
                value={profile.descriptionEn}
                onChange={(e) => setProfile({ ...profile, descriptionEn: e.target.value })}
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "رسالة الترحيب /start (عربي)" : "Welcome Message /start (AR)"}
              </label>
              <textarea
                rows={4}
                value={profile.welcomeMessageAr}
                onChange={(e) => setProfile({ ...profile, welcomeMessageAr: e.target.value })}
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "رسالة الترحيب /start (إنجليزي)" : "Welcome Message /start (EN)"}
              </label>
              <textarea
                rows={4}
                value={profile.welcomeMessageEn}
                onChange={(e) => setProfile({ ...profile, welcomeMessageEn: e.target.value })}
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "رسالة المساعدة /help (عربي)" : "Help Message /help (AR)"}
              </label>
              <textarea
                rows={4}
                value={profile.helpMessageAr}
                onChange={(e) => setProfile({ ...profile, helpMessageAr: e.target.value })}
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === "ar" ? "رسالة المساعدة /help (إنجليزي)" : "Help Message /help (EN)"}
              </label>
              <textarea
                rows={4}
                value={profile.helpMessageEn}
                onChange={(e) => setProfile({ ...profile, helpMessageEn: e.target.value })}
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="cyber-glass rounded-2xl p-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
              <Webhook className="h-5 w-5 text-[#00ff88]" />
              <span>{lang === "ar" ? "إدارة Webhook والصورة الرسمية" : "Webhook & Official Photo"}</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs text-slate-300">
                  {lang === "ar" ? "رابط HTTPS Webhook" : "HTTPS Webhook Endpoint"}
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="cyber-input font-mono-cyber w-full rounded-xl px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSetWebhook}
                  disabled={syncingTelegram || !botLive?.tokenConfigured}
                  className="cyber-btn-primary flex-1 rounded-xl px-3 py-2.5 text-xs"
                >
                  {lang === "ar" ? "تفعيل Webhook الآمن" : "Register Secure Webhook"}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWebhook}
                  disabled={syncingTelegram || !botLive?.tokenConfigured}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>{lang === "ar" ? "فصل" : "Unlink"}</span>
                </button>
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <label className="mb-2 block text-xs font-semibold text-slate-200">
                  {lang === "ar"
                    ? "تغيير صورة البوت عبر setMyProfilePhoto الرسمية (JPEG/PNG ≤ 10MB)"
                    : "Update Bot Avatar via Official setMyProfilePhoto (JPEG/PNG ≤ 10MB)"}
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#00ff88]/40 bg-[#00ff88]/[0.05] px-4 py-3 text-xs font-semibold text-[#00ff88] transition hover:bg-[#00ff88]/10">
                  <Camera className="h-4 w-4" />
                  <span>
                    {uploadingPhoto
                      ? lang === "ar"
                        ? "جاري رفع الصورة إلى تيليجرام..."
                        : "Uploading to Telegram..."
                      : lang === "ar"
                      ? "اختيار ورفع صورة البوت"
                      : "Select & Upload Bot Photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoChange}
                    disabled={uploadingPhoto || !botLive?.tokenConfigured}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="cyber-glass rounded-2xl p-6">
            <h2 className="mb-4 text-base font-bold text-white">
              {lang === "ar" ? "تفعيل وتعطيل ميزات البوت" : "Bot Feature Switches"}
            </h2>

            <div className="space-y-3 text-xs">
              {(
                [
                  {
                    key: "botEnabled",
                    labelAr: "تفعيل البوت بالكامل",
                    labelEn: "Master Bot Enabled",
                  },
                  {
                    key: "maintenanceMode",
                    labelAr: "وضع الصيانة المؤقت",
                    labelEn: "Maintenance Mode",
                  },
                  {
                    key: "inlineMenuEnabled",
                    labelAr: "تفعيل القوائم التفاعلية والأزرار",
                    labelEn: "Interactive Inline Menus",
                  },
                  {
                    key: "cyberToolsEnabled",
                    labelAr: "تفعيل أدوات الفحص السيبراني داخل البوت",
                    labelEn: "In-Chat Cyber Tools Execution",
                  },
                  {
                    key: "mediaDeliveryEnabled",
                    labelAr: "تفعيل إرسال الفيديوهات والملفات",
                    labelEn: "Direct Video & Media Delivery",
                  },
                  {
                    key: "antiSpamEnabled",
                    labelAr: "حماية منع الإزعاج (Rate Limiting)",
                    labelEn: "Per-User Anti-Spam Protection",
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5"
                >
                  <span className="font-medium text-slate-200">
                    {lang === "ar" ? item.labelAr : item.labelEn}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(features[item.key])}
                    onChange={(e) =>
                      setFeatures({ ...features, [item.key]: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#00ff88]"
                  />
                </label>
              ))}

              <div className="pt-2">
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === "ar"
                    ? "الحد الأقصى للطلبات في الدقيقة لكل مستخدم"
                    : "Max Requests / Minute per Telegram User"}
                </label>
                <input
                  type="number"
                  min={3}
                  max={120}
                  value={features.maxRequestsPerMinutePerUser}
                  onChange={(e) =>
                    setFeatures({
                      ...features,
                      maxRequestsPerMinutePerUser: Number(e.target.value) || 15,
                    })
                  }
                  className="cyber-input w-full rounded-xl px-3.5 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cyber-glass rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {lang === "ar" ? "إدارة أوامر البوت (/commands)" : "Bot Commands Manager"}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === "ar"
                ? "أضف أو عدّل الأوامر واربطها بأدوات سيبرانية أو ردود مخصصة"
                : "Create or customize slash commands linked to tools or custom responses"}
            </p>
          </div>

          <button
            type="button"
            onClick={addCommand}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-3.5 py-2 text-xs font-semibold text-[#00ff88] hover:bg-[#00ff88]/20"
          >
            <Plus className="h-4 w-4" />
            <span>{lang === "ar" ? "إضافة أمر" : "Add Command"}</span>
          </button>
        </div>

        <div className="space-y-3">
          {commands.map((cmd, idx) => (
            <div
              key={cmd.id}
              className="grid grid-cols-1 items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3.5 md:grid-cols-12"
            >
              <div className="md:col-span-2">
                <div className="flex items-center rounded-lg border border-white/10 bg-black/50 px-2.5 py-2">
                  <span className="font-mono-cyber text-xs text-[#00ff88]">/</span>
                  <input
                    type="text"
                    value={cmd.command}
                    onChange={(e) =>
                      updateCommand(idx, {
                        command: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                      })
                    }
                    className="font-mono-cyber w-full bg-transparent text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <input
                  type="text"
                  value={cmd.descriptionAr}
                  onChange={(e) => updateCommand(idx, { descriptionAr: e.target.value })}
                  placeholder="الوصف بالعربية"
                  className="cyber-input w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="md:col-span-3">
                <input
                  type="text"
                  value={cmd.descriptionEn}
                  onChange={(e) => updateCommand(idx, { descriptionEn: e.target.value })}
                  placeholder="English description"
                  className="cyber-input w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="md:col-span-2">
                <select
                  value={cmd.linkedTool || ""}
                  onChange={(e) =>
                    updateCommand(idx, {
                      linkedTool: (e.target.value || undefined) as CyberToolId | undefined,
                    })
                  }
                  className="cyber-input w-full rounded-lg px-2.5 py-2 text-xs"
                >
                  <option value="">{lang === "ar" ? "رد نصي مخصص" : "Custom Text"}</option>
                  {TOOL_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => updateCommand(idx, { enabled: !cmd.enabled })}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                    cmd.enabled
                      ? "bg-[#00ff88]/15 text-[#00ff88]"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{cmd.enabled ? (lang === "ar" ? "مفعّل" : "On") : lang === "ar" ? "معطّل" : "Off"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => removeCommand(idx)}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
