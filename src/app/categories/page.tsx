"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FolderTree,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type { CategoryItem } from "@/types/zero-trace";

export default function CategoriesPage() {
  const { lang, config, saving, saveConfigPatch } = useZeroTrace();
  const [categories, setCategories] = useState<CategoryItem[]>(config.categories);

  useEffect(() => {
    setCategories(
      [...config.categories].sort((a, b) => a.order - b.order)
    );
  }, [config.categories]);

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: `cat_${Date.now()}`,
        nameAr: "قسم سيبراني جديد",
        nameEn: "New Cyber Category",
        descriptionAr: "وصف القسم والمحتوى المرتبط به",
        descriptionEn: "Category description and organized modules",
        icon: "Shield",
        order: prev.length,
        enabled: true,
      },
    ]);
  };

  const updateCat = (idx: number, patch: Partial<CategoryItem>) => {
    setCategories((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const moveCat = (idx: number, delta: number) => {
    const next = idx + delta;
    if (next < 0 || next >= categories.length) return;
    const copy = [...categories];
    const [moved] = copy.splice(idx, 1);
    copy.splice(next, 0, moved);
    setCategories(copy.map((c, i) => ({ ...c, order: i })));
  };

  const removeCat = (id: string) => {
    setCategories((prev) =>
      prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i }))
    );
  };

  const handleSave = async () => {
    await saveConfigPatch("categories.update", { categories });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            TAXONOMY & MODULES
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar" ? "إدارة الأقسام وتنظيم المحتوى" : "Categories & Section Architecture"}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={addCategory}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2.5 text-xs font-semibold text-[#00ff88]"
          >
            <Plus className="h-4 w-4" />
            <span>{lang === "ar" ? "إضافة قسم" : "New Category"}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cyber-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          >
            <Save className="h-4 w-4" />
            <span>{lang === "ar" ? "حفظ الأقسام" : "Save Categories"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {categories.map((cat, idx) => {
          const linkedButtons = config.buttons.filter((b) => b.categoryId === cat.id).length;
          const linkedMedia = config.media.filter((m) => m.categoryId === cat.id).length;

          return (
            <div key={cat.id} className="cyber-glass rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]">
                    <FolderTree className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    <span className="font-mono-cyber text-[11px] text-slate-400">
                      {linkedButtons} {lang === "ar" ? "أزرار" : "buttons"} • {linkedMedia}{" "}
                      {lang === "ar" ? "وسائط" : "media"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveCat(idx, -1)}
                    disabled={idx === 0}
                    className="rounded-lg border border-white/10 p-1.5 text-slate-300 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCat(idx, 1)}
                    disabled={idx === categories.length - 1}
                    className="rounded-lg border border-white/10 p-1.5 text-slate-300 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <label className="mx-1 flex items-center gap-1 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={cat.enabled}
                      onChange={(e) => updateCat(idx, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-[#00ff88]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCat(cat.id)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    {lang === "ar" ? "اسم القسم (عربي)" : "Name (Arabic)"}
                  </label>
                  <input
                    type="text"
                    value={cat.nameAr}
                    onChange={(e) => updateCat(idx, { nameAr: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    {lang === "ar" ? "اسم القسم (إنجليزي)" : "Name (English)"}
                  </label>
                  <input
                    type="text"
                    value={cat.nameEn}
                    onChange={(e) => updateCat(idx, { nameEn: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] text-slate-400">
                    {lang === "ar" ? "الوصف (عربي)" : "Description (AR)"}
                  </label>
                  <input
                    type="text"
                    value={cat.descriptionAr}
                    onChange={(e) => updateCat(idx, { descriptionAr: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] text-slate-400">
                    {lang === "ar" ? "الوصف (إنجليزي)" : "Description (EN)"}
                  </label>
                  <input
                    type="text"
                    value={cat.descriptionEn}
                    onChange={(e) => updateCat(idx, { descriptionEn: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
