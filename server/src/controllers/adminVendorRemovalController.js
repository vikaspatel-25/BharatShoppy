import mongoose from "mongoose";
import { deleteStoreMediaFolder } from "../services/cloudinaryService.js";
import { findVendorByEmail, updateVendor, getInMemoryVendors } from "./vendorAuthController.js";
import mockStores from "../data/mockData/stores.js";

// In-memory fallback stores for testing when MongoDB is not connected
let inMemoryStoresForRemoval = new Map();
let inMemoryProductsForRemoval = new Map();

export function setInMemoryStoreForRemoval(store) {
  inMemoryStoresForRemoval.set(store._id, store);
}

export function setInMemoryProductForRemoval(product) {
  inMemoryProductsForRemoval.set(product._id, product);
}

export function resetInMemoryRemovalData() {
  inMemoryStoresForRemoval.clear();
  inMemoryProductsForRemoval.clear();
}

function getVendorsCollection() {
  return mongoose.connection?.db ? mongoose.connection.db.collection("vendors") : null;
}

function getStoresCollection() {
  return mongoose.connection?.db ? mongoose.connection.db.collection("stores") : null;
}

function getProductsCollection() {
  return mongoose.connection?.db ? mongoose.connection.db.collection("products") : null;
}

function getApplicationsCollection() {
  return mongoose.connection?.db ? mongoose.connection.db.collection("vendor_applications") : null;
}

function getSubscriptionRequestsCollection() {
  return mongoose.connection?.db ? mongoose.connection.db.collection("subscription_requests") : null;
}

/**
 * Finds vendor by vendorId or email across MongoDB and in-memory test mocks.
 */
async function findVendor(identifier) {
  if (!identifier) return null;
  const col = getVendorsCollection();
  if (col) {
    const v = await col.findOne({
      $or: [{ _id: identifier }, { email: String(identifier).toLowerCase().trim() }],
    });
    if (v) return v;
  }
  const byEmail = await findVendorByEmail(identifier);
  if (byEmail) return byEmail;
  const all = getInMemoryVendors();
  return (
    all.find(
      (v) =>
        v._id === identifier ||
        v.email === String(identifier).toLowerCase().trim()
    ) || null
  );
}

/**
 * POST /api/admin/vendors/:vendorId/remove
 * Admin action sets status 'removed' with deleteAfter 7 days away and hides listings immediately.
 */
