"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Plus,
  Save,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useZeroTrace } from "@/context/zero-trace-context";
import type { BotButtonItem, MediaItem, MediaType } from "@/types/zero-trace";

export default function MediaLibraryPage() {
  const {
    lang,
    config,
    saving,
    saveConfigPatch,
    apiFetch,
    notify,
  } = useZeroTrace();

  const [mediaList, setMediaList] = useState<MediaItem[]>(config.media);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadChatId, setUploadChatId] = useState("");
  const [testChatId, setTestChatId] = useState("");
  const [sendingTestId, setSendingTestId] = useState<string | null>(null);
  const [localPreviewBlobUrl, setLocalPreviewBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setMediaList(config.media);
  }, [config.media]);

  const startNewMedia = (type: MediaType = "video") => {
    const now = new Date().toISOString();
    const fresh: MediaItem = {
      id: `med_${Date.now()}`,
      titleAr: type === "video" ? "فيديو تعليمي سيبراني" : type === "photo" ? "صورة توضيحية" : "ملف تعليمي PDF",
      titleEn: type === "video" ? "Cybersecurity Video Lesson" : type === "photo" ? "Security Infographic" : "Educational Guide",
      descriptionAr: "شرح دفاعي تطبيقي مخصص للمتدربين.",
      descriptionEn: "Practical defensive cybersecurity module.",
      type,
      categoryId: config.categories[0]?.id || null,
      linkedButtonId: null,
      externalUrl: "",
      telegramFileId: "",
      mimeType: type === "video" ? "video/mp4" : type === "photo" ? "image/png" : "application/pdf",
      fileSizeBytes: 0,
      published: false,
      createdAt: now,
      updatedAt: now,
    };
    setLocalPreviewBlobUrl(null);
    setEditing(fresh);
  };

  const handleFileSelectAndUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    const maxUploadBytes =
      editing.type === "photo" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

    if (file.size > maxUploadBytes) {
      notify(
        "error",
        lang === "ar"
          ? `حجم الملف يتجاوز حد الرفع الرسمي في تيليجرام (${Math.round(maxUploadBytes / (1024 * 1024))} ميجابايت).`
          : `File exceeds official Telegram Bot API upload limit (${Math.round(maxUploadBytes / (1024 * 1024))} MB).`
      );
      e.target.value = "";
      return;
    }

    const blobPreview = URL.createObjectURL(file);
    setLocalPreviewBlobUrl(blobPreview);
    setEditing({
      ...editing,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });

    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", editing.type);
      form.append("title", editing.titleAr || editing.titleEn);
      if (uploadChatId.trim()) {
        form.append("chatId", uploadChatId.trim());
      }

      const res = await apiFetch("/api/admin/media", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setEditing((prev) =>
          prev
            ? {
                ...prev,
                externalUrl: json.externalUrl || prev.externalUrl,
                telegramFileId: json.telegramFileId || prev.telegramFileId,
                mimeType: json.mimeType || file.type,
                fileSizeBytes: json.fileSizeBytes || file.size,
              }
            : null
        );
        notify(
          "success",
          lang === "ar"
            ? "تم رفع الملف والتحقق من قيوده بنجاح!"
            : "Media uploaded and validated successfully!"
        );
      } else {
        notify("error", json.error || "Upload failed.");
      }
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleUpsertMediaItem = async (createButtonAutomatically = false) => {
    if (!editing) return;

    if (!editing.externalUrl.trim() && !editing.telegramFileId?.trim()) {
      notify(
        "error",
        lang === "ar"
          ? "أدخل رابط HTTPS خارجي صالح للتخزين السحابي أو معرّف Telegram file_id أو ارفع الملف أولاً."
          : "Provide a valid HTTPS external storage URL or Telegram file_id before saving."
      );
      return;
    }

    if (editing.externalUrl.trim() && !editing.telegramFileId?.trim()) {
      const maxUrlBytes = editing.type === "photo" ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
      if (editing.fileSizeBytes > maxUrlBytes) {
        notify(
          "error",
          lang === "ar"
            ? `عند الإرسال عبر رابط HTTP يحدد تيليجرام السقف بـ ${Math.round(maxUrlBytes / (1024 * 1024))}MB. استخدم رفع مباشر أو file_id.`
            : `Telegram caps HTTP URL media downloads at ${Math.round(maxUrlBytes / (1024 * 1024))} MB.`
        );
        return;
      }
    }

    let nextButtons: BotButtonItem[] | undefined;
    let finalItem = { ...editing, updatedAt: new Date().toISOString() };

    if (createButtonAutomatically && !finalItem.linkedButtonId) {
      const newBtnId = `btn_med_${Date.now()}`;
      finalItem = { ...finalItem, linkedButtonId: newBtnId, published: true };
      const newButton: BotButtonItem = {
        id: newBtnId,
        labelAr: `🎬 ${finalItem.titleAr}`,
        labelEn: `🎬 ${finalItem.titleEn}`,
        type: "media",
        parentId: null,
        categoryId: finalItem.categoryId,
        row: Math.ceil(config.buttons.filter((b) => !b.parentId).length / 2),
        order: 0,
        enabled: true,
        mediaId: finalItem.id,
      };
      nextButtons = [...config.buttons, newButton];
    }

    const exists = mediaList.some((m) => m.id === finalItem.id);
    const nextMedia = exists
      ? mediaList.map((m) => (m.id === finalItem.id ? finalItem : m))
      : [finalItem, ...mediaList];

    const ok = await saveConfigPatch("media.library", {
      media: nextMedia,
      ...(nextButtons ? { buttons: nextButtons } : {}),
    });

    if (ok) {
      setMediaList(nextMedia);
      setEditing(null);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    const nextMedia = mediaList.filter((m) => m.id !== id);
    const ok = await saveConfigPatch("media.delete", { media: nextMedia });
    if (ok) {
      setMediaList(nextMedia);
      if (editing?.id === id) setEditing(null);
    }
  };

  const handleSendTestToTelegram = async (mediaId: string) => {
    if (!testChatId.trim()) {
      notify(
        "error",
        lang === "ar"
          ? "أدخل معرّف المحادثة (Chat ID) لإرسال الفيديو/الملف إليها."
          : "Enter a target Telegram Chat ID first."
      );
      return;
    }
    setSendingTestId(mediaId);
    try {
      const res = await apiFetch("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({
          action: "send_test",
          mediaId,
          chatId: testChatId.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        notify(
          "success",
          lang === "ar"
            ? "تم إرسال الملف مباشرة داخل محادثة تيليجرام بنجاح!"
            : "Delivered media directly into Telegram chat!"
        );
      } else {
        notify("error", json.error || "Telegram media send failed.");
      }
    } finally {
      setSendingTestId(null);
    }
  };

  const filteredMedia =
    filterCat === "all"
      ? mediaList
      : mediaList.filter((m) => m.categoryId === filterCat);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-cyber text-xs tracking-[0.24em] text-[#00ff88]">
            EXTERNAL MEDIA & CONTENT STUDIO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {lang === "ar"
              ? "مكتبة الوسائط ومحرر الفيديوهات والملفات"
              : "Media Library & Video/Document Manager"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => startNewMedia("video")}
            className="cyber-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>{lang === "ar" ? "إضافة فيديو" : "Add Video"}</span>
          </button>
          <button
            type="button"
            onClick={() => startNewMedia("photo")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-white hover:border-[#00ff88]/40"
          >
            <ImageIcon className="h-4 w-4 text-[#00ff88]" />
            <span>{lang === "ar" ? "إضافة صورة" : "Add Photo"}</span>
          </button>
          <button
            type="button"
            onClick={() => startNewMedia("document")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-white hover:border-[#00ff88]/40"
          >
            <FileText className="h-4 w-4 text-[#00ff88]" />
            <span>{lang === "ar" ? "ملف تعليمي" : "Add Document"}</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/[0.04] p-4 text-xs text-slate-300">
        <p className="font-semibold text-[#00ff88]">
          {lang === "ar"
            ? "الالتزام بحدود Telegram Bot API الرسمية وتخزين الملفات الخارجي:"
            : "Official Telegram Bot API File Limits & External Storage Policy:"}
        </p>
        <p className="mt-1 leading-relaxed">
          {lang === "ar"
            ? "• لا يتم تخزين أي ملفات كبيرة داخل GitHub إطلاقًا (يُحفظ وصف ورابط الملف فقط). • الإرسال عبر رابط HTTPS خارجي: حتى 5MB للصور و20MB للفيديوهات والملفات. • الرفع المباشر (Multipart): حتى 10MB للصور و50MB للفيديوهات والملفات. • الإرسال عبر file_id المحفوظ في تيليجرام: فوري وبدون إعادة رفع."
            : "• Large binaries are never stored in GitHub (only structured metadata & external URLs/file_ids). • HTTPS URL delivery: max 5 MB photos, 20 MB videos/documents. • Direct multipart upload: max 10 MB photos, 50 MB videos/documents. • Cached Telegram file_id: instant delivery."}
        </p>
      </div>

      {editing && (
        <div className="cyber-glass-strong rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-base font-bold text-white">
              {lang === "ar" ? "تحرير ومعاينة المحتوى قبل النشر" : "Compose & Preview Media Asset"}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg p-1 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "نوع المحتوى" : "Media Type"}
                  </label>
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value as MediaType })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="video">{lang === "ar" ? "فيديو (Video)" : "Video"}</option>
                    <option value="photo">{lang === "ar" ? "صورة (Photo)" : "Photo"}</option>
                    <option value="document">
                      {lang === "ar" ? "ملف تعليمي (Document)" : "Educational Document"}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "القسم" : "Category"}
                  </label>
                  <select
                    value={editing.categoryId || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, categoryId: e.target.value || null })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">{lang === "ar" ? "بدون قسم" : "Uncategorized"}</option>
                    {config.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === "ar" ? c.nameAr : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "ربط بزر موجود" : "Link to Bot Button"}
                  </label>
                  <select
                    value={editing.linkedButtonId || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, linkedButtonId: e.target.value || null })
                    }
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">{lang === "ar" ? "-- اختياري --" : "-- Optional --"}</option>
                    {config.buttons.map((b) => (
                      <option key={b.id} value={b.id}>
                        {lang === "ar" ? b.labelAr : b.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "العنوان (عربي)" : "Title (Arabic)"}
                  </label>
                  <input
                    type="text"
                    value={editing.titleAr}
                    onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "العنوان (إنجليزي)" : "Title (English)"}
                  </label>
                  <input
                    type="text"
                    value={editing.titleEn}
                    onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })}
                    className="cyber-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "الوصف الكامل (عربي)" : "Description / Caption (AR)"}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1024}
                    value={editing.descriptionAr}
                    onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })}
                    className="cyber-input w-full rounded-xl p-3 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    {lang === "ar" ? "الوصف الكامل (إنجليزي)" : "Description / Caption (EN)"}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1024}
                    value={editing.descriptionEn}
                    onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })}
                    className="cyber-input w-full rounded-xl p-3 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                <p className="mb-2 text-xs font-semibold text-white">
                  {lang === "ar"
                    ? "رفع ملف إلى التخزين السحابي الخارجي (MEDIA_STORAGE_URL) أو توليد file_id عبر محادثة"
                    : "Upload File to External Storage (MEDIA_STORAGE_URL) or Telegram Chat"}
                </p>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={uploadChatId}
                    onChange={(e) => setUploadChatId(e.target.value)}
                    placeholder={
                      lang === "ar"
                        ? "اختياري: Chat ID لتوليد Telegram file_id عند الرفع"
                        : "Optional: Telegram Chat ID to capture file_id"
                    }
                    className="cyber-input flex-1 rounded-xl px-3 py-2 text-xs"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-4 py-2 text-xs font-semibold text-[#00ff88] hover:bg-[#00ff88]/20">
                    <UploadCloud className="h-4 w-4" />
                    <span>
                      {uploadingFile
                        ? lang === "ar"
                          ? "جاري الرفع..."
                          : "Uploading..."
                        : lang === "ar"
                        ? "اختيار ملف ورفعه"
                        : "Select & Upload File"}
                    </span>
                    <input
                      type="file"
                      onChange={handleFileSelectAndUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      {lang === "ar" ? "رابط الملف الخارجي (HTTPS)" : "External Storage HTTPS URL"}
                    </label>
                    <input
                      type="url"
                      value={editing.externalUrl}
                      onChange={(e) => setEditing({ ...editing, externalUrl: e.target.value })}
                      placeholder="https://cdn.example.com/lesson.mp4"
                      className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Telegram file_id ({lang === "ar" ? "اختياري" : "Optional"})
                    </label>
                    <input
                      type="text"
                      value={editing.telegramFileId || ""}
                      onChange={(e) => setEditing({ ...editing, telegramFileId: e.target.value })}
                      placeholder="BAACAgIAAxkBAAI..."
                      className="cyber-input font-mono-cyber w-full rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <input
                    type="checkbox"
                    checked={editing.published}
                    onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                    className="h-4 w-4 accent-[#00ff88]"
                  />
                  <span>
                    {lang === "ar"
                      ? "منشور وجاهز للإرسال في البوت"
                      : "Published & Active in Telegram Bot"}
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpsertMediaItem(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#00ff88]/40 bg-[#00ff88]/10 px-3.5 py-2.5 text-xs font-semibold text-[#00ff88]"
                  >
                    <Link2 className="h-4 w-4" />
                    <span>
                      {lang === "ar"
                        ? "حفظ + إنشاء زر تلقائي في البوت"
                        : "Save + Auto-Create Bot Button"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpsertMediaItem(false)}
                    disabled={saving}
                    className="cyber-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs"
                  >
                    <Save className="h-4 w-4" />
                    <span>{lang === "ar" ? "حفظ المحتوى" : "Save Media"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                <p className="mb-3 text-xs font-bold text-[#00ff88]">
                  {lang === "ar" ? "معاينة المحتوى قبل النشر" : "Pre-Publish Live Preview"}
                </p>

                {localPreviewBlobUrl || editing.externalUrl ? (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                    {editing.type === "video" && (
                      <video
                        controls
                        src={localPreviewBlobUrl || editing.externalUrl}
                        className="max-h-60 w-full object-contain"
                      />
                    )}
                    {editing.type === "photo" && (
                      <img
                        src={localPreviewBlobUrl || editing.externalUrl}
                        alt={editing.titleEn}
                        className="max-h-60 w-full object-contain"
                      />
                    )}
                    {editing.type === "document" && (
                      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-xs text-slate-300">
                        <FileText className="h-10 w-10 text-[#00ff88]" />
                        <a
                          href={localPreviewBlobUrl || editing.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00ff88] underline"
                        >
                          {lang === "ar" ? "فتح الملف للمعاينة" : "Open Document Preview"}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
                    {lang === "ar"
                      ? "أضف رابط HTTPS أو اختر ملفًا لمعاينته هنا قبل النشر"
                      : "Select a file or paste an HTTPS URL to preview before publishing"}
                  </div>
                )}

                <div className="mt-3 rounded-xl bg-white/[0.03] p-3 text-xs">
                  <p className="font-bold text-white">
                    {lang === "ar" ? editing.titleAr : editing.titleEn}
                  </p>
                  <p className="mt-1 text-slate-300">
                    {lang === "ar" ? editing.descriptionAr : editing.descriptionEn}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterCat("all")}
            className={`rounded-lg px-3 py-1.5 font-semibold ${
              filterCat === "all"
                ? "bg-[#00ff88] text-[#04150c]"
                : "bg-white/[0.04] text-slate-300"
            }`}
          >
            {lang === "ar" ? "الكل" : "All"} ({mediaList.length})
          </button>
          {config.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCat(cat.id)}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                filterCat === cat.id
                  ? "bg-[#00ff88] text-[#04150c]"
                  : "bg-white/[0.04] text-slate-300"
              }`}
            >
              {lang === "ar" ? cat.nameAr : cat.nameEn}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={testChatId}
            onChange={(e) => setTestChatId(e.target.value)}
            placeholder={
              lang === "ar"
                ? "Chat ID لتجربة إرسال الفيديو..."
                : "Telegram Chat ID for live send test..."
            }
            className="cyber-input rounded-xl px-3 py-2 text-xs"
          />
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="cyber-glass flex flex-col items-center justify-center rounded-2xl p-12 text-center">
          <Film className="mb-3 h-10 w-10 text-slate-500" />
          <p className="text-sm font-semibold text-white">
            {lang === "ar"
              ? "مكتبة الوسائط فارغة حاليًا"
              : "No media items in this category yet"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {lang === "ar"
              ? "اضغط «إضافة فيديو» أو «إضافة صورة» أو «ملف تعليمي» لإنشاء محتوى وربطه بأزرار البوت."
              : "Click Add Video, Add Photo, or Add Document to upload or link educational assets."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMedia.map((item) => (
            <div key={item.id} className="cyber-glass flex flex-col justify-between rounded-2xl p-5">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-md border border-[#00ff88]/30 bg-[#00ff88]/10 px-2.5 py-0.5 font-mono-cyber text-[10px] font-bold text-[#00ff88]">
                    {item.type.toUpperCase()}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      item.published ? "text-[#00ff88]" : "text-amber-300"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item.published
                      ? lang === "ar"
                        ? "منشور"
                        : "Published"
                      : lang === "ar"
                      ? "مسودة"
                      : "Draft"}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">
                  {lang === "ar" ? item.titleAr : item.titleEn}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                  {lang === "ar" ? item.descriptionAr : item.descriptionEn}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <div className="flex items-center gap-1.5">
                  {item.externalUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-slate-200 hover:text-[#00ff88]"
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200 hover:text-[#00ff88]"
                  >
                    {lang === "ar" ? "تعديل" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMedia(item.id)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendTestToTelegram(item.id)}
                  disabled={sendingTestId === item.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#00ff88]/35 bg-[#00ff88]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00ff88]"
                >
                  <Send className="h-3 w-3" />
                  <span>
                    {sendingTestId === item.id
                      ? "..."
                      : lang === "ar"
                      ? "إرسال بالبوت"
                      : "Send in Bot"}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="cyber-glass-strong w-full max-w-2xl rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {lang === "ar" ? previewItem.titleAr : previewItem.titleEn}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {previewItem.type === "video" && (
              <video
                controls
                src={previewItem.externalUrl}
                className="max-h-96 w-full rounded-xl bg-black"
              />
            )}
            {previewItem.type === "photo" && (
              <img
                src={previewItem.externalUrl}
                alt={previewItem.titleEn}
                className="max-h-96 w-full rounded-xl object-contain"
              />
            )}
            {previewItem.type === "document" && (
              <a
                href={previewItem.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cyber-btn-primary inline-flex rounded-xl px-4 py-2.5 text-xs"
              >
                {lang === "ar" ? "فتح الملف التعليمي" : "Open Document"}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
