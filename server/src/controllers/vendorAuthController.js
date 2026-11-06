import crypto from "node:crypto";
import mongoose from "mongoose";
import { signToken, hashString, getAuthSecret } from "../lib/tokenHelper.js";
import { normalizePhoneNumber } from "../lib/phoneHelper.js";
import { getSMSProvider } from "../services/smsProvider.js";

// In-memory vendor and OTP storage fallback for tests and offline operation
let inMemoryVendors = new Map();
let ipRequestTracker = new Map(); // ip -> [{ timestamp }]
let phoneRequestTracker = new Map(); // phone -> [{ timestamp }]

export function setInMemoryVendor(vendorData) {
  inMemoryVendors.set(vendorData.phone, {
    ...vendorData,
    status: vendorData.status || "approved",
    otpAttempts: vendorData.otpAttempts || 0,
  });
}

export function resetInMemoryVendors() {
  inMemoryVendors.clear();
  ipRequestTracker.clear();
  phoneRequestTracker.clear();
}

function getVendorCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("vendors");
  }
  return null;
}

export async function findVendorByPhone(phone) {
  const col = getVendorCollection();
  if (col) {
    return await col.findOne({ phone });
  }
  return inMemoryVendors.get(phone) || null;
}

export async function updateVendor(phone, updateFields) {
  const col = getVendorCollection();
  if (col) {
    await col.updateOne({ phone }, { $set: updateFields });
    return;
  }
  const existing = inMemoryVendors.get(phone);
  if (existing) {
    inMemoryVendors.set(phone, { ...existing, ...updateFields });
  }
}

/**
 * Checks rate limits per IP and per phone number.
 */
function checkRateLimits(ip, phone) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes

  // IP limit: max 10 requests per 15 minutes
  if (ip) {
    const ipHistory = (ipRequestTracker.get(ip) || []).filter(
      (t) => now - t < windowMs
    );
    if (ipHistory.length >= 10) {
      throw new Error(
        "Too many OTP requests from this IP address. Please wait a few minutes."
      );
    }
    ipHistory.push(now);
    ipRequestTracker.set(ip, ipHistory);
  }

  // Phone limit: max 5 requests per 15 minutes and 30-second cooldown
  if (phone) {
    const phoneHistory = (phoneRequestTracker.get(phone) || []).filter(
      (t) => now - t < windowMs
    );
    if (phoneHistory.length > 0) {
      const lastRequest = phoneHistory[phoneHistory.length - 1];
      if (now - lastRequest < 30 * 1000) {
        throw new Error(
          "Please wait 30 seconds before requesting another verification code."
        );
      }
    }
    if (phoneHistory.length >= 5) {
      throw new Error(
        "Too many OTP requests for this phone number. Please try again later."
      );
    }
    phoneHistory.push(now);
    phoneRequestTracker.set(phone, phoneHistory);
  }
}

/**
 * POST /api/vendor/auth/request-otp
 * Normalizes phone number, checks limits, sends 6-digit OTP via SMS provider.
 */
export async function requestOtp(req, res) {
  try {
    const rawPhone = req.body?.phone;
    if (!rawPhone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    let phone;
    try {
      phone = normalizePhoneNumber(rawPhone);
    } catch (normErr) {
      return res.status(400).json({ message: normErr.message });
    }

    const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

    try {
      checkRateLimits(clientIp, phone);
    } catch (rateErr) {
      return res.status(429).json({ message: rateErr.message });
    }

    const vendor = await findVendorByPhone(phone);
    if (!vendor) {
      return res.status(404).json({
        message: "No registered vendor account found for this phone number.",
      });
    }

    if (vendor.status === "removed") {
      return res.status(403).json({
        message: "Vendor account has been removed. Access denied.",
      });
    }

    // Generate 6-digit random code
    const rawOtp = String(crypto.randomInt(100000, 1000000));
    const otpHash = hashString(rawOtp);
    const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5-minute expiry

    await updateVendor(phone, {
      otpHash,
      otpExpiresAt,
      otpAttempts: 0,
    });

    const smsProvider = getSMSProvider();
    await smsProvider.sendOTP(phone, rawOtp);

    return res.status(200).json({
      success: true,
      message: "One-time verification code sent via SMS",
    });
  } catch (error) {
    console.error("requestOtp error:", error);
    return res.status(500).json({ message: "Failed to process OTP request" });
  }
}

/**
 * POST /api/vendor/auth/verify-otp
 * Verifies code, clears OTP (one use), sets separate vendor_session httpOnly cookie.
 */
export async function verifyOtp(req, res) {
  try {
    const rawPhone = req.body?.phone;
    const rawCode = req.body?.otp;

    if (!rawPhone || !rawCode) {
      return res.status(400).json({ message: "Phone number and OTP code are required" });
    }

    let phone;
    try {
      phone = normalizePhoneNumber(rawPhone);
    } catch (normErr) {
      return res.status(400).json({ message: normErr.message });
    }

    const vendor = await findVendorByPhone(phone);
    if (!vendor || !vendor.otpHash) {
      return res.status(400).json({
        message: "No active verification code found or code already used. Request a new OTP.",
      });
    }

    // Expiry check (5 minutes)
    if (!vendor.otpExpiresAt || Date.now() > vendor.otpExpiresAt) {
      await updateVendor(phone, {
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      });
      return res.status(400).json({ message: "Verification code has expired. Request a new OTP." });
    }

    // Limit verification attempts (max 5)
    const attempts = (vendor.otpAttempts || 0) + 1;
    if (attempts > 5) {
      await updateVendor(phone, {
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      });
      return res.status(429).json({
        message: "Too many failed attempts. Verification code invalidated. Request a new OTP.",
      });
    }

    await updateVendor(phone, { otpAttempts: attempts });

    // Compare hash
    const inputHash = hashString(rawCode.trim());
    if (inputHash !== vendor.otpHash) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Single use: Clear OTP immediately upon verification
    await updateVendor(phone, {
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    });

    // Create 24-hour vendor session token
    const sessionToken = signToken(
      {
        vendorId: vendor._id,
        phone: vendor.phone,
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
        phone: vendor.phone,
        storeId: vendor.storeId,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({ message: "OTP verification failed" });
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