export async function removeVendor(req, res) {
  try {
    const { vendorId } = req.params;
    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID parameter is required." });
    }

    const vendor = await findVendor(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    if (vendor.status === "removed") {
      return res.status(409).json({
        message: "Vendor is already marked for removal.",
        deleteAfter: vendor.deleteAfter,
      });
    }

    // Support time injection for testing (req.body.now, req.query.now, or header)
    const injectedNow =
      process.env.NODE_ENV !== "production" && (req.body?.now || req.query?.now || req.headers["x-injected-time"])
        ? new Date(req.body?.now || req.query?.now || req.headers["x-injected-time"])
        : new Date();

    const deleteAfter = new Date(injectedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const removedAt = injectedNow.toISOString();

    const vendorUpdates = {
      status: "removed",
      deleteAfter,
      removedAt,
      previousStatus: vendor.status || "approved",
    };

    const vendorsCol = getVendorsCollection();
    if (vendorsCol) {
      await vendorsCol.updateOne({ _id: vendor._id }, { $set: vendorUpdates });
    } else {
      await updateVendor(vendor.email, vendorUpdates);
    }

    // Immediately hide store and listings
    const storeId = vendor.storeId;
    if (storeId) {
      const storesCol = getStoresCollection();
      if (storesCol) {
        await storesCol.updateOne(
          { _id: storeId },
          {
            $set: {
              isActive: false,
              removalStatus: "pending_deletion",
              deleteAfter,
            },
          }
        );
      } else {
        const store = inMemoryStoresForRemoval.get(storeId) || mockStores.find((s) => s._id === storeId);
        if (store) {
          store.isActive = false;
          store.removalStatus = "pending_deletion";
          store.deleteAfter = deleteAfter;
        }
      }

      // Immediately hide all listings belonging to this store
      const productsCol = getProductsCollection();
      if (productsCol) {
        await productsCol.updateMany(
          { storeId },
          {
            $set: {
              isActive: false,
              hiddenByVendorRemoval: true,
            },
          }
        );
      } else {
        for (const p of inMemoryProductsForRemoval.values()) {
          if (p.storeId === storeId) {
            p.isActive = false;
            p.hiddenByVendorRemoval = true;
          }
        }
      }
    }

    return res.status(200).json({
      message: "Vendor marked for removal with 7-day hold. Listings have been hidden immediately.",
      vendorId: vendor._id,
      storeId,
      status: "removed",
      deleteAfter,
    });
  } catch (error) {
    console.error("removeVendor error:", error);
    return res.status(500).json({ message: "Failed to mark vendor for removal." });
  }
}

/**
 * POST /api/admin/vendors/:vendorId/cancel-removal
 * Admins can cancel the removal hold during the 7 days, restoring store and listings.
 */
export async function cancelVendorRemoval(req, res) {
  try {
    const { vendorId } = req.params;
    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID parameter is required." });
    }

    const vendor = await findVendor(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    if (vendor.status !== "removed") {
      return res.status(400).json({
        message: "Vendor is not in removed state. Cannot cancel removal.",
      });
    }

    const restoredStatus = vendor.previousStatus || "approved";
    const vendorUpdates = {
      status: restoredStatus,
      deleteAfter: null,
      removedAt: null,
      previousStatus: null,
    };

    const vendorsCol = getVendorsCollection();
    if (vendorsCol) {
      await vendorsCol.updateOne({ _id: vendor._id }, { $set: vendorUpdates });
    } else {
      await updateVendor(vendor.email, vendorUpdates);
    }

    // Restore store and listings
    const storeId = vendor.storeId;
    if (storeId) {
      const storesCol = getStoresCollection();
      if (storesCol) {
        await storesCol.updateOne(
          { _id: storeId },
          {
            $set: {
              isActive: true,
              removalStatus: null,
              deleteAfter: null,
            },
          }
        );
      } else {
        const store = inMemoryStoresForRemoval.get(storeId) || mockStores.find((s) => s._id === storeId);
        if (store) {
          store.isActive = true;
          store.removalStatus = null;
          store.deleteAfter = null;
        }
      }

      // Restore products that were hidden by vendor removal
      const productsCol = getProductsCollection();
      if (productsCol) {
        await productsCol.updateMany(
          { storeId, hiddenByVendorRemoval: true },
          {
            $set: {
              isActive: true,
              hiddenByVendorRemoval: false,
            },
          }
        );
      } else {
        for (const p of inMemoryProductsForRemoval.values()) {
          if (p.storeId === storeId && p.hiddenByVendorRemoval) {
            p.isActive = true;
            p.hiddenByVendorRemoval = false;
          }
        }
      }
    }

    return res.status(200).json({
      message: "Vendor removal cancelled. Store and listings restored successfully.",
      vendorId: vendor._id,
      storeId,
      status: restoredStatus,
    });
  } catch (error) {
    console.error("cancelVendorRemoval error:", error);
    return res.status(500).json({ message: "Failed to cancel vendor removal." });
  }
}

/**
 * Checks authorization for the secured cron endpoint.
 */
function verifyCronAuth(req) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // In production, CRON_SECRET is strictly mandatory
  if (isProduction && !cronSecret) {
    return false;
  }

  const authHeader = req.headers?.authorization;
  if (cronSecret) {
    if (!authHeader) return false;
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1] === cronSecret;
    }
    return false;
  }

  // Non-production fallback when CRON_SECRET is not configured
  return true;
}

/**
 * GET/POST /api/cron/cleanup-removed-vendors
 * Secured Vercel cron that permanently deletes expired profiles, listings, and media.
 * Logs each deletion without personal data.
 */
