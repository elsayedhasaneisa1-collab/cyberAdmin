"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, GitBranch, Send, Shield } from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

const WHATSAPP_URL =
  "https://wa.me/201550802408?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A8%D8%AE%D8%B5%D9%88%D8%B5%20ZERO%20TRACE.";

export function LuxuryFooter() {
  const { lang, config, botLive } = useZeroTrace();

  const telegramHref =
    botLive?.botInfo?.username
      ? `https://t.me/${botLive.botInfo.username}`
      : config.settings.telegramChannelUrl || "https://telegram.org";

  const githubHref = config.settings.githubPublicUrl || "https://github.com";

  return (
    <footer className="mt-12 border-t border-[#00ff88]/15 bg-[#06090d]/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.2)]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono-cyber text-base font-bold tracking-[0.22em] text-white">
                  ZERO TRACE
                </p>
                <p className="font-mono-cyber text-[11px] font-semibold tracking-[0.28em] text-[#00ff88]">
                  ELITE CYBER INTELLIGENCE
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              {lang === "ar"
                ? "منصة ذكاء سيبراني دفاعية وتعليمية متكاملة لإدارة بوت تيليجرام والأدوات الأمنية."
                : "Integrated defensive cyber intelligence & Telegram command operations platform."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Telegram</span>
            </a>

            <a
              href={githubHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>

            <Link
              href="/privacy"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
            >
              {lang === "ar" ? "سياسة الخصوصية (Privacy Policy)" : "Privacy Policy"}
            </Link>

            <Link
              href="/terms"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[#00ff88]/40 hover:text-[#00ff88]"
            >
              {lang === "ar" ? "شروط الخدمة (Terms of Service)" : "Terms of Service"}
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} <span className="font-semibold text-white">ZERO TRACE</span> —{" "}
            {lang === "ar" ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Developed by</span>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#00ff88]/40 bg-[#00ff88]/10 px-3.5 py-1 font-semibold text-[#00ff88] shadow-[0_0_16px_rgba(0,255,136,0.18)] transition hover:bg-[#00ff88] hover:text-[#04140c]"
            >
              <span>EL-sayed Hasan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
