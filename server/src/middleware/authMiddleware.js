import mongoose from "mongoose";
import storesMock from "../data/mockData/stores.js";
import { verifyToken } from "../lib/tokenHelper.js";

/**
 * Resolves a store by ID, slug, or subdomain from MongoDB or fallback mock data.
 */
export async function resolveStoreByIdentifier(identifier) {
  if (!identifier) return null;
  const target = String(identifier).trim().toLowerCase();

  const storesCol = mongoose.connection?.db?.collection("stores");
  if (storesCol) {
    const store = await storesCol.findOne({
      $or: [
        { _id: identifier },
        { slug: { $regex: new RegExp(`^${target}$`, "i") } },
        { subdomain: { $regex: new RegExp(`^${target}$`, "i") } },
      ],
    });
    if (store) return store;
  }

  return (
    storesMock.find(
      (s) =>
        s._id === identifier ||
        s.slug?.toLowerCase() === target ||
        s.subdomain?.toLowerCase() === target
    ) || null
  );
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
 * Verifies that the vendor's account is 'approved' and that they own the store.
 * Never trusts a store's public contact.phone as proof of ownership.
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

  // 1. Only approved vendors are permitted to access their store
  if (req.vendor.status !== "approved") {
    return res.status(403).json({
      message: `Forbidden: Vendor account is not approved (status: '${req.vendor.status}'). Only approved vendors have store access.`,
    });
  }

  // 2. Resolve store by ID, slug, or subdomain
  const resolvedStore = await resolveStoreByIdentifier(storeParam);
  if (!resolvedStore) {
    return res.status(404).json({ message: `Store '${storeParam}' not found` });
  }

  // 3. Match vendor's storeId to resolved store's _id
  if (req.vendor.storeId !== resolvedStore._id) {
    return res.status(403).json({
      message: "Forbidden: You do not have ownership of this store",
    });
  }

  req.store = resolvedStore;
  return next();
}
