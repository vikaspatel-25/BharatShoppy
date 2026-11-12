import mongoose from "mongoose";

/**
 * Records admin actions that change data, so there's a record of who did what and when.
 * Never stores codes, tokens, passwords or secrets. A logging failure never fails the request.
 */

const COLLECTION = "admin_audit_log";
const BLOCKED_KEY = /(password|token|secret|code|otp|cookie|hash)/i;
const MAX_STRING = 500;

let inMemoryLog = [];

export function getInMemoryAuditLog() {
  return inMemoryLog;
}
export function resetInMemoryAuditLog() {
  inMemoryLog = [];
}

function clientIp(req) {
  return req?.ip || req?.headers?.["x-forwarded-for"] || "unknown";
}

function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= 2) return undefined;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (BLOCKED_KEY.test(key)) continue;
      const clean = sanitize(v, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

export function buildAuditEntry({ req, action, targetType, targetId = "", targetName = "", details = {}, now = new Date() }) {
  return {
    _id: `audit_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    actorId: String(req?.admin?.adminId || "admin"),
    actorEmail: String(req?.admin?.email || ""),
    action: String(action),
    targetType: String(targetType),
    targetId: String(targetId ?? ""),
    targetName: String(targetName ?? "").slice(0, 200),
    details: sanitize(details && typeof details === "object" ? details : {}) || {},
    ipAddress: String(clientIp(req)).slice(0, 100),
    createdAt: now.toISOString(),
  };
}

/** Awaited by callers (Vercel can stop background work), but never throws. */
export async function logAdminAction(input) {
  try {
    const entry = buildAuditEntry(input);
    const col = mongoose.connection?.db?.collection(COLLECTION);
    if (col) {
      await col.insertOne(entry);
    } else {
      inMemoryLog.unshift(entry);
    }
    return entry;
  } catch (err) {
    console.error("Audit log write failed:", err?.message || err);
    return null;
  }
}

export const AUDIT_COLLECTION = COLLECTION;
