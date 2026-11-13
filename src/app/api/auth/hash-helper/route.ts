import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { generateBcryptHash } from "@/lib/security/auth";
import { checkRateLimit, extractClientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = extractClientIp(request);
  const rate = checkRateLimit(`hash_helper:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json()) as { password?: string; generateSecret?: boolean };
    const webhookSecret = body.generateSecret ? randomBytes(32).toString("hex") : undefined;

    let passwordHash: string | undefined;
    if (typeof body.password === "string" && body.password.length >= 8) {
      passwordHash = await generateBcryptHash(body.password.slice(0, 128));
    } else if (typeof body.password === "string" && body.password.length > 0) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      passwordHash,
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
