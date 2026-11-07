import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Query Optimization and Needed Data (M3)", () => {
  it("verifies createIndexes.js defines indexes for products.storeId, stores.slug, and stores.subdomain", () => {
    const scriptPath = path.resolve(__dirname, "../scripts/createIndexes.js");
    const content = fs.readFileSync(scriptPath, "utf8");

    assert.ok(content.includes("stores.createIndex({ slug: 1 }"), "Must index stores.slug");
    assert.ok(content.includes("stores.createIndex({ subdomain: 1 }"), "Must index stores.subdomain");
    assert.ok(content.includes("products.createIndex({ storeId: 1 }"), "Must index products.storeId");
  });

  it("verifies controllers use MongoDB filters, counts, and projections instead of full collection scans", () => {
    const productController = fs.readFileSync(
      path.resolve(__dirname, "../src/controllers/productController.js"),
      "utf8"
    );
    const storePageController = fs.readFileSync(
      path.resolve(__dirname, "../src/controllers/storePageController.js"),
      "utf8"
    );
    const tenantController = fs.readFileSync(
      path.resolve(__dirname, "../src/controllers/tenantController.js"),
      "utf8"
    );

    // Should not find({}).toArray() without filters
    assert.strictEqual(
      productController.includes('products.find({}).toArray()'),
      false,
      "productController must not scan full products collection"
    );
    assert.strictEqual(
      storePageController.includes('productsCollection.find({}).toArray()'),
      false,
      "storePageController must not scan full products collection"
    );
    assert.strictEqual(
      tenantController.includes('storesCollection.find({}).toArray()'),
      false,
      "tenantController must not scan full stores collection"
    );

    // Must use countDocuments and projections
    assert.ok(productController.includes("countDocuments"), "productController must use countDocuments");
    assert.ok(productController.includes("projection:"), "productController must project store fields");
    assert.ok(storePageController.includes("countDocuments"), "storePageController must use countDocuments");
    assert.ok(storePageController.includes("skip("), "storePageController must use skip");
    assert.ok(storePageController.includes("limit("), "storePageController must use limit");
  });

  it("verifies case-insensitive store lookup in resolveTenant and storePageController", () => {
    const storePageController = fs.readFileSync(
      path.resolve(__dirname, "../src/controllers/storePageController.js"),
      "utf8"
    );
    const tenantController = fs.readFileSync(
      path.resolve(__dirname, "../src/controllers/tenantController.js"),
      "utf8"
    );

    assert.ok(
      storePageController.includes("$regex"),
      "storePageController must use case-insensitive regex for slug/subdomain"
    );
    assert.ok(
      tenantController.includes("$regex"),
      "tenantController must use case-insensitive regex for slug/subdomain"
    );
  });
});
