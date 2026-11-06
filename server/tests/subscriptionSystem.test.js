import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isStoreSubscriptionActive,
  getActiveStoreIds,
  filterProductsByActiveStores,
  filterActiveStores,
} from "../src/services/catalogVisibility.js";
import { checkProductUploadQuota } from "../src/services/quotaService.js";
import { calculateDiscount, defaultPlans } from "../src/data/mockData/subscriptionPlans.js";

describe("Subscription Pricing & Schema Calculation Tests", () => {
  it("calculates discount percentage accurately", () => {
    assert.equal(calculateDiscount(1800, 1200), 33);
    assert.equal(calculateDiscount(3600, 2400), 33);
    assert.equal(calculateDiscount(1000, 500), 50);
    assert.equal(calculateDiscount(0, 0), 0);
    assert.equal(calculateDiscount(500, 500), 0);
  });

  it("seeds default plans with valid limits and features", () => {
    assert.ok(defaultPlans.length >= 3);
    const standardPlan = defaultPlans.find((p) => p.planId === "yearly_standard");
    assert.ok(standardPlan);
    assert.equal(standardPlan.productMonthlyLimit, 50);
    assert.equal(standardPlan.discountedPrice, 1200);
  });
});

describe("Catalog Visibility & Subscription Gatekeeper Tests", () => {
  const futureDate = new Date(Date.now() + 100 * 86400000).toISOString();
  const pastDate = new Date(Date.now() - 10 * 86400000).toISOString();

  const activeStore = {
    _id: "s_active",
    storeName: "Active Boutique",
    isActive: true,
    subscription: {
      plan: "yearly_standard",
      status: "active",
      expiresAt: futureDate,
    },
  };

  const expiredStore = {
    _id: "s_expired",
    storeName: "Expired Farm",
    isActive: true,
    subscription: {
      plan: "yearly_standard",
      status: "expired",
      expiresAt: pastDate,
    },
  };

  const deactivatedStore = {
    _id: "s_deactivated",
    storeName: "Deactivated Store",
    isActive: false,
    subscription: {
      plan: "yearly_pro",
      status: "active",
      expiresAt: futureDate,
    },
  };

  it("identifies active stores correctly", () => {
    assert.equal(isStoreSubscriptionActive(activeStore), true);
  });

  it("identifies expired or inactive stores correctly", () => {
    assert.equal(isStoreSubscriptionActive(expiredStore), false);
    assert.equal(isStoreSubscriptionActive(deactivatedStore), false);
    assert.equal(isStoreSubscriptionActive(null), false);
  });

  it("filters out products belonging to expired stores without deleting data", () => {
    const products = [
      { _id: "p1", storeId: "s_active", productName: "Silk Kurti" },
      { _id: "p2", storeId: "s_expired", productName: "Expired Mangoes" },
      { _id: "p3", storeId: "s_active", productName: "Linen Shirt" },
    ];
    const stores = [activeStore, expiredStore];

    const visibleProducts = filterProductsByActiveStores(products, stores);
    assert.equal(visibleProducts.length, 2);
    assert.ok(visibleProducts.some((p) => p._id === "p1"));
    assert.ok(visibleProducts.some((p) => p._id === "p3"));
    assert.ok(!visibleProducts.some((p) => p._id === "p2"));
  });
});

describe("Upload Quota Engine Tests", () => {
  const futureDate = new Date(Date.now() + 100 * 86400000).toISOString();
  const pastDate = new Date(Date.now() - 10 * 86400000).toISOString();

  const activeStore = {
    _id: "s1",
    storeName: "Vastra",
    isActive: true,
    subscription: {
      status: "active",
      expiresAt: futureDate,
    },
    limits: {
      productMonthlyLimit: 50,
    },
  };

  const expiredStore = {
    _id: "s2",
    storeName: "Expired Store",
    isActive: true,
    subscription: {
      status: "expired",
      expiresAt: pastDate,
    },
    limits: {
      productMonthlyLimit: 50,
    },
  };

  it("allows product upload when within plan quota limit", () => {
    const result = checkProductUploadQuota(activeStore, 24);
    assert.equal(result.allowed, true);
    assert.equal(result.currentCount, 24);
    assert.equal(result.limit, 50);
    assert.equal(result.remaining, 26);
  });

  it("blocks product upload with QUOTA_EXCEEDED when quota is reached", () => {
    const result = checkProductUploadQuota(activeStore, 50);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "QUOTA_EXCEEDED");
    assert.ok(result.message.includes("plan limit of 50"));
  });

  it("blocks product upload with SUBSCRIPTION_INACTIVE when subscription is expired", () => {
    const result = checkProductUploadQuota(expiredStore, 5);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "SUBSCRIPTION_INACTIVE");
  });
});
