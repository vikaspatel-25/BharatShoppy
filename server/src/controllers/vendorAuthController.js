import crypto from "node:crypto";
import mongoose from "mongoose";
import { signToken, hashString, getAuthSecret } from "../lib/tokenHelper.js";
import { sendVendorLoginCode } from "../services/emailService.js";
import { checkRateLimit, clearRateLimit } from "../lib/rateLimitHelper.js";

// In-memory vendor fallback for unit testing without MongoDB
let inMemoryVendors = new Map();

export function setInMemoryVendor(vendorData) {
  const normEmail = String(vendorData.email || "").toLowerCase().trim();
  inMemoryVendors.set(normEmail, {
    ...vendorData,
    email: normEmail,
    status: vendorData.status || "approved",
    codeAttempts: vendorData.codeAttempts || 0,
  });
}

export function resetInMemoryVendors() {
  inMemoryVendors.clear();
}

function getVendorCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("vendors");
  }
  return null;
}

export async function findVendorByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const normEmail = email.toLowerCase().trim();
  const col = getVendorCollection();
  if (col) {
    return await col.findOne({ email: normEmail });
  }
  return inMemoryVendors.get(normEmail) || null;
}

export async function updateVendor(email, updateFields) {
  if (!email || typeof email !== "string") return;
  const normEmail = email.toLowerCase().trim();
  const col = getVendorCollection();
  if (col) {
    await col.updateOne({ email: normEmail }, { $set: updateFields });
    return;
  }
  const existing = inMemoryVendors.get(normEmail);
  if (existing) {
    inMemoryVendors.set(normEmail, { ...existing, ...updateFields });
  }
}

/**
 * POST /api/vendor/auth/request-code
 * Normalizes email, checks rate limits via MongoDB, and sends a 6-digit verification code.
 * Always returns the exact same response for known and unknown emails.
 */
export async function requestCode(req, res) {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({ message: "Email is required and must be a string" });
    }

    const email = rawEmail.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ message: "Email cannot be empty" });
    }

    const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

    // 1. IP rate limit: max 10 requests per 15 minutes
    const ipCheck = await checkRateLimit(`ip:${clientIp}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 15 * 60 * 1000,
    });
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many code requests from this IP address. Please wait before retrying.",
      });
    }

    // 2. Email rate limit & cooldown: 60s cooldown, max 5 requests per 15 minutes
    const emailCheck = await checkRateLimit(`vendor_req:${email}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 60 * 1000,
      minIntervalMs: 60 * 1000,
    });
    if (!emailCheck.allowed) {
      return res.status(429).json({
        message: "Please wait before requesting another verification code.",
      });
    }

    const vendor = await findVendorByEmail(email);

    // Only generate and send code if vendor exists and is approved.
    // However, return the EXACT same response to callers regardless (prevent email enumeration).
    if (vendor && vendor.status === "approved") {
      const rawCode = String(crypto.randomInt(100000, 1000000));
      const codeHash = hashString(rawCode);
      const codeExpiresAt = Date.now() + 5 * 60 * 1000; // 5-minute expiry

      await updateVendor(email, {
        codeHash,
        codeExpiresAt,
        codeAttempts: 0,
      });

      await sendVendorLoginCode(email, rawCode);
    }

    return res.status(200).json({
      success: true,
      message: "If your email is registered as an approved vendor, a 6-digit verification code has been sent.",
    });
  } catch (error) {
    console.error("requestCode error:", error);
    return res.status(500).json({ message: "Failed to process login code request" });
  }
}

/**
 * POST /api/vendor/auth/verify-code
 * Verifies code, clears code (single use), sets separate vendor_session httpOnly cookie.
 */
export async function verifyCode(req, res) {
  try {
    const rawEmail = req.body?.email;
    const rawCode = req.body?.code;

    if (typeof rawEmail !== "string" || typeof rawCode !== "string") {
      return res.status(400).json({ message: "Email and code are required and must be strings" });
    }

    const email = rawEmail.toLowerCase().trim();
    const code = rawCode.trim();

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code cannot be empty" });
    }

    // Global attempt rate limiting stored in collection per email
    const attemptCheck = await checkRateLimit(`vendor_verify:${email}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 15 * 60 * 1000,
    });
    if (!attemptCheck.allowed) {
      return res.status(429).json({
        message: "Too many failed attempts. Verification locked for 15 minutes.",
      });
    }

    const vendor = await findVendorByEmail(email);
    if (!vendor || !vendor.codeHash) {
      return res.status(400).json({
        message: "No active verification code found or code already used. Request a new code.",
      });
    }

    // Expiry check (5 minutes)
    if (!vendor.codeExpiresAt || Date.now() > vendor.codeExpiresAt) {
      await updateVendor(email, {
        codeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
      });
      return res.status(400).json({ message: "Verification code has expired. Request a new code." });
    }

    // Limit verification attempts per code
    const attempts = (vendor.codeAttempts || 0) + 1;
    if (attempts > 5) {
      await updateVendor(email, {
        codeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
      });
      return res.status(429).json({
        message: "Too many failed attempts. Verification code invalidated. Request a new code.",
      });
    }

    await updateVendor(email, { codeAttempts: attempts });

    // Compare hash
    const inputHash = hashString(code);
    if (inputHash !== vendor.codeHash) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Check vendor status
    if (vendor.status !== "approved") {
      await updateVendor(email, {
        codeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
      });
      return res.status(403).json({
        message: `Forbidden: Vendor account is not approved (status: '${vendor.status}').`,
      });
    }

    // Single use: Clear code immediately upon verification
    await updateVendor(email, {
      codeHash: null,
      codeExpiresAt: null,
      codeAttempts: 0,
    });
    await clearRateLimit(`vendor_verify:${email}`);

    // Create 24-hour vendor session token
    const sessionToken = signToken(
      {
        vendorId: vendor._id,
        email: vendor.email,
        storeId: vendor.storeId,
        status: vendor.status,
        role: "vendor",
      },
      getAuthSecret(),
      24 * 3600 // 24 hours
    );

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("vendor_session", sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 24 * 3600 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Vendor authenticated successfully",
      vendor: {
        _id: vendor._id,
        email: vendor.email,
        storeId: vendor.storeId,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error("verifyCode error:", error);
    return res.status(500).json({ message: "Code verification failed" });
  }
}

/**
 * POST /api/vendor/auth/logout
 * Clears the vendor_session cookie.
 */
export async function vendorLogout(req, res) {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("vendor_session", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("vendorLogout error:", error);
    return res.status(500).json({ message: "Logout failed" });
  }
}
