"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ExternalLink,
  KeyRound,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type { ApiCategory, ApiServiceEntry } from "@/types/zero-trace";

const API_CATEGORIES: ApiCategory[] = [
  "OSINT",
  "DNS",
  "IP_INFO",
  "WHOIS",
  "SSL",
  "DOMAIN",
  "URL_ANALYSIS",
  "THREAT_INTEL",
  "HASHING",
  "CRYPTOGRAPHY",
  "SECURITY_HEADERS",
  "HTTP_ANALYSIS",
  "EDUCATIONAL",
  "LINUX_LEARNING",
  "CTF",
];

export default function ApiManagerPage() {
  const {
    lang,
    config,
    saving,
    saveConfigPatch,
    apiFetch,
    refreshAll,
    notify,
  } = useZeroTrace();

  const [apis, setApis] = useState<ApiServiceEntry[]>(config.apis);
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [probingId, setProbingId] = useState<string | null>(null);
  const [editingApi, setEditingApi] = useState<ApiServiceEntry | null>(null);

  useEffect(() => {
    setApis(config.apis);
  }, [config.apis]);

  const filteredApis = useMemo(() => {
    return apis.filter((a) => {
      const catMatch = selectedCat === "ALL" || a.category === selectedCat;
      const q = query.trim().toLowerCase();
      const qMatch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.endpointPattern.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return catMatch && qMatch;
    });
  }, [apis, selectedCat, query]);

  const handleToggleEnabled = async (id: string) => {
    const next = apis.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
    setApis(next);
    await saveConfigPatch("apis.toggle", { apis: next });
  };

  const handleProbeSingle = async (apiId: string) => {
    setProbingId(apiId);
    try {
      const res = await apiFetch("/api/admin/apis/probe", {
        method: "POST",
        body: JSON.stringify({ apiId, persist: true }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        await refreshAll(false);
        const item = json.results?.[0];
        notify(
          item?.status === "online" ? "success" : "info",
          `${apiId}: ${item?.status?.toUpperCase() || "CHECKED"} (${item?.latencyMs ?? 0}ms)`
        );
      } else {
        notify("error", json.error || "Probe failed.");
      }
    } finally {
      setProbingId(null);
    }
  };

  const handleOpenNew = () => {
    setEditingApi({
      id: `api_custom_${Date.now()}`,
      name: "New Public Security API",
      category: "OSINT",
      endpointPattern: "https://api.example.org/v1/lookup?q={domain}",
      probeUrl: "https://api.example.org/v1/health",
      docsUrl: "https://example.org/docs",
      requiresKey: false,
      envKeyName: "",
      freeTierLimit: "Free public rate limit",
      termsSummaryAr: "خدمة قانونية موثقة للفحص الدفاعي.",
      termsSummaryEn: "Verified public defensive intelligence endpoint.",
      enabled: true,
      verifiedSource: "Official Documentation",
      lastStatus: "untested",
    });
  };

  const handleSaveApiModal = async () => {
    if (!editingApi) return;
    const exists = apis.some((a) => a.id === editingApi.id);
    const next = exists
      ? apis.map((a) => (a.id === editingApi.id ? editingApi : a))
      : [editingApi, ...apis];
    const ok = await saveConfigPatch("apis.upsert", { apis: next });
    if (ok) {
      setApis(next);
      setEditingApi(null);
    }
  };

  const handleDeleteApi = async (id: string) => {
    const next = apis.filter((a) => a.id !== id);
    const ok = await saveConfigPatch("apis.delete", { apis: next });
    if (ok) setApis(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            VERIFIED OSINT & SECURITY APIS
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "مدير واجهات API المجانية والمفتوحة الموثقة"
              : "Verified Cybersecurity & OSINT API Manager"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleProbeSingle("")}
            disabled={probingId !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88]"
          >
            <Activity className="h-4 w-4" />
            <span>
              {probingId === ""
                ? lang === "ar"
                  ? "جاري الفحص..."
                  : "Probing..."
                : lang === "ar"
                ? "فحص جماعي للخدمات"
                : "Batch Health Probe"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>{lang === "ar" ? "إضافة خدمة API" : "Add API Service"}</span>
          </button>
        </div>
      </div>

      <div className="cyber-glass rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "ابحث باسم الخدمة أو الرابط أو الفئة..."
                  : "Search by API name, endpoint, or category..."
              }
              className="cyber-input w-full rounded-xl py-2 pe-4 ps-10 text-xs"
            />
          </div>

          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="cyber-input rounded-xl px-3.5 py-2 text-xs"
          >
            <option value="ALL">
              {lang === "ar" ? `جميع الفئات (${apis.length})` : `All Categories (${apis.length})`}
            </option>
            {API_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredApis.map((api) => (
          <div key={api.id} className="cyber-glass flex flex-col justify-between rounded-2xl p-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-[#00ff88]/30 bg-[#00ff88]/10 px-2 py-0.5 font-mono-cyber text-[10px] font-bold text-[#00ff88]">
                    {api.category}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono-cyber text-[10px] ${
                      api.lastStatus === "online"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : api.lastStatus === "offline"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {(api.lastStatus || "untested").toUpperCase()}
                    {api.lastLatencyMs ? ` • ${api.lastLatencyMs}ms` : ""}
                  </span>
                </div>

                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={api.enabled}
                    onChange={() => handleToggleEnabled(api.id)}
                    className="h-4 w-4 accent-[#00ff88]"
                  />
                  <span>{api.enabled ? (lang === "ar" ? "مفعّل" : "Enabled") : lang === "ar" ? "معطّل" : "Disabled"}</span>
                </label>
              </div>

              <h3 className="text-base font-bold text-white">{api.name}</h3>
              <p className="mt-1 break-all font-mono-cyber text-[11px] text-slate-400">
                {api.endpointPattern}
              </p>

              <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                {lang === "ar" ? api.termsSummaryAr : api.termsSummaryEn}
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-white/5 bg-black/30 p-3 text-[11px] sm:grid-cols-2">
                <div>
                  <span className="text-slate-400">
                    {lang === "ar" ? "الحد المجاني:" : "Free Quota:"}
                  </span>
                  <p className="font-medium text-slate-200">{api.freeTierLimit}</p>
                </div>
                <div>
                  <span className="text-slate-400">
                    {lang === "ar" ? "المفتاح (API Key):" : "Authentication:"}
                  </span>
                  <p className="flex items-center gap-1 font-mono-cyber text-slate-200">
                    <KeyRound className="h-3 w-3 text-[#00ff88]" />
                    {api.requiresKey
                      ? `Required (${api.envKeyName || "ENV"})`
                      : api.envKeyName
                      ? `Optional (${api.envKeyName})`
                      : "No Key Required"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
              <a
                href={api.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#00ff88] hover:underline"
              >
                <span>{lang === "ar" ? "التوثيق الرسمي" : "Official Docs"}</span>
                <ExternalLink className="h-3 w-3" />
              </a>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleProbeSingle(api.id)}
                  disabled={probingId === api.id}
                  className="rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00ff88]"
                >
                  {probingId === api.id
                    ? "..."
                    : lang === "ar"
                    ? "فحص الاتصال"
                    : "Probe"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingApi(api)}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-200"
                >
                  {lang === "ar" ? "تعديل" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteApi(api.id)}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1 text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingApi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="cyber-glass-strong max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {lang === "ar" ? "إعداد خدمة API (المفاتيح تبقى على السيرفر فقط)" : "Configure API Service (Server-Side Env Keys Only)"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingApi(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-slate-300">Name</label>
                  <input
                    type="text"
                    value={editingApi.name}
                    onChange={(e) => setEditingApi({ ...editingApi, name: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-300">Category</label>
                  <select
                    value={editingApi.category}
                    onChange={(e) =>
                      setEditingApi({ ...editingApi, category: e.target.value as ApiCategory })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2"
                  >
                    {API_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-slate-300">Endpoint Pattern (HTTPS)</label>
                <input
                  type="text"
                  value={editingApi.endpointPattern}
                  onChange={(e) =>
                    setEditingApi({ ...editingApi, endpointPattern: e.target.value })
                  }
                  className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-slate-300">Health Probe URL (HTTPS)</label>
                  <input
                    type="url"
                    value={editingApi.probeUrl}
                    onChange={(e) => setEditingApi({ ...editingApi, probeUrl: e.target.value })}
                    className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-300">Official Documentation URL</label>
                  <input
                    type="url"
                    value={editingApi.docsUrl}
                    onChange={(e) => setEditingApi({ ...editingApi, docsUrl: e.target.value })}
                    className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-slate-300">Free Tier Rate Limit</label>
                  <input
                    type="text"
                    value={editingApi.freeTierLimit}
                    onChange={(e) =>
                      setEditingApi({ ...editingApi, freeTierLimit: e.target.value })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-300">
                    Server Env Var Name (Never enter secret key value!)
                  </label>
                  <input
                    type="text"
                    value={editingApi.envKeyName || ""}
                    onChange={(e) =>
                      setEditingApi({
                        ...editingApi,
                        envKeyName: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                      })
                    }
                    placeholder="e.g. ABUSECH_AUTH_KEY"
                    className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={editingApi.requiresKey}
                  onChange={(e) =>
                    setEditingApi({ ...editingApi, requiresKey: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#00ff88]"
                />
                <span>
                  {lang === "ar"
                    ? "هذه الخدمة تتطلب مفتاح API إلزامي على السيرفر"
                    : "Requires mandatory API Key via Server Environment Variable"}
                </span>
              </label>

              <div>
                <label className="mb-1 block text-slate-300">Terms Summary (AR)</label>
                <input
                  type="text"
                  value={editingApi.termsSummaryAr}
                  onChange={(e) =>
                    setEditingApi({ ...editingApi, termsSummaryAr: e.target.value })
                  }
                  className="cyber-input w-full rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-slate-300">Terms Summary (EN)</label>
                <input
                  type="text"
                  value={editingApi.termsSummaryEn}
                  onChange={(e) =>
                    setEditingApi({ ...editingApi, termsSummaryEn: e.target.value })
                  }
                  className="cyber-input w-full rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleSaveApiModal}
                  disabled={saving}
                  className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{lang === "ar" ? "حفظ الخدمة" : "Save Service"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
