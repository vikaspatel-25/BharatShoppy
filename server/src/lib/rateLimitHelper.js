import mongoose from "mongoose";

// In-memory fallback if MongoDB connection is not open
const memoryLimits = new Map();

export function resetMemoryLimits() {
  memoryLimits.clear();
}

function getLimitsCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("auth_limits");
  }
  return null;
}

/**
 * Checks and records an attempt or request against a rate limit key.
 * Uses atomic MongoDB operations to prevent race conditions during concurrent requests.
 * 
 * @param {string} key - Unique rate limit identifier (e.g. `ip:${ip}` or `email:${email}`)
 * @param {object} options
 * @param {number} options.maxAttempts - Maximum allowed attempts within window
 * @param {number} options.windowMs - Sliding window duration in milliseconds
 * @param {number} options.cooldownMs - Lockout duration after exceeding max attempts
 * @param {number} options.minIntervalMs - Minimum cooldown interval required between consecutive requests
 * @returns {Promise<{ allowed: boolean, remainingAttempts: number, cooldownRemainingMs: number }>}
 */
export async function checkRateLimit(key, { maxAttempts = 5, windowMs = 60000, cooldownMs = 60000, minIntervalMs = 0 } = {}) {
  const col = getLimitsCollection();
  const now = Date.now();
  const ttlDuration = Math.max(windowMs, cooldownMs) + 86400000; // 24 hours beyond max lifetime

  if (col) {
    // 1. Check if key is currently in cooldown or violating minIntervalMs
    const doc = await col.findOne({ _id: key });
    if (doc) {
      if (doc.cooldownUntil && doc.cooldownUntil > now) {
        return {
          allowed: false,
          remainingAttempts: 0,
          cooldownRemainingMs: doc.cooldownUntil - now,
        };
      }

      if (minIntervalMs > 0 && doc.lastRequestAt && now - doc.lastRequestAt < minIntervalMs) {
        return {
          allowed: false,
          remainingAttempts: 0,
          cooldownRemainingMs: minIntervalMs - (now - doc.lastRequestAt),
        };
      }
    }

    // 2. Atomically increment attempts if an active window exists
    const updateResult = await col.findOneAndUpdate(
      {
        _id: key,
        windowExpiresAt: { $gt: now },
        $or: [{ cooldownUntil: { $exists: false } }, { cooldownUntil: { $lte: now } }],
      },
      {
        $inc: { attempts: 1 },
        $set: {
          lastRequestAt: now,
          updatedAt: new Date(),
          expireAt: new Date(now + ttlDuration),
        },
      },
      { returnDocument: "after" }
    );

    const activeDoc = updateResult?.value !== undefined ? updateResult.value : updateResult;

    if (activeDoc) {
      if (activeDoc.attempts > maxAttempts) {
        const cooldownUntil = now + cooldownMs;
        await col.updateOne(
          { _id: key },
          {
            $set: {
              cooldownUntil,
              updatedAt: new Date(),
              expireAt: new Date(cooldownUntil + ttlDuration),
            },
          }
        );
        return {
          allowed: false,
          remainingAttempts: 0,
          cooldownRemainingMs: cooldownMs,
        };
      }

      return {
        allowed: true,
        remainingAttempts: Math.max(0, maxAttempts - activeDoc.attempts),
        cooldownRemainingMs: 0,
      };
    }

    // 3. No active window found: initialize a new window
    try {
      await col.updateOne(
        {
          _id: key,
          $or: [
            { windowExpiresAt: { $exists: false } },
            { windowExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            attempts: 1,
            windowExpiresAt: now + windowMs,
            cooldownUntil: 0,
            lastRequestAt: now,
            updatedAt: new Date(),
            expireAt: new Date(now + ttlDuration),
          },
        },
        { upsert: true }
      );

      return {
        allowed: true,
        remainingAttempts: maxAttempts - 1,
        cooldownRemainingMs: 0,
      };
    } catch {
      // Race condition during upsert: another concurrent request initialized window.
      // Atomically increment on retry.
      const retryResult = await col.findOneAndUpdate(
        { _id: key },
        {
          $inc: { attempts: 1 },
          $set: {
            lastRequestAt: now,
            updatedAt: new Date(),
            expireAt: new Date(now + ttlDuration),
          },
        },
        { returnDocument: "after" }
      );
      const retryDoc = retryResult?.value !== undefined ? retryResult.value : retryResult;
      const count = retryDoc?.attempts || 1;

      if (count > maxAttempts) {
        const cooldownUntil = now + cooldownMs;
        await col.updateOne(
          { _id: key },
          { $set: { cooldownUntil, expireAt: new Date(cooldownUntil + ttlDuration) } }
        );
        return {
          allowed: false,
          remainingAttempts: 0,
          cooldownRemainingMs: cooldownMs,
        };
      }

      return {
        allowed: true,
        remainingAttempts: Math.max(0, maxAttempts - count),
        cooldownRemainingMs: 0,
      };
    }
  }

  // Memory fallback
  const existing = memoryLimits.get(key);
  if (existing) {
    if (existing.cooldownUntil && existing.cooldownUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        cooldownRemainingMs: existing.cooldownUntil - now,
      };
    }

    if (minIntervalMs > 0 && existing.lastRequestAt && now - existing.lastRequestAt < minIntervalMs) {
      return {
        allowed: false,
        remainingAttempts: 0,
        cooldownRemainingMs: minIntervalMs - (now - existing.lastRequestAt),
      };
    }

    if (existing.windowExpiresAt && existing.windowExpiresAt > now) {
      existing.attempts += 1;
      existing.lastRequestAt = now;
      if (existing.attempts > maxAttempts) {
        existing.cooldownUntil = now + cooldownMs;
        return {
          allowed: false,
          remainingAttempts: 0,
          cooldownRemainingMs: cooldownMs,
        };
      }
      return {
        allowed: true,
        remainingAttempts: Math.max(0, maxAttempts - existing.attempts),
        cooldownRemainingMs: 0,
      };
    }
  }

  memoryLimits.set(key, {
    attempts: 1,
    windowExpiresAt: now + windowMs,
    cooldownUntil: 0,
    lastRequestAt: now,
  });

  return {
    allowed: true,
    remainingAttempts: maxAttempts - 1,
    cooldownRemainingMs: 0,
  };
}

