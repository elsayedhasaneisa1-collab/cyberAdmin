"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Info,
  Play,
  ShieldAlert,
  ShieldCheck,
  Webhook,
  Wrench,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

export default function DashboardPage() {
  const {
    lang,
    config,
    syncState,
    telemetry,
    botLive,
    apiFetch,
    refreshAll,
    notify,
  } = useZeroTrace();

  const [probing, setProbing] = useState(false);

  const enabledApis = config.apis.filter((a) => a.enabled);
  const onlineApis = enabledApis.filter((a) => a.lastStatus === "online").length;
  const offlineApis = enabledApis.filter((a) => a.lastStatus === "offline").length;
  const untestedApis = enabledApis.filter(
    (a) => !a.lastStatus || a.lastStatus === "untested"
  ).length;

  const toolEntries = Object.entries(telemetry?.toolUsageCounts || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const maxToolRuns = toolEntries.length > 0 ? Math.max(...toolEntries.map((e) => e[1]), 1) : 1;

  const recentErrors = (telemetry?.recentEvents || [])
    .filter((ev) => ev.status === "error" || ev.status === "blocked")
    .slice(0, 6);

  const recentEventsSlice = (telemetry?.recentEvents || []).slice(0, 8);

  const handleProbeApis = async () => {
    setProbing(true);
    try {
      const res = await apiFetch("/api/admin/apis/probe", {
        method: "POST",
        body: JSON.stringify({ persist: true }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        await refreshAll(false);
        notify(
          "success",
          lang === "ar"
            ? "تم فحص حالة واجهات API الحية بنجاح."
            : "Completed live health probe of active APIs."
        );
      } else {
        notify("error", json.error || "API probe failed.");
      }
    } finally {
      setProbing(false);
    }
  };

  const formattedUpdatedAt =
    config.updatedAt && !config.updatedAt.startsWith("1970-")
      ? new Date(config.updatedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")
      : lang === "ar"
      ? "الإعداد الافتراضي الأولي (لم يُعدّل بعد)"
      : "Initial Bootstrap Default (Not edited yet)";

  const onlineRatio =
    enabledApis.length > 0 ? Math.round((onlineApis / enabledApis.length) * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (onlineRatio / 100) * circumference;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.25em] text-[#00ff88]">
            COMMAND TELEMETRY
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {lang === "ar" ? "لوحة القيادة السيبرانية" : "Cyber Intelligence Dashboard"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleProbeApis}
            disabled={probing}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88] transition hover:bg-[#00ff88]/20"
          >
            <Play className="h-3.5 w-3.5" />
            <span>
              {probing
                ? lang === "ar"
                  ? "جاري فحص APIs..."
                  : "Probing APIs..."
                : lang === "ar"
                ? "فحص حي لواجهات API"
                : "Probe Active APIs"}
            </span>
          </button>

          <Link
            href="/tools"
            className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>{lang === "ar" ? "تشغيل الأدوات الدفاعية" : "Launch Cyber Tools"}</span>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-4 text-xs text-cyan-100">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#00ff88]" />
          <p className="leading-relaxed">
            {lang === "ar"
              ? "شفافية معمارية: يعمل المشروع بدون أي قاعدة بيانات تقليدية وفق المتطلبات. جميع الأرقام المعروضة أدناه حقيقية 100% وتعكس العمليات المسجلة فعليًا في جلسة Serverless الحالية وإعدادات GitHub الحية؛ للاحتفاظ بإحصائيات تاريخية دائمة عبر إعادة تشغيل الخوادم السحابية يلزم ربط خدمة سجلات خارجية."
              : "Architectural Transparency: ZERO TRACE runs without any traditional database. All counters below reflect 100% genuine operations recorded in the active Serverless runtime and live GitHub configuration; permanent historical analytics across cold starts require an external log sink."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="cyber-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {lang === "ar" ? "حالة البوت (Telegram Bot)" : "Telegram Bot Status"}
            </span>
            <Bot className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="mt-3 text-xl font-bold text-white">
            {botLive?.botInfo
              ? lang === "ar"
                ? "متصل ونشط"
                : "Connected & Active"
              : botLive?.tokenConfigured
              ? lang === "ar"
                ? "خطأ في التوكن"
                : "Token Error"
              : lang === "ar"
              ? "غير مربوط بعد"
              : "Token Not Set"}
          </p>
          <p className="mt-1 font-mono-cyber text-xs text-slate-400">
            {botLive?.botInfo
              ? `@${botLive.botInfo.username || botLive.botInfo.first_name}`
              : "TELEGRAM_BOT_TOKEN"}
          </p>
        </div>

        <div className="cyber-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {lang === "ar" ? "حالة Webhook" : "Webhook Status"}
            </span>
            <Webhook className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="mt-3 text-xl font-bold text-white">
            {botLive?.webhookInfo?.url
              ? lang === "ar"
                ? "مفعّل عبر HTTPS"
                : "Active HTTPS"
              : lang === "ar"
              ? "غير مسجل"
              : "Not Registered"}
          </p>
          <p className="mt-1 truncate font-mono-cyber text-xs text-slate-400">
            {botLive?.webhookInfo?.url
              ? `${lang === "ar" ? "بالانتظار:" : "Pending:"} ${botLive.webhookInfo.pending_update_count}`
              : lang === "ar"
              ? "سجّله من صفحة إدارة البوت"
              : "Configure in Bot Management"}
          </p>
        </div>

        <div className="cyber-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {lang === "ar" ? "العمليات المسجلة فعليًا" : "Recorded Operations"}
            </span>
            <Activity className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="mt-3 font-mono-cyber text-2xl font-bold text-[#00ff88]">
            {telemetry?.totalOperations ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {lang === "ar"
              ? `تحديثات Webhook: ${telemetry?.webhookUpdatesProcessed ?? 0} | محظور أمنيًا: ${telemetry?.securityBlocksCount ?? 0}`
              : `Webhooks: ${telemetry?.webhookUpdatesProcessed ?? 0} | Blocked: ${telemetry?.securityBlocksCount ?? 0}`}
          </p>
        </div>

        <div className="cyber-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {lang === "ar" ? "حالة التخزين والإعدادات" : "Storage & Revision"}
            </span>
            <Database className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="mt-3 text-xl font-bold text-white">
            {syncState.mode === "github"
              ? `GitHub (Rev #${config.revision})`
              : lang === "ar"
              ? `مؤقت (Rev #${config.revision})`
              : `Ephemeral (Rev #${config.revision})`}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">{formattedUpdatedAt}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="cyber-glass rounded-2xl p-6 lg:col-span-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                {lang === "ar" ? "أكثر الأدوات استخدامًا (فعليًا)" : "Most Used Cyber Tools (Live)"}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === "ar"
                  ? "يتم التحديث فور تشغيل أي أداة من الموقع أو البوت"
                  : "Updates in real time as tools run via Web or Telegram"}
              </p>
            </div>
            <Link
              href="/tools"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#00ff88] hover:underline"
            >
              <span>{lang === "ar" ? "فتح المختبر" : "Open Lab"}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {toolEntries.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/25 p-6 text-center">
              <Wrench className="mb-2 h-7 w-7 text-slate-500" />
              <p className="text-xs font-medium text-slate-300">
                {lang === "ar"
                  ? "لم يتم تشغيل أي أداة خلال هذه الجلسة بعد (0 عمليات)."
                  : "No diagnostic tools have been executed in this session yet (0 runs)."}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {lang === "ar"
                  ? "لا نعرض أرقامًا وهمية — جرّب أي أداة من قسم أدوات الأمن السيبراني لرؤية الإحصائيات الحية."
                  : "Zero fake statistics — run any tool in Cyber Tools to populate real telemetry."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {toolEntries.slice(0, 6).map(([toolId, count]) => {
                const widthPct = Math.max(8, Math.round((count / maxToolRuns) * 100));
                return (
                  <div key={toolId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-cyber text-slate-200">{toolId}</span>
                      <span className="font-mono-cyber font-bold text-[#00ff88]">{count}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-emerald-400 transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center text-xs">
            <div className="rounded-xl bg-white/[0.02] p-3">
              <p className="font-mono-cyber text-lg font-bold text-white">
                {config.buttons.length}
              </p>
              <p className="text-[11px] text-slate-400">
                {lang === "ar" ? "الأزرار النشطة" : "Configured Buttons"}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.02] p-3">
              <p className="font-mono-cyber text-lg font-bold text-white">
                {config.categories.length}
              </p>
              <p className="text-[11px] text-slate-400">
                {lang === "ar" ? "الأقسام" : "Categories"}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.02] p-3">
              <p className="font-mono-cyber text-lg font-bold text-white">{config.media.length}</p>
              <p className="text-[11px] text-slate-400">
                {lang === "ar" ? "ملفات الوسائط" : "Media Assets"}
              </p>
            </div>
          </div>
        </div>

        <div className="cyber-glass rounded-2xl p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                {lang === "ar" ? "مؤشر حالة واجهات API" : "API Ecosystem Health"}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === "ar"
                  ? `${enabledApis.length} خدمة مفعّلة من أصل ${config.apis.length}`
                  : `${enabledApis.length} enabled of ${config.apis.length} cataloged APIs`}
              </p>
            </div>
            <Cpu className="h-5 w-5 text-[#00ff88]" />
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-2 sm:flex-row">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="9"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="#00ff88"
                  strokeWidth="9"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <p className="font-mono-cyber text-xl font-bold text-white">{onlineRatio}%</p>
                <p className="text-[10px] text-slate-400">
                  {lang === "ar" ? "متصل" : "Verified"}
                </p>
              </div>
            </div>

            <div className="w-full flex-1 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {lang === "ar" ? "متاح (Online)" : "Online"}
                </span>
                <span className="font-mono-cyber font-bold text-white">{onlineApis}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="flex items-center gap-2 text-slate-300">
                  <Activity className="h-3.5 w-3.5 text-amber-300" />
                  {lang === "ar" ? "لم يُفحص بعد" : "Untested"}
                </span>
                <span className="font-mono-cyber font-bold text-white">{untestedApis}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {lang === "ar" ? "غير متاح" : "Offline"}
                </span>
                <span className="font-mono-cyber font-bold text-white">{offlineApis}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <Link
              href="/apis"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-slate-200 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
            >
              <span>{lang === "ar" ? "إدارة جميع واجهات API" : "Manage All API Services"}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="cyber-glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <span>
                {lang === "ar"
                  ? "الأخطاء والعمليات المحظورة الأخيرة"
                  : "Recent Security Blocks & Errors"}
              </span>
            </h2>
            <span className="font-mono-cyber text-xs text-slate-400">
              {(telemetry?.errorsCount ?? 0) + (telemetry?.securityBlocksCount ?? 0)}
            </span>
          </div>

          {recentErrors.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/[0.05] p-4 text-xs text-emerald-200">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#00ff88]" />
              <span>
                {lang === "ar"
                  ? "لا توجد أخطاء أو تهديدات مسجلة في السجل الحالي."
                  : "Zero errors or blocked threats recorded in active runtime log."}
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentErrors.map((err) => (
                <div
                  key={err.id}
                  className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-cyber font-semibold text-rose-300">
                      {err.action}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-300">{err.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cyber-glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Activity className="h-4 w-4 text-[#00ff88]" />
              <span>{lang === "ar" ? "آخر العمليات الحية" : "Latest Operational Stream"}</span>
            </h2>
            <Link href="/logs" className="text-xs font-semibold text-[#00ff88] hover:underline">
              {lang === "ar" ? "عرض السجل الكامل" : "Full Logs"}
            </Link>
          </div>

          {recentEventsSlice.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-slate-400">
              {lang === "ar"
                ? "لا توجد أحداث مسجلة بعد."
                : "No events recorded yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {recentEventsSlice.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono-cyber text-[11px] font-semibold text-white">
                      {ev.action}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{ev.details}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono-cyber text-[10px] ${
                      ev.status === "success"
                        ? "bg-[#00ff88]/15 text-[#00ff88]"
                        : ev.status === "blocked"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {ev.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
