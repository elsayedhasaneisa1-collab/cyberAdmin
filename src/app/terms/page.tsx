"use client";

import React from "react";
import { Shield } from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

export default function TermsOfServicePage() {
  const { lang } = useZeroTrace();

  return (
    <div className="cyber-glass space-y-5 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-[#00ff88]" />
        <h1 className="text-2xl font-bold text-white">
          {lang === "ar" ? "شروط الخدمة والاستخدام القانوني — ZERO TRACE" : "Terms of Service & Authorized Use — ZERO TRACE"}
        </h1>
      </div>

      {lang === "ar" ? (
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <p>
            باستخدامك لمنصة وبوت <b>ZERO TRACE</b>، فإنك توافق على شروط الاستخدام القانوني والأخلاقي التالية:
          </p>
          <ul className="list-disc space-y-2 ps-5">
            <li>جميع الأدوات المتوفرة في النظام دفاعية وتعليمية بحتة ومخصصة فقط للأنظمة والنطاقات التي تملكها أو تملك تصريحًا رسميًا ومكتوبًا بفحصها.</li>
            <li>يُحظر تمامًا استخدام المنصة أو البوت في أي نشاط غير قانوني، أو محاولة تجاوز صلاحيات، أو إغراق خوادم خارجية بالطلبات.</li>
            <li>يطبّق النظام حظرًا تلقائيًا على عناوين الشبكات الداخلية والخاصة (SSRF Protection) وتحديدًا لمعدل الطلبات (Rate Limiting) وتسجيلاً للأحداث الأمنية.</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <p>
            By accessing or operating <b>ZERO TRACE</b>, you agree to the following mandatory ethical and legal terms:
          </p>
          <ul className="list-disc space-y-2 ps-5">
            <li>All utilities provided by ZERO TRACE are strictly defensive and educational, restricted exclusively to domains, networks, and assets you own or have explicit written authorization to test.</li>
            <li>Unauthorized scanning, exploitation attempts, credential abuse, or denial-of-service activity is strictly prohibited.</li>
            <li>The platform enforces automated SSRF private-network blocking, rate limiting, and security event logging.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
