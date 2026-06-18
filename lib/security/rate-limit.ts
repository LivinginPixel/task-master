/**
 * ======================================================================
 * ENTERPRISE RATE LIMITING WITH UPSTASH REDIS
 * ======================================================================
 * 
 * Production-grade rate limiting with privacy-first design.
 * 
 * Key Features:
 * - Hashed IPs for privacy (never store raw IPs in Redis)
 * - Fail-closed in production (blocks if Redis unavailable)
 * - Fail-open in development (with warnings)
 * - Sliding window algorithm (prevents burst attacks)
 * - Per-IP, per-email, and composite limiters
 * - Reusable limiter factories
 * 
 * Why Redis is required on Vercel:
 * 1. Serverless Isolation - Each function has isolated memory
 * 2. Cold Starts - In-memory state is lost on cold start
 * 3. Distributed Enforcement - Multiple instances need shared state
 * 4. Sliding Window - More accurate than fixed window
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

/**
 * Standardized rate limit response
 */
export interface LimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  limit(identifier: string): Promise<LimitResult>;
}

/**
 * Hash identifier for privacy
 * Uses SHA-256 with a salt to prevent rainbow table attacks
 */
function hashIdentifier(identifier: string): string {
  const salt = process.env.RATE_LIMIT_SALT || "default-salt-change-in-production";
  const hash = createHash("sha256");
  hash.update(identifier + salt);
  return hash.digest("hex");
}

/**
 * Initialize Redis client singleton
 * Uses environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 */
let redis: Redis | null = null;
let redisInitialized = false;
let redisError: Error | null = null;

function getRedis(): Redis | null {
  if (redisInitialized) {
    return redis;
  }

  redisInitialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const isProduction = process.env.NODE_ENV === "production";

  if (!url || !token) {
    if (isProduction) {
      // Fail closed in production
      redisError = new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production"
      );
      console.error("❌ CRITICAL: Redis not configured in production. Rate limiting will BLOCK all requests.");
      return null;
    } else {
      // Fail open in development
      console.warn(
        "⚠️  Upstash Redis not configured. Rate limiting is disabled in development.\n" +
        "   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.\n" +
        "   Get them from: https://console.upstash.com/"
      );
      return null;
    }
  }

  try {
    redis = new Redis({
      url,
      token,
    });
    return redis;
  } catch (error) {
    redisError = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to initialize Upstash Redis:", redisError);
    
    if (isProduction) {
      // Fail closed in production
      return null;
    }
    // Fail open in development
    return null;
  }
}

/**
 * Create a blocking limiter (fail-closed)
 * Blocks all requests if Redis is unavailable
 */
function createBlockingLimiter(
  redisClient: Redis | null,
  limiter: Ratelimit["limiter"],
  prefix: string
): RateLimiter {
  if (!redisClient) {
    const isProduction = process.env.NODE_ENV === "production";
    
    if (isProduction) {
      // Fail closed - block all requests
      return {
        limit: async (_identifier: string) => ({
          success: false,
          remaining: 0,
          limit: 0,
          reset: Date.now() + 60000, // 1 minute
        }),
      };
    } else {
      // Fail open in development
      return {
        limit: async (_identifier: string) => ({
          success: true,
          remaining: 999,
          limit: 999,
          reset: Date.now() + 600000,
        }),
      };
    }
  }

  const ratelimit = new Ratelimit({
    redis: redisClient,
    limiter,
    analytics: true,
    prefix: `@upstash/ratelimit/${prefix}`,
  });

  return {
    limit: async (identifier: string) => {
      try {
        const hashedId = hashIdentifier(identifier);
        const result = await ratelimit.limit(hashedId);
        return {
          success: result.success,
          remaining: result.remaining,
          limit: result.limit,
          reset: result.reset,
        };
      } catch (error) {
        // Redis fetch failed (network unreachable, timeout, etc.)
        const isProduction = process.env.NODE_ENV === "production";
        if (isProduction) {
          console.error("❌ Rate limiter fetch failed in production:", error);
          return { success: false, remaining: 0, limit: 0, reset: Date.now() + 60000 };
        }
        console.warn("⚠️  Rate limiter unavailable (Redis unreachable). Failing open in development.");
        return { success: true, remaining: 999, limit: 999, reset: Date.now() + 600000 };
      }
    },
  };
}

