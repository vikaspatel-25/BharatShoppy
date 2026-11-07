import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  addVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
} from "../src/controllers/vendorCatalogController.js";
import { getStoreSubscriptionInfo } from "../src/controllers/subscriptionController.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

describe("Catalog Quota Behaviour Tests (M2)", () => {
  let mockStores = [];
  let mockProducts = [];

  const mockDb = {
    collection(name) {
      if (name === "stores") {
        return {
          findOne: async (query) => {
            return mockStores.find((s) => s._id === query._id) || null;
          },
        };
      }
      if (name === "products") {
        return {
          countDocuments: async (query) => {
            return mockProducts.filter((p) => {
              if (query.storeId && p.storeId !== query.storeId) return false;
              if (query.isActive && query.isActive.$ne !== undefined) {
                return p.isActive !== query.isActive.$ne;
              }
              if (query.isActive !== undefined) {
                return p.isActive === query.isActive;
              }
              return true;
            }).length;
          },
          findOne: async (query) => {
            return (
              mockProducts.find(
                (p) =>
                  p._id === query._id &&
                  (!query.storeId || p.storeId === query.storeId)
              ) || null
            );
          },
          insertOne: async (doc) => {
            mockProducts.push(doc);
            return { insertedId: doc._id };
          },
          updateOne: async (query, update) => {
            const prod = mockProducts.find(
              (p) =>
                p._id === query._id &&
                (!query.storeId || p.storeId === query.storeId)
            );
            if (prod && update.$set) {
              Object.assign(prod, update.$set);
              return { matchedCount: 1, modifiedCount: 1 };
            }
            return { matchedCount: 0, modifiedCount: 0 };
          },
        };
      }
      if (name === "subscription_requests") {
        return {
          find: () => ({ toArray: async () => [] }),
        };
      }
      throw new Error(`Unhandled collection ${name}`);
    },
  };

  before(() => {
    mongoose.connection.db = mockDb;
  });

  beforeEach(() => {
    // Store with strict productMonthlyLimit = 2
    mockStores = [
      {
        _id: "store_quota_01",
        storeName: "Quota Test Store",
        limits: {
          productMonthlyLimit: 2,
          maxImagesPerProduct: 5,
        },
        subscription: {
          status: "active",
          startDate: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        isActive: true,
      },
    ];

    mockProducts = [
      {
        _id: "prod_active_1",
        storeId: "store_quota_01",
        productName: "Active Item 1",
        price: { min: 100, max: 100, unit: "piece", currency: "INR" },
        images: ["https://res.cloudinary.com/test/image/upload/v1/bharatshopy/store_quota_01/p1.jpg"],
        imageAssets: [{ url: "https://res.cloudinary.com/test/image/upload/v1/bharatshopy/store_quota_01/p1.jpg", publicId: "bharatshopy/store_quota_01/p1" }],
        isActive: true,
      },
      {
        _id: "prod_active_2",
        storeId: "store_quota_01",
        productName: "Active Item 2",
        price: { min: 200, max: 200, unit: "piece", currency: "INR" },
        images: ["https://res.cloudinary.com/test/image/upload/v1/bharatshopy/store_quota_01/p2.jpg"],
        imageAssets: [{ url: "https://res.cloudinary.com/test/image/upload/v1/bharatshopy/store_quota_01/p2.jpg", publicId: "bharatshopy/store_quota_01/p2" }],
        isActive: true,
      },
    ];
  });

  it("blocks adding product when active items reach the limit", async () => {
    const req = {
      params: { storeId: "store_quota_01" },
      store: mockStores[0],
      body: {
        productName: "Item 3 Over Limit",
        price: 300,
      },
    };
    const res = createMockRes();
    await addVendorProduct(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /quota reached/i);
    assert.equal(res.body.currentCount, 2);
    assert.equal(res.body.limit, 2);
  });

  it("deactivate-then-add: allows adding after deactivating an item", async () => {
    // 1. Deactivate prod_active_1
    const delReq = {
      params: { storeId: "store_quota_01", productId: "prod_active_1" },
      store: mockStores[0],
    };
    const delRes = createMockRes();
    await deleteVendorProduct(delReq, delRes);
    assert.equal(delRes.statusCode, 200);

    // Verify prod_active_1 is now inactive
    const prod1 = mockProducts.find((p) => p._id === "prod_active_1");
    assert.equal(prod1.isActive, false);

    // 2. Now add item 3 (should succeed because active count is 1, below limit of 2)
    const addReq = {
      params: { storeId: "store_quota_01" },
      store: mockStores[0],
      body: {
        productName: "Item 3 After Deactivation",
        price: 350,
        images: ["https://res.cloudinary.com/test/image/upload/v1/bharatshopy/store_quota_01/p3.jpg"],
        imageAssets: [{ url: "https://res.cloudinary.com/test/image/upload/v1/bharatshopy/store_quota_01/p3.jpg", publicId: "bharatshopy/store_quota_01/p3" }],
      },
    };
    const addRes = createMockRes();
    await addVendorProduct(addReq, addRes);
    assert.equal(addRes.statusCode, 201);
    assert.equal(addRes.body.product.productName, "Item 3 After Deactivation");
  });

  it("reactivating at limit: blocks reactivation when active items are at quota limit", async () => {
    // Deactivate prod_active_1
    mockProducts[0].isActive = false;

    // Add a new active product to reach limit of 2 active items again
    mockProducts.push({
      _id: "prod_active_3",
      storeId: "store_quota_01",
      productName: "Active Item 3",
      price: { min: 300, max: 300, unit: "piece", currency: "INR" },
      isActive: true,
    });

    // Currently: 2 active items (prod_active_2, prod_active_3) and 1 inactive item (prod_active_1)
    // Attempting to reactivate prod_active_1 must be blocked with 403
    const reactivateReq = {
      params: { storeId: "store_quota_01", productId: "prod_active_1" },
      store: mockStores[0],
      body: { isActive: true },
    };
    const reactivateRes = createMockRes();
    await updateVendorProduct(reactivateReq, reactivateRes);

    assert.equal(reactivateRes.statusCode, 403);
    assert.match(reactivateRes.body.message, /quota reached/i);
    assert.equal(reactivateRes.body.currentCount, 2);
    assert.equal(reactivateRes.body.limit, 2);
  });

  it("usage numbers: getStoreSubscriptionInfo counts only active products", async () => {
    // Deactivate 1 item
    mockProducts[0].isActive = false;

    const req = {
      params: { storeId: "store_quota_01" },
      store: mockStores[0],
    };
    const res = createMockRes();
    await getStoreSubscriptionInfo(req, res);

    assert.equal(res.statusCode, 200);
    // Even though 2 total documents exist in products, active items count is 1
    assert.equal(res.body.usage.totalProducts, 1, "Must only count active products");
    assert.equal(res.body.usage.remaining, 1);
  });
});
