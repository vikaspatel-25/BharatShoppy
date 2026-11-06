import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("Subscription Approval & Lifecycle Logic Tests (H6)", () => {
  let server;
  let baseUrl;
  let app;
  let adminToken;
  let vendorToken;
  let resetInMemorySubscriptionRequests;
  let setInMemorySubscriptionRequest;
  let setInMemoryVendor;
  let resetInMemoryVendors;

  before(async () => {
    process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    process.env.NODE_ENV = "test";

    const tokenHelper = await import("../src/lib/tokenHelper.js");
    const { signToken } = tokenHelper;

    const subController = await import("../src/controllers/subscriptionController.js");
    resetInMemorySubscriptionRequests = subController.resetInMemorySubscriptionRequests;
    setInMemorySubscriptionRequest = subController.setInMemorySubscriptionRequest;

    const vendorController = await import("../src/controllers/vendorAuthController.js");
    setInMemoryVendor = vendorController.setInMemoryVendor;
    resetInMemoryVendors = vendorController.resetInMemoryVendors;

    const appModule = await import("../src/app.js");
    app = appModule.default;

    adminToken = signToken({ role: "admin", email: "admin@bharatshopy.com" });
    vendorToken = signToken({
      role: "vendor",
      vendorId: "vendor_farmer_01",
      email: "farmer@example.com",
      status: "approved",
      storeId: "store_farmer_01",
    });

    setInMemoryVendor({
      _id: "vendor_farmer_01",
      email: "farmer@example.com",
      status: "approved",
      storeId: "store_farmer_01",
    });

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
    resetInMemorySubscriptionRequests();
  });

  describe("Vendor Subscription Request Validation", () => {
    it("rejects unknown plan with 400 instead of falling back to default standard plan", async () => {
      const res = await fetch(`${baseUrl}/api/vendor/store/store_farmer_01/subscription-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `vendor_session=${vendorToken}`,
        },
        body: JSON.stringify({
          planId: "non_existent_fake_plan",
          vendorNote: "Please activate",
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /unknown subscription plan/i);
    });

    it("prevents duplicate pending requests for the same store with 409", async () => {
      // 1. First valid request
      const res1 = await fetch(`${baseUrl}/api/vendor/store/store_farmer_01/subscription-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `vendor_session=${vendorToken}`,
        },
        body: JSON.stringify({
          planId: "yearly_standard",
          vendorNote: "First payment request",
        }),
      });
      assert.equal(res1.status, 201);

      // 2. Immediate second request while first is pending
      const res2 = await fetch(`${baseUrl}/api/vendor/store/store_farmer_01/subscription-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `vendor_session=${vendorToken}`,
        },
        body: JSON.stringify({
          planId: "yearly_pro",
          vendorNote: "Second duplicate request",
        }),
      });
      assert.equal(res2.status, 409);
      const data2 = await res2.json();
      assert.match(data2.message, /already pending/i);
    });
  });

  describe("Admin Approval and Rejection State Transitions (Atomic)", () => {
    it("successfully approves a pending request and prevents double approval with 409", async () => {
      const requestId = "req_test_approval_" + Date.now();
      setInMemorySubscriptionRequest({
        _id: requestId,
        storeId: "store_farmer_01",
        storeName: "Kisan Organic Produce & Farms",
        selectedPlan: "yearly_standard",
        planName: "Boutique & Farm Standard",
        discountedPrice: 1200,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      // 1. First approval succeeds
      const res1 = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          action: "approve",
          durationDays: 365,
        }),
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.request.status, "approved");

      // 2. Second approval attempt returns 409
      const res2 = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          action: "approve",
          durationDays: 365,
        }),
      });
      assert.equal(res2.status, 409);
      const data2 = await res2.json();
      assert.match(data2.message, /cannot approve/i);
    });

    it("prevents approving a rejected request with 409", async () => {
      const requestId = "req_test_reject_" + Date.now();
      setInMemorySubscriptionRequest({
        _id: requestId,
        storeId: "store_farmer_01",
        storeName: "Kisan Organic Produce & Farms",
        selectedPlan: "yearly_standard",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      // 1. Reject
      const resReject = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          action: "reject",
          adminNotes: "Offline payment mismatch",
        }),
      });
      assert.equal(resReject.status, 200);

      // 2. Attempt to approve after rejection
      const resApprove = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          action: "approve",
          durationDays: 365,
        }),
      });
      assert.equal(resApprove.status, 409);
      const data = await resApprove.json();
      assert.match(data.message, /cannot approve/i);
    });
  });

  describe("Duration and Plan Validation", () => {
    it("rejects invalid durationDays in verifyPaymentRequest with 400", async () => {
      const requestId = "req_test_dur_" + Date.now();
      setInMemorySubscriptionRequest({
        _id: requestId,
        storeId: "store_farmer_01",
        selectedPlan: "yearly_standard",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      const badDurations = [0, -10, 367, 1000, 30.5, "not-a-number"];
      for (const badDays of badDurations) {
        const res = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `admin_session=${adminToken}`,
          },
          body: JSON.stringify({
            action: "approve",
            durationDays: badDays,
          }),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.message, /integer between 1 and 366/i);
      }
    });

    it("rejects unknown plan in verifyPaymentRequest with 400", async () => {
      const requestId = "req_test_unknown_" + Date.now();
      setInMemorySubscriptionRequest({
        _id: requestId,
        storeId: "store_farmer_01",
        selectedPlan: "mystery_plan",
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
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /unknown plan/i);
    });

    it("rejects invalid durationDays in adminDirectRenew with 400", async () => {
      const res = await fetch(`${baseUrl}/api/admin/store/store_farmer_01/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          planId: "yearly_standard",
          durationDays: 500, // exceeds 366
        }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /integer between 1 and 366/i);
    });

    it("rejects unknown plan in adminDirectRenew with 400", async () => {
      const res = await fetch(`${baseUrl}/api/admin/store/store_farmer_01/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          planId: "non_existent_plan_xyz",
          durationDays: 30,
        }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /unknown plan/i);
    });
  });

  describe("Early Renewal Calculation", () => {
    it("extends from the current expiry if subscription has days remaining", async () => {
      // Direct renew store with 30 days
      const res1 = await fetch(`${baseUrl}/api/admin/store/store_farmer_01/renew`, {
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
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      const firstExpiry = new Date(data1.expiresAt).getTime();

      // Early renew with an additional 60 days
      const res2 = await fetch(`${baseUrl}/api/admin/store/store_farmer_01/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({
          planId: "yearly_standard",
          durationDays: 60,
        }),
      });
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      const secondExpiry = new Date(data2.expiresAt).getTime();

      // Second expiry should be approximately firstExpiry + 60 days (tolerance of 5 seconds)
      const expectedExpiry = firstExpiry + 60 * 86400000;
      assert.ok(
        Math.abs(secondExpiry - expectedExpiry) < 5000,
        `Expected ${secondExpiry} to be near ${expectedExpiry}`
      );
    });
  });
});
