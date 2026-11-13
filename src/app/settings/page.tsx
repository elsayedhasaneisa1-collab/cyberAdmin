"use client";

import React, { useEffect, useState } from "react";
import { Download, GitCommit, Save, Upload } from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type { SystemGeneralSettings, ZeroTraceConfig } from "@/types/zero-trace";

export default function SettingsPage() {
  const { lang, config, syncState, saving, saveConfigPatch, notify } = useZeroTrace();

  const [settings, setSettings] = useState<SystemGeneralSettings>(config.settings);

  useEffect(() => {
    setSettings(config.settings);
  }, [config.settings]);

  const handleSave = async () => {
    await saveConfigPatch("settings.general", { settings }, true);
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zero-trace-config-rev${config.revision}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<ZeroTraceConfig>;
      const ok = await saveConfigPatch("settings.import_backup", parsed);
      if (ok) {
        notify(
          "success",
          lang === "ar"
            ? "تم استيراد النسخة الاحتياطية ومزامنتها بنجاح."
            : "Configuration backup imported and synced."
        );
      }
    } catch {
      notify(
        "error",
        lang === "ar" ? "ملف JSON غير صالح." : "Invalid JSON configuration file."
      );
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            GLOBAL CONFIGURATION & GITHUB SYNC
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "إعدادات المنصة والنسخ الاحتياطي عبر GitHub"
              : "Platform Settings & GitHub Version Control"}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs"
        >
          <Save className="h-4 w-4" />
          <span>{lang === "ar" ? "حفظ الإعدادات" : "Save Settings"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="cyber-glass space-y-4 rounded-2xl p-6 lg:col-span-7">
          <h2 className="text-base font-bold text-white">
            {lang === "ar" ? "الإعدادات العامة والروابط" : "General Platform Parameters"}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar" ? "عنوان المنصة" : "Platform Title"}
              </label>
              <input
                type="text"
                value={settings.platformTitle}
                onChange={(e) => setSettings({ ...settings, platformTitle: e.target.value })}
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar" ? "رابط قناة / حساب Telegram" : "Public Telegram URL"}
              </label>
              <input
                type="url"
                value={settings.telegramChannelUrl}
                onChange={(e) =>
                  setSettings({ ...settings, telegramChannelUrl: e.target.value })
                }
                className="cyber-input font-mono-cyber w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar" ? "رابط مستودع / حساب GitHub" : "Public GitHub URL"}
              </label>
              <input
                type="url"
                value={settings.githubPublicUrl}
                onChange={(e) => setSettings({ ...settings, githubPublicUrl: e.target.value })}
                className="cyber-input font-mono-cyber w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar"
                  ? "الحد الأقصى لطلبات الأدوات في الدقيقة"
                  : "API Diagnostic Rate Limit / Min"}
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={settings.apiRateLimitPerMinute}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    apiRateLimitPerMinute: Number(e.target.value) || 40,
                  })
                }
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar" ? "اللغة الافتراضية" : "Default Locale"}
              </label>
              <select
                value={settings.defaultLocale}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultLocale: e.target.value === "en" ? "en" : "ar",
                  })
                }
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              >
                <option value="ar">العربية (RTL)</option>
                <option value="en">English (LTR)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar" ? "إشعار النطاق المصرح به (عربي)" : "Authorized Scope Notice (AR)"}
              </label>
              <textarea
                rows={2}
                value={settings.authorizedScopeNoticeAr}
                onChange={(e) =>
                  setSettings({ ...settings, authorizedScopeNoticeAr: e.target.value })
                }
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-300">
                {lang === "ar" ? "إشعار النطاق المصرح به (إنجليزي)" : "Authorized Scope Notice (EN)"}
              </label>
              <textarea
                rows={2}
                value={settings.authorizedScopeNoticeEn}
                onChange={(e) =>
                  setSettings({ ...settings, authorizedScopeNoticeEn: e.target.value })
                }
                className="cyber-input w-full rounded-xl p-3 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="cyber-glass rounded-2xl p-6">
            <div className="mb-3 flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-[#00ff88]" />
              <h2 className="text-base font-bold text-white">
                {lang === "ar"
                  ? "التحكم في التزامن ومنع التعارض (GitHub SHA)"
                  : "GitHub Optimistic Concurrency Status"}
              </h2>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-4 font-mono-cyber text-xs">
              <p className="text-slate-300">
                Mode: <span className="text-[#00ff88]">{syncState.mode.toUpperCase()}</span>
              </p>
              <p className="text-slate-300">
                Revision: <span className="text-white">#{config.revision}</span>
              </p>
              <p className="break-all text-slate-300">
                Blob SHA: <span className="text-emerald-300">{syncState.sha || "N/A"}</span>
              </p>
              <p className="text-slate-300">
                Path: <span className="text-slate-400">{syncState.configPath}</span>
              </p>
            </div>
          </div>

          <div className="cyber-glass rounded-2xl p-6">
            <h2 className="mb-3 text-base font-bold text-white">
              {lang === "ar"
                ? "تصدير واستيراد نسخة الإعدادات (JSON Backup)"
                : "Configuration Export & Validated Restore"}
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              {lang === "ar"
                ? "قم بتنزيل نسخة JSON منظمة من جميع الأزرار والأقسام والأوامر أو استرجاعها بأمان."
                : "Download a clean JSON snapshot of buttons, categories, commands, and APIs, or restore a validated snapshot."}
            </p>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleExportConfig}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88]"
              >
                <Download className="h-4 w-4" />
                <span>{lang === "ar" ? "تصدير JSON" : "Export JSON"}</span>
              </button>

              <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white hover:border-[#00ff88]/40">
                <Upload className="h-4 w-4 text-[#00ff88]" />
                <span>{lang === "ar" ? "استيراد JSON" : "Import JSON"}</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportConfig}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
