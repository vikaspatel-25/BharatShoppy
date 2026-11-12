import mongoose from "mongoose";
import { getSubscriptionState, getRemovalDaysLeft, matchesStatusFilter } from "../services/subscriptionStatus.js";
import { getPlanNameMap } from "../services/planService.js";

/**
 * Read-only data the admin panel needs: who is signed in, the vendor directory,
 * what removing a vendor would delete, and the dashboard totals.
 */

const STATUS_FILTERS = new Set(["all", "active", "expiring", "expired", "none", "removal_hold"]);
const MAX_LIMIT = 100;

function db() {
  return mongoose.connection?.db || null;
}

function dbUnavailable(res) {
  return res.status(503).json({ message: "Database service unavailable. Please try again later." });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePaging(query) {
  const skip = Math.max(0, Number.parseInt(query?.skip, 10) || 0);
  const rawLimit = Number.parseInt(query?.limit, 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 25));
  return { skip, limit };
}

const STORE_PROJECTION = {
  storeName: 1,
  slug: 1,
  subdomain: 1,
  entityType: 1,
  storeCategory: 1,
  city: 1,
  "address.city": 1,
  "contact.phone": 1,
  "contact.whatsapp": 1,
  "contact.email": 1,
  subscription: 1,
  limits: 1,
  isActive: 1,
  removalStatus: 1,
  deleteAfter: 1,
  createdAt: 1,
};

/** GET /api/admin/auth/me */
export async function getAdminMe(req, res) {
  return res.json({ admin: { email: req.admin?.email || null } });
}

/**
 * GET /api/admin/vendors?search=&status=&skip=&limit=
 * One row per store, joined with its vendor. Totals per status cover all stores,
 * not only the page returned, so the tabs always show real counts.
 */
export async function listVendorDirectory(req, res) {
  try {
    const database = db();
    if (!database) return dbUnavailable(res);

    const status = typeof req.query?.status === "string" ? req.query.status : "all";
    if (!STATUS_FILTERS.has(status)) {
      return res.status(400).json({ message: `Unknown status filter '${status}'.` });
    }
    const search = typeof req.query?.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const { skip, limit } = parsePaging(req.query);
    const now = new Date();

    const [stores, vendors, planNames] = await Promise.all([
      database.collection("stores").find({}, { projection: STORE_PROJECTION }).toArray(),
      database
        .collection("vendors")
        .find({}, { projection: { email: 1, storeId: 1, status: 1, name: 1, deleteAfter: 1 } })
        .toArray(),
      getPlanNameMap(),
    ]);

    const vendorByStore = new Map();
    for (const v of vendors) if (v.storeId) vendorByStore.set(String(v.storeId), v);

    const totals = { all: 0, active: 0, expiring: 0, expired: 0, none: 0, removal_hold: 0 };
    const searchRe = search ? new RegExp(escapeRegex(search), "i") : null;
    const matching = [];

    for (const store of stores) {
      const vendor = vendorByStore.get(String(store._id)) || null;
      const state = getSubscriptionState(store, now);

      totals.all += 1;
      totals[state.computedStatus] += 1;
      if (state.isExpiringSoon) totals.expiring += 1;

      if (!matchesStatusFilter(state, status)) continue;
      if (searchRe) {
        const haystack = [store.storeName, store.slug, store.subdomain, vendor?.email, store.contact?.email].filter(Boolean);
        if (!haystack.some((text) => searchRe.test(String(text)))) continue;
      }
      matching.push({ store, vendor, state });
    }

    // Most urgent first: removal hold, ending soon, then by name
    const rank = (row) =>
      row.state.computedStatus === "removal_hold" ? 0 : row.state.isExpiringSoon ? 1 : row.state.computedStatus === "expired" ? 2 : 3;
    matching.sort((a, b) => rank(a) - rank(b) || String(a.store.storeName || "").localeCompare(String(b.store.storeName || "")));

    const page = matching.slice(skip, skip + limit);
    const pageIds = page.map((row) => row.store._id);

    const activeCounts = new Map();
    if (pageIds.length > 0) {
      const items = await database
        .collection("products")
        .find({ storeId: { $in: pageIds }, isActive: { $ne: false } }, { projection: { storeId: 1 } })
        .toArray();
      for (const item of items) {
        const key = String(item.storeId);
        activeCounts.set(key, (activeCounts.get(key) || 0) + 1);
      }
    }

    const rows = page.map(({ store, vendor, state }) => ({
      vendorId: vendor?._id ?? null,
      vendorStatus: vendor?.status ?? null,
      vendorName: vendor?.name ?? null,
      email: vendor?.email || store.contact?.email || null,
      storeId: store._id,
      storeName: store.storeName || "",
      slug: store.slug || null,
      subdomain: store.subdomain || store.slug || null,
      entityType: store.entityType || null,
      category: store.storeCategory || null,
      city: store.city || store.address?.city || null,
      phone: store.contact?.phone || null,
      whatsapp: store.contact?.whatsapp || null,
      planId: state.planId,
      planName: state.planId ? planNames.get(state.planId) || null : null,
      computedStatus: state.computedStatus,
      expiresAt: state.expiresAt,
      startDate: state.startDate,
      remainingDays: state.remainingDays,
      isExpiringSoon: state.isExpiringSoon,
      removalDaysLeft: state.computedStatus === "removal_hold" ? getRemovalDaysLeft(store, now) : 0,
      deleteAfter: state.computedStatus === "removal_hold" ? store.deleteAfter || null : null,
      itemLimit: Number(store.limits?.productMonthlyLimit) || 0,
      activeItems: activeCounts.get(String(store._id)) || 0,
      createdAt: store.createdAt || null,
    }));

    return res.json({ vendors: rows, total: matching.length, totals, skip, limit });
  } catch (error) {
    console.error("listVendorDirectory error:", error);
    return res.status(500).json({ message: "Failed to load the vendor directory." });
  }
}

