import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { createMemoryDb, createMockRes } from "./helpers/memoryDb.js";
import { listAdminPlans, updateAdminPlan, validatePlanEdit } from "../src/controllers/adminPlanController.js";
import {
  adminDirectRenew,
  getStoreSubscriptionInfo,
  getSubscriptionPlans,
  resetInMemorySubscriptionRequests,
  submitSubscriptionRequest,
  verifyPaymentRequest,
} from "../src/controllers/subscriptionController.js";
import { generateLimitLines, listPlans } from "../src/services/planService.js";
import { defaultPlans } from "../src/data/mockData/subscriptionPlans.js";
import { assertPlanSeedAllowed } from "../scripts/seedPlans.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
const future = (days) => new Date(Date.now() + days * DAY).toISOString();
const admin = { adminId: "admin_1", email: "admin@example.com" };

const call = async (handler, req) => {
  const res = createMockRes();
  await handler({ query: {}, params: {}, body: {}, headers: {}, admin, ...req }, res);
  return res;
};

describe("P8: plans in the database", () => {
  let previousDb;
  let memDb;

  const seed = () => ({
    stores: [
      { _id: "s_current", storeName: "Current Store", slug: "current", isActive: true, subscription: { plan: "yearly_standard", status: "active", expiresAt: future(100) }, limits: { productMonthlyLimit: 50, maxImagesPerProduct: 8 } },
      { _id: "s_renew", storeName: "Renew Store", slug: "renew", isActive: true, subscription: { plan: "starter_free", status: "active", expiresAt: future(5) }, limits: { productMonthlyLimit: 15, maxImagesPerProduct: 5 } },
    ],
    vendors: [
      { _id: "v_current", email: "current@example.com", storeId: "s_current", status: "approved" },
      { _id: "v_renew", email: "renew@example.com", storeId: "s_renew", status: "approved" },
    ],
    subscription_plans: [],
    subscription_requests: [],
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
    resetInMemorySubscriptionRequests();
  });

  const edit = (planId, body) => call(updateAdminPlan, { params: { planId }, body });

  it("falls back to the defaults while the collection is empty", async () => {
    const plans = await listPlans({ includeInactive: true });
    assert.deepEqual(plans.map((p) => p.planId), defaultPlans.map((p) => p.planId));
  });

  it("generates the item and photo lines from the numbers", async () => {
    const res = await edit("yearly_standard", { productMonthlyLimit: 5, maxImagesPerProduct: 3, extraFeatures: ["Store QR code"] });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const plan = (await listPlans()).find((p) => p.planId === "yearly_standard");
    assert.deepEqual(plan.features, ["Up to 5 active items in your store", "Up to 3 photos per item", "Store QR code"]);
    assert.deepEqual(generateLimitLines({ productMonthlyLimit: 1, maxImagesPerProduct: 1 }), ["Up to 1 active item in your store", "Up to 1 photo per item"]);
    for (const p of await listPlans({ includeInactive: true })) {
      assert.ok(!p.features.some((l) => /\d+\s*(catalog\s+)?products/i.test(l)), `${p.planId} has no free-text limit line`);
    }
  });

  it("the first edit stores every default plan, so none disappears", async () => {
    await edit("yearly_pro", { name: "Pro" });
    assert.equal(memDb.collection("subscription_plans").docs.length, defaultPlans.length);
    const plans = await listPlans({ includeInactive: true });
    assert.equal(plans.find((p) => p.planId === "yearly_pro").name, "Pro");
  });

  it("the public plan list reads the edited plan", async () => {
    await edit("yearly_standard", { name: "Standard Yearly", discountedPrice: 999 });
    const res = await call(getSubscriptionPlans, {});
    const plan = res.body.plans.find((p) => p.planId === "yearly_standard");
    assert.equal(plan.name, "Standard Yearly");
    assert.equal(plan.discountedPrice, 999);
    assert.equal(plan.discountPercentage, 45, "discount is computed on the server");
  });

  it("an edited limit applies at the next activation and not to a current subscriber", async () => {
    await edit("yearly_standard", { productMonthlyLimit: 70, maxImagesPerProduct: 9 });
    const current = memDb.collection("stores").docs.find((s) => s._id === "s_current");
    assert.equal(current.limits.productMonthlyLimit, 50, "current subscriber keeps their limit");

    const res = await call(adminDirectRenew, { params: { storeId: "s_renew" }, body: { planId: "yearly_standard", durationDays: 30 } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const renewed = memDb.collection("stores").docs.find((s) => s._id === "s_renew");
    assert.equal(renewed.limits.productMonthlyLimit, 70);
    assert.equal(renewed.limits.maxImagesPerProduct, 9);
  });

  it("approving a request copies the stored plan's limits", async () => {
    await edit("yearly_pro", { productMonthlyLimit: 250 });
    const store = memDb.collection("stores").docs.find((s) => s._id === "s_renew");
    const sent = await call(submitSubscriptionRequest, { params: { storeId: "s_renew" }, store, body: { planId: "yearly_pro" } });
    assert.equal(sent.statusCode, 201, JSON.stringify(sent.body));
    const requestId = memDb.collection("subscription_requests").docs[0]._id;
    const res = await call(verifyPaymentRequest, { params: { requestId }, body: { action: "approve", durationDays: 30 } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(memDb.collection("stores").docs.find((s) => s._id === "s_renew").limits.productMonthlyLimit, 250);
  });

  it("a switched-off plan is refused for a new request but still shown as a store's current plan", async () => {
    const off = await edit("yearly_standard", { isActive: false });
    assert.equal(off.statusCode, 200, JSON.stringify(off.body));

    const store = memDb.collection("stores").docs.find((s) => s._id === "s_renew");
    const req = await call(submitSubscriptionRequest, { params: { storeId: "s_renew" }, store, body: { planId: "yearly_standard" } });
    assert.equal(req.statusCode, 400);
    assert.match(req.body.message, /isn't available/);

    const pub = await call(getSubscriptionPlans, {});
    assert.ok(!pub.body.plans.some((p) => p.planId === "yearly_standard"), "not offered publicly");

    const current = memDb.collection("stores").docs.find((s) => s._id === "s_current");
    const info = await call(getStoreSubscriptionInfo, { params: { storeId: "s_current" }, store: current });
    assert.equal(info.body.subscription.planName, "Boutique & Farm Standard");

    const list = await call(listAdminPlans, {});
    const row = list.body.plans.find((p) => p.planId === "yearly_standard");
    assert.equal(row.isActive, false);
    assert.equal(row.storesOnPlan, 1);
  });

  it("refuses to switch off the last available plan", async () => {
    await edit("starter_free", { isActive: false });
    await edit("yearly_pro", { isActive: false });
    const res = await edit("yearly_standard", { isActive: false });
    assert.equal(res.statusCode, 409);
  });

  it("rejects banned claims, restated limits, and bad prices and limits with 400", async () => {
    const cases = [
      { extraFeatures: ["Priority support"] },
      { extraFeatures: ["Sales analytics dashboard"] },
      { extraFeatures: ["Verified badge"] },
      { name: "Top ranking plan" },
      { extraFeatures: ["50 catalog products"] },
      { discountedPrice: -1 },
      { originalPrice: 12.5 },
      { discountedPrice: "100" },
      { productMonthlyLimit: 0 },
      { maxImagesPerProduct: 21 },
      { isActive: "no" },
      { originalPrice: 100, discountedPrice: 200 },
      {},
    ];
    for (const body of cases) {
      const res = await edit("yearly_standard", body);
      assert.equal(res.statusCode, 400, `expected 400 for ${JSON.stringify(body)}, got ${res.statusCode}`);
    }
    assert.equal(memDb.collection("subscription_plans").docs.length, 0, "nothing was stored by a refused edit");
  });

  it("returns 404 for an unknown plan and doesn't create it", async () => {
    const res = await edit("made_up", { name: "Made up" });
    assert.equal(res.statusCode, 404);
  });

  it("only allowed fields are saved", () => {
    const { update } = validatePlanEdit({ name: "Plan", planId: "other", _id: "x", features: ["x"], discountPercentage: 99 });
    assert.deepEqual(Object.keys(update), ["name"]);
  });

  it("writes an audit entry with what changed", async () => {
    await edit("yearly_standard", { productMonthlyLimit: 60 });
    const entries = memDb.collection("admin_audit_log").docs;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].action, "plan.update");
    assert.equal(entries[0].targetType, "plan");
    assert.equal(entries[0].targetId, "yearly_standard");
    assert.deepEqual(entries[0].details.productMonthlyLimit, { from: 50, to: 60 });
  });

  it("returns 503 when the database is unavailable", async () => {
    mongoose.connection.db = null;
    const res = await edit("yearly_standard", { name: "Plan" });
    assert.equal(res.statusCode, 503);
  });
});

describe("P8: every controller reads plans through the service", () => {
  it("no controller imports the default plan list or keeps its own copy", () => {
    const dir = path.join(__dirname, "..", "src", "controllers");
    for (const file of fs.readdirSync(dir)) {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      assert.ok(!content.includes("inMemoryPlans"), `${file} keeps an in-memory plan list`);
      assert.ok(!content.includes("defaultPlans"), `${file} reads the default plans directly`);
    }
  });
});

describe("P8: plan seed script guard", () => {
  it("refuses in production without the explicit flag, and without MONGO_URI", () => {
    assert.throws(() => assertPlanSeedAllowed({ NODE_ENV: "production", MONGO_URI: "mongodb://x" }), /production/);
    assert.doesNotThrow(() => assertPlanSeedAllowed({ NODE_ENV: "production", ALLOW_PLAN_SEED_IN_PRODUCTION: "true", MONGO_URI: "mongodb://x" }));
    assert.throws(() => assertPlanSeedAllowed({ NODE_ENV: "development" }), /MONGO_URI/);
    assert.doesNotThrow(() => assertPlanSeedAllowed({ NODE_ENV: "development", MONGO_URI: "mongodb://x" }));
  });
});