export async function cleanupRemovedVendors(req, res) {
  try {
    if (!verifyCronAuth(req)) {
      return res.status(401).json({ message: "Unauthorized: Invalid or missing cron secret." });
    }

    const injectedNow =
      process.env.NODE_ENV !== "production" && (req.body?.now || req.query?.now || req.headers["x-injected-time"])
        ? new Date(req.body?.now || req.query?.now || req.headers["x-injected-time"])
        : new Date();

    const nowIso = injectedNow.toISOString();
    const result = await executePermanentDeletion(nowIso);

    return res.status(200).json({
      success: true,
      timestamp: nowIso,
      ...result,
    });
  } catch (error) {
    console.error("cleanupRemovedVendors error:", error);
    return res.status(500).json({ message: "Failed to execute vendor cleanup cron." });
  }
}

/**
 * Executes permanent deletion of vendors whose 7-day hold has expired.
 * Strict privacy rule: Log each deletion WITHOUT personal data (no names, emails, phones, addresses).
 */
export async function executePermanentDeletion(asOfIsoString) {
  const cutoff = asOfIsoString ? new Date(asOfIsoString).toISOString() : new Date().toISOString();
  const vendorsCol = getVendorsCollection();
  const storesCol = getStoresCollection();
  const productsCol = getProductsCollection();
  const appsCol = getApplicationsCollection();
  const subRequestsCol = getSubscriptionRequestsCollection();

  let expiredVendors = [];

  if (vendorsCol) {
    expiredVendors = await vendorsCol
      .find({
        status: "removed",
        deleteAfter: { $lte: cutoff },
      })
      .toArray();
  } else {
    // In-memory check
    const { getInMemoryVendors } = await import("./vendorAuthController.js");
    const allVendors = getInMemoryVendors ? getInMemoryVendors() : [];
    expiredVendors = allVendors.filter(
      (v) => v.status === "removed" && v.deleteAfter && v.deleteAfter <= cutoff
    );
  }

  const deletedRecords = [];

  for (const vendor of expiredVendors) {
    const vendorId = vendor._id;
    const storeId = vendor.storeId;

    let productsDeleted = 0;
    let mediaDeleted = false;

    // 1. Permanently delete media resources from Cloudinary
    if (storeId) {
      try {
        const mediaRes = await deleteStoreMediaFolder(storeId);
        mediaDeleted = Boolean(mediaRes);
      } catch (err) {
        console.warn(`Media deletion skipped or failed for storeId=${storeId}`);
      }
    }

    // 2. Permanently delete products from database
    if (storeId) {
      if (productsCol) {
        const prodRes = await productsCol.deleteMany({ storeId });
        productsDeleted = prodRes.deletedCount || 0;
      } else {
        let count = 0;
        for (const [id, p] of inMemoryProductsForRemoval.entries()) {
          if (p.storeId === storeId) {
            inMemoryProductsForRemoval.delete(id);
            count++;
          }
        }
        productsDeleted = count;
      }
    }

    // 3. Permanently delete store record
    if (storeId) {
      if (storesCol) {
        await storesCol.deleteOne({ _id: storeId });
      } else {
        inMemoryStoresForRemoval.delete(storeId);
      }
    }

    // 4. Permanently delete pending/historical applications and subscription requests
    if (vendor.email) {
      if (appsCol) {
        await appsCol.deleteMany({ email: vendor.email });
      }
    }
    if (storeId && subRequestsCol) {
      await subRequestsCol.deleteMany({ storeId });
    }

    // 5. Permanently delete vendor record
    if (vendorsCol) {
      await vendorsCol.deleteOne({ _id: vendorId });
    } else {
      const { deleteInMemoryVendor } = await import("./vendorAuthController.js");
      if (deleteInMemoryVendor) {
        deleteInMemoryVendor(vendor.email);
      }
    }

    // Log deletion WITHOUT any personal data (only non-PII internal system identifiers and count)
    console.log(
      `[VENDOR REMOVAL CRON] Permanently deleted vendorId=${vendorId}, storeId=${storeId}, productsDeleted=${productsDeleted}, mediaCleaned=${mediaDeleted}`
    );

    deletedRecords.push({
      vendorId,
      storeId,
      productsDeleted,
      mediaDeleted,
    });
  }

  return {
    deletedCount: deletedRecords.length,
    deletedRecords,
  };
}
