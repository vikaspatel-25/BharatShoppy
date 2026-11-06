import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("Email Notifications and Failure Handling (E1)", () => {
  let server;
  let baseUrl;
  let app;
  let sentEmails = [];
  let shouldThrowOnSend = false;

  let signToken;
  let setTestTransport;
  let adminToken;
  let setInMemoryApplication;
  let resetInMemoryApplications;
  let setInMemoryVendor;
  let resetInMemoryVendors;
  let setInMemorySubscriptionRequest;
  let resetInMemorySubscriptionRequests;

  const fakeTransport = {
    sendMail: async (mailOptions) => {
      if (shouldThrowOnSend) {
        throw new Error("Simulated SMTP delivery failure");
      }
      sentEmails.push(mailOptions);
      return { messageId: "msg-" + Date.now() };
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
    adminToken = signToken({ role: "admin", email: "admin@bharatshopy.com" });

    const appController = await import("../src/controllers/vendorApplicationController.js");
    setInMemoryApplication = appController.setInMemoryApplication;
    resetInMemoryApplications = appController.resetInMemoryApplications;

    const vendorController = await import("../src/controllers/vendorAuthController.js");
    setInMemoryVendor = vendorController.setInMemoryVendor;
    resetInMemoryVendors = vendorController.resetInMemoryVendors;

    const subController = await import("../src/controllers/subscriptionController.js");
    setInMemorySubscriptionRequest = subController.setInMemorySubscriptionRequest;
    resetInMemorySubscriptionRequests = subController.resetInMemorySubscriptionRequests;

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
    sentEmails = [];
    shouldThrowOnSend = false;
    resetInMemoryApplications();
    resetInMemoryVendors();
    resetInMemorySubscriptionRequests();
  });

  describe("Coverage for Each Email Notification Type", () => {
    it("delivers new-application alert and applicant confirmation", async () => {
      const emailService = await import("../src/services/emailService.js");

      // 1. Admin Alert
      await emailService.sendNewApplicationAlert({
        storeName: "Swadeshi Handlooms",
        email: "weaver@example.com",
        name: "Anand Rao",
        city: "Varanasi",
        entityType: "artisan",
      });

      assert.equal(sentEmails.length, 1);
      const adminAlert = sentEmails[0];
      assert.equal(adminAlert.to, "admin@bharatshopy.com");
      assert.match(adminAlert.subject, /New Vendor Application: Swadeshi Handlooms/);
      assert.match(adminAlert.text, /weaver@example.com/);

      // 2. Applicant Confirmation
      await emailService.sendApplicationConfirmation("weaver@example.com", {
        storeName: "Swadeshi Handlooms",
        name: "Anand Rao",
      });

      assert.equal(sentEmails.length, 2);
      const applicantConf = sentEmails[1];
      assert.equal(applicantConf.to, "weaver@example.com");
      assert.match(applicantConf.subject, /Application Received for Swadeshi Handlooms/);
    });

    it("delivers vendor approval and rejection notifications", async () => {
      const emailService = await import("../src/services/emailService.js");

      // 1. Vendor Approval
      await emailService.sendVendorApprovalEmail("approved@example.com", {
        storeName: "Pooja Sweets",
        slug: "pooja-sweets",
        subdomain: "pooja-sweets",
      });

      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, "approved@example.com");
      assert.match(sentEmails[0].subject, /Approved/);
      assert.match(sentEmails[0].text, /Starter Free Plan/);

      // 2. Vendor Rejection with Reason
      await emailService.sendVendorRejectionEmail("rejected@example.com", {
        storeName: "Counterfeit Hub",
        reason: "Selling unauthorized branded apparel.",
      });

      assert.equal(sentEmails.length, 2);
      assert.equal(sentEmails[1].to, "rejected@example.com");
      assert.match(sentEmails[1].text, /Selling unauthorized branded apparel/);
    });

    it("delivers subscription activation and discontinuation emails", async () => {
      const emailService = await import("../src/services/emailService.js");

      // 1. Activation
      const futureDate = new Date(Date.now() + 365 * 86400000).toISOString();
      await emailService.sendSubscriptionActivationEmail("kisan@example.com", {
        storeName: "Kisan Organics",
        planName: "Boutique & Farm Standard",
        durationDays: 365,
        expiresAt: futureDate,
      });

      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, "kisan@example.com");
      assert.match(sentEmails[0].subject, /Subscription Activated/);
      assert.match(sentEmails[0].text, /Boutique & Farm Standard/);

      // 2. Discontinuation
      await emailService.sendSubscriptionDiscontinuationEmail("kisan@example.com", {
        storeName: "Kisan Organics",
      });

      assert.equal(sentEmails.length, 2);
      assert.equal(sentEmails[1].to, "kisan@example.com");
      assert.match(sentEmails[1].subject, /Subscription Discontinued/);
    });

    it("sends manual renewal reminder via admin endpoint", async () => {
      setInMemoryVendor({
        _id: "v_farmer",
        email: "farmer_renew@example.com",
        status: "approved",
        storeId: "store_farmer_01",
      });

      const res = await fetch(`${baseUrl}/api/admin/store/store_farmer_01/send-renewal-reminder`, {
        method: "POST",
        headers: { Cookie: `admin_session=${adminToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      assert.equal(sentEmails.length, 1);
      assert.match(sentEmails[0].subject, /Renewal Reminder/);
      assert.match(sentEmails[0].text, /Kisan Organic Produce & Farms/);
    });
  });

  describe("Failure Handling: Keeps Database Changes and Returns Warnings", () => {
    it("keeps vendor approval in DB and returns warning when email fails", async () => {
      const appDoc = setInMemoryApplication({
        _id: "app_fail_email_test",
        email: "fail_email@example.com",
        storeName: "Resilient Store",
        slug: "resilient-store",
        subdomain: "resilient-store",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      setInMemoryVendor({
        _id: "vendor_fail_email",
        email: "fail_email@example.com",
        status: "pending",
        storeId: null,
      });

      // Force email failure on transport
      shouldThrowOnSend = true;

      const res = await fetch(`${baseUrl}/api/admin/vendor-applications/${appDoc._id}/approve`, {
        method: "POST",
        headers: { Cookie: `admin_session=${adminToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();

      // Database changes are preserved
      assert.equal(data.success, true);
      assert.equal(appDoc.status, "approved");
      assert.ok(data.store);
      assert.equal(data.emailFailed, true);
      assert.ok(data.warning);
      assert.match(data.warning, /approval email failed to deliver/i);
      assert.ok(data.resendEndpoint);

      // Now fix transport and test resend
      shouldThrowOnSend = false;
      const resendRes = await fetch(`${baseUrl}${data.resendEndpoint}`, {
        method: "POST",
        headers: { Cookie: `admin_session=${adminToken}` },
      });

      assert.equal(resendRes.status, 200);
      const resendData = await resendRes.json();
      assert.equal(resendData.success, true);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, "fail_email@example.com");
    });

    it("keeps subscription approval in DB and returns warning when email fails", async () => {
      const requestId = "req_fail_email_" + Date.now();
      const requestDoc = {
        _id: requestId,
        storeId: "store_farmer_01",
        storeName: "Kisan Organic Produce & Farms",
        selectedPlan: "yearly_standard",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      setInMemorySubscriptionRequest(requestDoc);

      setInMemoryVendor({
        _id: "v_farmer_sub",
        email: "farmer_sub@example.com",
        status: "approved",
        storeId: "store_farmer_01",
      });

      shouldThrowOnSend = true;

      const res = await fetch(`${baseUrl}/api/admin/subscription-requests/${requestId}/verify`, {
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

      assert.equal(res.status, 200);
      const data = await res.json();

      // Database change preserved
      assert.equal(requestDoc.status, "approved");
      assert.equal(data.emailFailed, true);
      assert.ok(data.warning);
      assert.ok(data.resendEndpoint);

      // Resend succeeded once transport recovered
      shouldThrowOnSend = false;
      const resendRes = await fetch(`${baseUrl}${data.resendEndpoint}`, {
        method: "POST",
        headers: { Cookie: `admin_session=${adminToken}` },
      });
      assert.equal(resendRes.status, 200);
      assert.equal(sentEmails.length, 1);
    });
  });

  describe("Compliance: No Banned Words in Email Templates", () => {
    it("ensures no banned phrases are found in email texts", async () => {
      const emailService = await import("../src/services/emailService.js");

      await emailService.sendAdminLoginCode("a@b.com", "123456");
      await emailService.sendVendorLoginCode("a@b.com", "123456");
      await emailService.sendApplicationVerificationCode("a@b.com", "123456");
      await emailService.sendNewApplicationAlert({ storeName: "Store", email: "a@b.com", name: "Name" });
      await emailService.sendApplicationConfirmation("a@b.com", { storeName: "Store", name: "Name" });
      await emailService.sendVendorApprovalEmail("a@b.com", { storeName: "Store", slug: "s", subdomain: "s" });
      await emailService.sendVendorRejectionEmail("a@b.com", { storeName: "Store", reason: "Reason" });
      await emailService.sendSubscriptionActivationEmail("a@b.com", { storeName: "Store", planName: "Plan", durationDays: 30 });
      await emailService.sendSubscriptionDiscontinuationEmail("a@b.com", { storeName: "Store" });
      await emailService.sendRenewalReminderEmail("a@b.com", { storeName: "Store", planName: "Plan" });

      const bannedRegex = /payment received|utr|invoice|receipt/i;
      for (const email of sentEmails) {
        assert.ok(
          !bannedRegex.test(email.subject),
          `Banned word found in subject: ${email.subject}`
        );
        assert.ok(
          !bannedRegex.test(email.text),
          `Banned word found in text: ${email.text}`
        );
        if (email.html) {
          assert.ok(
            !bannedRegex.test(email.html),
            `Banned word found in html: ${email.html}`
          );
        }
      }
    });
  });
});
