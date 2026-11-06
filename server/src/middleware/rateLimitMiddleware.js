import { checkRateLimit } from "../lib/rateLimitHelper.js";

/**
 * Creates an Express rate limiting middleware backed by rateLimitHelper (MongoDB or memory).
 */
export function createRateLimiter({
  keyPrefix = "rl",
  maxAttempts = 60,
  windowMs = 60000,
  message = "Too many requests. Please slow down.",
} = {}) {
  return async (req, res, next) => {
    try {
      const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
      const key = `${keyPrefix}:${clientIp}`;
      const result = await checkRateLimit(key, {
        maxAttempts,
        windowMs,
        cooldownMs: windowMs,
      });

      if (!result.allowed) {
        return res.status(429).json({ message });
      }

      return next();
    } catch (err) {
      // Do not block legitimate traffic if rate limiter encounters internal error
      console.error("Rate limiter middleware error:", err);
      return next();
    }
  };
}

export const searchRateLimiter = createRateLimiter({
  keyPrefix: "search_rl",
  maxAttempts: 60,
  windowMs: 60 * 1000,
  message: "Too many search requests. Please wait a moment before trying again.",
});

export const writeRateLimiter = createRateLimiter({
  keyPrefix: "write_rl",
  maxAttempts: 60,
  windowMs: 60 * 1000,
  message: "Too many write requests. Please wait a moment before trying again.",
});
