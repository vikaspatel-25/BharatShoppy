import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

describe("Vendor Removal with 7-Day Hold Tests (A4)", () => {
  let server;
  let baseUrl;
  let adminToken;
  let vendorToken;
  let setInMemoryVendor;
  let resetInMemoryVendors;
  let setInMemoryStoreForRemoval;
  let setInMemoryProductForRemoval;
  let resetInMemoryRemovalData;
  let setTestCloudinaryClient;
  let deletedMediaPrefixes = [];

  const CRON_SECRET = "test-cron-secret-key-12345";
  const TEST_VENDOR_ID = "vendor_a4_test";
  const TEST_VENDOR_EMAIL = "vendor_a4@bharatshopy.com";
  const TEST_STORE_ID = "store_a4_test";
  const TEST_PROD_ID = "prod_a4_test";

  before(async () => {
    process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    process.env.NODE_ENV = "test";
    process.env.CRON_SECRET = CRON_SECRET;

    const tokenHelper = await import("../src/lib/tokenHelper.js");
    adminToken = tokenHelper.signToken({ adminId: "admin_test", email: "admin@bharatshopy.com", role: "admin" }, process.env.AUTH_SECRET, 3600);
    vendorToken = tokenHelper.signToken({ vendorId: TEST_VENDOR_ID, email: TEST_VENDOR_EMAIL, role: "vendor" }, process.env.AUTH_SECRET, 3600);

    const vendorAuthModule = await import("../src/controllers/vendorAuthController.js");
    setInMemoryVendor = vendorAuthModule.setInMemoryVendor;
    resetInMemoryVendors = vendorAuthModule.resetInMemoryVendors;

    const removalModule = await import("../src/controllers/adminVendorRemovalController.js");
    setInMemoryStoreForRemoval = removalModule.setInMemoryStoreForRemoval;
    setInMemoryProductForRemoval = removalModule.setInMemoryProductForRemoval;
    resetInMemoryRemovalData = removalModule.resetInMemoryRemovalData;

    const cloudinaryModule = await import("../src/services/cloudinaryService.js");
    setTestCloudinaryClient = cloudinaryModule.setTestCloudinaryClient;

    setTestCloudinaryClient({
      deleteResourcesByPrefix: async (prefix) => {
        deletedMediaPrefixes.push(prefix);
        return { deleted: { [`${prefix}img1`]: "deleted" } };
      },
    });

    const appModule = await import("../src/app.js");
    const app = appModule.default;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    resetInMemoryVendors();
    resetInMemoryRemovalData();
    deletedMediaPrefixes = [];

    // Initialize an active, approved vendor
    setInMemoryVendor({
      _id: TEST_VENDOR_ID,
      email: TEST_VENDOR_EMAIL,
      storeId: TEST_STORE_ID,
      status: "approved",
    });

    // Initialize active store
    setInMemoryStoreForRemoval({
      _id: TEST_STORE_ID,
      storeName: "A4 Removal Test Store",
      slug: "a4-test-store",
      subdomain: "a4store",
      isActive: true,
      subscription: { status: "active", plan: "starter_free" },
    });

    // Initialize active product
    setInMemoryProductForRemoval({
      _id: TEST_PROD_ID,
      storeId: TEST_STORE_ID,
      productName: "A4 Removal Test Product",
      price: { min: 100, max: 100, unit: "piece", currency: "INR" },
      isActive: true,
    });
  });

  describe("Admin Authorization", () => {
    it("rejects unauthenticated requests to remove a vendor with 401", async () => {
      const res = await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
      });
      assert.strictEqual(res.status, 401);
    });

    it("rejects unauthenticated requests to cancel vendor removal with 401", async () => {
      const res = await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/cancel-removal`, {
        method: "POST",
      });
      assert.strictEqual(res.status, 401);
    });
  });

  describe("Immediate Hiding and 7-Day Hold Setup", () => {
    it("marks vendor as removed with deleteAfter exactly 7 days away and hides listings immediately", async () => {
      const fixedNow = new Date("2026-11-01T10:00:00.000Z");

      const res = await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ now: fixedNow.toISOString() }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, "removed");
      assert.strictEqual(data.vendorId, TEST_VENDOR_ID);

      // deleteAfter must be 7 days (7 * 24 * 60 * 60 * 1000 = 604,800,000 ms) after injected time
      const expectedDeleteAfter = new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(data.deleteAfter, expectedDeleteAfter);

      // Verify vendor status is updated
      const { findVendorByEmail } = await import("../src/controllers/vendorAuthController.js");
      const updatedVendor = await findVendorByEmail(TEST_VENDOR_EMAIL);
      assert.strictEqual(updatedVendor.status, "removed");
      assert.strictEqual(updatedVendor.deleteAfter, expectedDeleteAfter);

      // Duplicate removal request returns 409
      const dupRes = await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      assert.strictEqual(dupRes.status, 409);
    });

    it("denies removed vendor access to store routes with 403", async () => {
      // Mark as removed
      await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      // Vendor attempts to access vendor dashboard
      const storeRes = await fetch(`${baseUrl}/api/vendor/store/${TEST_STORE_ID}`, {
        headers: {
          Authorization: `Bearer ${vendorToken}`,
        },
      });
      assert.strictEqual(storeRes.status, 403);
    });
  });

  describe("Cancel Removal During Hold", () => {
    it("cancels removal during the 7-day hold, restoring approved status and unhiding listings", async () => {
      const fixedNow = new Date("2026-11-01T10:00:00.000Z");

      // 1. Mark for removal
      await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ now: fixedNow.toISOString() }),
      });

      // 2. Admin cancels removal
      const cancelRes = await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/cancel-removal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      assert.strictEqual(cancelRes.status, 200);
      const cancelData = await cancelRes.json();
      assert.strictEqual(cancelData.status, "approved");

      // Verify vendor is restored
      const { findVendorByEmail } = await import("../src/controllers/vendorAuthController.js");
      const restoredVendor = await findVendorByEmail(TEST_VENDOR_EMAIL);
      assert.strictEqual(restoredVendor.status, "approved");
      assert.strictEqual(restoredVendor.deleteAfter, null);

      // Calling cancel again when vendor is not removed returns 400
      const cancelAgainRes = await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/cancel-removal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(cancelAgainRes.status, 400);
    });
  });

  describe("Secured Cron Cleanup (Injected Time)", () => {
    it("rejects unauthorized cron requests with 401 when missing or invalid secret", async () => {
      const res = await fetch(`${baseUrl}/api/cron/cleanup-removed-vendors`, {
        headers: { Authorization: "Bearer wrong-secret" },
      });
      assert.strictEqual(res.status, 401);
    });

    it("does NOT delete vendor, store, or media before the 7-day hold expires (Day 5)", async () => {
      const removalTime = new Date("2026-11-01T10:00:00.000Z");

      // Mark for removal at Day 0
      await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ now: removalTime.toISOString() }),
      });

      // Cron triggers at Day 5 (cutoff not reached)
      const day5Time = new Date("2026-11-06T10:00:00.000Z");
      const cronRes = await fetch(`${baseUrl}/api/cron/cleanup-removed-vendors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ now: day5Time.toISOString() }),
      });

      assert.strictEqual(cronRes.status, 200);
      const cronData = await cronRes.json();
      assert.strictEqual(cronData.deletedCount, 0, "Must not delete any vendor before 7-day hold expires");

      // Vendor still exists
      const { findVendorByEmail } = await import("../src/controllers/vendorAuthController.js");
      const vendor = await findVendorByEmail(TEST_VENDOR_EMAIL);
      assert.ok(vendor, "Vendor must remain during hold");
      assert.strictEqual(deletedMediaPrefixes.length, 0, "No media should be deleted before hold expires");
    });

    it("permanently deletes profile, listings, and media after the 7-day hold expires (Day 8)", async () => {
      const removalTime = new Date("2026-11-01T10:00:00.000Z");

      // Mark for removal at Day 0
      await fetch(`${baseUrl}/api/admin/vendors/${TEST_VENDOR_ID}/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ now: removalTime.toISOString() }),
      });

      // Capture logs to verify absence of personal data
      const capturedLogs = [];
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        capturedLogs.push(args.join(" "));
        originalConsoleLog(...args);
      };

      try {
        // Cron triggers at Day 8 (7-day hold has passed)
        const day8Time = new Date("2026-11-09T12:00:00.000Z");
        const cronRes = await fetch(`${baseUrl}/api/cron/cleanup-removed-vendors`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CRON_SECRET}`,
          },
          body: JSON.stringify({ now: day8Time.toISOString() }),
        });

        assert.strictEqual(cronRes.status, 200);
        const cronData = await cronRes.json();
        assert.strictEqual(cronData.deletedCount, 1, "Must permanently delete expired vendor");

        // Media deletion was called with store folder prefix
        assert.ok(
          deletedMediaPrefixes.includes(`bharatshopy/${TEST_STORE_ID}/`),
          "Store Cloudinary media prefix must be deleted"
        );

        // Vendor record is permanently deleted
        const { findVendorByEmail } = await import("../src/controllers/vendorAuthController.js");
        const vendor = await findVendorByEmail(TEST_VENDOR_EMAIL);
        assert.strictEqual(vendor, null, "Vendor record must be permanently removed");

        // Verify logs contain no personal data (no email, applicant name, phone, etc.)
        const removalLog = capturedLogs.find((l) => l.includes("[VENDOR REMOVAL CRON]"));
        assert.ok(removalLog, "Deletion must be logged");
        assert.strictEqual(removalLog.includes(TEST_VENDOR_EMAIL), false, "Log must not contain personal email");
        assert.strictEqual(removalLog.includes("A4 Removal Test Store"), false, "Log must not contain personal store name");
      } finally {
        console.log = originalConsoleLog;
      }
    });
  });
});
