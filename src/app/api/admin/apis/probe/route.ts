import { NextResponse } from "next/server";
import { loadZeroTraceConfig, mutateZeroTraceConfig } from "@/lib/github-storage";
import { verifyAdminApiRequest } from "@/lib/security/auth";
import { validatePublicTargetUrl } from "@/lib/security/ssrf";
import { recordSecurityEvent } from "@/lib/security/telemetry";
import type { ApiServiceEntry } from "@/types/zero-trace";

export const dynamic = "force-dynamic";

async function probeSingleApi(api: ApiServiceEntry): Promise<{
  id: string;
  status: "online" | "degraded" | "offline";
  latencyMs: number;
  checkedAt: string;
  keyConfigured: boolean;
}> {
  const checkedAt = new Date().toISOString();
  const keyConfigured = api.envKeyName ? Boolean(process.env[api.envKeyName]?.trim()) : true;

  if (api.probeUrl.startsWith("/")) {
    return {
      id: api.id,
      status: "online",
      latencyMs: 2,
      checkedAt,
      keyConfigured,
    };
  }

  const check = await validatePublicTargetUrl(api.probeUrl, { requireHttps: true });
  if (!check.valid || !check.normalizedUrl) {
    return {
      id: api.id,
      status: "offline",
      latencyMs: 0,
      checkedAt,
      keyConfigured,
    };
  }

  const headers: Record<string, string> = {
    "User-Agent": "ZeroTrace-HealthProbe/1.0",
    Accept: api.id.includes("doh") ? "application/dns-json" : "application/json, text/plain, */*",
  };

  if (api.requiresKey && api.envKeyName) {
    const secretVal = process.env[api.envKeyName]?.trim();
    if (secretVal) {
      headers["Auth-Key"] = secretVal;
      headers["apiKey"] = secretVal;
    }
  }

  const start = Date.now();
  try {
    const res = await fetch(check.normalizedUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(5500),
      cache: "no-store",
    });
    const latencyMs = Date.now() - start;
    const status = res.ok ? "online" : res.status < 500 ? "degraded" : "offline";
    return {
      id: api.id,
      status,
      latencyMs,
      checkedAt,
      keyConfigured,
    };
  } catch {
    return {
      id: api.id,
      status: "offline",
      latencyMs: Date.now() - start,
      checkedAt,
      keyConfigured,
    };
  }
}

export async function POST(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { apiId?: string; persist?: boolean };
    const { config } = await loadZeroTraceConfig();

    const targets = body.apiId
      ? config.apis.filter((a) => a.id === body.apiId)
      : config.apis.filter((a) => a.enabled).slice(0, 12);

    const results = await Promise.all(targets.map((a) => probeSingleApi(a)));
    const resultMap = new Map(results.map((r) => [r.id, r]));

    if (body.persist) {
      await mutateZeroTraceConfig({
        actor: auth.session.email,
        reason: "apis.health_probe",
        mutator: (draft) => {
          for (const item of draft.apis) {
            const p = resultMap.get(item.id);
            if (p) {
              item.lastStatus = p.status;
              item.lastLatencyMs = p.latencyMs;
              item.lastCheckedAt = p.checkedAt;
            }
          }
          return draft;
        },
      });
    }

    recordSecurityEvent({
      category: "API_PROBE",
      severity: "info",
      action: body.apiId ? `api.probe:${body.apiId}` : "api.probe_batch",
      actor: auth.session.email,
      status: "success",
      details: `Probed ${results.length} API endpoint(s); ${results.filter((r) => r.status === "online").length} online.`,
    });

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Probe request failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