/**
 * Create IP-based rate limiter
 * 
 * @param limit - Maximum requests allowed
 * @param window - Time window (e.g., "10 m", "1 h")
 * @param prefix - Redis key prefix
 */
export function createIpLimiter(
  limit: number,
  window: string,
  prefix: string
): RateLimiter {
  const redisClient = getRedis();
  return createBlockingLimiter(
    redisClient,
    Ratelimit.slidingWindow(limit, window as any),
    prefix
  );
}

/**
 * Create email-based rate limiter
 * 
 * @param limit - Maximum requests allowed
 * @param window - Time window (e.g., "10 m", "1 h")
 * @param prefix - Redis key prefix
 */
export function createEmailLimiter(
  limit: number,
  window: string,
  prefix: string
): RateLimiter {
  const redisClient = getRedis();
  return createBlockingLimiter(
    redisClient,
    Ratelimit.slidingWindow(limit, window as any),
    prefix
  );
}

/**
 * Create composite limiter (both IP and email must pass)
 * 
 * @param ipLimiter - IP-based limiter
 * @param emailLimiter - Email-based limiter
 */
export function createCompositeLimiter(
  ipLimiter: RateLimiter,
  emailLimiter: RateLimiter
): RateLimiter {
  return {
    limit: async (identifier: string) => {
      // Extract IP and email from identifier
      // Format: "ip:1.2.3.4|email:user@example.com"
      const parts = identifier.split("|");
      const ipPart = parts.find((p) => p.startsWith("ip:"));
      const emailPart = parts.find((p) => p.startsWith("email:"));

      const ip = ipPart ? ipPart.substring(3) : "";
      const email = emailPart ? emailPart.substring(6) : "";

      // Check both limiters
      const [ipResult, emailResult] = await Promise.all([
        ip ? ipLimiter.limit(ip) : Promise.resolve({ success: true, remaining: 999, limit: 999, reset: Date.now() }),
        email ? emailLimiter.limit(email) : Promise.resolve({ success: true, remaining: 999, limit: 999, reset: Date.now() }),
      ]);

      // Both must succeed
      const success = ipResult.success && emailResult.success;
      const remaining = Math.min(ipResult.remaining, emailResult.remaining);
      const limit = Math.min(ipResult.limit, emailResult.limit);
      const reset = Math.max(ipResult.reset, emailResult.reset);

      return { success, remaining, limit, reset };
    },
  };
}

// ======================================================================
// PRE-CONFIGURED LIMITERS
// ======================================================================

/**
 * Login rate limiter
 * - 5 attempts per 10 minutes per IP
 * - Sliding window algorithm
 */
export const loginIpLimiter = createIpLimiter(5, "10 m", "login-ip");

/**
 * Login email limiter
 * - 5 attempts per 10 minutes per email
 * - Additional protection for targeted attacks
 */
export const loginEmailLimiter = createEmailLimiter(5, "10 m", "login-email");

/**
 * Registration rate limiter
 * - 5 attempts per 15 minutes per IP
 */
export const registrationLimiter = createIpLimiter(5, "15 m", "registration");

/**
 * Password reset rate limiter
 * - 3 attempts per hour per IP
 */
export const passwordResetLimiter = createIpLimiter(3, "1 h", "password-reset");

/**
 * Email verification rate limiter
 * - 5 attempts per 15 minutes per IP
 */
export const emailVerificationLimiter = createIpLimiter(
  5,
  "15 m",
  "email-verification"
);
