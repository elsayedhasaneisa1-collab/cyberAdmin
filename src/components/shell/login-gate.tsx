"use client";

import React, { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Languages,
  Lock,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import { LuxuryFooter } from "./luxury-footer";

export function LoginGate() {
  const {
    lang,
    setLang,
    authEnforced,
    loginWithCredentials,
    enterBootstrapSession,
  } = useZeroTrace();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [candidatePassword, setCandidatePassword] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginWithCredentials(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async () => {
    setSubmitting(true);
    try {
      await enterBootstrapSession();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateHash = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/auth/hash-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: candidatePassword || undefined,
          generateSecret: true,
        }),
      });
      const json = await res.json();
      if (json.passwordHash) setGeneratedHash(json.passwordHash);
      if (json.webhookSecret) setGeneratedSecret(json.webhookSecret);
    } finally {
      setGenerating(false);
    }
  };

  const copyValue = async (key: string, val: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col justify-between">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88] shadow-[0_0_24px_rgba(0,255,136,0.25)]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-mono-cyber text-lg font-bold tracking-[0.22em] text-white">
                ZERO TRACE
              </h1>
              <p className="font-mono-cyber text-[11px] tracking-[0.26em] text-[#00ff88]">
                ELITE CYBER INTELLIGENCE SYSTEM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]"
          >
            <Languages className="h-4 w-4 text-[#00ff88]" />
            <span>{lang === "ar" ? "English (LTR)" : "العربية (RTL)"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="cyber-glass-strong rounded-2xl p-6 sm:p-8 lg:col-span-7">
            <div className="mb-6 flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-[#00ff88]" />
              <h2 className="text-xl font-bold text-white">
                {lang === "ar"
                  ? "بوابة القيادة والتحكم المشفرة"
                  : "Encrypted Command & Control Access"}
              </h2>
            </div>

            {authEnforced ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">
                    {lang === "ar" ? "البريد الإلكتروني للمدير (ADMIN_EMAIL)" : "Administrator Email"}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourdomain.com"
                    className="cyber-input w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">
                    {lang === "ar" ? "كلمة المرور السرية" : "Administrator Password"}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="cyber-input w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="cyber-btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>
                    {submitting
                      ? lang === "ar"
                        ? "جاري التحقق من التجزئة..."
                        : "Verifying Cryptographic Hash..."
                      : lang === "ar"
                      ? "تسجيل الدخول الآمن للوحة التحكم"
                      : "Authenticate to Command Center"}
                  </span>
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
                  <div className="mb-1.5 flex items-center gap-2 font-bold text-amber-300">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>
                      {lang === "ar"
                        ? "وضع التهيئة الأولية (لم يتم تعيين متغيرات مصادقة المدير بعد)"
                        : "Initial Deployment Mode (Admin Env Variables Not Yet Set)"}
                    </span>
                  </div>
                  <p>
                    {lang === "ar"
                      ? "لم يتم العثور على ADMIN_EMAIL وADMIN_PASSWORD_HASH في متغيرات البيئة الحالية. يمكنك الدخول الآن إلى جلسة الإعداد الأولي لاستعراض وإدارة جميع أقسام المنصة، وفور إضافة المتغيرين في Vercel سيتم فرض قفل المصادقة الكامل تلقائيًا."
                      : "ADMIN_EMAIL and ADMIN_PASSWORD_HASH are not configured in Environment Variables yet. You can launch a signed Bootstrap Setup Session below to manage and inspect all modules; production credential lock enforces automatically once those variables are added."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBootstrap}
                  disabled={submitting}
                  className="cyber-btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm"
                >
                  <Terminal className="h-4 w-4" />
                  <span>
                    {submitting
                      ? lang === "ar"
                        ? "جاري فتح جلسة الإعداد..."
                        : "Starting Session..."
                      : lang === "ar"
                      ? "الدخول إلى لوحة التحكم (وضع الإعداد الأولي)"
                      : "Enter Control Panel (Bootstrap Setup Session)"}
                  </span>
                </button>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-[11px] text-slate-400 sm:grid-cols-3">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <p className="font-semibold text-[#00ff88]">HMAC-SHA256</p>
                <p>{lang === "ar" ? "جلسات HttpOnly موقعة" : "Signed HttpOnly Cookies"}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <p className="font-semibold text-[#00ff88]">Anti-CSRF + SSRF</p>
                <p>{lang === "ar" ? "فحص مزدوج وحظر الشبكات الخاصة" : "Token + Private IP Guard"}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 sm:col-span-1">
                <p className="font-semibold text-[#00ff88]">GitHub SHA Sync</p>
                <p>{lang === "ar" ? "بدون قواعد بيانات تقليدية" : "Zero Traditional DB"}</p>
              </div>
            </div>
          </div>

          <div className="cyber-glass rounded-2xl p-6 lg:col-span-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#00ff88]" />
              <h3 className="text-sm font-bold text-white">
                {lang === "ar"
                  ? "مولد التجزئة والأسرار لمتغيرات Vercel"
                  : "Vercel Env Hash & Secret Generator"}
              </h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              {lang === "ar"
                ? "ولّد تجزئة bcrypt آمنة لمتغير ADMIN_PASSWORD_HASH ورمز حماية لـ TELEGRAM_WEBHOOK_SECRET دون تخزين كلمة المرور كنص عادي."
                : "Generate a bcrypt cost-12 hash for ADMIN_PASSWORD_HASH and a 256-bit TELEGRAM_WEBHOOK_SECRET without storing plaintext."}
            </p>

            <div className="space-y-3">
              <input
                type="password"
                value={candidatePassword}
                onChange={(e) => setCandidatePassword(e.target.value)}
                placeholder={
                  lang === "ar"
                    ? "اكتب كلمة مرور قوية (8 أحرف فأكثر)..."
                    : "Enter strong password (min 8 chars)..."
                }
                className="cyber-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
              <button
                type="button"
                onClick={handleGenerateHash}
                disabled={generating}
                className="w-full rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88] transition hover:bg-[#00ff88]/20"
              >
                {generating
                  ? lang === "ar"
                    ? "جاري التوليد..."
                    : "Generating..."
                  : lang === "ar"
                  ? "توليد Hash + Webhook Secret"
                  : "Generate Bcrypt Hash & Webhook Secret"}
              </button>

              {generatedHash && (
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>ADMIN_PASSWORD_HASH</span>
                    <button
                      type="button"
                      onClick={() => copyValue("hash", generatedHash)}
                      className="inline-flex items-center gap-1 text-[#00ff88]"
                    >
                      {copiedKey === "hash" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{lang === "ar" ? "نسخ" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="font-mono-cyber break-all text-[11px] text-emerald-300">
                    {generatedHash}
                  </p>
                </div>
              )}

              {generatedSecret && (
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>TELEGRAM_WEBHOOK_SECRET</span>
                    <button
                      type="button"
                      onClick={() => copyValue("secret", generatedSecret)}
                      className="inline-flex items-center gap-1 text-[#00ff88]"
                    >
                      {copiedKey === "secret" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{lang === "ar" ? "نسخ" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="font-mono-cyber break-all text-[11px] text-emerald-300">
                    {generatedSecret}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LuxuryFooter />
    </div>
  );
}
