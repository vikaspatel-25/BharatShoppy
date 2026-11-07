import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

describe("Final Review Fixes Unit & Integration Tests (R4)", () => {
  let server;
  let baseUrl;
  let adminToken;
  let app;
  let setInMemoryStoreForRemoval;
  let resetInMemoryRemovalData;
  let setInMemorySubscriptionRequest;
  let resetInMemorySubscriptionRequests;
  let getInMemorySubscriptionRequests;
  let setInMemoryApplication;
  let resetInMemoryApplications;
  let approveApplication;
  let setInMemoryVendor;
  let resetInMemoryVendors;

  before(async () => {
    process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    process.env.NODE_ENV = "test";

    const removalModule = await import("../src/controllers/adminVendorRemovalController.js");
    setInMemoryStoreForRemoval = removalModule.setInMemoryStoreForRemoval;
    resetInMemoryRemovalData = removalModule.resetInMemoryRemovalData;

    const subModule = await import("../src/controllers/subscriptionController.js");
    setInMemorySubscriptionRequest = subModule.setInMemorySubscriptionRequest;
    resetInMemorySubscriptionRequests = subModule.resetInMemorySubscriptionRequests;
    getInMemorySubscriptionRequests = subModule.getInMemorySubscriptionRequests;

    const appCtrlModule = await import("../src/controllers/vendorApplicationController.js");
    setInMemoryApplication = appCtrlModule.setInMemoryApplication;
    resetInMemoryApplications = appCtrlModule.resetInMemoryApplications;
    approveApplication = appCtrlModule.approveApplication;

    const vendorModule = await import("../src/controllers/vendorAuthController.js");
    setInMemoryVendor = vendorModule.setInMemoryVendor;
    resetInMemoryVendors = vendorModule.resetInMemoryVendors;

    const tokenModule = await import("../src/lib/tokenHelper.js");
    adminToken = tokenModule.signToken({ role: "admin", email: "admin@bharatshopy.com" });

    const appModule = await import("../src/app.js");
    app = appModule.default;

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
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
    resetInMemoryRemovalData();
    resetInMemorySubscriptionRequests();
    resetInMemoryApplications();
    resetInMemoryVendors();
  });

  describe("Item 1: Subscription Approval & Direct Renew for Stores Pending Removal", () => {
    it("returns 409 when approving subscription request for a store pending removal, leaving request pending and store hidden", async () => {
      const storeId = "store_pending_removal_01";
      const removedStore = {
        _id: storeId,
        storeName: "Removed Merchant Store",
        slug: "removed-merchant-store",
        isActive: false,
        removalStatus: "pending_deletion",
        deleteAfter: new Date(Date.now() + 7 * 86400000).toISOString(),
        subscription: {
          plan: "starter_free",
          status: "expired",
          expiresAt: new Date(Date.now() - 86400000).toISOString(),
        },
      };
      setInMemoryStoreForRemoval(removedStore);

      const requestId = "sub_req_removed_01";
      setInMemorySubscriptionRequest({
        _id: requestId,
        storeId,
        storeName: "Removed Merchant Store",
        selectedPlan: "yearly_standard",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      const res = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          action: "approve",
          durationDays: 30,
        }),
      });

      assert.equal(res.status, 409, "Approving subscription for store pending removal must return 409");
      const body = await res.json();
      assert.match(body.message, /pending removal/i);

      // Verify request remains pending
      const requests = getInMemorySubscriptionRequests();
      const currentReq = requests.find((r) => r._id === requestId);
      assert.equal(currentReq?.status, "pending", "Request must remain pending");

      // Verify store remains hidden and pending deletion
      assert.equal(removedStore.isActive, false, "Store must remain inactive");
      assert.equal(removedStore.removalStatus, "pending_deletion", "Store removalStatus must remain pending_deletion");
    });

    it("returns 409 when adminDirectRenew is called for a store pending removal, leaving store hidden", async () => {
      const storeId = "store_pending_removal_02";
      const removedStore = {
        _id: storeId,
        storeName: "Direct Renew Removed Store",
        slug: "direct-renew-removed",
        isActive: false,
        removalStatus: "pending_deletion",
        deleteAfter: new Date(Date.now() + 7 * 86400000).toISOString(),
        subscription: {
          plan: "starter_free",
          status: "expired",
          expiresAt: new Date(Date.now() - 86400000).toISOString(),
        },
      };
      setInMemoryStoreForRemoval(removedStore);

      const res = await fetch(`${baseUrl}/api/admin/store/${storeId}/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          planId: "yearly_standard",
          durationDays: 30,
        }),
      });

      assert.equal(res.status, 409, "Direct renew for store pending removal must return 409");
      const body = await res.json();
      assert.match(body.message, /pending removal/i);

      assert.equal(removedStore.isActive, false, "Store must remain inactive");
      assert.equal(removedStore.removalStatus, "pending_deletion", "Store removalStatus must remain pending_deletion");
    });
  });

  describe("Item 2: Atomic adminDirectRenew Concurrent Expiry Handling", () => {
    it("retries and stacks duration when expiry changes concurrently without losing days", async () => {
      const storeId = "store_concurrent_renew_01";
      const initialExpiry = new Date(Date.now() + 10 * 86400000).toISOString();
      const concurrentExpiry = new Date(Date.now() + 40 * 86400000).toISOString(); // another renew added 30 days

      const store = {
        _id: storeId,
        storeName: "Concurrent Renew Store",
        slug: "concurrent-renew-store",
        isActive: true,
        subscription: {
          plan: "starter_free",
          status: "active",
          expiresAt: initialExpiry,
        },
        // Simulate a concurrent update that changes the expiry during first attempt
        _simulatedConcurrentChange: concurrentExpiry,
      };
      setInMemoryStoreForRemoval(store);

      const res = await fetch(`${baseUrl}/api/admin/store/${storeId}/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          planId: "yearly_standard",
          durationDays: 30,
        }),
      });

      assert.equal(res.status, 200, "Direct renew should succeed after retrying against new expiry");
      const data = await res.json();
      const finalExpiryTime = new Date(data.expiresAt).getTime();
      const expectedExpiryTime = new Date(concurrentExpiry).getTime() + 30 * 86400000;

      // The new expiry must extend from concurrentExpiry (+30 days), NOT from initialExpiry
      assert.ok(
        Math.abs(finalExpiryTime - expectedExpiryTime) < 5000,
        `Expected final expiry (${finalExpiryTime}) to stack on concurrent expiry (${expectedExpiryTime})`
      );
      assert.equal(store.isActive, true);
    });

    it("conditional update in MongoDB collection retries on conflict and stacks days", async () => {
      // Test the atomic conditional update query logic directly using a mock MongoDB collection
      const initialExpiry = new Date(Date.now() + 5 * 86400000).toISOString();
      const concurrentExpiry = new Date(Date.now() + 35 * 86400000).toISOString();

      let storeInDb = {
        _id: "store_db_atomic_01",
        storeName: "Atomic Store DB",
        isActive: true,
        subscription: {
          plan: "starter_free",
          expiresAt: initialExpiry,
        },
      };

      let updateAttempts = 0;
      const mockCollection = {
        findOne: async ({ _id }) => ({ ...storeInDb }),
        updateOne: async (query, update) => {
          updateAttempts++;
          // First attempt fails because another process changed subscription.expiresAt
          if (updateAttempts === 1) {
            // Concurrent process changed it in the DB
            storeInDb.subscription.expiresAt = concurrentExpiry;
            return { matchedCount: 0, modifiedCount: 0 };
          }
          // Second attempt matches the new expiry
          if (query["subscription.expiresAt"] === concurrentExpiry) {
            storeInDb.subscription.expiresAt = update.$set["subscription.expiresAt"];
            storeInDb.subscription.status = update.$set["subscription.status"];
            return { matchedCount: 1, modifiedCount: 1 };
          }
          return { matchedCount: 0, modifiedCount: 0 };
        },
      };

      const originalDb = mongoose.connection.db;
      mongoose.connection.db = {
        collection: (name) => (name === "stores" ? mockCollection : null),
      };

      try {
        const { adminDirectRenew } = await import("../src/controllers/subscriptionController.js");

        let responseData = null;
        let responseStatus = 200;
        const req = {
          params: { storeId: "store_db_atomic_01" },
          body: { planId: "yearly_standard", durationDays: 15 },
        };
        const res = {
          status: (code) => {
            responseStatus = code;
            return res;
          },
          json: (data) => {
            responseData = data;
            return res;
          },
        };

        await adminDirectRenew(req, res);

        assert.equal(responseStatus, 200);
        assert.equal(updateAttempts, 2, "Should have retried after the first conflict");
        const expectedTime = new Date(concurrentExpiry).getTime() + 15 * 86400000;
        const actualTime = new Date(responseData.expiresAt).getTime();
        assert.ok(
          Math.abs(actualTime - expectedTime) < 5000,
          `Expected final expiry to stack 15 days on concurrent expiry (${expectedTime}), got ${actualTime}`
        );
      } finally {
        mongoose.connection.db = originalDb;
      }
    });
  });

  describe("Item 3: Revert Application on Any Store Insert Error", () => {
    it("reverts application to pending and storeId null on a non-duplicate insert error", async () => {
      const appId = "app_test_insert_error_01";
      const appDoc = setInMemoryApplication({
        _id: appId,
        email: "inserterror@example.com",
        name: "Test Applicant",
        storeName: "Error Shop",
        slug: "error-shop",
        subdomain: "error-shop",
        entityType: "artisan",
        status: "pending",
        storeId: null,
      });

      setInMemoryVendor({
        _id: "vendor_err_01",
        email: "inserterror@example.com",
        status: "pending",
        storeId: null,
      });

      // Mock stores collection to throw a generic (non-duplicate 11000) database error
      const mockStoresCol = {
        insertOne: async () => {
          throw new Error("MongoNetworkTimeoutException: connection timed out during insert");
        },
      };

      const originalDb = mongoose.connection.db;
      mongoose.connection.db = {
        collection: (name) => {
          if (name === "stores") return mockStoresCol;
          return null;
        },
      };

      try {
        let statusCode = 200;
        let body = null;
        const req = {
          params: { id: appId },
        };
        const res = {
          status: (code) => {
            statusCode = code;
            return res;
          },
          json: (data) => {
            body = data;
            return res;
          },
        };

        await approveApplication(req, res);

        assert.equal(statusCode, 500, "Should return 500 on store insert failure");
        assert.match(body.message, /reverted to pending/i);

        // Verify the application was reverted to pending and storeId is null
        assert.equal(appDoc.status, "pending", "Application status must be reverted to pending");
        assert.equal(appDoc.storeId, null, "Application storeId must be reverted to null");
      } finally {
        mongoose.connection.db = originalDb;
      }
    });

    it("reverts application to pending and storeId null on a duplicate key error (code 11000)", async () => {
      const appId = "app_test_duplicate_key_02";
      const appDoc = setInMemoryApplication({
        _id: appId,
        email: "duplicatekey@example.com",
        name: "Duplicate Key Applicant",
        storeName: "Dup Shop",
        slug: "dup-shop",
        subdomain: "dup-shop",
        entityType: "artisan",
        status: "pending",
        storeId: null,
      });

      setInMemoryVendor({
        _id: "vendor_dup_01",
        email: "duplicatekey@example.com",
        status: "pending",
        storeId: null,
      });

      const duplicateError = new Error("E11000 duplicate key error collection: stores index: slug_1 dup key");
      duplicateError.code = 11000;

      const mockStoresCol = {
        insertOne: async () => {
          throw duplicateError;
        },
      };

      const originalDb = mongoose.connection.db;
      mongoose.connection.db = {
        collection: (name) => {
          if (name === "stores") return mockStoresCol;
          return null;
        },
      };

      try {
        let statusCode = 200;
        let body = null;
        const req = {
          params: { id: appId },
        };
        const res = {
          status: (code) => {
            statusCode = code;
            return res;
          },
          json: (data) => {
            body = data;
            return res;
          },
        };

        await approveApplication(req, res);

        assert.equal(statusCode, 409, "Should return 409 on duplicate slug/subdomain");
        assert.match(body.message, /already exists/i);

        // Verify the application was reverted to pending and storeId is null
        assert.equal(appDoc.status, "pending", "Application status must be reverted to pending");
        assert.equal(appDoc.storeId, null, "Application storeId must be reverted to null");
      } finally {
        mongoose.connection.db = originalDb;
      }
    });
  });
});
