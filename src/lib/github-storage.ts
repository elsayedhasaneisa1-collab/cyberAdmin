import { createDefaultConfig } from "./default-catalog";
import { recordSecurityEvent } from "./security/telemetry";
import type { StorageSyncState, ZeroTraceConfig } from "@/types/zero-trace";

interface RuntimeConfigCache {
  config: ZeroTraceConfig;
  sha: string | null;
  fetchedAt: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  writeLock: Promise<void>;
}

const CACHE_TTL_MS = 8_000;

const globalStorageRef = globalThis as unknown as {
  __zeroTraceStorageCache?: RuntimeConfigCache;
};

function getStorageCache(): RuntimeConfigCache {
  if (!globalStorageRef.__zeroTraceStorageCache) {
    globalStorageRef.__zeroTraceStorageCache = {
      config: createDefaultConfig(),
      sha: null,
      fetchedAt: 0,
      lastSyncedAt: null,
      lastError: null,
      writeLock: Promise.resolve(),
    };
  }
  return globalStorageRef.__zeroTraceStorageCache;
}

export function getGitHubEnvConfig(): {
  configured: boolean;
  token: string;
  owner: string;
  repo: string;
  path: string;
} {
  const token = process.env.GITHUB_TOKEN?.trim() || "";
  const owner = process.env.GITHUB_OWNER?.trim() || "";
  const repo = process.env.GITHUB_REPO?.trim() || "";
  const rawPath = process.env.GITHUB_CONFIG_PATH?.trim() || "config/zero-trace-config.json";
  const safePath = rawPath
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

  return {
    configured: Boolean(token && owner && repo && safePath),
    token,
    owner,
    repo,
    path: safePath || "config/zero-trace-config.json",
  };
}

function normalizeLoadedConfig(raw: Partial<ZeroTraceConfig>): ZeroTraceConfig {
  const defaults = createDefaultConfig();
  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : defaults.schemaVersion,
    revision: typeof raw.revision === "number" ? raw.revision : defaults.revision,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : defaults.updatedAt,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : defaults.updatedBy,
    botProfile: { ...defaults.botProfile, ...(raw.botProfile || {}) },
    botFeatures: { ...defaults.botFeatures, ...(raw.botFeatures || {}) },
    commands: Array.isArray(raw.commands) ? raw.commands : defaults.commands,
    categories: Array.isArray(raw.categories) ? raw.categories : defaults.categories,
    buttons: Array.isArray(raw.buttons) ? raw.buttons : defaults.buttons,
    media: Array.isArray(raw.media) ? raw.media : defaults.media,
    apis: Array.isArray(raw.apis) ? raw.apis : defaults.apis,
    settings: { ...defaults.settings, ...(raw.settings || {}) },
  };
}

function buildGitHubContentsUrl(owner: string, repo: string, path: string): string {
  const encodedPath = path
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
}

