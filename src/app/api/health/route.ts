export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    system: "ZERO TRACE — ELITE CYBER INTELLIGENCE SYSTEM",
    runtime: "serverless",
    timestamp: new Date().toISOString(),
  });
}
