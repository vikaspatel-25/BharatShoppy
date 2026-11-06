import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { signToken, verifyToken, hashString, getAuthSecret } from "../lib/tokenHelper.js";
import { getEmailProvider } from "../services/emailProvider.js";

// In-memory admin store fallback when MongoDB is simulated/offline
let inMemoryAdmins = new Map();

export function setInMemoryAdmin(adminData) {
  inMemoryAdmins.set(adminData.email.toLowerCase(), {
    ...adminData,
    email: adminData.email.toLowerCase(),
    loginAttempts: adminData.loginAttempts || 0,
    codeAttempts: adminData.codeAttempts || 0,
  });
}

export function resetInMemoryAdmins() {
  inMemoryAdmins.clear();
}

/**
 * Retrieves the MongoDB collection if connected, otherwise null.
 */
function getCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("admins");
  }
  return null;
}

/**
 * Finds admin by email from DB or in-memory fallback.
 */
async function findAdminByEmail(email) {
  const normEmail = email.toLowerCase().trim();
  const col = getCollection();
  if (col) {
    return await col.findOne({ email: normEmail });
  }
  return inMemoryAdmins.get(normEmail) || null;
}

/**
 * Finds admin by ID from DB or in-memory fallback.
 */
async function findAdminById(id) {
  const col = getCollection();
  if (col) {
    return await col.findOne({ _id: id });
  }
  for (const admin of inMemoryAdmins.values()) {
    if (admin._id === id) return admin;
  }
  return null;
}

/**
 * Updates admin document in DB or in-memory store.
 */
async function updateAdmin(id, updateFields) {
  const col = getCollection();
  if (col) {
    await col.updateOne({ _id: id }, { $set: updateFields });
    return;
  }
  for (const [email, admin] of inMemoryAdmins.entries()) {
    if (admin._id === id) {
      inMemoryAdmins.set(email, { ...admin, ...updateFields });
      return;
    }
  }
}

/**
 * POST /api/admin/auth/login
 * Step 1: Password verification & 6-digit 2FA code generation
 */
export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await findAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Rate limiting: check password attempt lockout
    if (admin.lockUntil && admin.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((admin.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `Account temporarily locked due to excessive failed attempts. Try again in ${waitMinutes} minute(s).`,
      });
    }

    const passwordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValid) {
      const attempts = (admin.loginAttempts || 0) + 1;
      const updates = { loginAttempts: attempts };
      if (attempts >= 5) {
        updates.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minute lock
        updates.loginAttempts = 0;
      }
      await updateAdmin(admin._id, updates);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Reset failed login attempts on password success
    await updateAdmin(admin._id, { loginAttempts: 0, lockUntil: null });

    // Generate 6-digit numeric verification code
    const rawCode = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashString(rawCode);
    const codeExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await updateAdmin(admin._id, {
      verificationCodeHash: codeHash,
      codeExpiresAt,
      codeAttempts: 0,
    });

    // Create a short-lived, single-use token from the successful password step
    const tempToken = signToken(
      { adminId: admin._id, email: admin.email, step: "code_verification" },
      getAuthSecret(),
      600 // 10 minutes
    );

    // Send code through configured email provider
    const emailProvider = getEmailProvider();
    await emailProvider.sendAdminVerificationCode(admin.email, rawCode);

    return res.status(200).json({
      success: true,
      message: "Verification code sent to admin email",
      tempToken,
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    return res.status(500).json({ message: "Admin login process failed" });
  }
}

/**
 * POST /api/admin/auth/verify
 * Step 2: 6-digit code verification and session creation
 */
export async function adminVerify(req, res) {
  try {
    const tempToken = req.body?.tempToken || req.headers?.["x-pre-auth-token"];
    const code = req.body?.code;

    if (!tempToken) {
      return res.status(400).json({
        message: "Verification requires a valid pre-auth token from a completed password step",
      });
    }

    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    let tokenPayload;
    try {
      tokenPayload = verifyToken(tempToken);
    } catch {
      return res.status(401).json({
        message: "Invalid or expired pre-auth token. Please login again.",
      });
    }

    if (tokenPayload.step !== "code_verification" || !tokenPayload.adminId) {
      return res.status(401).json({
        message: "Pre-auth token is not valid for code verification",
      });
    }

    const admin = await findAdminById(tokenPayload.adminId);
    if (!admin || !admin.verificationCodeHash) {
      return res.status(400).json({
        message: "No active verification code found or code already used. Please login again.",
      });
    }

    // Expiry check (10 minutes)
    if (!admin.codeExpiresAt || Date.now() > admin.codeExpiresAt) {
      await updateAdmin(admin._id, {
        verificationCodeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
      });
      return res.status(400).json({ message: "Verification code has expired. Please login again." });
    }

    // Attempt rate limit (max 5 attempts)
    const attempts = (admin.codeAttempts || 0) + 1;
    if (attempts > 5) {
      await updateAdmin(admin._id, {
        verificationCodeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
      });
      return res.status(429).json({
        message: "Too many failed verification attempts. Code invalidated. Please login again.",
      });
    }

    await updateAdmin(admin._id, { codeAttempts: attempts });

    // Compare hashed code
    const providedHash = hashString(code.trim());
    if (providedHash !== admin.verificationCodeHash) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Code verified: Clear code to ensure single-use
    await updateAdmin(admin._id, {
      verificationCodeHash: null,
      codeExpiresAt: null,
      codeAttempts: 0,
    });

    // Create 1-hour session token
    const sessionToken = signToken(
      { adminId: admin._id, email: admin.email, role: "admin" },
      getAuthSecret(),
      3600 // 1 hour
    );

    // Set httpOnly, Secure (in production), SameSite=Lax cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("admin_session", sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 3600 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Admin authenticated successfully",
      admin: {
        _id: admin._id,
        email: admin.email,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("adminVerify error:", error);
    return res.status(500).json({ message: "Admin verification failed" });
  }
}

/**
 * POST /api/admin/auth/logout
 * Clears session cookie
 */
export async function adminLogout(req, res) {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("admin_session", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("adminLogout error:", error);
    return res.status(500).json({ message: "Logout failed" });
  }
}
