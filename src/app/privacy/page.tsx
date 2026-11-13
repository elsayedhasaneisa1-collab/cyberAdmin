"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

export default function PrivacyPolicyPage() {
  const { lang } = useZeroTrace();

  return (
    <div className="cyber-glass space-y-5 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-[#00ff88]" />
        <h1 className="text-2xl font-bold text-white">
          {lang === "ar" ? "سياسة الخصوصية — ZERO TRACE" : "Privacy Policy — ZERO TRACE"}
        </h1>
      </div>

      {lang === "ar" ? (
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <p>
            يلتزم نظام <b>ZERO TRACE — ELITE CYBER INTELLIGENCE SYSTEM</b> بأعلى معايير الخصوصية وتقليل البيانات:
          </p>
          <ul className="list-disc space-y-2 ps-5">
            <li>لا يستخدم النظام أي قاعدة بيانات تقليدية لتخزين رسائل المستخدمين أو كلمات المرور النصية.</li>
            <li>عند استخدام أداة فحص قوة كلمات المرور، يتم حساب تجزئة SHA-1 محليًا على الخادم وإرسال أول 5 محارف فقط وفق بروتوكول k-Anonymity دون إرسال أو تسجيل كلمة المرور إطلاقًا.</li>
            <li>تُحفظ إعدادات البوت الهيكلية فقط (الأزرار، الأقسام، الأوامر، روابط الوسائط) عبر GitHub API باستخدام صلاحيات مقيدة.</li>
            <li>تبقى جميع المفاتيح السرية ورموز التوثيق معزولة داخل متغيرات البيئة على الخادم ولا تُكشف للواجهة الأمامية.</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <p>
            <b>ZERO TRACE — ELITE CYBER INTELLIGENCE SYSTEM</b> adheres to strict data-minimization and defensive privacy principles:
          </p>
          <ul className="list-disc space-y-2 ps-5">
            <li>No traditional database is used to store private chat histories or plaintext passwords.</li>
            <li>Password breach checks strictly follow the k-Anonymity model—only the first 5 hexadecimal characters of the SHA-1 hash are queried; candidate passwords are never stored or logged.</li>
            <li>Only structural bot settings (menus, buttons, categories, commands, external media metadata) are versioned via GitHub API.</li>
            <li>All API tokens and webhook secrets remain isolated in server-side Environment Variables.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
