"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Cpu,
  Film,
  FolderTree,
  HelpCircle,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MousePointerClick,
  RefreshCw,
  ServerCog,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import { LoginGate } from "./login-gate";
import { LuxuryFooter } from "./luxury-footer";

interface NavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelAr: "لوحة القيادة", labelEn: "Dashboard", icon: LayoutDashboard },
  { href: "/bot", labelAr: "إدارة البوت", labelEn: "Bot Management", icon: Bot },
  { href: "/buttons", labelAr: "محرر الأزرار", labelEn: "Buttons Editor", icon: MousePointerClick },
  { href: "/categories", labelAr: "إدارة الأقسام", labelEn: "Categories", icon: FolderTree },
  { href: "/media", labelAr: "مكتبة الوسائط", labelEn: "Media Library", icon: Film },
  { href: "/apis", labelAr: "مدير واجهات API", labelEn: "API Manager", icon: Cpu },
  { href: "/tools", labelAr: "أدوات الأمن السيبراني", labelEn: "Cyber Tools", icon: Wrench },
  { href: "/security", labelAr: "مركز الحماية", labelEn: "Security Center", icon: ShieldCheck },
  { href: "/logs", labelAr: "سجل النشاطات", labelEn: "Activity Logs", icon: Activity },
  { href: "/status", labelAr: "حالة النظام", labelEn: "System Status", icon: ServerCog },
  { href: "/settings", labelAr: "الإعدادات", labelEn: "Settings", icon: Settings },
  { href: "/help", labelAr: "مركز المساعدة", labelEn: "Help Center", icon: HelpCircle },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    lang,
    setLang,
    loading,
    saving,
    authenticated,
    sessionMode,
    sessionEmail,
    syncState,
    botLive,
    toasts,
    dismissToast,
    refreshAll,
    logoutSession,
  } = useZeroTrace();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isPublicLegalRoute = pathname === "/privacy" || pathname === "/terms";

  if (isPublicLegalRoute) {
    return (
      <div className="flex min-h-screen flex-col justify-between">
        <header className="border-b border-white/10 bg-[#06090d]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono-cyber text-sm font-bold tracking-[0.2em] text-white">
                  ZERO TRACE
                </p>
                <p className="font-mono-cyber text-[10px] tracking-[0.24em] text-[#00ff88]">
                  ELITE CYBER INTELLIGENCE
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:border-[#00ff88]/50"
              >
                {lang === "ar" ? "English" : "العربية"}
              </button>
              <Link
                href="/"
                className="cyber-btn-primary rounded-lg px-3.5 py-1.5 text-xs"
              >
                {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <LuxuryFooter />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl border border-[#00ff88]/50 bg-[#00ff88]/10 text-[#00ff88] shadow-[0_0_32px_rgba(0,255,136,0.3)]">
          <Shield className="h-7 w-7" />
        </div>
        <p className="font-mono-cyber text-xs tracking-[0.28em] text-[#00ff88]">
          INITIALIZING ZERO TRACE CORE...
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginGate />;
  }

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 z-50 flex w-72 flex-col border-e border-white/10 bg-[#070b10]/95 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : lang === "ar"
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00ff88]/45 bg-[#00ff88]/10 text-[#00ff88] shadow-[0_0_22px_rgba(0,255,136,0.22)]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono-cyber text-sm font-bold tracking-[0.2em] text-white">
                ZERO TRACE
              </p>
              <p className="font-mono-cyber text-[10px] tracking-[0.22em] text-[#00ff88]">
                ELITE CYBER INTEL
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  active
                    ? "border border-[#00ff88]/40 bg-[#00ff88]/12 text-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.12)]"
                    : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#00ff88]" : "text-slate-400"}`} />
                <span>{lang === "ar" ? item.labelAr : item.labelEn}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {lang === "ar" ? "تخزين الإعدادات" : "Config Storage"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono-cyber text-[10px] font-semibold ${
                  syncState.mode === "github"
                    ? "bg-[#00ff88]/15 text-[#00ff88]"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {syncState.mode === "github" ? "GITHUB API" : "EPHEMERAL"}
              </span>
            </div>
            {syncState.sha && (
              <p className="mt-1.5 font-mono-cyber text-[10px] text-slate-400">
                SHA: {syncState.sha.slice(0, 10)}
              </p>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {sessionMode === "bootstrap" && (
            <div className="border-b border-amber-400/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" />
                  <span>
                    {lang === "ar"
                      ? "وضع الإعداد الأولي نشط — أضف ADMIN_EMAIL وADMIN_PASSWORD_HASH في متغيرات Vercel لتفعيل المصادقة الإلزامية."
                      : "Bootstrap Setup Session active — configure ADMIN_EMAIL & ADMIN_PASSWORD_HASH in Vercel Env Vars to lock production access."}
                  </span>
                </div>
                <Link href="/status" className="shrink-0 font-semibold text-[#00ff88] underline">
                  {lang === "ar" ? "حالة المتغيرات" : "Check Env"}
                </Link>
              </div>
            </div>
          )}

          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06090d]/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-200 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="hidden items-center gap-2.5 sm:flex">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      botLive?.botInfo
                        ? "bg-[#00ff88] shadow-[0_0_10px_#00ff88]"
                        : "bg-amber-400"
                    }`}
                  />
                  <span className="text-xs font-medium text-slate-300">
                    {botLive?.botInfo
                      ? `@${botLive.botInfo.username || botLive.botInfo.first_name}`
                      : lang === "ar"
                      ? "بانتظار ربط TELEGRAM_BOT_TOKEN"
                      : "Awaiting TELEGRAM_BOT_TOKEN"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {saving && (
                  <span className="font-mono-cyber text-[11px] text-[#00ff88]">
                    {lang === "ar" ? "جاري المزامنة..." : "SYNCING..."}
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  title={lang === "ar" ? "تحديث البيانات" : "Refresh State"}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-[#00ff88]" : ""}`} />
                  <span className="hidden sm:inline">{lang === "ar" ? "تحديث" : "Sync"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
                >
                  <Languages className="h-3.5 w-3.5 text-[#00ff88]" />
                  <span>{lang === "ar" ? "EN" : "عربي"}</span>
                </button>

                <div className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 md:block">
                  {sessionEmail}
                </div>

                <button
                  type="button"
                  onClick={logoutSession}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{lang === "ar" ? "خروج" : "Logout"}</span>
                </button>
              </div>
            </div>
          </header>

          {toasts.length > 0 && (
            <div className="fixed bottom-5 end-5 z-50 flex max-w-sm flex-col gap-2">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  onClick={() => dismissToast(t.id)}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-xl transition ${
                    t.type === "success"
                      ? "border-[#00ff88]/50 bg-[#041810]/95 text-[#00ff88]"
                      : t.type === "error"
                      ? "border-rose-500/50 bg-[#1c070b]/95 text-rose-200"
                      : "border-cyan-400/40 bg-[#07151f]/95 text-cyan-200"
                  }`}
                >
                  {t.message}
                </div>
              ))}
            </div>
          )}

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>

        <LuxuryFooter />
      </div>
    </div>
  );
}
