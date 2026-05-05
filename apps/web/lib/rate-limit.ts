import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis() {
  if (!_redis) {
    try {
      const url = process.env.UPSTASH_REDIS_URL;
      const token = process.env.UPSTASH_REDIS_TOKEN;
      
      if (!url || !url.startsWith('https')) {
        console.warn("[Upstash Redis] Invalid or missing REST URL. Rate limiting will be disabled.");
        return null as any;
      }
      
      _redis = new Redis({
        url: url,
        token: token ?? "",
      });
    } catch (err) {
      console.warn("[Upstash Redis] Failed to initialize:", err);
      return null as any;
    }
  }
  return _redis;
}

// Helper to safely create a Ratelimit instance
function createLimiter(limit: number, window: string, prefix: string) {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window as any),
    prefix,
  });
}

// 10 AI requests per user per minute
export const aiRateLimit = createLimiter(10, "1 m", "repomind:ai");

// 3 scans per user per hour
export const scanRateLimit = createLimiter(3, "1 h", "repomind:scan");

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!limiter) return { allowed: true };
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
