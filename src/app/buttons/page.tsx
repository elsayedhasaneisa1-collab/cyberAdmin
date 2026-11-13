"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Edit3,
  ExternalLink,
  FolderOpen,
  GripVertical,
  Plus,
  Save,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type { BotButtonItem, BotButtonType, CyberToolId } from "@/types/zero-trace";

const TOOL_LIST: Array<{ id: CyberToolId; name: string }> = [
  { id: "ip_info", name: "IP Information" },
  { id: "dns_lookup", name: "DNS Lookup" },
  { id: "whois_lookup", name: "WHOIS / RDAP Lookup" },
  { id: "ssl_checker", name: "SSL Certificate Checker" },
  { id: "security_headers", name: "Security Headers Analyzer" },
  { id: "url_reputation", name: "URL Reputation Checker" },
  { id: "hash_generator", name: "Hash Generator" },
  { id: "base64_codec", name: "Base64 Encoder / Decoder" },
  { id: "password_strength", name: "Password Strength Analyzer" },
  { id: "http_analyzer", name: "HTTP Response Analyzer" },
  { id: "domain_info", name: "Domain Information" },
  { id: "network_education", name: "Basic Network Education" },
  { id: "learning_center", name: "Cybersecurity Learning Center" },
];

export default function ButtonsEditorPage() {
  const { lang, config, saving, saveConfigPatch } = useZeroTrace();

  const [buttons, setButtons] = useState<BotButtonItem[]>(config.buttons);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingBtn, setEditingBtn] = useState<BotButtonItem | null>(null);
  const [simParentId, setSimParentId] = useState<string | null>(null);
  const [simOutput, setSimOutput] = useState<string>("");

  useEffect(() => {
    setButtons(config.buttons);
  }, [config.buttons]);

  const submenus = useMemo(
    () => buttons.filter((b) => b.type === "submenu"),
    [buttons]
  );

  const visibleButtons = useMemo(
    () =>
      buttons
        .filter((b) => (b.parentId || null) === activeParentId)
        .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.order - b.order)),
    [buttons, activeParentId]
  );

  const applySequentialRows = (scopeList: BotButtonItem[], allList: BotButtonItem[]) => {
    const updatedScope = scopeList.map((b, index) => ({
      ...b,
      row: Math.floor(index / 2),
      order: index % 2,
    }));
    const map = new Map(updatedScope.map((u) => [u.id, u]));
    return allList.map((item) => map.get(item.id) || item);
  };

  const handleDropOnButton = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const current = [...visibleButtons];
    const fromIdx = current.findIndex((b) => b.id === draggedId);
    const toIdx = current.findIndex((b) => b.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setButtons((prev) => applySequentialRows(current, prev));
    setDraggedId(null);
  };

  const moveItemByDelta = (id: string, delta: number) => {
    const current = [...visibleButtons];
    const idx = current.findIndex((b) => b.id === id);
    const nextIdx = idx + delta;
    if (idx === -1 || nextIdx < 0 || nextIdx >= current.length) return;
    const [moved] = current.splice(idx, 1);
    current.splice(nextIdx, 0, moved);
    setButtons((prev) => applySequentialRows(current, prev));
  };

  const handleCreateButton = () => {
    const nextRow = Math.floor(visibleButtons.length / 2);
    const nextOrder = visibleButtons.length % 2;
    const fresh: BotButtonItem = {
      id: `btn_${Date.now()}`,
      labelAr: "زر سيبراني جديد",
      labelEn: "New Cyber Button",
      type: "tool",
      parentId: activeParentId,
      categoryId: config.categories[0]?.id || null,
      row: nextRow,
      order: nextOrder,
      enabled: true,
      toolId: "ip_info",
    };
    setButtons((prev) => [...prev, fresh]);
    setEditingBtn(fresh);
  };

  const handleDeleteButton = (id: string) => {
    setButtons((prev) =>
      prev
        .filter((b) => b.id !== id)
        .map((b) => (b.parentId === id ? { ...b, parentId: null } : b))
    );
    if (editingBtn?.id === id) setEditingBtn(null);
    if (activeParentId === id) setActiveParentId(null);
  };

  const handleUpdateEditing = (patch: Partial<BotButtonItem>) => {
    if (!editingBtn) return;
    const updated = { ...editingBtn, ...patch };
    setEditingBtn(updated);
    setButtons((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleSaveButtons = async () => {
    await saveConfigPatch("buttons.editor", { buttons });
  };

  const simButtons = useMemo(
    () =>
      buttons
        .filter((b) => b.enabled && (b.parentId || null) === simParentId)
        .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.order - b.order)),
    [buttons, simParentId]
  );

  const simRows = useMemo(() => {
    const grouped = new Map<number, BotButtonItem[]>();
    for (const b of simButtons) {
      const arr = grouped.get(b.row) || [];
      arr.push(b);
      grouped.set(b.row, arr);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);
  }, [simButtons]);

  const handleSimClick = (btn: BotButtonItem) => {
    if (btn.type === "submenu") {
      setSimParentId(btn.id);
      setSimOutput(
        lang === "ar"
          ? `تم فتح القائمة الفرعية: ${btn.labelAr}`
          : `Opened submenu: ${btn.labelEn}`
      );
      return;
    }
    if (btn.type === "url") {
      setSimOutput(`🔗 URL -> ${btn.url || "https://"}`);
      return;
    }
    if (btn.type === "tool") {
      setSimOutput(
        lang === "ar"
          ? `🛠️ سيطلب البوت إدخال الهدف لتشغيل الأداة: ${btn.toolId}`
          : `🛠️ Bot prompts user input to run tool: ${btn.toolId}`
      );
      return;
    }
    if (btn.type === "media") {
      const med = config.media.find((m) => m.id === btn.mediaId);
      setSimOutput(
        med
          ? `🎬 ${lang === "ar" ? "يرسل البوت مباشرة:" : "Bot sends media directly:"} ${
              med.titleAr || med.titleEn
            } (${med.type})`
          : lang === "ar"
          ? "⚠️ لم يتم ربط ملف وسائط بعد"
          : "⚠️ No media item linked yet"
      );
      return;
    }
    setSimOutput(
      (lang === "ar" ? btn.responseTextAr : btn.responseTextEn) ||
        btn.responseTextAr ||
        btn.responseTextEn ||
        "..."
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            INLINE KEYBOARD ARCHITECT
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "محرر الأزرار والقوائم الفرعية بالسحب والإفلات"
              : "Drag & Drop Buttons & Submenus Editor"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCreateButton}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88] hover:bg-[#00ff88]/20"
          >
            <Plus className="h-4 w-4" />
            <span>{lang === "ar" ? "إنشاء زر جديد" : "New Button"}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveButtons}
            disabled={saving}
            className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          >
            <Save className="h-4 w-4" />
            <span>
              {saving
                ? lang === "ar"
                  ? "جاري الحفظ..."
                  : "Saving..."
                : lang === "ar"
                ? "حفظ وتحديث البوت"
                : "Save & Publish to Bot"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs">
        <span className="font-semibold text-slate-400">
          {lang === "ar" ? "القائمة الحالية:" : "Active Menu Scope:"}
        </span>
        <button
          type="button"
          onClick={() => setActiveParentId(null)}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeParentId === null
              ? "bg-[#00ff88] text-[#03140b]"
              : "bg-white/[0.04] text-slate-300 hover:text-white"
          }`}
        >
          {lang === "ar" ? "🏠 القائمة الرئيسية" : "🏠 Root Menu"}
        </button>

        {submenus.map((sm) => (
          <button
            key={sm.id}
            type="button"
            onClick={() => setActiveParentId(sm.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
              activeParentId === sm.id
                ? "bg-[#00ff88] text-[#03140b]"
                : "bg-white/[0.04] text-slate-300 hover:text-white"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{lang === "ar" ? sm.labelAr : sm.labelEn}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="cyber-glass rounded-2xl p-5">
            <p className="mb-3 text-xs text-slate-400">
              {lang === "ar"
                ? "اسحب وأفلت الأزرار لإعادة ترتيبها أو استخدم أسهم الترتيب على الهاتف."
                : "Drag and drop cards to reorder, or use up/down controls on mobile."}
            </p>

            {visibleButtons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-slate-400">
                {lang === "ar"
                  ? "لا توجد أزرار في هذه القائمة بعد. اضغط «إنشاء زر جديد»."
                  : "No buttons in this menu level yet. Click 'New Button'."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleButtons.map((btn, index) => (
                  <div
                    key={btn.id}
                    draggable
                    onDragStart={() => setDraggedId(btn.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnButton(btn.id)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                      editingBtn?.id === btn.id
                        ? "border-[#00ff88]/60 bg-[#00ff88]/[0.08]"
                        : "border-white/10 bg-black/35 hover:border-white/25"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-500" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-bold text-white">
                            {lang === "ar" ? btn.labelAr : btn.labelEn}
                          </span>
                          <span className="rounded-md border border-[#00ff88]/30 bg-[#00ff88]/10 px-2 py-0.5 font-mono-cyber text-[10px] text-[#00ff88]">
                            {btn.type.toUpperCase()}
                          </span>
                          {!btn.enabled && (
                            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300">
                              {lang === "ar" ? "معطّل" : "Disabled"}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono-cyber text-[10px] text-slate-400">
                          Row {btn.row + 1} • Col {btn.order + 1}
                          {btn.type === "tool" && btn.toolId ? ` • Tool: ${btn.toolId}` : ""}
                          {btn.type === "url" && btn.url ? ` • ${btn.url}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveItemByDelta(btn.id, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-[#00ff88]/40 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItemByDelta(btn.id, 1)}
                        disabled={index === visibleButtons.length - 1}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-[#00ff88]/40 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      {btn.type === "submenu" && (
                        <button
                          type="button"
                          onClick={() => setActiveParentId(btn.id)}
                          className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-200"
                        >
                          {lang === "ar" ? "فتح الفرعية" : "Open"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingBtn(btn)}
                        className="rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-slate-200 hover:text-[#00ff88]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteButton(btn.id)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editingBtn && (
            <div className="cyber-glass-strong rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  {lang === "ar" ? "تعديل خصائص الزر" : "Edit Button Configuration"}
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingBtn.enabled}
                    onChange={(e) => handleUpdateEditing({ enabled: e.target.checked })}
                    className="h-4 w-4 accent-[#00ff88]"
                  />
                  <span>{lang === "ar" ? "مفعّل" : "Enabled"}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "نص الزر (عربي)" : "Label (Arabic)"}
                  </label>
                  <input
                    type="text"
                    value={editingBtn.labelAr}
                    onChange={(e) => handleUpdateEditing({ labelAr: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "نص الزر (إنجليزي)" : "Label (English)"}
                  </label>
                  <input
                    type="text"
                    value={editingBtn.labelEn}
                    onChange={(e) => handleUpdateEditing({ labelEn: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "نوع الوظيفة" : "Action Type"}
                  </label>
                  <select
                    value={editingBtn.type}
                    onChange={(e) =>
                      handleUpdateEditing({ type: e.target.value as BotButtonType })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="submenu">
                      {lang === "ar" ? "قائمة فرعية (Submenu)" : "Submenu"}
                    </option>
                    <option value="tool">
                      {lang === "ar" ? "أداة أمن سيبراني (Cyber Tool)" : "Cyber Tool"}
                    </option>
                    <option value="media">
                      {lang === "ar" ? "إرسال فيديو / ملف (Media)" : "Send Video / Media"}
                    </option>
                    <option value="url">
                      {lang === "ar" ? "رابط خارجي (URL)" : "External Link (URL)"}
                    </option>
                    <option value="text">
                      {lang === "ar" ? "رسالة نصية مخصصة (Text)" : "Custom Rich Text"}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "القسم التابع له" : "Category"}
                  </label>
                  <select
                    value={editingBtn.categoryId || ""}
                    onChange={(e) =>
                      handleUpdateEditing({ categoryId: e.target.value || null })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">{lang === "ar" ? "بدون قسم" : "Uncategorized"}</option>
                    {config.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {lang === "ar" ? cat.nameAr : cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "رقم الصف (Row)" : "Row Index"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={editingBtn.row}
                    onChange={(e) =>
                      handleUpdateEditing({ row: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "الترتيب في الصف (Column)" : "Column Order"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={editingBtn.order}
                    onChange={(e) =>
                      handleUpdateEditing({ order: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {editingBtn.type === "url" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "الرابط الخارجي الآمن (HTTPS)" : "External HTTPS URL"}
                  </label>
                  <input
                    type="url"
                    value={editingBtn.url || ""}
                    onChange={(e) => handleUpdateEditing({ url: e.target.value })}
                    placeholder="https://example.com"
                    className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              )}

              {editingBtn.type === "tool" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "اختر الأداة المرتبطة" : "Linked Cyber Tool"}
                  </label>
                  <select
                    value={editingBtn.toolId || "ip_info"}
                    onChange={(e) =>
                      handleUpdateEditing({ toolId: e.target.value as CyberToolId })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    {TOOL_LIST.map((tl) => (
                      <option key={tl.id} value={tl.id}>
                        {tl.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingBtn.type === "media" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar"
                      ? "اختر الفيديو أو الملف من مكتبة الوسائط"
                      : "Linked Media Asset"}
                  </label>
                  <select
                    value={editingBtn.mediaId || ""}
                    onChange={(e) => handleUpdateEditing({ mediaId: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">
                      {lang === "ar" ? "-- اختر ملف وسائط --" : "-- Select Media Item --"}
                    </option>
                    {config.media.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.type.toUpperCase()}] {lang === "ar" ? m.titleAr : m.titleEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingBtn.type === "text" && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <textarea
                    rows={3}
                    value={editingBtn.responseTextAr || ""}
                    onChange={(e) => handleUpdateEditing({ responseTextAr: e.target.value })}
                    placeholder="محتوى الرد بالعربية..."
                    className="cyber-input w-full rounded-xl p-3 text-xs"
                  />
                  <textarea
                    rows={3}
                    value={editingBtn.responseTextEn || ""}
                    onChange={(e) => handleUpdateEditing({ responseTextEn: e.target.value })}
                    placeholder="English response text..."
                    className="cyber-input w-full rounded-xl p-3 text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="cyber-glass sticky top-24 rounded-3xl border border-[#00ff88]/25 p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#00ff88]" />
                <span className="text-xs font-bold text-white">
                  {lang === "ar"
                    ? "معاينة حية لواجهة محادثة Telegram"
                    : "Live Interactive Telegram Preview"}
                </span>
              </div>
              {simParentId && (
                <button
                  type="button"
                  onClick={() => setSimParentId(null)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#00ff88]"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>{lang === "ar" ? "الرئيسية" : "Root"}</span>
                </button>
              )}
            </div>

            <div className="space-y-3 rounded-2xl bg-[#0b141d] p-4">
              <div className="rounded-2xl rounded-ss-sm border border-white/10 bg-[#13202e] p-3.5 text-xs leading-relaxed text-slate-100">
                <p className="font-semibold text-[#00ff88]">
                  {lang === "ar"
                    ? config.botProfile.displayNameAr
                    : config.botProfile.displayNameEn}
                </p>
                <p className="mt-1 whitespace-pre-line text-slate-200">
                  {(lang === "ar"
                    ? config.botProfile.welcomeMessageAr
                    : config.botProfile.welcomeMessageEn
                  ).replace(/<[^>]+>/g, "")}
                </p>
              </div>

              <div className="space-y-1.5">
                {simRows.map((row, rIdx) => (
                  <div key={rIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                    {row.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSimClick(b)}
                        className="flex items-center justify-center gap-1 truncate rounded-xl border border-white/10 bg-[#1c2d40]/90 px-2.5 py-2.5 text-[11px] font-semibold text-white transition hover:border-[#00ff88]/50 hover:bg-[#233850]"
                      >
                        <span className="truncate">
                          {lang === "ar" ? b.labelAr : b.labelEn}
                        </span>
                        {b.type === "url" && <ExternalLink className="h-3 w-3 shrink-0 text-[#00ff88]" />}
                      </button>
                    ))}
                  </div>
                ))}

                {simParentId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      const parent = buttons.find((x) => x.id === simParentId);
                      setSimParentId(parent?.parentId || null);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#172535] py-2 text-[11px] font-semibold text-[#00ff88]"
                  >
                    {lang === "ar" ? "⬅️ رجوع للقائمة السابقة" : "⬅️ Back to Menu"}
                  </button>
                )}
              </div>

              {simOutput && (
                <div className="rounded-xl border border-[#00ff88]/30 bg-[#041910] p-3 text-[11px] text-emerald-200">
                  {simOutput}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
