import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN ?? "",
    });
  }
  return _redis;
}

// 10 AI requests per user per minute
export const aiRateLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "repomind:ai",
});

// 3 scans per user per hour
export const scanRateLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "repomind:scan",
});

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const result = await limiter.limit(identifier);
    if (!result.success) {
      return { allowed: false, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
    }
    return { allowed: true };
  } catch {
    // If Redis is down, allow the request (fail open)
    return { allowed: true };
  }
}
