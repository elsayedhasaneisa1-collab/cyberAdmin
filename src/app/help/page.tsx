"use client";

import React, { useState } from "react";
import { Check, Copy, HelpCircle, KeyRound, ShieldCheck, Terminal } from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

export default function HelpCenterPage() {
  const { lang } = useZeroTrace();

  const [pwd, setPwd] = useState("");
  const [hashOut, setHashOut] = useState("");
  const [secretOut, setSecretOut] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async () => {
    const res = await fetch("/api/auth/hash-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd || undefined, generateSecret: true }),
    });
    const json = await res.json();
    if (json.passwordHash) setHashOut(json.passwordHash);
    if (json.webhookSecret) setSecretOut(json.webhookSecret);
  };

  const copyText = async (key: string, val: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const guides = [
    {
      step: "01",
      titleAr: "إعداد بوت تيليجرام عبر @BotFather",
      titleEn: "1. Create Your Bot via @BotFather",
      bodyAr:
        "افتح @BotFather على تيليجرام، أرسل /newbot، واحتفظ بالتوكن وضعه في متغير TELEGRAM_BOT_TOKEN داخل إعدادات Vercel دون كتابته في الكود.",
      bodyEn:
        "Open @BotFather on Telegram, run /newbot, and add the token to TELEGRAM_BOT_TOKEN in Vercel Environment Variables.",
    },
    {
      step: "02",
      titleAr: "إعداد تخزين الإعدادات عبر GitHub API",
      titleEn: "2. Configure GitHub API Config Persistence",
      bodyAr:
        "أنشئ Fine-Grained Personal Access Token بصلاحية Contents: Read & Write للمستودع فقط، وأضف GITHUB_TOKEN وGITHUB_OWNER وGITHUB_REPO وGITHUB_CONFIG_PATH.",
      bodyEn:
        "Generate a Fine-Grained GitHub PAT with Contents: Read & Write on your config repository and set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, and GITHUB_CONFIG_PATH.",
    },
    {
      step: "03",
      titleAr: "تأمين لوحة التحكم والـ Webhook",
      titleEn: "3. Harden Admin Auth & Webhook Secret",
      bodyAr:
        "استخدم المولد أدناه لإنشاء ADMIN_PASSWORD_HASH (بتشفير bcrypt) وTELEGRAM_WEBHOOK_SECRET، ثم من صفحة «إدارة البوت» اضغط تفعيل Webhook الآمن.",
      bodyEn:
        "Use the generator below to create ADMIN_PASSWORD_HASH (bcrypt) and TELEGRAM_WEBHOOK_SECRET, then click Register Secure Webhook in Bot Management.",
    },
    {
      step: "04",
      titleAr: "إعداد التخزين الخارجي للفيديوهات والملفات",
      titleEn: "4. External Media Storage & Telegram Limits",
      bodyAr:
        "لرفع الفيديوهات والملفات التعليمية دون تخزينها في GitHub، أضف MEDIA_STORAGE_URL وMEDIA_STORAGE_TOKEN، أو ارفع الملف عبر Chat ID لتوليد Telegram file_id دائم.",
      bodyEn:
        "Configure MEDIA_STORAGE_URL and MEDIA_STORAGE_TOKEN for external storage, or upload with a Telegram Chat ID to obtain a reusable Telegram file_id.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
          OPERATIONS MANUAL & DEPLOYMENT GUIDE
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">
          {lang === "ar"
            ? "مركز المساعدة ودليل النشر على Vercel"
            : "Help Center & Vercel Deployment Blueprint"}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {guides.map((g) => (
          <div key={g.step} className="cyber-glass rounded-2xl p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-lg border border-[#00ff88]/40 bg-[#00ff88]/10 px-2.5 py-1 font-mono-cyber text-xs font-bold text-[#00ff88]">
                {g.step}
              </span>
              <h2 className="text-sm font-bold text-white">
                {lang === "ar" ? g.titleAr : g.titleEn}
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {lang === "ar" ? g.bodyAr : g.bodyEn}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="cyber-glass rounded-2xl p-6 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#00ff88]" />
            <h2 className="text-base font-bold text-white">
              {lang === "ar"
                ? "مولد ADMIN_PASSWORD_HASH وTELEGRAM_WEBHOOK_SECRET"
                : "Cryptographic Hash & Webhook Secret Generator"}
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "كلمة مرور المدير (8 أحرف على الأقل)..."
                  : "Admin password (min 8 characters)..."
              }
              className="cyber-input w-full rounded-xl px-3.5 py-2.5"
            />
            <button
              type="button"
              onClick={handleGenerate}
              className="cyber-btn-primary w-full rounded-xl py-2.5 text-xs"
            >
              {lang === "ar" ? "توليد القيم الآمنة الآن" : "Generate Secure Values"}
            </button>

            {hashOut && (
              <div className="rounded-xl border border-white/10 bg-black/45 p-3">
                <div className="mb-1 flex items-center justify-between text-slate-400">
                  <span>ADMIN_PASSWORD_HASH</span>
                  <button
                    type="button"
                    onClick={() => copyText("h", hashOut)}
                    className="inline-flex items-center gap-1 text-[#00ff88]"
                  >
                    {copied === "h" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>Copy</span>
                  </button>
                </div>
                <p className="font-mono-cyber break-all text-[11px] text-emerald-300">{hashOut}</p>
              </div>
            )}

            {secretOut && (
              <div className="rounded-xl border border-white/10 bg-black/45 p-3">
                <div className="mb-1 flex items-center justify-between text-slate-400">
                  <span>TELEGRAM_WEBHOOK_SECRET</span>
                  <button
                    type="button"
                    onClick={() => copyText("s", secretOut)}
                    className="inline-flex items-center gap-1 text-[#00ff88]"
                  >
                    {copied === "s" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>Copy</span>
                  </button>
                </div>
                <p className="font-mono-cyber break-all text-[11px] text-emerald-300">{secretOut}</p>
              </div>
            )}
          </div>
        </div>

        <div className="cyber-glass rounded-2xl p-6 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-[#00ff88]" />
            <h2 className="text-base font-bold text-white">
              {lang === "ar"
                ? "جدول حدود ملفات Telegram Bot API الرسمية"
                : "Official Telegram Bot API File Size Ceilings"}
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
              <span className="text-slate-300">
                {lang === "ar" ? "إرسال صورة عبر رابط HTTPS" : "Photo via HTTPS URL"}
              </span>
              <span className="font-mono-cyber font-bold text-[#00ff88]">≤ 5 MB</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
              <span className="text-slate-300">
                {lang === "ar" ? "إرسال فيديو / ملف عبر رابط HTTPS" : "Video / Document via HTTPS URL"}
              </span>
              <span className="font-mono-cyber font-bold text-[#00ff88]">≤ 20 MB</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
              <span className="text-slate-300">
                {lang === "ar" ? "رفع مباشر Multipart (صور)" : "Direct Multipart Upload (Photos)"}
              </span>
              <span className="font-mono-cyber font-bold text-[#00ff88]">≤ 10 MB</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
              <span className="text-slate-300">
                {lang === "ar" ? "رفع مباشر Multipart (فيديو وملفات)" : "Direct Multipart Upload (Video/Docs)"}
              </span>
              <span className="font-mono-cyber font-bold text-[#00ff88]">≤ 50 MB</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#00ff88]/25 bg-[#00ff88]/[0.06] p-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-200">
                <ShieldCheck className="h-4 w-4 text-[#00ff88]" />
                {lang === "ar" ? "إعادة الإرسال عبر Telegram file_id" : "Resending via Telegram file_id"}
              </span>
              <span className="font-mono-cyber font-bold text-[#00ff88]">UNLIMITED REUSE</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3 font-mono-cyber text-[11px] text-slate-400">
            <Terminal className="h-4 w-4 shrink-0 text-[#00ff88]" />
            <span>Webhook Route: /api/telegram/webhook</span>
          </div>
        </div>
      </div>
    </div>
  );
}