export async function loadZeroTraceConfig(options?: {
  forceRefresh?: boolean;
}): Promise<{ config: ZeroTraceConfig; syncState: StorageSyncState }> {
  const envCfg = getGitHubEnvConfig();
  const cache = getStorageCache();

  if (!envCfg.configured) {
    return {
      config: structuredClone(cache.config),
      syncState: {
        mode: "ephemeral",
        configured: false,
        sha: null,
        repository: null,
        configPath: envCfg.path,
        lastSyncedAt: cache.lastSyncedAt,
        lastError: null,
      },
    };
  }

  const now = Date.now();
  if (!options?.forceRefresh && cache.fetchedAt > 0 && now - cache.fetchedAt < CACHE_TTL_MS) {
    return {
      config: structuredClone(cache.config),
      syncState: {
        mode: "github",
        configured: true,
        sha: cache.sha,
        repository: `${envCfg.owner}/${envCfg.repo}`,
        configPath: envCfg.path,
        lastSyncedAt: cache.lastSyncedAt,
        lastError: cache.lastError,
      },
    };
  }

  const url = buildGitHubContentsUrl(envCfg.owner, envCfg.repo, envCfg.path);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${envCfg.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ZeroTrace-ConfigEngine/1.0",
      },
      signal: AbortSignal.timeout(7500),
      cache: "no-store",
    });

    if (response.status === 404) {
      cache.fetchedAt = Date.now();
      cache.sha = null;
      cache.lastError = null;
      return {
        config: structuredClone(cache.config),
        syncState: {
          mode: "github",
          configured: true,
          sha: null,
          repository: `${envCfg.owner}/${envCfg.repo}`,
          configPath: envCfg.path,
          lastSyncedAt: cache.lastSyncedAt,
          lastError: null,
        },
      };
    }

    if (!response.ok) {
      throw new Error(`GitHub API returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      sha?: string;
      content?: string;
      encoding?: string;
    };

    if (!body.content) {
      throw new Error("GitHub contents payload missing file content.");
    }

    const decodedJson = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8");
    const parsed = JSON.parse(decodedJson) as Partial<ZeroTraceConfig>;
    const normalized = normalizeLoadedConfig(parsed);

    cache.config = normalized;
    cache.sha = body.sha || null;
    cache.fetchedAt = Date.now();
    cache.lastSyncedAt = new Date().toISOString();
    cache.lastError = null;

    return {
      config: structuredClone(normalized),
      syncState: {
        mode: "github",
        configured: true,
        sha: cache.sha,
        repository: `${envCfg.owner}/${envCfg.repo}`,
        configPath: envCfg.path,
        lastSyncedAt: cache.lastSyncedAt,
        lastError: null,
      },
    };
  } catch (err) {
    const safeMsg = err instanceof Error ? err.message : "Failed to load config from GitHub.";
    cache.lastError = safeMsg;
    return {
      config: structuredClone(cache.config),
      syncState: {
        mode: "github",
        configured: true,
        sha: cache.sha,
        repository: `${envCfg.owner}/${envCfg.repo}`,
        configPath: envCfg.path,
        lastSyncedAt: cache.lastSyncedAt,
        lastError: safeMsg,
      },
    };
  }
}

export async function mutateZeroTraceConfig(params: {
  actor: string;
  reason: string;
  expectedSha?: string | null;
  strictShaMatch?: boolean;
  mutator: (current: ZeroTraceConfig) => ZeroTraceConfig | Promise<ZeroTraceConfig>;
}): Promise<{
  ok: boolean;
  conflict?: boolean;
  error?: string;
  config: ZeroTraceConfig;
  syncState: StorageSyncState;
}> {
  const cache = getStorageCache();
  let releaseLock!: () => void;
  const previousLock = cache.writeLock;
  cache.writeLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    const envCfg = getGitHubEnvConfig();

    if (!envCfg.configured) {
      const updated = normalizeLoadedConfig(await params.mutator(structuredClone(cache.config)));
      updated.revision = (cache.config.revision || 1) + 1;
      updated.updatedAt = new Date().toISOString();
      updated.updatedBy = params.actor;

      cache.config = updated;
      cache.fetchedAt = Date.now();
      cache.lastSyncedAt = updated.updatedAt;

      recordSecurityEvent({
        category: "CONFIG",
        severity: "info",
        action: params.reason,
        actor: params.actor,
        status: "success",
        details: `Configuration updated in ephemeral session runtime (rev ${updated.revision}).`,
      });

      return {
        ok: true,
        config: structuredClone(updated),
        syncState: {
          mode: "ephemeral",
          configured: false,
          sha: null,
          repository: null,
          configPath: envCfg.path,
          lastSyncedAt: cache.lastSyncedAt,
          lastError: null,
        },
      };
    }

    const url = buildGitHubContentsUrl(envCfg.owner, envCfg.repo, envCfg.path);
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const loaded = await loadZeroTraceConfig({ forceRefresh: true });
      const currentSha = loaded.syncState.sha;

      if (
        params.strictShaMatch &&
        params.expectedSha &&
        currentSha &&
        params.expectedSha !== currentSha
      ) {
        recordSecurityEvent({
          category: "CONFIG",
          severity: "warning",
          action: "config.sha_conflict",
          actor: params.actor,
          status: "blocked",
          details: "Concurrent edit conflict prevented overwrite (SHA mismatch).",
        });
        return {
          ok: false,
          conflict: true,
          error: "Concurrent modification detected on GitHub. Reloaded latest version to prevent data loss.",
          config: loaded.config,
          syncState: loaded.syncState,
        };
      }

      const mutated = normalizeLoadedConfig(await params.mutator(structuredClone(loaded.config)));
      mutated.revision = (loaded.config.revision || 1) + 1;
      mutated.updatedAt = new Date().toISOString();
      mutated.updatedBy = params.actor;

      const serialized = JSON.stringify(mutated, null, 2);
      const encodedContent = Buffer.from(serialized, "utf8").toString("base64");

      const putBody: Record<string, string> = {
        message: `[ZERO TRACE] ${params.reason} (rev ${mutated.revision})`,
        content: encodedContent,
      };
      if (currentSha) {
        putBody.sha = currentSha;
      }

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${envCfg.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ZeroTrace-ConfigEngine/1.0",
        },
        body: JSON.stringify(putBody),
        signal: AbortSignal.timeout(9000),
      });

      if (response.status === 409 || response.status === 422) {
        if (attempt < maxRetries - 1 && !params.strictShaMatch) {
          continue;
        }
        const latest = await loadZeroTraceConfig({ forceRefresh: true });
        return {
          ok: false,
          conflict: true,
          error: "GitHub reported a concurrent SHA conflict. Please review the latest configuration and retry.",
          config: latest.config,
          syncState: latest.syncState,
        };
      }

      if (!response.ok) {
        const errMessage = `GitHub commit failed with HTTP ${response.status}`;
        cache.lastError = errMessage;
        recordSecurityEvent({
          category: "CONFIG",
          severity: "critical",
          action: "config.github_write_error",
          actor: params.actor,
          status: "error",
          details: errMessage,
        });
        return {
          ok: false,
          error: errMessage,
          config: loaded.config,
          syncState: {
            ...loaded.syncState,
            lastError: errMessage,
          },
        };
      }

      const resultJson = (await response.json()) as { content?: { sha?: string } };
      const newSha = resultJson.content?.sha || currentSha;

      cache.config = mutated;
      cache.sha = newSha;
      cache.fetchedAt = Date.now();
      cache.lastSyncedAt = mutated.updatedAt;
      cache.lastError = null;

      recordSecurityEvent({
        category: "CONFIG",
        severity: "info",
        action: params.reason,
        actor: params.actor,
        status: "success",
        details: `Committed rev ${mutated.revision} to GitHub (${envCfg.owner}/${envCfg.repo}).`,
      });

      return {
        ok: true,
        config: structuredClone(mutated),
        syncState: {
          mode: "github",
          configured: true,
          sha: newSha,
          repository: `${envCfg.owner}/${envCfg.repo}`,
          configPath: envCfg.path,
          lastSyncedAt: cache.lastSyncedAt,
          lastError: null,
        },
      };
    }

    const fallback = await loadZeroTraceConfig({ forceRefresh: true });
    return {
      ok: false,
      conflict: true,
      error: "Unable to resolve concurrent GitHub edits after multiple retries.",
      config: fallback.config,
      syncState: fallback.syncState,
    };
  } finally {
    releaseLock();
  }
}
