import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMemoryDb, createMockRes } from "./helpers/memoryDb.js";
import { getSubscriptionState, getRemovalDaysLeft, matchesStatusFilter } from "../src/services/subscriptionStatus.js";
import { isStoreSubscriptionActive } from "../src/services/catalogVisibility.js";
import {
  listVendorDirectory,
  getVendorRemovalImpact,
  getAdminOverview,
  getAdminMe,
} from "../src/controllers/adminPanelController.js";
import { getStoreSubscriptionInfo, getAdminPaymentRequests } from "../src/controllers/subscriptionController.js";

const DAY = 86400000;
const NOW = new Date("2026-11-12T06:00:00.000Z");
const iso = (ms) => new Date(NOW.getTime() + ms).toISOString();

describe("P2: one plan-status rule", () => {
  it("active with more than 30 days left", () => {
    const s = getSubscriptionState({ subscription: { plan: "yearly_standard", status: "active", expiresAt: iso(100 * DAY) } }, NOW);
    assert.equal(s.computedStatus, "active");
    assert.equal(s.remainingDays, 100);
    assert.equal(s.isExpiringSoon, false);
  });

  it("active with 30 days or fewer left is expiring soon", () => {
    const s = getSubscriptionState({ subscription: { status: "active", expiresAt: iso(30 * DAY) } }, NOW);
    assert.equal(s.computedStatus, "active");
    assert.equal(s.isExpiringSoon, true);
    assert.ok(matchesStatusFilter(s, "expiring"));
    assert.ok(matchesStatusFilter(s, "active"));
  });

  it("a stored status of active with a past end date is expired", () => {
    const s = getSubscriptionState({ subscription: { status: "active", expiresAt: iso(-1 * DAY) } }, NOW);
    assert.equal(s.computedStatus, "expired");
    assert.equal(s.remainingDays, 0);
    assert.equal(s.isExpiringSoon, false);
  });

  it("trial counts as active, discontinued counts as expired", () => {
    assert.equal(getSubscriptionState({ subscription: { status: "trial", expiresAt: iso(5 * DAY) } }, NOW).computedStatus, "active");
    assert.equal(getSubscriptionState({ subscription: { status: "expired", expiresAt: iso(-1) } }, NOW).computedStatus, "expired");
  });

  it("no subscription record is 'none'", () => {
    const s = getSubscriptionState({ storeName: "Legacy" }, NOW);
    assert.equal(s.computedStatus, "none");
    assert.equal(s.expiresAt, null);
  });

  it("removal hold wins over the plan, with days left", () => {
    const store = {
      removalStatus: "pending_deletion",
      deleteAfter: iso(3 * DAY + 1000),
      subscription: { status: "active", expiresAt: iso(100 * DAY) },
    };
    assert.equal(getSubscriptionState(store, NOW).computedStatus, "removal_hold");
    assert.equal(getRemovalDaysLeft(store, NOW), 4);
  });

  it("public visibility rules are unchanged", () => {
    // Legacy store with no subscription record stays visible
    assert.equal(isStoreSubscriptionActive({ _id: "a" }, NOW), true);
    // Inactive store is hidden whatever its plan
    assert.equal(isStoreSubscriptionActive({ isActive: false, subscription: { status: "active" } }, NOW), false);
    // Active without an end date is visible
    assert.equal(isStoreSubscriptionActive({ subscription: { status: "active" } }, NOW), true);
    // Trial is visible
    assert.equal(isStoreSubscriptionActive({ subscription: { status: "trial", expiresAt: iso(DAY) } }, NOW), true);
    // Past end date is hidden
    assert.equal(isStoreSubscriptionActive({ subscription: { status: "active", expiresAt: iso(-DAY) } }, NOW), false);
    // Any other status is hidden
    assert.equal(isStoreSubscriptionActive({ subscription: { status: "pending_payment", expiresAt: iso(DAY) } }, NOW), false);
    assert.equal(isStoreSubscriptionActive(null, NOW), false);
  });
});

