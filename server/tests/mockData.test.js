import { describe, it } from "node:test";
import assert from "node:assert/strict";
import stores from "../src/data/mockData/stores.js";
import products from "../src/data/mockData/products.js";
import locations from "../src/data/mockData/locations.js";

describe("Mock Datasets Schema & Integrity Tests", () => {
  describe("Locations Mock Data", () => {
    it("has a valid non-empty array of locations", () => {
      assert.ok(Array.isArray(locations));
      assert.ok(locations.length > 0);
    });

    it("ensures every location has required fields", () => {
      locations.forEach((loc, index) => {
        assert.ok(loc.id, `Location at index ${index} missing id`);
        assert.ok(loc.city, `Location at index ${index} missing city`);
        assert.ok(loc.state, `Location at index ${index} missing state`);
        assert.ok(loc.displayName, `Location at index ${index} missing displayName`);
      });
    });
  });

  describe("Stores Mock Data", () => {
    it("has a valid non-empty array of stores", () => {
      assert.ok(Array.isArray(stores));
      assert.ok(stores.length > 0);
    });

    it("ensures all stores have _id, storeName, city, and active flag", () => {
      stores.forEach((store) => {
        assert.ok(store._id, `Store missing _id: ${JSON.stringify(store)}`);
        assert.ok(store.storeName, `Store ${store._id} missing storeName`);
        assert.ok(store.city, `Store ${store._id} missing city`);
        assert.equal(typeof store.isActive, "boolean", `Store ${store._id} isActive must be boolean`);
      });
    });
  });

  describe("Products Mock Data", () => {
    it("has a valid non-empty array of products", () => {
      assert.ok(Array.isArray(products));
      assert.ok(products.length > 0);
    });

    it("ensures every product has _id, storeId, productName, and valid price", () => {
      products.forEach((product) => {
        assert.ok(product._id, `Product missing _id`);
        assert.ok(product.storeId, `Product ${product._id} missing storeId`);
        assert.ok(product.productName, `Product ${product._id} missing productName`);
        assert.ok(product.price, `Product ${product._id} missing price object`);
        assert.equal(typeof product.price.min, "number", `Product ${product._id} price.min must be a number`);
      });
    });

    it("ensures all products reference existing store IDs", () => {
      const storeIdSet = new Set(stores.map((s) => s._id));
      const orphanProducts = products.filter((p) => !storeIdSet.has(p.storeId));

      assert.equal(
        orphanProducts.length,
        0,
        `Found products with non-existent storeId: ${orphanProducts.map((p) => p._id).join(", ")}`
      );
    });
  });
});
