import mongoose from "mongoose";
import { logAdminAction } from "../services/auditLogService.js";
import { sendListingHiddenEmail, sendListingRestoredEmail } from "../services/emailService.js";
import { findVendorByStoreId } from "./vendorAuthController.js";

/**
 * Admin listing moderation: see items across all stores, hide one with a reason,
 * and restore it. Hiding is separate from the vendor's own active switch, and a vendor
 * can't undo it. Admins still can't add, edit or delete items.
 */

const MAX_LIMIT = 100;
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;

function db() {
  return mongoose.connection?.db || null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function vendorEmailFor(store) {
  if (store?._id) {
    const col = db()?.collection("vendors");
    const vendor = col ? await col.findOne({ storeId: store._id }, { projection: { email: 1 } }) : await findVendorByStoreId(store._id);
    if (vendor?.email) return vendor.email;
  }
  return store?.contact?.email || null;
}

/** GET /api/admin/listings?search=&storeId=&state=&skip=&limit= */
export async function listListings(req, res) {
  try {
    const database = db();
    if (!database) return res.status(503).json({ message: "Database service unavailable. Please try again later." });

    const search = typeof req.query?.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const storeId = typeof req.query?.storeId === "string" ? req.query.storeId.trim() : "";
    const state = typeof req.query?.state === "string" ? req.query.state : "all";
    if (!["all", "visible", "hidden"].includes(state)) {
      return res.status(400).json({ message: `Unknown state filter '${state}'.` });
    }
    if (storeId && !ID_PATTERN.test(storeId)) {
      return res.status(400).json({ message: "Invalid store ID." });
    }
    const skip = Math.max(0, Number.parseInt(req.query?.skip, 10) || 0);
    const rawLimit = Number.parseInt(req.query?.limit, 10);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 25));

    const filter = {};
    if (storeId) filter.storeId = storeId;
    if (state === "hidden") filter["moderation.status"] = "hidden";
    if (state === "visible") filter["moderation.status"] = { $ne: "hidden" };

    const storesCol = database.collection("stores");
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      const matchingStores = await storesCol.find({ storeName: { $regex: re } }, { projection: { _id: 1 } }).toArray();
      filter.$or = [{ productName: { $regex: re } }, { storeId: { $in: matchingStores.map((s) => s._id) } }];
    }

    const productsCol = database.collection("products");
    const [items, total] = await Promise.all([
      productsCol
        .find(filter, {
          projection: { productName: 1, images: 1, price: 1, storeId: 1, isActive: 1, moderation: 1, category: 1, updatedAt: 1, createdAt: 1 },
        })
        .sort({ updatedAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      productsCol.countDocuments(filter),
    ]);

    const storeIds = [...new Set(items.map((i) => i.storeId).filter(Boolean))];
    const stores = storeIds.length
      ? await storesCol.find({ _id: { $in: storeIds } }, { projection: { storeName: 1, slug: 1 } }).toArray()
      : [];
    const storeById = new Map(stores.map((s) => [String(s._id), s]));

    const listings = items.map((item) => {
      const store = storeById.get(String(item.storeId));
      return {
        productId: item._id,
        productName: item.productName || "",
        image: Array.isArray(item.images) ? item.images[0] || null : null,
        price: item.price ?? null,
        category: item.category || null,
        storeId: item.storeId,
        storeName: store?.storeName || null,
        storeSlug: store?.slug || null,
        vendorActive: item.isActive !== false,
        hidden: item.moderation?.status === "hidden",
        moderation: item.moderation || null,
      };
    });

    return res.json({ listings, total, skip, limit });
  } catch (error) {
    console.error("listListings error:", error);
    return res.status(500).json({ message: "Failed to load listings." });
  }
}

async function loadTarget(req, res) {
  const database = db();
  if (!database) {
    res.status(503).json({ message: "Database service unavailable. Please try again later." });
    return null;
  }
  const { productId } = req.params;
  if (typeof productId !== "string" || !ID_PATTERN.test(productId)) {
    res.status(400).json({ message: "Invalid item ID." });
    return null;
  }
  const product = await database.collection("products").findOne({ _id: productId });
  if (!product) {
    res.status(404).json({ message: "Item not found." });
    return null;
  }
  const store = await database.collection("stores").findOne({ _id: product.storeId }, { projection: { storeName: 1, contact: 1 } });
  return { database, product, store };
}

/** POST /api/admin/listings/:productId/hide  { reason } */
export async function hideListing(req, res) {
  try {
    const rawReason = req.body?.reason;
    if (typeof rawReason !== "string" || rawReason.trim().length < 5 || rawReason.trim().length > 500) {
      return res.status(400).json({ message: "Give the vendor a reason of 5 to 500 characters." });
    }
    const reason = rawReason.trim();

    const target = await loadTarget(req, res);
    if (!target) return undefined;
    const { database, product, store } = target;

    // The vendor sees this object, so it holds no admin details. The audit log records who did it.
    const moderation = { status: "hidden", reason, hiddenAt: new Date().toISOString() };
    // Conditional on the item not being hidden already, so two admins can't both hide it
    const result = await database
      .collection("products")
      .updateOne({ _id: product._id, "moderation.status": { $ne: "hidden" } }, { $set: { moderation } });
    if (result.matchedCount === 0) {
      return res.status(409).json({ message: "This item is already hidden." });
    }

    let warning = null;
    const email = await vendorEmailFor(store);
    if (email) {
      try {
        await sendListingHiddenEmail(email, { storeName: store?.storeName || "your store", productName: product.productName || "An item", reason });
      } catch (emailErr) {
        console.error("Failed to send listing hidden email:", emailErr);
        warning = "The item is hidden, but the email to the vendor could not be sent.";
      }
    } else {
      warning = "The item is hidden, but no vendor email was found to tell them.";
    }

    await logAdminAction({
      req,
      action: "listing.hide",
      targetType: "listing",
      targetId: product._id,
      targetName: product.productName,
      details: { storeId: product.storeId, storeName: store?.storeName || null, reason, emailFailed: Boolean(warning) },
    });

    return res.json({ success: true, message: "Item hidden from the public.", warning, moderation });
  } catch (error) {
    console.error("hideListing error:", error);
    return res.status(500).json({ message: "Failed to hide the item." });
  }
}

/** POST /api/admin/listings/:productId/restore */
export async function restoreListing(req, res) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return undefined;
    const { database, product, store } = target;

    const result = await database
      .collection("products")
      .updateOne({ _id: product._id, "moderation.status": "hidden" }, { $unset: { moderation: "" } });
    if (result.matchedCount === 0) {
      return res.status(409).json({ message: "This item isn't hidden." });
    }

    let warning = null;
    const email = await vendorEmailFor(store);
    if (email) {
      try {
        await sendListingRestoredEmail(email, { storeName: store?.storeName || "your store", productName: product.productName || "An item" });
      } catch (emailErr) {
        console.error("Failed to send listing restored email:", emailErr);
        warning = "The item is visible again, but the email to the vendor could not be sent.";
      }
    }

    await logAdminAction({
      req,
      action: "listing.restore",
      targetType: "listing",
      targetId: product._id,
      targetName: product.productName,
      details: { storeId: product.storeId, storeName: store?.storeName || null, previousReason: product.moderation?.reason || null, emailFailed: Boolean(warning) },
    });

    return res.json({
      success: true,
      message: product.isActive === false ? "Restored. It stays off the site until the vendor makes it active." : "Item is visible again.",
      warning,
    });
  } catch (error) {
    console.error("restoreListing error:", error);
    return res.status(500).json({ message: "Failed to restore the item." });
  }
}
