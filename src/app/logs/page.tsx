"use client";

import React, { useMemo, useState } from "react";
import { Activity, Download, Search, Trash2 } from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";

export default function ActivityLogsPage() {
  const { lang, telemetry, apiFetch, refreshAll, notify } = useZeroTrace();

  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const events = telemetry?.recentEvents || [];

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const catOk = categoryFilter === "ALL" || ev.category === categoryFilter;
      const stOk = statusFilter === "ALL" || ev.status === statusFilter;
      const q = searchText.trim().toLowerCase();
      const qOk =
        !q ||
        ev.action.toLowerCase().includes(q) ||
        ev.details.toLowerCase().includes(q) ||
        ev.actor.toLowerCase().includes(q);
      return catOk && stOk && qOk;
    });
  }, [events, categoryFilter, statusFilter, searchText]);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zero-trace-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    const res = await apiFetch("/api/admin/status", {
      method: "POST",
      body: JSON.stringify({ action: "clear_logs" }),
    });
    if (res.ok) {
      await refreshAll(false);
      notify(
        "info",
        lang === "ar" ? "تم تفريغ ذاكرة السجل المؤقتة." : "Cleared runtime log buffer."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            AUDIT & EVENT STREAM
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "سجل النشاطات والأحداث الأمنية"
              : "Security & Operational Activity Logs"}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-3.5 py-2 text-xs font-semibold text-[#00ff88]"
          >
            <Download className="h-4 w-4" />
            <span>{lang === "ar" ? "تصدير JSON" : "Export JSON"}</span>
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
            <span>{lang === "ar" ? "مسح السجل" : "Clear Buffer"}</span>
          </button>
        </div>
      </div>

      <div className="cyber-glass rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute start-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "بحث بالعملية أو الفاعل أو التفاصيل..."
                  : "Filter by action, actor, or details..."
              }
              className="cyber-input w-full rounded-xl py-2 pe-3 ps-10 text-xs"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="cyber-input rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">{lang === "ar" ? "جميع الفئات" : "All Categories"}</option>
            <option value="AUTH">AUTH</option>
            <option value="WEBHOOK">WEBHOOK</option>
            <option value="CONFIG">CONFIG</option>
            <option value="TOOL">TOOL</option>
            <option value="MEDIA">MEDIA</option>
            <option value="SECURITY_BLOCK">SECURITY_BLOCK</option>
            <option value="API_PROBE">API_PROBE</option>
            <option value="BOT_SYNC">BOT_SYNC</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cyber-input rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
            <option value="success">SUCCESS</option>
            <option value="blocked">BLOCKED</option>
            <option value="error">ERROR</option>
          </select>
        </div>
      </div>

      <div className="cyber-glass overflow-hidden rounded-2xl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Activity className="mb-2 h-8 w-8 text-slate-500" />
            <p className="text-xs text-slate-400">
              {lang === "ar"
                ? "لا توجد سجلات مطابقة لمعايير التصفية الحالية."
                : "No log entries match the selected filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-white/10 bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "الوقت" : "Timestamp"}</th>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "الحدث" : "Action"}</th>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "الفاعل" : "Actor"}</th>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "التفاصيل" : "Details"}</th>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 font-mono-cyber text-[11px] text-slate-400">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono-cyber text-[11px] text-[#00ff88]">
                      {ev.category}
                    </td>
                    <td className="px-4 py-3 font-mono-cyber font-semibold text-white">
                      {ev.action}
                    </td>
                    <td className="px-4 py-3 font-mono-cyber text-[11px] text-slate-300">
                      {ev.actor}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-300">{ev.details}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono-cyber text-[10px] font-bold ${
                          ev.status === "success"
                            ? "bg-[#00ff88]/15 text-[#00ff88]"
                            : ev.status === "blocked"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {ev.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
