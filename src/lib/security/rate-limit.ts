interface RateBucket {
  timestamps: number[];
}

const globalRateRef = globalThis as unknown as {
  __zeroTraceRateBuckets?: Map<string, RateBucket>;
};

function getBuckets(): Map<string, RateBucket> {
  if (!globalRateRef.__zeroTraceRateBuckets) {
    globalRateRef.__zeroTraceRateBuckets = new Map<string, RateBucket>();
  }
  return globalRateRef.__zeroTraceRateBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): RateLimitResult {
  const buckets = getBuckets();
  const now = Date.now();
  const safeLimit = Math.max(1, Math.min(limit, 500));

  if (buckets.size > 4000) {
    for (const [k, b] of buckets.entries()) {
      const valid = b.timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        buckets.delete(k);
      } else {
        b.timestamps = valid;
      }
    }
  }

  const bucket = buckets.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= safeLimit) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, safeLimit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 64);
  return "unknown-ip";
}