/**
 * Checks a cooldown without immediately incrementing attempts.
 */
export async function checkCooldown(key) {
  const col = getLimitsCollection();
  const now = Date.now();

  if (col) {
    const doc = await col.findOne({ _id: key });
    if (doc?.cooldownUntil && doc.cooldownUntil > now) {
      return {
        active: true,
        cooldownRemainingMs: doc.cooldownUntil - now,
      };
    }
    return { active: false, cooldownRemainingMs: 0 };
  }

  const existing = memoryLimits.get(key);
  if (existing?.cooldownUntil && existing.cooldownUntil > now) {
    return {
      active: true,
      cooldownRemainingMs: existing.cooldownUntil - now,
    };
  }

  return { active: false, cooldownRemainingMs: 0 };
}

/**
 * Sets a specific cooldown until timestamp.
 */
export async function setCooldown(key, cooldownMs) {
  const col = getLimitsCollection();
  const now = Date.now();
  const cooldownUntil = now + cooldownMs;
  const ttlDuration = cooldownMs + 86400000;

  if (col) {
    await col.updateOne(
      { _id: key },
      {
        $set: {
          cooldownUntil,
          updatedAt: new Date(),
          expireAt: new Date(cooldownUntil + ttlDuration),
        },
      },
      { upsert: true }
    );
    return;
  }

  const existing = memoryLimits.get(key) || { attempts: 0, windowExpiresAt: 0 };
  existing.cooldownUntil = cooldownUntil;
  memoryLimits.set(key, existing);
}

/**
 * Resets a limit key upon successful action.
 */
export async function clearRateLimit(key) {
  const col = getLimitsCollection();
  if (col) {
    await col.deleteOne({ _id: key });
    return;
  }
  memoryLimits.delete(key);
}
