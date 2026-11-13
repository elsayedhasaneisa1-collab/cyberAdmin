"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Play,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

interface SelfTestCheck {
  id: string;
  nameAr: string;
  nameEn: string;
  passed: boolean;
  warningIfFalse?: boolean;
}

export default function SecurityCenterPage() {
  const { lang, authEnforced, botLive, apiFetch, refreshAll, notify } = useZeroTrace();

  const [runningAudit, setRunningAudit] = useState(false);
  const [auditChecks, setAuditChecks] = useState<SelfTestCheck[] | null>(null);
  const [auditTimestamp, setAuditTimestamp] = useState<string | null>(null);

  const runSelfTest = async () => {
    setRunningAudit(true);
    try {
      const res = await apiFetch("/api/admin/status", {
        method: "POST",
        body: JSON.stringify({ action: "run_security_self_test" }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setAuditChecks(json.checks);
        setAuditTimestamp(json.executedAt);
        await refreshAll(false);
        notify(
          "success",
          lang === "ar"
            ? "اكتمل الفحص الدفاعي الذاتي لطبقات الحماية."
            : "Completed live defensive security self-audit."
        );
      } else {
        notify("error", json.error || "Audit failed.");
      }
    } finally {
      setRunningAudit(false);
    }
  };

  const controls = [
    {
      titleAr: "مصادقة المدير وتجزئة كلمة المرور",
      titleEn: "Admin Auth & Password Hashing",
      descAr: "دعم bcrypt وscrypt وSHA-256 مع مقارنة ثابتة الزمن وجلسات HttpOnly موقعة بـ HMAC-SHA256.",
      descEn: "Supports bcrypt/scrypt/SHA-256 with timingSafeEqual and HMAC-SHA256 signed HttpOnly cookies.",
      active: true,
      note: authEnforced ? "ENFORCED" : "SETUP MODE",
    },
    {
      titleAr: "حماية Telegram Webhook بـ Secret Token",
      titleEn: "Telegram Webhook Secret Verification",
      descAr: "فحص ترويسة X-Telegram-Bot-Api-Secret-Token ومنع إعادة تنفيذ نفس update_id.",
      descEn: "Verifies X-Telegram-Bot-Api-Secret-Token and deduplicates Telegram update_id retries.",
      active: Boolean(botLive?.webhookSecretConfigured),
      note: botLive?.webhookSecretConfigured ? "ACTIVE" : "SET ENV SECRET",
    },
    {
      titleAr: "الحماية الصارمة ضد SSRF والشبكات الخاصة",
      titleEn: "Strict SSRF & Private IP Egress Blocker",
      descAr: "فحص سجلات DNS وحظر عناوين RFC1918 وLoopback وCloud Metadata وIPv4-Mapped IPv6.",
      descEn: "Pre-flight DNS resolution check blocking loopback, RFC1918, CGNAT, link-local, and cloud metadata.",
      active: true,
      note: "ENFORCED",
    },
    {
      titleAr: "الحماية ضد CSRF وXSS وحقن المدخلات",
      titleEn: "Anti-CSRF, Anti-XSS & Input Sanitization",
      descAr: "تحقق مزدوج من Origin ورمز X-CSRF-Token مع تطهير جميع المخرجات ومنع إظهار Stack Traces.",
      descEn: "Origin + X-CSRF-Token verification, HTML escaping, and zero stack-trace leakage.",
      active: true,
      note: "ENFORCED",
    },
    {
      titleAr: "تحديد معدل الطلبات ومنع الإزعاج (Rate Limiting)",
      titleEn: "Sliding-Window Rate Limiting & Anti-Spam",
      descAr: "تقييد محاولات تسجيل الدخول، مسارات API، وطلبات مستخدمي البوت لمنع الإغراق.",
      descEn: "Throttles login attempts, API mutations, diagnostic runs, and per-user bot requests.",
      active: true,
      note: "ENFORCED",
    },
    {
      titleAr: "ترويسات الأمان الدفاعية (Security Headers)",
      titleEn: "Production HTTP Security Headers",
      descAr: "تفعيل CSP وHSTS وX-Frame-Options: DENY وnosniff وPermissions-Policy.",
      descEn: "Applies CSP, HSTS, X-Frame-Options: DENY, nosniff, Referrer-Policy, and Permissions-Policy.",
      active: true,
      note: "ENFORCED",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            DEFENSE-IN-DEPTH ARCHITECTURE
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "مركز الحماية والتحقق الأمني الموثق"
              : "Security Center & Defensive Verification"}
          </h1>
        </div>

        <button
          type="button"
          onClick={runSelfTest}
          disabled={runningAudit}
          className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs"
        >
          <Play className="h-4 w-4" />
          <span>
            {runningAudit
              ? lang === "ar"
                ? "جاري تنفيذ الاختبارات الأمنية..."
                : "Running Defensive Self-Tests..."
              : lang === "ar"
              ? "تشغيل الفحص الأمني الذاتي"
              : "Run Live Security Self-Audit"}
          </span>
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-300">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#00ff88]" />
          <p>
            {lang === "ar"
              ? "مبدأ هندسة الأمن الاحترافية: لا يدّعي أي نظام هندسي رصين أنه «مستحيل الاختراق» مطلقًا؛ بل يطبّق ZERO TRACE نموذج الدفاع المتعمق (Defense-in-Depth) عبر طبقات تحقق قابلة للاختبار تشمل عزل الأسرار على الخادم، منع SSRF/CSRF/XSS، التحقق التشفيري من الجلسات والـ Webhook، وتسجيل الأحداث الأمنية."
              : "Engineering Realism Principle: No credible security system claims to be 'unhackable'. Instead, ZERO TRACE implements verifiable Defense-in-Depth layers—server-only secret isolation, SSRF/CSRF/XSS guards, cryptographic session & webhook verification, rate limiting, and structured security auditing."}
          </p>
        </div>
      </div>

      {auditChecks && (
        <div className="cyber-glass-strong rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              {lang === "ar"
                ? "نتائج الاختبار الأمني الذاتي المباشر"
                : "Live Defensive Self-Audit Results"}
            </h2>
            {auditTimestamp && (
              <span className="font-mono-cyber text-xs text-slate-400">
                {new Date(auditTimestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {auditChecks.map((chk) => (
              <div
                key={chk.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-3.5 text-xs"
              >
                <span className="font-medium text-slate-200">
                  {lang === "ar" ? chk.nameAr : chk.nameEn}
                </span>
                {chk.passed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00ff88]/15 px-2.5 py-1 font-mono-cyber text-[10px] font-bold text-[#00ff88]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    PASS
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 font-mono-cyber text-[10px] font-bold text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {chk.warningIfFalse ? "SET ENV" : "FAIL"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {controls.map((item, idx) => (
          <div key={idx} className="cyber-glass flex flex-col justify-between rounded-2xl p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="rounded-xl border border-[#00ff88]/30 bg-[#00ff88]/10 p-2 text-[#00ff88]">
                  {item.active ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <Lock className="h-5 w-5 text-amber-300" />
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono-cyber text-[10px] font-bold ${
                    item.active
                      ? "bg-[#00ff88]/15 text-[#00ff88]"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {item.note}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">
                {lang === "ar" ? item.titleAr : item.titleEn}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {lang === "ar" ? item.descAr : item.descEn}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
