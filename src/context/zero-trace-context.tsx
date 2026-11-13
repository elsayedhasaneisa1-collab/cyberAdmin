"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createDefaultConfig } from "@/lib/default-catalog";
import type {
  Language,
  StorageSyncState,
  TelemetrySnapshot,
  ZeroTraceConfig,
} from "@/types/zero-trace";

export interface EnvReadinessItem {
  key: string;
  configured: boolean;
  group: string;
}

export interface BotLiveStatus {
  tokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  configuredUsername: string | null;
  botInfo: {
    id: number;
    first_name: string;
    username?: string;
  } | null;
  botError?: string | null;
  webhookInfo: {
    url: string;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  } | null;
}

export interface ToastNotice {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ZeroTraceContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  isRtl: boolean;
  loading: boolean;
  saving: boolean;
  authenticated: boolean;
  authEnforced: boolean;
  sessionEmail: string;
  sessionMode: "enforced" | "bootstrap" | null;
  csrfToken: string;
  config: ZeroTraceConfig;
  syncState: StorageSyncState;
  telemetry: TelemetrySnapshot | null;
  envReadiness: EnvReadinessItem[];
  botLive: BotLiveStatus | null;
  toasts: ToastNotice[];
  notify: (type: "success" | "error" | "info", message: string) => void;
  dismissToast: (id: string) => void;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  enterBootstrapSession: () => Promise<boolean>;
  logoutSession: () => Promise<void>;
  refreshAll: (forceGitHub?: boolean) => Promise<void>;
  saveConfigPatch: (
    section: string,
    patch: Partial<ZeroTraceConfig>,
    strictShaMatch?: boolean
  ) => Promise<boolean>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const ZeroTraceContext = createContext<ZeroTraceContextValue | null>(null);

export function ZeroTraceProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authEnforced, setAuthEnforced] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionMode, setSessionMode] = useState<"enforced" | "bootstrap" | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [config, setConfig] = useState<ZeroTraceConfig>(() => createDefaultConfig());
  const [syncState, setSyncState] = useState<StorageSyncState>({
    mode: "ephemeral",
    configured: false,
    sha: null,
    repository: null,
    configPath: "config/zero-trace-config.json",
    lastSyncedAt: null,
    lastError: null,
  });
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [envReadiness, setEnvReadiness] = useState<EnvReadinessItem[]>([]);
  const [botLive, setBotLive] = useState<BotLiveStatus | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("zt_lang", next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (window.localStorage.getItem("zt_lang") as Language | null)
        : null;
    const initial = saved === "en" ? "en" : "ar";
    setLangState(initial);
    document.documentElement.lang = initial;
    document.documentElement.dir = initial === "ar" ? "rtl" : "ltr";
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4800);
    },
    [dismissToast]
  );

  const apiFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || {});
      if (csrfToken) {
        headers.set("x-csrf-token", csrfToken);
      }
      if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(url, {
        ...init,
        headers,
      });
    },
    [csrfToken]
  );

  const loadProtectedResources = useCallback(async (forceGitHub = false) => {
    const [cfgRes, statusRes, botRes] = await Promise.all([
      fetch(`/api/admin/config${forceGitHub ? "?refresh=1" : ""}`, { cache: "no-store" }),
      fetch("/api/admin/status", { cache: "no-store" }),
      fetch("/api/admin/bot", { cache: "no-store" }),
    ]);

    if (cfgRes.ok) {
      const cfgJson = await cfgRes.json();
      if (cfgJson.config) setConfig(cfgJson.config);
      if (cfgJson.syncState) setSyncState(cfgJson.syncState);
    }

    if (statusRes.ok) {
      const stJson = await statusRes.json();
      if (stJson.telemetry) setTelemetry(stJson.telemetry);
      if (Array.isArray(stJson.envReadiness)) setEnvReadiness(stJson.envReadiness);
    }

    if (botRes.ok) {
      const botJson = await botRes.json();
      setBotLive(botJson);
    }
  }, []);

  const refreshAll = useCallback(
    async (forceGitHub = false) => {
      try {
        const sessRes = await fetch("/api/auth/session", { cache: "no-store" });
        const sessJson = await sessRes.json();
        setAuthEnforced(Boolean(sessJson.authEnforced));

        if (sessJson.authenticated) {
          setAuthenticated(true);
          setSessionEmail(sessJson.email || "");
          setSessionMode(sessJson.mode || null);
          setCsrfToken(sessJson.csrfToken || "");
          await loadProtectedResources(forceGitHub);
        } else {
          setAuthenticated(false);
          setSessionEmail("");
          setSessionMode(null);
          setCsrfToken("");
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    },
    [loadProtectedResources]
  );

  useEffect(() => {
    void refreshAll(false);
  }, [refreshAll]);

  const loginWithCredentials = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        notify("error", data.error || "Authentication failed.");
        return false;
      }
      setAuthenticated(true);
      setAuthEnforced(Boolean(data.authEnforced));
      setSessionEmail(data.email || email);
      setSessionMode(data.mode || "enforced");
      setCsrfToken(data.csrfToken || "");
      await loadProtectedResources(true);
      notify(
        "success",
        lang === "ar" ? "تم تسجيل الدخول الآمن بنجاح." : "Authenticated securely."
      );
      return true;
    },
    [lang, loadProtectedResources, notify]
  );

  const enterBootstrapSession = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bootstrapSession: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.authenticated) {
      notify("error", data.error || "Unable to start setup session.");
      return false;
    }
    setAuthenticated(true);
    setAuthEnforced(false);
    setSessionEmail(data.email || "setup-operator@local");
    setSessionMode("bootstrap");
    setCsrfToken(data.csrfToken || "");
    await loadProtectedResources(false);
    notify(
      "info",
      lang === "ar"
        ? "تم تفعيل جلسة الإعداد الأولي. أضف ADMIN_EMAIL وADMIN_PASSWORD_HASH لتفعيل القفل الإنتاجي."
        : "Bootstrap setup session started. Set ADMIN_EMAIL & ADMIN_PASSWORD_HASH to enforce production lock."
    );
    return true;
  }, [lang, loadProtectedResources, notify]);

  const logoutSession = useCallback(async () => {
    await apiFetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    setAuthenticated(false);
    setSessionEmail("");
    setSessionMode(null);
    setCsrfToken("");
  }, [apiFetch]);

  const saveConfigPatch = useCallback(
    async (
      section: string,
      patch: Partial<ZeroTraceConfig>,
      strictShaMatch = false
    ): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await apiFetch("/api/admin/config", {
          method: "PUT",
          body: JSON.stringify({
            section,
            expectedSha: syncState.sha,
            strictShaMatch,
            patch,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (res.status === 409 && data.config) {
            setConfig(data.config);
            if (data.syncState) setSyncState(data.syncState);
          }
          notify("error", data.error || "Failed to save configuration.");
          return false;
        }

        if (data.config) setConfig(data.config);
        if (data.syncState) setSyncState(data.syncState);
        const stRes = await fetch("/api/admin/status", { cache: "no-store" });
        if (stRes.ok) {
          const stJson = await stRes.json();
          if (stJson.telemetry) setTelemetry(stJson.telemetry);
        }
        notify(
          "success",
          lang === "ar"
            ? "تم حفظ الإعدادات وتحديث البوت تلقائيًا."
            : "Settings saved and synced to the bot automatically."
        );
        return true;
      } catch {
        notify("error", lang === "ar" ? "تعذر الاتصال بالخادم." : "Network error while saving.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [apiFetch, lang, notify, syncState.sha]
  );

  const value = useMemo<ZeroTraceContextValue>(
    () => ({
      lang,
      setLang,
      isRtl: lang === "ar",
      loading,
      saving,
      authenticated,
      authEnforced,
      sessionEmail,
      sessionMode,
      csrfToken,
      config,
      syncState,
      telemetry,
      envReadiness,
      botLive,
      toasts,
      notify,
      dismissToast,
      loginWithCredentials,
      enterBootstrapSession,
      logoutSession,
      refreshAll,
      saveConfigPatch,
      apiFetch,
    }),
    [
      lang,
      setLang,
      loading,
      saving,
      authenticated,
      authEnforced,
      sessionEmail,
      sessionMode,
      csrfToken,
      config,
      syncState,
      telemetry,
      envReadiness,
      botLive,
      toasts,
      notify,
      dismissToast,
      loginWithCredentials,
      enterBootstrapSession,
      logoutSession,
      refreshAll,
      saveConfigPatch,
      apiFetch,
    ]
  );

  return <ZeroTraceContext.Provider value={value}>{children}</ZeroTraceContext.Provider>;
}

export function useZeroTrace() {
  const ctx = useContext(ZeroTraceContext);
  if (!ctx) {
    throw new Error("useZeroTrace must be used within ZeroTraceProvider");
  }
  return ctx;
}
