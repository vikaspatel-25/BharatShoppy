import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("Vendor Application and Approval Flow (A3)", () => {
  let server;
  let baseUrl;
  let app;
  let sentEmails = [];
  let signToken;
  let setTestTransport;
  let resetInMemoryApplications;
  let setInMemoryApplication;
  let setInMemoryApplicationCode;
  let setInMemoryVendor;
  let resetInMemoryVendors;
  let resetMemoryLimits;
  let adminToken;

  const fakeTransport = {
    sendMail: async (mailOptions) => {
      sentEmails.push(mailOptions);
      return { messageId: "fake-msg-" + Date.now() };
    },
  };

  before(async () => {
    process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    process.env.NODE_ENV = "test";

    const emailService = await import("../src/services/emailService.js");
    setTestTransport = emailService.setTestTransport;
    setTestTransport(fakeTransport);

    const tokenHelper = await import("../src/lib/tokenHelper.js");
    signToken = tokenHelper.signToken;

    const appController = await import("../src/controllers/vendorApplicationController.js");
    resetInMemoryApplications = appController.resetInMemoryApplications;
    setInMemoryApplication = appController.setInMemoryApplication;
    setInMemoryApplicationCode = appController.setInMemoryApplicationCode;

    const vendorController = await import("../src/controllers/vendorAuthController.js");
    setInMemoryVendor = vendorController.setInMemoryVendor;
    resetInMemoryVendors = vendorController.resetInMemoryVendors;

    const rateLimitHelper = await import("../src/lib/rateLimitHelper.js");
    resetMemoryLimits = rateLimitHelper.resetMemoryLimits;

    const appModule = await import("../src/app.js");
    app = appModule.default;

    adminToken = signToken({ role: "admin", email: "admin@bharatshopy.com" });

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
    sentEmails = [];
    resetInMemoryApplications();
    resetInMemoryVendors();
    resetMemoryLimits();
  });

  describe("POST /api/vendor/apply/request-code", () => {
    it("sends 6-digit code for a valid new applicant email", async () => {
      const res = await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "applicant1@example.com" }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, "applicant1@example.com");
      assert.match(sentEmails[0].subject, /Verification Code/);
      assert.match(sentEmails[0].text, /\d{6}/);
    });

    it("rejects non-string or invalid email format with 400", async () => {
      const res1 = await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: 12345 }),
      });
      assert.equal(res1.status, 400);

      const res2 = await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });
      assert.equal(res2.status, 400);
    });

    it("rejects email of an already approved vendor with 400", async () => {
      setInMemoryVendor({
        email: "approved_vendor@example.com",
        status: "approved",
        storeId: "store_approved",
      });

      const res = await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "approved_vendor@example.com" }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /already exists/i);
    });

    it("rejects email of an already pending application with 400", async () => {
      setInMemoryApplication({
        _id: "app_existing",
        email: "pending_vendor@example.com",
        storeName: "Pending Store",
        status: "pending",
      });

      const res = await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pending_vendor@example.com" }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /already pending/i);
    });
  });

  describe("POST /api/vendor/apply", () => {
    it("submits a valid application and creates pending records", async () => {
      // 1. Request code
      await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "newshop@example.com" }),
      });

      const emailCall = sentEmails.find((e) => e.to === "newshop@example.com");
      const codeMatch = emailCall.text.match(/\b\d{6}\b/);
      assert.ok(codeMatch, "Must contain 6-digit code");
      const code = codeMatch[0];

      // 2. Submit application
      const res = await fetch(`${baseUrl}/api/vendor/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newshop@example.com",
          code,
          name: "Suresh Kumar",
          storeName: "Suresh Daily Needs",
          slug: "suresh-daily",
          subdomain: "suresh-daily",
          phone: "+919876543210",
          entityType: "shopkeeper",
          storeCategory: "Groceries",
          description: "Fresh daily provisions",
          address: { city: "Nagpur", state: "Maharashtra" },
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.applicationId);

      // Confirm confirmation sent to applicant and alert sent to admin
      const applicantEmail = sentEmails.find(
        (e) => e.to === "newshop@example.com" && e.subject.includes("Application Received")
      );
      assert.ok(applicantEmail, "Applicant must receive confirmation");

      const adminAlert = sentEmails.find(
        (e) => e.to === "admin@bharatshopy.com" && e.subject.includes("New Vendor Application")
      );
      assert.ok(adminAlert, "Admin must receive alert");
    });

    it("rejects invalid verification code with 400", async () => {
      await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "testcode@example.com" }),
      });

      const res = await fetch(`${baseUrl}/api/vendor/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "testcode@example.com",
          code: "999999", // wrong code
          name: "Wrong Code",
          storeName: "Wrong Code Store",
          slug: "wrong-code-store",
          subdomain: "wrong-code-store",
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /invalid verification code/i);
    });

    it("rejects reserved subdomains with 400", async () => {
      await fetch(`${baseUrl}/api/vendor/apply/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reserved@example.com" }),
      });

      const emailCall = sentEmails.find((e) => e.to === "reserved@example.com");
      const code = emailCall.text.match(/\b\d{6}\b/)[0];

      const reservedNames = ["admin", "www", "api", "bharatshopy"];

      for (const name of reservedNames) {
        const res = await fetch(`${baseUrl}/api/vendor/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reserved@example.com",
            code,
            name: "Reserved User",
            storeName: "Reserved Store",
            slug: name,
            subdomain: name,
          }),
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.message, /reserved/i);
      }
    });

    it("rejects duplicate application with same email with 409", async () => {
      // Create existing pending application
      setInMemoryApplication({
        _id: "app_dup_email",
        email: "duplicate@example.com",
        storeName: "Existing App",
        slug: "existing-app",
        subdomain: "existing-app",
        status: "pending",
      });

      const { hashString } = await import("../src/lib/tokenHelper.js");
      setInMemoryApplicationCode("duplicate@example.com", {
        codeHash: hashString("123456"),
        codeExpiresAt: Date.now() + 600000,
        codeAttempts: 0,
      });

      const res = await fetch(`${baseUrl}/api/vendor/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "duplicate@example.com",
          code: "123456",
          name: "Duplicate User",
          storeName: "Duplicate Store",
          slug: "duplicate-store",
          subdomain: "duplicate-store",
        }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.match(data.message, /already pending/i);
    });

    it("rejects duplicate slug or subdomain with 409", async () => {
      setInMemoryApplication({
        _id: "app_slug_taken",
        email: "other@example.com",
        storeName: "Taken Store",
        slug: "taken-slug",
        subdomain: "taken-slug",
        status: "pending",
      });

      const { hashString } = await import("../src/lib/tokenHelper.js");
      setInMemoryApplicationCode("newapplicant@example.com", {
        codeHash: hashString("123456"),
        codeExpiresAt: Date.now() + 600000,
        codeAttempts: 0,
      });

      const res = await fetch(`${baseUrl}/api/vendor/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newapplicant@example.com",
          code: "123456",
          name: "New Applicant",
          storeName: "Different Name",
          slug: "taken-slug",
          subdomain: "different-subdomain",
        }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.match(data.message, /already in use/i);
    });
  });

  describe("Admin Moderation: list, approve, reject", () => {
    it("requires admin authentication for admin routes", async () => {
      const resList = await fetch(`${baseUrl}/api/admin/vendor-applications`);
      assert.equal(resList.status, 401);

      const resApprove = await fetch(`${baseUrl}/api/admin/vendor-applications/app_1/approve`, {
        method: "POST",
      });
      assert.equal(resApprove.status, 401);

      const resReject = await fetch(`${baseUrl}/api/admin/vendor-applications/app_1/reject`, {
        method: "POST",
      });
      assert.equal(resReject.status, 401);
    });

    it("lists applications for authenticated admin", async () => {
      setInMemoryApplication({
        _id: "app_list_1",
        email: "app1@example.com",
        storeName: "App Store 1",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      const res = await fetch(`${baseUrl}/api/admin/vendor-applications`, {
        headers: { Cookie: `admin_session=${adminToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.applications));
      assert.equal(data.applications.length, 1);
      assert.equal(data.applications[0].storeName, "App Store 1");
    });

    it("approves pending application, provisions store on starter_free, and updates vendor", async () => {
      const appDoc = setInMemoryApplication({
        _id: "app_to_approve",
        email: "toapprove@example.com",
        name: "Approve Me",
        storeName: "Approved Shop",
        slug: "approved-shop",
        subdomain: "approved-shop",
        entityType: "artisan",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      setInMemoryVendor({
        _id: "vendor_pending_1",
        email: "toapprove@example.com",
        status: "pending",
        storeId: null,
      });

      const res = await fetch(`${baseUrl}/api/admin/vendor-applications/${appDoc._id}/approve`, {
        method: "POST",
        headers: { Cookie: `admin_session=${adminToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.store);
      assert.equal(data.store.subscription.plan, "starter_free");
      assert.equal(data.store.limits.productMonthlyLimit, 15);
      assert.equal(data.store.limits.maxImagesPerProduct, 5);

      // Verify approval email sent
      const approvalEmail = sentEmails.find(
        (e) => e.to === "toapprove@example.com" && e.subject.includes("Approved")
      );
      assert.ok(approvalEmail, "Vendor must receive approval email");

      // Verify double approval returns 409
      const doubleRes = await fetch(`${baseUrl}/api/admin/vendor-applications/${appDoc._id}/approve`, {
        method: "POST",
        headers: { Cookie: `admin_session=${adminToken}` },
      });
      assert.equal(doubleRes.status, 409);
    });

    it("rejects pending application with required reason", async () => {
      const appDoc = setInMemoryApplication({
        _id: "app_to_reject",
        email: "toreject@example.com",
        storeName: "Reject Shop",
        slug: "reject-shop",
        subdomain: "reject-shop",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      setInMemoryVendor({
        _id: "vendor_pending_2",
        email: "toreject@example.com",
        status: "pending",
        storeId: null,
      });

      // 1. Missing reason returns 400
      const missingReasonRes = await fetch(`${baseUrl}/api/admin/vendor-applications/${appDoc._id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(missingReasonRes.status, 400);

      // 2. Valid reason succeeds
      const res = await fetch(`${baseUrl}/api/admin/vendor-applications/${appDoc._id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({ reason: "Incomplete address details and unverifiable phone number." }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify rejection email sent with reason
      const rejectionEmail = sentEmails.find(
        (e) => e.to === "toreject@example.com" && e.subject.includes("BharatShopy application")
      );
      assert.ok(rejectionEmail, "Applicant must receive rejection email");
      assert.match(rejectionEmail.text, /Incomplete address details/);

      // Verify double reject returns 409
      const doubleRes = await fetch(`${baseUrl}/api/admin/vendor-applications/${appDoc._id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `admin_session=${adminToken}`,
        },
        body: JSON.stringify({ reason: "Again" }),
      });
      assert.equal(doubleRes.status, 409);
    });
  });

  describe("Access control for pending and rejected vendors", () => {
    it("does not issue vendor login code to a pending vendor", async () => {
      setInMemoryVendor({
        email: "pending_vendor@example.com",
        status: "pending",
        storeId: null,
      });

      const res = await fetch(`${baseUrl}/api/vendor/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pending_vendor@example.com" }),
      });

      // Uniform response returned, but no email dispatched
      assert.equal(res.status, 200);
      const sent = sentEmails.find((e) => e.to === "pending_vendor@example.com");
      assert.equal(sent, undefined, "Pending vendor must NOT receive login code");
    });

    it("denies pending vendor access to store routes with 403", async () => {
      setInMemoryVendor({
        _id: "vendor_pending_3",
        email: "pending3@example.com",
        status: "pending",
        storeId: null,
      });

      const vendorToken = signToken({
        role: "vendor",
        vendorId: "vendor_pending_3",
        email: "pending3@example.com",
        status: "pending",
      });

      const res = await fetch(`${baseUrl}/api/vendor/store/store_farmer_01`, {
        headers: { Cookie: `vendor_session=${vendorToken}` },
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /not approved/i);
    });

    it("denies rejected vendor access to store routes with 403", async () => {
      setInMemoryVendor({
        _id: "vendor_rejected_1",
        email: "rejected@example.com",
        status: "rejected",
        storeId: null,
      });

      const vendorToken = signToken({
        role: "vendor",
        vendorId: "vendor_rejected_1",
        email: "rejected@example.com",
        status: "rejected",
      });

      const res = await fetch(`${baseUrl}/api/vendor/store/store_farmer_01`, {
        headers: { Cookie: `vendor_session=${vendorToken}` },
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /not approved/i);
    });
  });
});
