"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Globe,
  GraduationCap,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type { CyberToolId } from "@/types/zero-trace";

interface ToolCardSpec {
  id: CyberToolId;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  placeholder: string;
  requiresAuthorization: boolean;
  needsInput: boolean;
}

const TOOLS_CATALOG: ToolCardSpec[] = [
  {
    id: "ip_info",
    nameAr: "معلومات عنوان IP",
    nameEn: "IP Information",
    descAr: "استعلام سلبي عن الموقع الجغرافي وASN والمنافذ المسجلة عبر IPWhois وRIPEstat وInternetDB.",
    descEn: "Passive geolocation, ASN, BGP prefix, and Shodan InternetDB snapshot.",
    placeholder: "1.1.1.1",
    requiresAuthorization: false,
    needsInput: true,
  },
  {
    id: "dns_lookup",
    nameAr: "فحص سجلات DNS",
    nameEn: "DNS Lookup",
    descAr: "فحص A, AAAA, MX, NS, TXT, CAA وحالة DNSSEC وSPF/DMARC عبر Cloudflare DoH.",
    descEn: "Resolve A, AAAA, MX, NS, TXT, CAA, DNSSEC AD flag, and SPF/DMARC posture.",
    placeholder: "cloudflare.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "whois_lookup",
    nameAr: "استعلام WHOIS / RDAP",
    nameEn: "WHOIS / RDAP Lookup",
    descAr: "استعلام رسمي عبر بروتوكول ICANN RDAP المعتمد لتواريخ التسجيل وحالة القفل.",
    descEn: "Authoritative ICANN RDAP registration dates, EPP lock status, and domain age.",
    placeholder: "example.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "ssl_checker",
    nameAr: "فاحص شهادة SSL/TLS",
    nameEn: "SSL Certificate Checker",
    descAr: "فحص صلاحية شهادة X.509، الجهة المصدرة، البروتوكول، وسجلات الشفافية crt.sh.",
    descEn: "Inspect live TLS peer certificate, expiry countdown, SANs, and CT logs.",
    placeholder: "github.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "security_headers",
    nameAr: "محلل ترويسات الأمان",
    nameEn: "Security Headers Analyzer",
    descAr: "تقييم HSTS وCSP وX-Frame-Options وReferrer-Policy من A+ إلى F مع توصيات التحصين.",
    descEn: "Grade HTTP defensive headers from A+ to F with actionable remediation tips.",
    placeholder: "https://example.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "url_reputation",
    nameAr: "فحص سمعة الروابط",
    nameEn: "URL Reputation Checker",
    descAr: "تحليل هيكل الرابط، عمر النطاق، Punycode، وفحص قاعدة بيانات التهديدات بأمان.",
    descEn: "Structural phishing heuristics, domain age verification, and optional URLhaus check.",
    placeholder: "https://example.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "hash_generator",
    nameAr: "مولد البصمات التشفيرية",
    nameEn: "Hash Generator",
    descAr: "توليد SHA-256 وSHA-384 وSHA-512 وSHA3-256 وHMAC-SHA256 للنصوص.",
    descEn: "Compute SHA-256, SHA-384, SHA-512, SHA3-256, and optional HMAC-SHA256.",
    placeholder: "ZERO TRACE Cyber Intelligence",
    requiresAuthorization: false,
    needsInput: true,
  },
  {
    id: "base64_codec",
    nameAr: "ترميز وفك Base64 / Hex",
    nameEn: "Base64 Encoder / Decoder",
    descAr: "تحويل النصوص بأمان بين UTF-8 وBase64 وBase64URL وHexadecimal.",
    descEn: "UTF-8 safe transformation across Base64, Base64URL, and Hexadecimal.",
    placeholder: "ZeroTracePayload",
    requiresAuthorization: false,
    needsInput: true,
  },
  {
    id: "password_strength",
    nameAr: "محلل قوة كلمات المرور",
    nameEn: "Password Strength Analyzer",
    descAr: "حساب الإنتروبيا وفحص التسريبات عبر HIBP بنموذج k-Anonymity دون إرسال كلمة المرور.",
    descEn: "Shannon entropy audit + zero-knowledge HIBP k-Anonymity 5-char prefix check.",
    placeholder: "Enter candidate password...",
    requiresAuthorization: false,
    needsInput: true,
  },
  {
    id: "http_analyzer",
    nameAr: "محلل استجابة HTTP",
    nameEn: "HTTP Response Analyzer",
    descAr: "فحص محمي ضد SSRF لكود الاستجابة، التحويلات، زمن الاستجابة، وسياسات CORS.",
    descEn: "SSRF-guarded HTTP status, redirect chain, latency, caching, and CORS inspection.",
    placeholder: "https://example.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "domain_info",
    nameAr: "ملف النطاق الشامل",
    nameEn: "Domain Information",
    descAr: "تقرير موحد يجمع سجلات DNS، حالة البريد SPF/DMARC، وبيانات التسجيل RDAP.",
    descEn: "Unified defensive recon report combining DNS, SPF/DMARC, and RDAP registration.",
    placeholder: "cloudflare.com",
    requiresAuthorization: true,
    needsInput: true,
  },
  {
    id: "network_education",
    nameAr: "أساسيات الشبكات وأوامر Linux",
    nameEn: "Basic Network Education",
    descAr: "حاسبة تقسيم الشبكات CIDR، طبقات OSI السبع، وأدلة أوامر Linux الحية من tldr-pages.",
    descEn: "Interactive IPv4 CIDR subnetting calculator, OSI layers, and live Linux tldr docs.",
    placeholder: "192.168.1.0/24 or ssh",
    requiresAuthorization: false,
    needsInput: true,
  },
  {
    id: "learning_center",
    nameAr: "مركز التعلم السيبراني وCTF",
    nameEn: "Cybersecurity Learning Center",
    descAr: "مسارات تعليمية دفاعية، أحدث مسابقات CTF القادمة من CTFtime، وتنبيهات CISA KEV.",
    descEn: "Defensive learning tracks, live upcoming CTFtime events, and CISA KEV advisories.",
    placeholder: "",
    requiresAuthorization: false,
    needsInput: false,
  },
];