/** GET /api/admin/vendors/:vendorId/removal-impact */
export async function getVendorRemovalImpact(req, res) {
  try {
    const database = db();
    if (!database) return dbUnavailable(res);

    const { vendorId } = req.params;
    if (!vendorId || typeof vendorId !== "string") {
      return res.status(400).json({ message: "Vendor ID is required." });
    }

    const vendor = await database.collection("vendors").findOne({ _id: vendorId }, { projection: { email: 1, storeId: 1, status: 1 } });
    if (!vendor) return res.status(404).json({ message: "Vendor not found." });

    let store = null;
    let items = 0;
    let photos = 0;
    if (vendor.storeId) {
      store = await database.collection("stores").findOne({ _id: vendor.storeId }, { projection: { storeName: 1, slug: 1 } });
      const products = await database
        .collection("products")
        .find({ storeId: vendor.storeId }, { projection: { images: 1, imageAssets: 1 } })
        .toArray();
      items = products.length;
      for (const p of products) {
        // Uploaded photos are the ones recorded in imageAssets; older items only have image links
        photos += Array.isArray(p.imageAssets) ? p.imageAssets.length : 0;
      }
    }

    return res.json({
      vendor: { vendorId: vendor._id, email: vendor.email, status: vendor.status },
      store: store ? { storeId: store._id, storeName: store.storeName, slug: store.slug } : null,
      impact: { items, photos },
    });
  } catch (error) {
    console.error("getVendorRemovalImpact error:", error);
    return res.status(500).json({ message: "Failed to work out what removal would delete." });
  }
}

/** GET /api/admin/overview: the numbers on the admin dashboard and the sidebar badges. */
export async function getAdminOverview(req, res) {
  try {
    const database = db();
    if (!database) return dbUnavailable(res);
    const now = new Date();

    const [applicationsWaiting, planRequestsWaiting, activeItems, hiddenItems, stores] = await Promise.all([
      database.collection("vendor_applications").countDocuments({ status: "pending" }),
      database.collection("subscription_requests").countDocuments({ status: "pending" }),
      database.collection("products").countDocuments({ isActive: { $ne: false } }),
      database.collection("products").countDocuments({ "moderation.status": "hidden" }),
      database
        .collection("stores")
        .find({}, { projection: { subscription: 1, removalStatus: 1 } })
        .toArray(),
    ]);

    const storeTotals = { all: 0, active: 0, expiring: 0, expired: 0, none: 0, removal_hold: 0 };
    for (const store of stores) {
      const state = getSubscriptionState(store, now);
      storeTotals.all += 1;
      storeTotals[state.computedStatus] += 1;
      if (state.isExpiringSoon) storeTotals.expiring += 1;
    }

    return res.json({ applicationsWaiting, planRequestsWaiting, activeItems, hiddenItems, stores: storeTotals });
  } catch (error) {
    console.error("getAdminOverview error:", error);
    return res.status(500).json({ message: "Failed to load the dashboard." });
  }
}
