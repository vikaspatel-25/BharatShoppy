import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  updateVendorProduct,
  deleteVendorProduct,
} from "../src/controllers/vendorCatalogController.js";

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

describe("Product Write Scoping & Allowlist Tests (H1)", () => {
  let stores;
  let products;

  beforeEach(() => {
    // Seed test stores
    stores = [
      { _id: "store_A", storeName: "Store Alpha", slug: "store-alpha" },
      { _id: "store_B", storeName: "Store Beta", slug: "store-beta" },
    ];

    // Seed test products
    products = [
      {
        _id: "prod_A1",
        storeId: "store_A",
        productName: "Alpha Product 1",
        price: { min: 100, max: 120, unit: "piece", currency: "INR" },
        createdAt: "2026-01-01T00:00:00.000Z",
        isActive: true,
      },
      {
        _id: "prod_B1",
        storeId: "store_B",
        productName: "Beta Product 1",
        price: { min: 200, max: 250, unit: "piece", currency: "INR" },
        createdAt: "2026-01-01T00:00:00.000Z",
        isActive: true,
      },
    ];

    // Mock MongoDB collections on mongoose.connection.db
    const mockDb = {
      collection(name) {
        if (name === "stores") {
          return {
            findOne: async (query) => {
              if (query.$or) {
                return stores.find((s) =>
                  query.$or.some(
                    (cond) =>
                      (cond._id && s._id === cond._id) ||
                      (cond.slug && s.slug === cond.slug) ||
                      (cond.subdomain && s.subdomain === cond.subdomain)
                  )
                ) || null;
              }
              return stores.find((s) => s._id === query._id) || null;
            },
          };
        }

        if (name === "products") {
          return {
            findOne: async (query) => {
              return products.find((p) => {
                let match = true;
                if (query._id && p._id !== query._id) match = false;
                if (query.storeId && p.storeId !== query.storeId) match = false;
                return match;
              }) || null;
            },
            updateOne: async (query, update) => {
              const prod = products.find((p) => {
                let match = true;
                if (query._id && p._id !== query._id) match = false;
                if (query.storeId && p.storeId !== query.storeId) match = false;
                return match;
              });
              if (!prod) return { matchedCount: 0, modifiedCount: 0 };
              if (update.$set) {
                Object.assign(prod, update.$set);
              }
              return { matchedCount: 1, modifiedCount: 1 };
            },
          };
        }
        return null;
      },
    };

    mongoose.connection.db = mockDb;
  });

  describe("Cross-store product tampering prevention", () => {
    it("returns 404 when Store A attempts to update Store B's product", async () => {
      const req = {
        params: { storeId: "store_A", productId: "prod_B1" },
        body: { productName: "Hacked by Store A" },
      };
      const res = createMockRes();

      await updateVendorProduct(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.message, "Product not found");

      // Verify product was not altered
      const betaProd = products.find((p) => p._id === "prod_B1");
      assert.equal(betaProd.productName, "Beta Product 1");
    });

    it("returns 404 when Store A attempts to delete Store B's product", async () => {
      const req = {
        params: { storeId: "store_A", productId: "prod_B1" },
      };
      const res = createMockRes();

      await deleteVendorProduct(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.message, "Product not found");

      // Verify product remains active
      const betaProd = products.find((p) => p._id === "prod_B1");
      assert.equal(betaProd.isActive, true);
    });

    it("successfully allows Store A to update its own product", async () => {
      const req = {
        params: { storeId: "store_A", productId: "prod_A1" },
        body: { productName: "Alpha Product Updated" },
      };
      const res = createMockRes();

      await updateVendorProduct(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.product.productName, "Alpha Product Updated");
    });

    it("successfully allows Store A to delete (soft-delete) its own product", async () => {
      const req = {
        params: { storeId: "store_A", productId: "prod_A1" },
      };
      const res = createMockRes();

      await deleteVendorProduct(req, res);

      assert.equal(res.statusCode, 200);
      const alphaProd = products.find((p) => p._id === "prod_A1");
      assert.equal(alphaProd.isActive, false);
    });
  });

  describe("Allowlist enforcement & field tampering prevention", () => {
    it("ignores storeId, _id, and createdAt passed in the update body", async () => {
      const req = {
        params: { storeId: "store_A", productId: "prod_A1" },
        body: {
          productName: "Alpha Product Legitimate Name Change",
          _id: "malicious_new_id",
          storeId: "store_B", // Attempt to move product to another store
          createdAt: "1999-01-01T00:00:00.000Z", // Attempt to overwrite createdAt
          arbitraryField: "should_not_exist",
        },
      };
      const res = createMockRes();

      await updateVendorProduct(req, res);

      assert.equal(res.statusCode, 200);

      const updated = products.find((p) => p._id === "prod_A1");
      assert.ok(updated, "Product ID must not change");
      assert.equal(updated._id, "prod_A1");
      assert.equal(updated.storeId, "store_A", "storeId must remain unchanged");
      assert.equal(updated.createdAt, "2026-01-01T00:00:00.000Z", "createdAt must remain unchanged");
      assert.equal(updated.productName, "Alpha Product Legitimate Name Change");
      assert.equal(updated.arbitraryField, undefined, "Non-allowlisted fields must not be persisted");
    });

    it("successfully updates brand and subCategory when provided in update body", async () => {
      const req = {
        params: { storeId: "store_A", productId: "prod_A1" },
        body: {
          brand: "Heritage Handloom",
          subCategory: "Casual Kurtas",
        },
      };
      const res = createMockRes();

      await updateVendorProduct(req, res);

      assert.equal(res.statusCode, 200);
      const updated = products.find((p) => p._id === "prod_A1");
      assert.equal(updated.brand, "Heritage Handloom");
      assert.equal(updated.subCategory, "Casual Kurtas");
    });

    it("returns 404 if the storeId parameter is invalid or unknown", async () => {
      const req = {
        params: { storeId: "nonexistent_store", productId: "prod_A1" },
        body: { productName: "New Name" },
      };
      const res = createMockRes();

      await updateVendorProduct(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.message, "Store not found");
    });
  });
});