export default function CyberToolsPage() {
  const { lang, config, apiFetch, refreshAll, notify } = useZeroTrace();

  const [selectedToolId, setSelectedToolId] = useState<CyberToolId>("ip_info");
  const [inputVal, setInputVal] = useState("1.1.1.1");
  const [secondaryVal, setSecondaryVal] = useState("");
  const [authorizedConfirmed, setAuthorizedConfirmed] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    titleAr: string;
    titleEn: string;
    summaryAr: string;
    summaryEn: string;
    executedAt: string;
    data: Record<string, unknown>;
  } | null>(null);

  const activeTool =
    TOOLS_CATALOG.find((t) => t.id === selectedToolId) || TOOLS_CATALOG[0];

  const handleSelectTool = (tool: ToolCardSpec) => {
    setSelectedToolId(tool.id);
    setInputVal(tool.placeholder);
    setSecondaryVal(tool.id === "base64_codec" ? "encode" : "");
    setResult(null);
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTool.requiresAuthorization && !authorizedConfirmed) {
      notify(
        "error",
        lang === "ar"
          ? "يرجى تأكيد امتلاكك التصريح القانوني لفحص هذا النطاق أولاً."
          : "Please confirm explicit authorization to test the target asset."
      );
      return;
    }

    setRunning(true);
    try {
      const res = await apiFetch("/api/tools/execute", {
        method: "POST",
        body: JSON.stringify({
          toolId: activeTool.id,
          input: inputVal,
          secondaryInput: secondaryVal || undefined,
          authorizedConfirmed,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        notify("error", json.error || "Execution failed.");
        return;
      }
      setResult(json);
      await refreshAll(false);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
          DEFENSIVE DIAGNOSTICS & EDUCATION
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">
          {lang === "ar"
            ? "مختبر أدوات الأمن السيبراني الدفاعية والتعليمية"
            : "Defensive Cybersecurity & Educational Tools Suite"}
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          {lang === "ar"
            ? config.settings.authorizedScopeNoticeAr
            : config.settings.authorizedScopeNoticeEn}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-4">
          {TOOLS_CATALOG.map((tool) => {
            const active = tool.id === selectedToolId;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleSelectTool(tool)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-start transition ${
                  active
                    ? "border-[#00ff88]/55 bg-[#00ff88]/12 text-white shadow-[0_0_20px_rgba(0,255,136,0.12)]"
                    : "border-white/10 bg-[#0a0f16]/80 text-slate-300 hover:border-white/25"
                }`}
              >
                <div className="mt-0.5 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/10 p-1.5 text-[#00ff88]">
                  {tool.id === "learning_center" || tool.id === "network_education" ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : tool.id.includes("hash") || tool.id.includes("base64") || tool.id.includes("password") ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">
                    {lang === "ar" ? tool.nameAr : tool.nameEn}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                    {lang === "ar" ? tool.descAr : tool.descEn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-6 lg:col-span-8">
          <form onSubmit={handleExecute} className="cyber-glass-strong rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {lang === "ar" ? activeTool.nameAr : activeTool.nameEn}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {lang === "ar" ? activeTool.descAr : activeTool.descEn}
                </p>
              </div>
              <ShieldCheck className="h-6 w-6 shrink-0 text-[#00ff88]" />
            </div>

            {activeTool.needsInput && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    {lang === "ar" ? "المدخل المطلوب فحصه" : "Target / Input Payload"}
                  </label>
                  <input
                    type={activeTool.id === "password_strength" ? "password" : "text"}
                    required
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={activeTool.placeholder}
                    className="cyber-input font-mono-cyber w-full rounded-xl px-4 py-3 text-xs"
                  />
                </div>

                {activeTool.id === "base64_codec" && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">
                      {lang === "ar" ? "وضع التحويل" : "Operation Mode"}
                    </label>
                    <select
                      value={secondaryVal || "encode"}
                      onChange={(e) => setSecondaryVal(e.target.value)}
                      className="cyber-input rounded-xl px-3.5 py-2 text-xs"
                    >
                      <option value="encode">Encode (UTF-8 → Base64 / Hex)</option>
                      <option value="decode">Decode (Base64 → UTF-8)</option>
                    </select>
                  </div>
                )}

                {activeTool.id === "hash_generator" && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">
                      {lang === "ar"
                        ? "مفتاح HMAC اختياري (اتركه فارغًا للهاش القياسي)"
                        : "Optional HMAC Secret Key"}
                    </label>
                    <input
                      type="text"
                      value={secondaryVal}
                      onChange={(e) => setSecondaryVal(e.target.value)}
                      placeholder="Optional HMAC-SHA256 key"
                      className="cyber-input font-mono-cyber w-full rounded-xl px-3.5 py-2 text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTool.requiresAuthorization && (
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-3 text-xs text-amber-100">
                <input
                  type="checkbox"
                  checked={authorizedConfirmed}
                  onChange={(e) => setAuthorizedConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#00ff88]"
                />
                <span>
                  {lang === "ar"
                    ? "أقر بأن لدي تصريحًا قانونيًا لفحص هذا النطاق/النظام لأغراض دفاعية وتعليمية، مع العلم أن العناوين الداخلية والخاصة محظورة تلقائيًا (SSRF Guard)."
                    : "I confirm I own or hold explicit authorization to run defensive diagnostics on this target. All private/internal IPs are blocked by SSRF Guard."}
                </span>
              </label>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={running}
                className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs"
              >
                <Play className="h-4 w-4" />
                <span>
                  {running
                    ? lang === "ar"
                      ? "جاري التحليل الدفاعي..."
                      : "Running Defensive Analysis..."
                    : lang === "ar"
                    ? "تشغيل الأداة الآن"
                    : "Execute Diagnostic"}
                </span>
              </button>
            </div>
          </form>

          {result && (
            <div className="cyber-glass rounded-2xl p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#00ff88]" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {lang === "ar" ? result.titleAr : result.titleEn}
                    </h3>
                    <p className="text-xs text-[#00ff88]">
                      {lang === "ar" ? result.summaryAr : result.summaryEn}
                    </p>
                  </div>
                </div>
                <span className="font-mono-cyber text-[11px] text-slate-400">
                  {new Date(result.executedAt).toLocaleTimeString()}
                </span>
              </div>

              {selectedToolId === "security_headers" && Array.isArray(result.data.checks) && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-3 rounded-xl border border-[#00ff88]/30 bg-[#00ff88]/10 p-3">
                    <span className="font-mono-cyber text-2xl font-bold text-[#00ff88]">
                      {String(result.data.grade)}
                    </span>
                    <div className="text-xs">
                      <p className="font-bold text-white">
                        Score: {String(result.data.score)} / 100
                      </p>
                      <p className="text-slate-300">{String(result.data.finalUrl)}</p>
                    </div>
                  </div>
                  {(
                    result.data.checks as Array<{
                      header: string;
                      present: boolean;
                      recommendationAr: string;
                      recommendationEn: string;
                    }>
                  ).map((chk) => (
                    <div
                      key={chk.header}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs"
                    >
                      <div>
                        <p className="font-mono-cyber font-semibold text-white">{chk.header}</p>
                        {!chk.present && (
                          <p className="mt-0.5 text-slate-400">
                            {lang === "ar" ? chk.recommendationAr : chk.recommendationEn}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono-cyber text-[10px] font-bold ${
                          chk.present
                            ? "bg-[#00ff88]/20 text-[#00ff88]"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {chk.present ? "PRESENT" : "MISSING"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-[#05080c] p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <Terminal className="h-3.5 w-3.5 text-[#00ff88]" />
                  <span>STRUCTURED INTELLIGENCE OUTPUT</span>
                </div>
                <pre className="font-mono-cyber max-h-96 overflow-auto text-xs leading-relaxed text-emerald-300">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {!result && (
            <div className="cyber-glass flex items-center gap-3 rounded-2xl p-5 text-xs text-slate-400">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[#00ff88]" />
              <span>
                {lang === "ar"
                  ? "جميع الفحوصات تمر عبر مرشحات الحماية الخلفية لمنع الوصول إلى الشبكات الخاصة (127.0.0.0/8, 10.0.0.0/8, 169.254.169.254, IPv6 Loopback)."
                  : "All requests pass through server-side SSRF egress filters blocking 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254, and IPv6 private ranges."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
