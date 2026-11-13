import { NextResponse } from "next/server";
import { executeCyberTool } from "@/lib/cyber-tools";
import { loadZeroTraceConfig } from "@/lib/github-storage";
import { verifyAdminApiRequest } from "@/lib/security/auth";
import { checkRateLimit, extractClientIp } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/telemetry";
import type { CyberToolId } from "@/types/zero-trace";

export const dynamic = "force-dynamic";

const NETWORK_TOOLS_REQUIRING_SCOPE: CyberToolId[] = [
  "dns_lookup",
  "whois_lookup",
  "ssl_checker",
  "security_headers",
  "url_reputation",
  "http_analyzer",
  "domain_info",
];

export async function POST(request: Request) {
  const auth = verifyAdminApiRequest(request, { requireCsrf: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = extractClientIp(request);
  const { config } = await loadZeroTraceConfig();
  const limit = config.settings.apiRateLimitPerMinute || 40;

  const rate = checkRateLimit(`cyber_tool:${ip}`, limit, 60_000);
  if (!rate.allowed) {
    recordSecurityEvent({
      category: "SECURITY_BLOCK",
      severity: "warning",
      action: "tools.rate_limited",
      actor: auth.session.email,
      status: "blocked",
      details: `Tool execution throttled for ${ip}.`,
    });
    return NextResponse.json(
      { error: "Rate limit exceeded for diagnostic tools." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json()) as {
      toolId?: CyberToolId;
      input?: string;
      secondaryInput?: string;
      authorizedConfirmed?: boolean;
    };

    if (!body.toolId) {
      return NextResponse.json({ error: "Tool identifier is required." }, { status: 400 });
    }

    if (
      NETWORK_TOOLS_REQUIRING_SCOPE.includes(body.toolId) &&
      body.authorizedConfirmed !== true
    ) {
      return NextResponse.json(
        {
          error:
            "You must confirm explicit authorization to run network/web diagnostics on the target system.",
        },
        { status: 400 }
      );
    }

    const result = await executeCyberTool({
      toolId: body.toolId,
      input: typeof body.input === "string" ? body.input : "",
      secondaryInput: typeof body.secondaryInput === "string" ? body.secondaryInput : undefined,
      actor: auth.session.email,
    });

    return NextResponse.json(result);
  } catch (err) {
    const safeMsg = err instanceof Error ? err.message : "Diagnostic execution failed.";
    return NextResponse.json({ ok: false, error: safeMsg }, { status: 400 });
  }
}
