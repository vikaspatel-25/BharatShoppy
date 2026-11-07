import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  updateVendorProfile,
  addVendorProduct,
  updateVendorProduct,
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

describe("Write Input Validation Tests (M1)", () => {
  let mockStores = [];
  let mockProducts = [];

  const mockDb = {
    collection(name) {
      if (name === "stores") {
        return {
          findOne: async (query) => {
            return mockStores.find((s) => s._id === query._id) || null;
          },
          updateOne: async (query, update) => {
            const store = mockStores.find((s) => s._id === query._id);
            if (store && update.$set) {
              Object.assign(store, update.$set);
              return { matchedCount: 1, modifiedCount: 1 };
            }
            return { matchedCount: 0, modifiedCount: 0 };
          },
        };
      }
      if (name === "products") {
        return {
          countDocuments: async () => mockProducts.length,
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
      throw new Error(`Unhandled collection ${name}`);
    },
  };

  before(() => {
    mongoose.connection.db = mockDb;
  });

  beforeEach(() => {
    mockStores = [
      {
        _id: "store_m1_test",
        storeName: "Original Store Name",
        entityType: "shopkeeper",
        contact: {
          phone: "+919876543210",
          whatsapp: "+919876543210",
          email: "vendor@test.com",
        },
        limits: {
          maxImagesPerProduct: 5,
          productMonthlyLimit: 20,
        },
        subscription: { status: "active" },
        isActive: true,
      },
    ];

    mockProducts = [
      {
        _id: "prod_m1_01",
        storeId: "store_m1_test",
        productName: "Valid Test Item",
        price: { min: 500, max: 600, unit: "piece", currency: "INR" },
        images: ["https://res.cloudinary.com/test-cloud/image/upload/v1/bharatshopy/store_m1_test/img1.jpg"],
        imageAssets: [{ url: "https://res.cloudinary.com/test-cloud/image/upload/v1/bharatshopy/store_m1_test/img1.jpg", publicId: "bharatshopy/store_m1_test/img1" }],
        isActive: true,
      },
    ];
  });

  describe("updateVendorProfile Validation", () => {
    it("rejects non-string storeName with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { storeName: 12345 },
      };
      const res = createMockRes();
      await updateVendorProfile(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Store name must be a non-empty string/i);
    });

    it("rejects empty storeName with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { storeName: "   " },
      };
      const res = createMockRes();
      await updateVendorProfile(req, res);
      assert.equal(res.statusCode, 400);
    });

    it("rejects disallowed entityType with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { entityType: "unauthorized_entity" },
      };
      const res = createMockRes();
      await updateVendorProfile(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Invalid entityType/i);
    });

    it("allows valid entityTypes (shopkeeper, farmer, service_provider)", async () => {
      for (const entity of ["shopkeeper", "farmer", "service_provider"]) {
        const req = {
          params: { storeId: "store_m1_test" },
          store: mockStores[0],
          body: { entityType: entity },
        };
        const res = createMockRes();
        await updateVendorProfile(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.store.entityType, entity);
      }
    });

    it("rejects invalid WhatsApp phone format with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { contact: { whatsapp: "not-a-number" } },
      };
      const res = createMockRes();
      await updateVendorProfile(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /WhatsApp number format/i);
    });

    it("rejects non-string WhatsApp phone with 400 without crashing", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { contact: { whatsapp: { nested: true } } },
      };
      const res = createMockRes();
      await updateVendorProfile(req, res);
      assert.equal(res.statusCode, 400);
    });

    it("accepts valid contact phone formats", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { contact: { phone: "+919876543210", whatsapp: "+919876543210" } },
      };
      const res = createMockRes();
      await updateVendorProfile(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.store.contact.phone, "+919876543210");
    });
  });

  describe("addVendorProduct Validation", () => {
    it("rejects missing or empty productName with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { productName: "   ", price: 100 },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Product name is required/i);
    });

    it("rejects price <= 0 with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { productName: "Zero Price Product", price: 0 },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /greater than 0/i);

      const reqNeg = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { productName: "Negative Price Product", price: -50 },
      };
      const resNeg = createMockRes();
      await addVendorProduct(reqNeg, resNeg);
      assert.equal(resNeg.statusCode, 400);
    });

    it("rejects price max < min with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: {
          productName: "Inverted Price Product",
          price: { min: 500, max: 400 },
        },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Maximum price must be at or above minimum/i);
    });

    it("rejects non-numeric price with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: { productName: "Bad Price Product", price: "free" },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /valid number/i);
    });

    it("rejects non-string brand/description fields with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: {
          productName: "Valid Name",
          price: 150,
          brand: 12345,
        },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Brand must be a string/i);
    });

    it("accepts valid product with numeric price and returns 201", async () => {
      const req = {
        params: { storeId: "store_m1_test" },
        store: mockStores[0],
        body: {
          productName: "Organic Wheat Flour",
          price: 250,
          mrp: 300,
          unit: "kg",
          brand: "Farm Fresh",
          category: "Groceries & Organics",
          shortDescription: "100% stone-ground whole wheat",
        },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.product.price.min, 250);
      assert.equal(res.body.product.price.max, 300);
      assert.equal(res.body.product.price.unit, "kg");
    });
  });

  describe("updateVendorProduct Validation", () => {
    it("rejects price <= 0 on update with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test", productId: "prod_m1_01" },
        store: mockStores[0],
        body: { price: -100 },
      };
      const res = createMockRes();
      await updateVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /greater than 0/i);
    });

    it("rejects price max < min on update with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test", productId: "prod_m1_01" },
        store: mockStores[0],
        body: { price: { min: 1000, max: 800 } },
      };
      const res = createMockRes();
      await updateVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Maximum price must be at or above minimum/i);
    });

    it("rejects non-string productName on update with 400", async () => {
      const req = {
        params: { storeId: "store_m1_test", productId: "prod_m1_01" },
        store: mockStores[0],
        body: { productName: { name: "invalid" } },
      };
      const res = createMockRes();
      await updateVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Product name must be a non-empty string/i);
    });

    it("successfully updates valid fields", async () => {
      const req = {
        params: { storeId: "store_m1_test", productId: "prod_m1_01" },
        store: mockStores[0],
        body: {
          productName: "Updated Name",
          price: { min: 750, max: 900 },
        },
      };
      const res = createMockRes();
      await updateVendorProduct(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.product.productName, "Updated Name");
      assert.equal(res.body.product.price.min, 750);
      assert.equal(res.body.product.price.max, 900);
    });
  });
});