describe("P2: admin panel data routes", () => {
  let previousDb;
  let memDb;

  const seed = () => ({
    stores: [
      { _id: "s_active", storeName: "Asha Tailors", slug: "asha", subdomain: "asha", city: "Pune", contact: { phone: "+919800000001" }, subscription: { plan: "yearly_standard", status: "active", expiresAt: iso(200 * DAY) }, limits: { productMonthlyLimit: 50 } },
      { _id: "s_soon", storeName: "Bala Farms", slug: "bala", subdomain: "bala", subscription: { plan: "starter_free", status: "active", expiresAt: iso(10 * DAY) } },
      { _id: "s_stale", storeName: "Chotu Repairs", slug: "chotu", subdomain: "chotu", subscription: { plan: "yearly_pro", status: "active", expiresAt: iso(-2 * DAY) } },
      { _id: "s_none", storeName: "Demo Legacy", slug: "legacy" },
      { _id: "s_hold", storeName: "Dhaba Store", slug: "dhaba", isActive: false, removalStatus: "pending_deletion", deleteAfter: iso(5 * DAY), subscription: { plan: "mystery_plan", status: "active", expiresAt: iso(90 * DAY) } },
    ],
    vendors: [
      { _id: "v_active", email: "asha@example.com", storeId: "s_active", status: "approved" },
      { _id: "v_soon", email: "bala@example.com", storeId: "s_soon", status: "approved" },
      { _id: "v_hold", email: "dhaba@example.com", storeId: "s_hold", status: "removed" },
    ],
    products: [
      { _id: "p1", storeId: "s_active", isActive: true, images: ["a"], imageAssets: [{ url: "u1", publicId: "x/1" }, { url: "u2", publicId: "x/2" }] },
      { _id: "p2", storeId: "s_active", isActive: false, imageAssets: [{ url: "u3", publicId: "x/3" }] },
      { _id: "p3", storeId: "s_active", images: ["legacy.jpg"] },
      { _id: "p4", storeId: "s_soon", isActive: true, moderation: { status: "hidden", reason: "Wrong photos" } },
      { _id: "p5", storeId: "s_hold", isActive: false, imageAssets: [{ url: "u4", publicId: "x/4" }] },
    ],
    vendor_applications: [
      { _id: "a1", status: "pending" },
      { _id: "a2", status: "pending" },
      { _id: "a3", status: "rejected" },
    ],
    subscription_requests: [
      { _id: "r1", storeId: "s_soon", storeName: "Bala Farms", selectedPlan: "yearly_standard", status: "pending", createdAt: iso(-DAY) },
      { _id: "r2", storeId: "s_active", storeName: "Asha Tailors", selectedPlan: "yearly_standard", status: "approved", createdAt: iso(-5 * DAY) },
      { _id: "r3", storeId: "s_stale", storeName: "Chotu Repairs", selectedPlan: "yearly_pro", status: "rejected", adminNotes: "Payment not received", createdAt: iso(-9 * DAY) },
    ],
  });

  before(() => {
    previousDb = mongoose.connection.db;
  });
  after(() => {
    mongoose.connection.db = previousDb;
  });
  beforeEach(() => {
    memDb = createMemoryDb(seed());
    mongoose.connection.db = memDb;
  });

  const call = async (handler, req) => {
    const res = createMockRes();
    await handler({ query: {}, params: {}, body: {}, ...req }, res);
    return res;
  };

  it("lists every store with computed status, plan name, vendor email and active item count", async () => {
    const res = await call(listVendorDirectory, {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total, 5);
    const asha = res.body.vendors.find((v) => v.storeId === "s_active");
    assert.equal(asha.email, "asha@example.com");
    assert.equal(asha.computedStatus, "active");
    assert.equal(asha.planName, "Boutique & Farm Standard");
    assert.equal(asha.activeItems, 2, "inactive items are not counted");
    assert.equal(asha.itemLimit, 50);
    const stale = res.body.vendors.find((v) => v.storeId === "s_stale");
    assert.equal(stale.computedStatus, "expired", "stored 'active' with a past end date shows as expired");
    const hold = res.body.vendors.find((v) => v.storeId === "s_hold");
    assert.equal(hold.computedStatus, "removal_hold");
    assert.equal(hold.removalDaysLeft, 5);
    assert.equal(hold.planName, null, "an unknown plan ID gets no borrowed name");
    assert.equal(hold.planId, "mystery_plan");
  });

  it("returns totals per status over all stores, whatever the filter", async () => {
    const res = await call(listVendorDirectory, { query: { status: "expired", limit: "1" } });
    assert.deepEqual(res.body.totals, { all: 5, active: 2, expiring: 1, expired: 1, none: 1, removal_hold: 1 });
    assert.equal(res.body.vendors.length, 1);
    assert.equal(res.body.vendors[0].storeId, "s_stale");
  });

  it("filters by ending soon and by search text", async () => {
    const soon = await call(listVendorDirectory, { query: { status: "expiring" } });
    assert.deepEqual(soon.body.vendors.map((v) => v.storeId), ["s_soon"]);

    const byEmail = await call(listVendorDirectory, { query: { search: "ASHA@" } });
    assert.deepEqual(byEmail.body.vendors.map((v) => v.storeId), ["s_active"]);

    const bySlug = await call(listVendorDirectory, { query: { search: "chotu" } });
    assert.deepEqual(bySlug.body.vendors.map((v) => v.storeId), ["s_stale"]);

    const regexChars = await call(listVendorDirectory, { query: { search: "(.*" } });
    assert.equal(regexChars.statusCode, 200);
    assert.equal(regexChars.body.total, 0);
  });

  it("caps the page size and pages through results", async () => {
    const big = await call(listVendorDirectory, { query: { limit: "5000" } });
    assert.equal(big.body.limit, 100);
    const page2 = await call(listVendorDirectory, { query: { skip: "4", limit: "2" } });
    assert.equal(page2.body.vendors.length, 1);
    assert.equal(page2.body.total, 5);
  });

  it("rejects an unknown status filter", async () => {
    const res = await call(listVendorDirectory, { query: { status: "deleted" } });
    assert.equal(res.statusCode, 400);
  });

  it("returns 503 when the database is unavailable", async () => {
    mongoose.connection.db = undefined;
    const res = await call(listVendorDirectory, {});
    assert.equal(res.statusCode, 503);
  });

  it("counts the items and uploaded photos removal would delete", async () => {
    const res = await call(getVendorRemovalImpact, { params: { vendorId: "v_active" } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.impact, { items: 3, photos: 3 });
    assert.equal(res.body.store.storeName, "Asha Tailors");

    const missing = await call(getVendorRemovalImpact, { params: { vendorId: "nope" } });
    assert.equal(missing.statusCode, 404);
  });

  it("returns dashboard totals", async () => {
    const res = await call(getAdminOverview, {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.applicationsWaiting, 2);
    assert.equal(res.body.planRequestsWaiting, 1);
    assert.equal(res.body.activeItems, 3);
    assert.equal(res.body.hiddenItems, 1);
    assert.equal(res.body.stores.expired, 1);
    assert.equal(res.body.stores.all, 5);
  });

  it("auth/me returns the admin email and nothing else", async () => {
    const res = await call(getAdminMe, { admin: { adminId: "admin_1", email: "admin@example.com", role: "admin", iat: 1 } });
    assert.deepEqual(res.body, { admin: { email: "admin@example.com" } });
  });

  it("plan requests include vendor email and totals per status", async () => {
    const res = await call(getAdminPaymentRequests, { query: { status: "pending" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.requests.length, 1);
    assert.equal(res.body.requests[0].vendorEmail, "bala@example.com");
    assert.deepEqual(res.body.counts, { pending: 1, approved: 1, rejected: 1, total: 3 });

    const all = await call(getAdminPaymentRequests, {});
    const rejected = all.body.requests.find((r) => r.requestId === "r3");
    assert.equal(rejected.rejectionReason, "Payment not received");
  });

  it("subscription info invents nothing for a store with no subscription record", async () => {
    const store = memDb.collection("stores").docs.find((s) => s._id === "s_none");
    const res = await call(getStoreSubscriptionInfo, { params: { storeId: "s_none" }, store });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.subscription.computedStatus, "none");
    assert.equal(res.body.subscription.expiresAt, undefined);
    assert.equal(res.body.subscription.plan, null);
    assert.equal(res.body.subscription.planDetails, null);
    assert.equal(res.body.subscription.daysRemaining, 0);
  });

  it("subscription info reports an unknown plan ID without borrowing another plan", async () => {
    const store = memDb.collection("stores").docs.find((s) => s._id === "s_hold");
    const res = await call(getStoreSubscriptionInfo, { params: { storeId: "s_hold" }, store });
    assert.equal(res.body.subscription.plan, "mystery_plan");
    assert.equal(res.body.subscription.planDetails, null);
    assert.equal(res.body.subscription.computedStatus, "removal_hold");
  });

  it("subscription info shows a stale active plan as expired", async () => {
    const store = memDb.collection("stores").docs.find((s) => s._id === "s_stale");
    const res = await call(getStoreSubscriptionInfo, { params: { storeId: "s_stale" }, store });
    assert.equal(res.body.subscription.effectiveStatus, "expired");
    assert.equal(res.body.subscription.planName, "Enterprise & Agri-Hub Pro");
  });
});
