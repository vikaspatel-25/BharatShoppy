import mongoose from "mongoose";
import storesMock from "../data/mockData/stores.js";
import { verifyToken, signToken, getAuthSecret } from "../lib/tokenHelper.js";
import { findVendorByEmail } from "../controllers/vendorAuthController.js";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves a store by ID, slug, or subdomain from MongoDB or fallback mock data.
 * Safely escapes regex and refuses fallback to mock stores in production.
 */
export async function resolveStoreByIdentifier(identifier) {
  if (!identifier || typeof identifier !== "string") return null;
  const target = identifier.trim().toLowerCase();
  if (!target) return null;
  const escapedTarget = escapeRegex(target);

  const storesCol = mongoose.connection?.db?.collection("stores");
  if (storesCol) {
    const store = await storesCol.findOne({
      $or: [
        { _id: identifier },
        { slug: { $regex: new RegExp(`^${escapedTarget}$`, "i") } },
        { subdomain: { $regex: new RegExp(`^${escapedTarget}$`, "i") } },
      ],
    });
    if (store) return store;
  }

  // Refuse fallback to mock stores in production
  if (process.env.NODE_ENV !== "production") {
    return (
      storesMock.find(
        (s) =>
          s._id === identifier ||
          s.slug?.toLowerCase() === target ||
          s.subdomain?.toLowerCase() === target
      ) || null
    );
  }

  return null;
}

/**
 * Middleware requiring valid admin authentication.
 * Verifies session token from httpOnly cookie or Authorization header.
 * Renews the 1-hour session while active.
 */
export function requireAdmin(req, res, next) {
  try {
    let token = req.cookies?.admin_session;

    if (!token && req.headers?.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: "Invalid or expired admin session" });
    }

    if (payload.role !== "admin") {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    // Session renewal: extend session cookie by 1 hour while active
    try {
      const renewedToken = signToken(
        { adminId: payload.adminId, email: payload.email, role: "admin" },
        getAuthSecret(),
        3600
      );
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("admin_session", renewedToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 3600 * 1000,
        path: "/",
      });
    } catch {
      // Cookie renewal failure should not block request
    }

    req.admin = payload;
    return next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ message: "Authentication check failed" });
  }
}

/**
 * Middleware: requireVendor
 * Ensures the request is from an authenticated vendor via httpOnly vendor_session cookie or Bearer token.
 */
export function requireVendor(req, res, next) {
  try {
    let token = req.cookies?.vendor_session;

    if (!token && req.headers?.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Vendor authentication required" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: "Invalid or expired vendor session" });
    }

    if (payload.role !== "vendor") {
      return res.status(403).json({ message: "Vendor privileges required" });
    }

    req.vendor = payload;
    return next();
  } catch (err) {
    console.error("requireVendor error:", err);
    return res.status(500).json({ message: "Vendor authentication check failed" });
  }
}

/**
 * Middleware: requireStoreOwner
 * Resolves :storeId parameter by ID, slug, or subdomain.
 * Loads fresh vendor from DB on every request to verify current status and store ownership.
 * Sets req.store and req.vendor.
 */
export async function requireStoreOwner(req, res, next) {
  try {
    // If requireVendor hasn't run yet, authenticate first
    if (!req.vendor) {
      return requireVendor(req, res, async () => {
        return handleStoreOwnership(req, res, next);
      });
    }

    return await handleStoreOwnership(req, res, next);
  } catch (err) {
    console.error("requireStoreOwner error:", err);
    return res.status(500).json({ message: "Store ownership verification failed" });
  }
}

async function handleStoreOwnership(req, res, next) {
  const storeParam = req.params?.storeId || req.body?.storeId || req.query?.storeId;
  if (!storeParam) {
    return res.status(400).json({ message: "Store identifier parameter (:storeId) is required" });
  }

  // 1. Fetch fresh vendor document from database to reflect current status
  let liveVendor = null;
  const vendorsCol = mongoose.connection?.db?.collection("vendors");
  if (vendorsCol) {
    if (req.vendor?.vendorId) {
      liveVendor = await vendorsCol.findOne({ _id: req.vendor.vendorId });
    }
    if (!liveVendor && req.vendor?.email) {
      liveVendor = await vendorsCol.findOne({ email: req.vendor.email.toLowerCase().trim() });
    }
  } else {
    liveVendor = await findVendorByEmail(req.vendor?.email);
  }

  if (!liveVendor || liveVendor.status !== "approved") {
    const status = liveVendor ? liveVendor.status : (req.vendor?.status || "unknown");
    return res.status(403).json({
      message: `Forbidden: Vendor account is not approved (status: '${status}'). Only approved vendors have store access.`,
    });
  }

  req.vendor = {
    ...req.vendor,
    ...liveVendor,
    vendorId: liveVendor._id,
    storeId: liveVendor.storeId,
    status: liveVendor.status,
  };

  // 2. Resolve store by ID, slug, or subdomain safely
  const resolvedStore = await resolveStoreByIdentifier(storeParam);
  if (!resolvedStore) {
    return res.status(404).json({ message: `Store '${storeParam}' not found` });
  }

  // 3. Match vendor's storeId to resolved store's _id
  if (String(liveVendor.storeId) !== String(resolvedStore._id)) {
    return res.status(403).json({
      message: "Forbidden: You do not have ownership of this store",
    });
  }

  req.store = resolvedStore;
  return next();
}
