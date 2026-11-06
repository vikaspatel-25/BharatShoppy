import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getProductPage } from "../src/controllers/productPageController.js";
import { getStorePage } from "../src/controllers/storePageController.js";

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

describe("Direct Page Visibility Rules Tests (H5)", () => {
  let server;
  let baseUrl;
  let app;

  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
  const pastDate = new Date(Date.now() - 5 * 86400000).toISOString();

  let testStores = [];
  let testProducts = [];

  const mockDb = {
    collection(name) {
      if (name === "stores") {
        return {
          find: () => ({
            toArray: async () => testStores,
          }),
        };
      }
      if (name === "products") {
        return {
          find: () => ({
            toArray: async () => testProducts,
          }),
        };
      }
      throw new Error(`Unhandled mock collection: ${name}`);
    },
  };

  before(async () => {
    process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    process.env.NODE_ENV = "test";
    mongoose.connection.db = mockDb;

    const appModule = await import("../src/app.js");
    app = appModule.default;

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    testStores = [
      {
        _id: "store_active_01",
        storeName: "Active Electronics",
        slug: "active-electronics",
        subdomain: "active-electronics",
        isActive: true,
        subscription: {
          plan: "yearly_standard",
          status: "active",
          expiresAt: futureDate,
        },
        contact: { phone: "9876543210", whatsapp: "9876543210" },
      },
      {
        _id: "store_expired_01",
        storeName: "Expired Farm Hub",
        slug: "expired-farm",
        subdomain: "expired-farm",
        isActive: true,
        subscription: {
          plan: "yearly_standard",
          status: "expired",
          expiresAt: pastDate,
        },
        contact: { phone: "9876543211", whatsapp: "9876543211" },
      },
      {
        _id: "store_disabled_01",
        storeName: "Deactivated Store",
        slug: "disabled-store",
        subdomain: "disabled-store",
        isActive: false,
        subscription: {
          plan: "yearly_standard",
          status: "active",
          expiresAt: futureDate,
        },
      },
    ];

    testProducts = [
      {
        _id: "prod_active_in_active_store",
        storeId: "store_active_01",
        productName: "Smartphone Pro",
        price: { min: 20000, max: 22000, unit: "piece", currency: "INR" },
        isActive: true,
      },
      {
        _id: "prod_inactive_in_active_store",
        storeId: "store_active_01",
        productName: "Old Broken Phone",
        price: { min: 5000, max: 5000, unit: "piece", currency: "INR" },
        isActive: false,
      },
      {
        _id: "prod_active_in_expired_store",
        storeId: "store_expired_01",
        productName: "Fresh Organic Apples",
        price: { min: 120, max: 150, unit: "kg", currency: "INR" },
        isActive: true,
      },
      {
        _id: "prod_inactive_in_expired_store",
        storeId: "store_expired_01",
        productName: "Rotten Apples",
        price: { min: 50, max: 50, unit: "kg", currency: "INR" },
        isActive: false,
      },
    ];
  });

  describe("Product Direct Page (GET /api/products/:productId)", () => {
    it("returns 404 for an inactive product under an active store", async () => {
      const res = await fetch(`${baseUrl}/api/products/prod_inactive_in_active_store`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.message, "Product not found");
    });

    it("returns 404 for an active product belonging to an expired store", async () => {
      const res = await fetch(`${baseUrl}/api/products/prod_active_in_expired_store`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.message, "Product not found");
    });

    it("returns 404 for a non-existent product ID", async () => {
      const res = await fetch(`${baseUrl}/api/products/non_existent_id`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.message, "Product not found");
    });

    it("returns 200 with product and store details for an active product under an active store", async () => {
      const res = await fetch(`${baseUrl}/api/products/prod_active_in_active_store`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.product);
      assert.equal(data.product._id, "prod_active_in_active_store");
      assert.equal(data.product.productName, "Smartphone Pro");
      assert.equal(data.product.store._id, "store_active_01");
      assert.equal(data.product.store.storeName, "Active Electronics");
    });
  });

  describe("Store Direct Page (GET /api/store/:storeId)", () => {
    it("returns 404 for a disabled/deactivated store (isActive: false)", async () => {
      const res = await fetch(`${baseUrl}/api/store/store_disabled_01`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.message, "Store not found");
    });

    it("returns 404 for a non-existent store", async () => {
      const res = await fetch(`${baseUrl}/api/store/non_existent_store`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.message, "Store not found");
    });

    it("returns store details with empty products array when store subscription is expired", async () => {
      const res = await fetch(`${baseUrl}/api/store/store_expired_01`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.store);
      assert.equal(data.store._id, "store_expired_01");
      assert.equal(data.store.storeName, "Expired Farm Hub");
      assert.equal(data.store.isSubscriptionActive, false);
      assert.deepEqual(data.products, []);
      assert.equal(data.pagination.total, 0);
      assert.equal(data.pagination.hasMore, false);
    });

    it("returns store details and only active products when store subscription is active", async () => {
      const res = await fetch(`${baseUrl}/api/store/store_active_01`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.store);
      assert.equal(data.store._id, "store_active_01");
      assert.equal(data.store.isSubscriptionActive, true);

      // Active phone included, soft-deleted phone excluded
      assert.equal(data.products.length, 1);
      assert.equal(data.products[0]._id, "prod_active_in_active_store");
      assert.equal(data.pagination.total, 1);
    });
  });
});
