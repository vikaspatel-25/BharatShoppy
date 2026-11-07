import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  setTestCloudinaryClient,
  resetTestCloudinaryClient,
  verifyUploadedMediaSizes,
} from "../src/services/cloudinaryService.js";
import {
  removeVendor,
  cancelVendorRemoval,
  executePermanentDeletion,
  setInMemoryStoreForRemoval,
  setInMemoryProductForRemoval,
  resetInMemoryRemovalData,
} from "../src/controllers/adminVendorRemovalController.js";
import {
  setInMemoryVendor,
  resetInMemoryVendors,
  getInMemoryVendors,
} from "../src/controllers/vendorAuthController.js";
import {
  addVendorProduct,
} from "../src/controllers/vendorCatalogController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe("Batch 3 & 4 Review Fixes Unit Tests (R3)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;

  after(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    resetTestCloudinaryClient();
  });

  describe("Item 2: Fail-Closed Upload Size Check in Production", () => {
    beforeEach(() => {
      resetTestCloudinaryClient();
      process.env.CLOUDINARY_CLOUD_NAME = "bharatshopy-test";
    });

    it("rejects save in production when Cloudinary resource API throws an error", async () => {
      process.env.NODE_ENV = "production";
      setTestCloudinaryClient({
        resource: async () => {
          throw new Error("Cloudinary connection timeout");
        },
      });

      const check = await verifyUploadedMediaSizes([
        { publicId: "bharatshopy/store_1/img1", url: "https://res.cloudinary.com/test/image1.jpg" },
      ]);

      assert.strictEqual(check.valid, false);
      assert.match(check.message, /Unable to verify upload size/i);
    });

    it("rejects save in production when resource size metadata (bytes) is missing", async () => {
      process.env.NODE_ENV = "production";
      setTestCloudinaryClient({
        resource: async () => ({ format: "jpg" }), // missing bytes
      });

      const check = await verifyUploadedMediaSizes([
        { publicId: "bharatshopy/store_1/img1", url: "https://res.cloudinary.com/test/image1.jpg" },
      ]);

      assert.strictEqual(check.valid, false);
      assert.match(check.message, /missing size metadata/i);
    });

    it("rejects save in production when Cloudinary credentials are not configured", async () => {
      process.env.NODE_ENV = "production";
      resetTestCloudinaryClient();
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const check = await verifyUploadedMediaSizes([
        { publicId: "bharatshopy/store_1/img1", url: "https://res.cloudinary.com/test/image1.jpg" },
      ]);

      assert.strictEqual(check.valid, false);
      assert.match(check.message, /Cloudinary is not configured/i);
    });

    it("addVendorProduct controller rejects save with 400 in production on failed size check", async () => {
      process.env.NODE_ENV = "production";
      setTestCloudinaryClient({
        resource: async () => {
          throw new Error("Network unreachable");
        },
      });

      const req = {
        params: { storeId: "store_r3" },
        store: {
          _id: "store_r3",
          storeName: "R3 Test Store",
          limits: { maxImagesPerProduct: 5 },
          subscription: { status: "active", plan: "starter_free" },
        },
        body: {
          productName: "Test Product R3",
          price: 150,
          images: ["https://res.cloudinary.com/bharatshopy-test/bharatshopy/store_r3/img1.jpg"],
          imageAssets: [
            {
              publicId: "bharatshopy/store_r3/img1",
              url: "https://res.cloudinary.com/bharatshopy-test/bharatshopy/store_r3/img1.jpg",
            },
          ],
        },
      };

      const res = createMockRes();
      await addVendorProduct(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.message, /Unable to verify upload size/i);
    });

    it("accepts save when size check confirms image is <= 5 MB", async () => {
      process.env.NODE_ENV = "production";
      setTestCloudinaryClient({
        resource: async () => ({ bytes: 1024 * 1024 }), // 1 MB
      });

      const check = await verifyUploadedMediaSizes([
        { publicId: "bharatshopy/store_1/img1", url: "https://res.cloudinary.com/test/image1.jpg" },
      ]);

      assert.strictEqual(check.valid, true);
    });
  });

  describe("Item 3: Remove & Cancel Preserves Previously Deleted Items & Store State", () => {
    const VENDOR_ID = "vendor_r3_test";
    const VENDOR_EMAIL = "vendor_r3@bharatshopy.com";
    const STORE_ID = "store_r3_test";
    const PROD_ACTIVE_ID = "prod_active_r3";
    const PROD_DELETED_ID = "prod_deleted_r3";

    beforeEach(() => {
      process.env.NODE_ENV = "test";
      resetInMemoryVendors();
      resetInMemoryRemovalData();

      // Vendor
      setInMemoryVendor({
        _id: VENDOR_ID,
        email: VENDOR_EMAIL,
        storeId: STORE_ID,
        status: "approved",
      });

      // Active store
      setInMemoryStoreForRemoval({
        _id: STORE_ID,
        storeName: "R3 Store",
        isActive: true,
      });

      // Product 1: Active
      setInMemoryProductForRemoval({
        _id: PROD_ACTIVE_ID,
        storeId: STORE_ID,
        productName: "Active Produce",
        isActive: true,
      });

      // Product 2: Previously soft-deleted by vendor
      setInMemoryProductForRemoval({
        _id: PROD_DELETED_ID,
        storeId: STORE_ID,
        productName: "Previously Soft-Deleted Produce",
        isActive: false,
      });
    });

    it("removing and then cancelling keeps previously deleted items inactive and restores store state", async () => {
      const fixedNow = new Date("2026-11-01T12:00:00Z").toISOString();

      // 1. Mark vendor for removal
      const reqRemove = {
        params: { vendorId: VENDOR_ID },
        body: { now: fixedNow },
      };
      const resRemove = createMockRes();
      await removeVendor(reqRemove, resRemove);
      assert.strictEqual(resRemove.statusCode, 200);

      const storeAfterRemove = (await import("../src/controllers/adminVendorRemovalController.js")).getInMemoryStoreForRemoval(STORE_ID);
      assert.strictEqual(storeAfterRemove.isActive, false, "Store must be hidden during hold");
      assert.strictEqual(storeAfterRemove.previousIsActive, true, "Store must record previous isActive: true");

      // Verify Product 1 was hidden by removal, while Product 2 was NOT marked hiddenByVendorRemoval
      const removalModule = await import("../src/controllers/adminVendorRemovalController.js");
      const prod1DuringHold = removalModule.getInMemoryProductForRemoval(PROD_ACTIVE_ID);
      const prod2DuringHold = removalModule.getInMemoryProductForRemoval(PROD_DELETED_ID);
      assert.strictEqual(prod1DuringHold.isActive, false, "Active product must be hidden");
      assert.strictEqual(prod1DuringHold.hiddenByVendorRemoval, true, "Active product must be marked hiddenByVendorRemoval");
      assert.strictEqual(prod2DuringHold.isActive, false, "Previously deleted product must remain inactive");
      assert.strictEqual(prod2DuringHold.hiddenByVendorRemoval, undefined, "Previously deleted product must NOT be marked hiddenByVendorRemoval");

      // 2. Cancel removal
      const reqCancel = {
        params: { vendorId: VENDOR_ID },
      };
      const resCancel = createMockRes();
      await cancelVendorRemoval(reqCancel, resCancel);
      assert.strictEqual(resCancel.statusCode, 200);

      // Verify Product 1 is restored, Product 2 remains soft-deleted
      const prod1AfterCancel = removalModule.getInMemoryProductForRemoval(PROD_ACTIVE_ID);
      const prod2AfterCancel = removalModule.getInMemoryProductForRemoval(PROD_DELETED_ID);
      assert.strictEqual(prod1AfterCancel.isActive, true, "Product 1 must be restored to active");
      assert.strictEqual(prod1AfterCancel.hiddenByVendorRemoval, false);
      assert.strictEqual(prod2AfterCancel.isActive, false, "Product 2 must stay soft-deleted and NOT be brought back");

      // Verify store state restored to true
      const storeAfterCancel = removalModule.getInMemoryStoreForRemoval(STORE_ID);
      assert.strictEqual(storeAfterCancel.isActive, true, "Store must be restored to previous isActive (true)");
      assert.strictEqual(storeAfterCancel.previousIsActive, undefined, "previousIsActive must be cleared");

      // Verify vendor restored
      const vendors = getInMemoryVendors();
      const restoredVendor = vendors.find((v) => v._id === VENDOR_ID);
      assert.strictEqual(restoredVendor.status, "approved");
    });

    it("restores previously inactive store to inactive on cancel removal", async () => {
      // Store was already inactive before removal
      setInMemoryStoreForRemoval({
        _id: STORE_ID,
        storeName: "R3 Inactive Store",
        isActive: false,
      });

      const fixedNow = new Date("2026-11-01T12:00:00Z").toISOString();
      const resRemove = createMockRes();
      await removeVendor({ params: { vendorId: VENDOR_ID }, body: { now: fixedNow } }, resRemove);
      assert.strictEqual(resRemove.statusCode, 200);

      const removalModule = await import("../src/controllers/adminVendorRemovalController.js");
      const storeAfterRemove = removalModule.getInMemoryStoreForRemoval(STORE_ID);
      assert.strictEqual(storeAfterRemove.previousIsActive, false);

      const resCancel = createMockRes();
      await cancelVendorRemoval({ params: { vendorId: VENDOR_ID } }, resCancel);
      assert.strictEqual(resCancel.statusCode, 200);

      const storeAfterCancel = removalModule.getInMemoryStoreForRemoval(STORE_ID);
      assert.strictEqual(storeAfterCancel.isActive, false, "Store that was inactive prior to removal must stay inactive on cancel");
    });
  });

  describe("Item 4: Failed Media Deletion Keeps Vendor Records for Retry", () => {
    const VENDOR_ID = "vendor_failed_media";
    const VENDOR_EMAIL = "vendor_failed_media@bharatshopy.com";
    const STORE_ID = "store_failed_media";

    beforeEach(() => {
      process.env.NODE_ENV = "test";
      resetInMemoryVendors();
      resetInMemoryRemovalData();
      resetTestCloudinaryClient();

      setInMemoryVendor({
        _id: VENDOR_ID,
        email: VENDOR_EMAIL,
        storeId: STORE_ID,
        status: "removed",
        deleteAfter: "2026-11-01T00:00:00.000Z", // Expired hold
      });

      setInMemoryStoreForRemoval({
        _id: STORE_ID,
        storeName: "Failed Media Store",
        isActive: false,
      });

      setInMemoryProductForRemoval({
        _id: "prod_failed_media",
        storeId: STORE_ID,
        productName: "Failed Media Product",
        isActive: false,
      });
    });

    it("keeps vendor, store, and product records when media deletion fails", async () => {
      // Simulate Cloudinary failure on folder deletion
      setTestCloudinaryClient({
        deleteResourcesByPrefix: async () => {
          throw new Error("Cloudinary media service 503 unavailable");
        },
      });

      const result = await executePermanentDeletion("2026-11-08T00:00:00.000Z");

      assert.strictEqual(result.deletedCount, 0, "No records should be permanently deleted if media deletion failed");

      // Verify vendor still exists
      const vendors = getInMemoryVendors();
      const vendor = vendors.find((v) => v._id === VENDOR_ID);
      assert.ok(vendor, "Vendor record must be kept for retry");
      assert.strictEqual(vendor.status, "removed");

      // Verify store still exists
      const removalModule = await import("../src/controllers/adminVendorRemovalController.js");
      const store = removalModule.getInMemoryStoreForRemoval(STORE_ID);
      assert.ok(store, "Store record must be kept for retry");
    });

    it("keeps vendor and store records when media deletion returns null / no result", async () => {
      setTestCloudinaryClient({
        deleteResourcesByPrefix: async () => null,
      });

      const result = await executePermanentDeletion("2026-11-08T00:00:00.000Z");

      assert.strictEqual(result.deletedCount, 0);
      const vendors = getInMemoryVendors();
      assert.ok(vendors.find((v) => v._id === VENDOR_ID), "Vendor must be kept for retry when media returns no result");
    });
  });

  describe("Item 5: server/vercel.json Cron Configuration", () => {
    it("is valid JSON and configures the cleanup-removed-vendors daily cron", () => {
      const vercelJsonPath = path.resolve(__dirname, "../vercel.json");
      const raw = fs.readFileSync(vercelJsonPath, "utf8");
      const parsed = JSON.parse(raw);

      assert.ok(Array.isArray(parsed.crons), "vercel.json must have a 'crons' array");
      const cronEntry = parsed.crons.find(
        (c) => c.path === "/api/cron/cleanup-removed-vendors"
      );
      assert.ok(cronEntry, "vercel.json must configure /api/cron/cleanup-removed-vendors");
      assert.strictEqual(cronEntry.schedule, "0 0 * * *", "Cron schedule must be daily (0 0 * * *)");
    });
  });
});
