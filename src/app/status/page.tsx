"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  RefreshCw,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

export default function SystemStatusPage() {
  const { lang, envReadiness, syncState, botLive, telemetry, refreshAll } =
    useZeroTrace();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            SYSTEM HEALTH & SECRET ISOLATION
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "حالة النظام ومتغيرات البيئة (بدون كشف الأسرار)"
              : "System Status & Zero-Leak Environment Matrix"}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => refreshAll(true)}
          className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{lang === "ar" ? "فحص شامل للخدمات" : "Refresh Live Status"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="cyber-glass rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">GitHub API Storage</span>
            <Database className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="text-lg font-bold text-white">
            {syncState.configured
              ? lang === "ar"
                ? "متصل بـ GitHub API"
                : "GitHub API Connected"
              : lang === "ar"
              ? "وضع الجلسة المؤقتة"
              : "Ephemeral Runtime Mode"}
          </p>
          <p className="mt-1 font-mono-cyber text-[11px] text-slate-400">
            {syncState.repository
              ? `${syncState.repository} (${syncState.configPath})`
              : "Configure GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO"}
          </p>
        </div>

        <div className="cyber-glass rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Telegram Bot Engine</span>
            <ServerCog className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="text-lg font-bold text-white">
            {botLive?.botInfo
              ? `Online (@${botLive.botInfo.username || botLive.botInfo.first_name})`
              : lang === "ar"
              ? "في انتظار التوكن"
              : "Awaiting Bot Token"}
          </p>
          <p className="mt-1 font-mono-cyber text-[11px] text-slate-400">
            Webhook: {botLive?.webhookInfo?.url ? "Active HTTPS" : "Unbound"}
          </p>
        </div>

        <div className="cyber-glass rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Serverless Runtime</span>
            <ShieldCheck className="h-5 w-5 text-[#00ff88]" />
          </div>
          <p className="text-lg font-bold text-white">
            {lang === "ar" ? "متوافق مع Vercel Serverless" : "Vercel Serverless Ready"}
          </p>
          <p className="mt-1 font-mono-cyber text-[11px] text-slate-400">
            Dup Updates Ignored: {telemetry?.webhookDuplicatesIgnored ?? 0}
          </p>
        </div>
      </div>

      <div className="cyber-glass rounded-2xl p-6">
        <h2 className="mb-1 text-base font-bold text-white">
          {lang === "ar"
            ? "مصفوفة جاهزية متغيرات البيئة (Environment Variables)"
            : "Environment Variables Readiness Matrix"}
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          {lang === "ar"
            ? "تعرض هذه القائمة حالة وجود المتغير على السيرفر فقط (Configured / Missing) دون إرسال أي قيمة سرية للواجهة الأمامية."
            : "Displays boolean presence only (Configured / Missing) — secret values never leave the server."}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {envReadiness.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-4 py-3"
            >
              <div>
                <p className="font-mono-cyber text-xs font-semibold text-white">{item.key}</p>
                <p className="text-[10px] text-slate-400">{item.group}</p>
              </div>
              {item.configured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#00ff88]/15 px-2.5 py-1 font-mono-cyber text-[10px] font-bold text-[#00ff88]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  CONFIGURED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-mono-cyber text-[10px] font-bold text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  MISSING
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
