import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  requestCode,
  verifyCode,
  vendorLogout,
  setInMemoryVendor,
  resetInMemoryVendors,
} from "../src/controllers/vendorAuthController.js";
import {
  requireVendor,
  requireStoreOwner,
  resolveStoreByIdentifier,
} from "../src/middleware/authMiddleware.js";
import { signToken, hashString } from "../src/lib/tokenHelper.js";
import { setTestTransport, resetTestTransport } from "../src/services/emailService.js";
import { resetMemoryLimits } from "../src/lib/rateLimitHelper.js";

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    cookies: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    cookie(name, val, opts) {
      this.cookies[name] = { val, opts };
      return this;
    },
    clearCookie(name, opts) {
      delete this.cookies[name];
      this.clearedCookie = { name, opts };
      return this;
    },
  };
}

describe("Vendor Email Code Authentication (A2 & R1) Unit Tests", () => {
  const TEST_SECRET = "test-vendor-signing-secret-unit-tests-12345";
  const TEST_EMAIL = "vendor@bharatshopy.com";
  const STORE_ID = "store_0103";
  let sentMails = [];

  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    resetInMemoryVendors();
    resetMemoryLimits();
    resetTestTransport();
    sentMails = [];

    setTestTransport({
      async sendMail(mailOptions) {
        sentMails.push(mailOptions);
        return { messageId: "vendor-fake-msg-123" };
      },
    });

    setInMemoryVendor({
      _id: "vendor_1",
      email: TEST_EMAIL,
      storeId: STORE_ID,
      status: "approved",
    });
  });

  afterEach(() => {
    resetTestTransport();
  });

  describe("POST /api/vendor/auth/request-code", () => {
    it("rejects non-string email with 400", async () => {
      const req = { body: { email: 12345 }, ip: "127.0.0.1" };
      const res = createMockRes();
      await requestCode(req, res);
      assert.equal(res.statusCode, 400);

      const req2 = { body: { email: { object: true } }, ip: "127.0.0.1" };
      const res2 = createMockRes();
      await requestCode(req2, res2);
      assert.equal(res2.statusCode, 400);
    });

    it("successfully requests code for approved vendor and sends 6-digit email", async () => {
      const req = { body: { email: TEST_EMAIL }, ip: "127.0.0.1" };
      const res = createMockRes();

      await requestCode(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(sentMails.length, 1);
      assert.equal(sentMails[0].to, TEST_EMAIL);
      assert.ok(sentMails[0].text.match(/\b\d{6}\b/));
    });

    it("returns identical success response for unknown or unapproved email without sending email", async () => {
      // 1. Unknown email
      const reqUnknown = { body: { email: "nobody@example.com" }, ip: "127.0.0.1" };
      const resUnknown = createMockRes();
      await requestCode(reqUnknown, resUnknown);

      assert.equal(resUnknown.statusCode, 200);
      assert.equal(resUnknown.body.success, true);
      assert.ok(resUnknown.body.message.includes("If your email is registered"));
      assert.equal(sentMails.length, 0, "Must not send email for unknown address");

      // 2. Pending vendor
      setInMemoryVendor({
        _id: "vendor_pending",
        email: "pending@bharatshopy.com",
        storeId: "store_pending",
        status: "pending",
      });
      const reqPending = { body: { email: "pending@bharatshopy.com" }, ip: "127.0.0.1" };
      const resPending = createMockRes();
      await requestCode(reqPending, resPending);

      assert.equal(resPending.statusCode, 200);
      assert.equal(sentMails.length, 0, "Must not send email for pending vendor");
    });

    it("enforces cooldown rate limiting per email", async () => {
      const req = { body: { email: TEST_EMAIL }, ip: "127.0.0.1" };

      // First request succeeds
      const res1 = createMockRes();
      await requestCode(req, res1);
      assert.equal(res1.statusCode, 200);

      // Immediate second request within 60s hits cooldown
      const res2 = createMockRes();
      await requestCode(req, res2);
      assert.equal(res2.statusCode, 429);
      assert.ok(res2.body.message.includes("wait before requesting"));
    });
  });

  describe("Rate Limits Stored in Collection", () => {
    it("stores rate limit records in auth_limits collection when MongoDB is present", async () => {
      const insertedDocs = [];
      const fakeCollection = {
        async findOne(query) {
          return insertedDocs.find((d) => d._id === query._id) || null;
        },
        async findOneAndUpdate(filter, update, options) {
          let doc = insertedDocs.find((d) => d._id === filter._id);
          if (!doc && options?.upsert) {
            doc = { _id: filter._id, ...update.$set, count: 0 };
            insertedDocs.push(doc);
          }
          if (doc) {
            if (update.$inc) {
              for (const [k, v] of Object.entries(update.$inc)) {
                doc[k] = (doc[k] || 0) + v;
              }
            }
            if (update.$set) {
              Object.assign(doc, update.$set);
            }
          }
          return doc;
        },
        async updateOne(filter, update, options) {
          let doc = insertedDocs.find((d) => d._id === filter._id);
          if (!doc && options?.upsert) {
            doc = { _id: filter._id, ...update.$set };
            insertedDocs.push(doc);
          } else if (doc) {
            Object.assign(doc, update.$set);
          }
        },
        async deleteOne(filter) {
          const idx = insertedDocs.findIndex((d) => d._id === filter._id);
          if (idx !== -1) insertedDocs.splice(idx, 1);
        },
      };

      const originalDb = mongoose.connection.db;
      mongoose.connection.db = {
        collection(name) {
          if (name === "auth_limits") return fakeCollection;
          return null;
        },
      };

      try {
        const req = { body: { email: "collection-test@bharatshopy.com" }, ip: "10.0.0.1" };
        const res = createMockRes();
        await requestCode(req, res);

        assert.ok(
          insertedDocs.some((d) => d._id === "ip:10.0.0.1"),
          "IP limit document must be stored in collection"
        );
        assert.ok(
          insertedDocs.some((d) => d._id === "vendor_req:collection-test@bharatshopy.com"),
          "Email limit document must be stored in collection"
        );
      } finally {
        mongoose.connection.db = originalDb;
      }
    });
  });

  describe("POST /api/vendor/auth/verify-code", () => {
    it("rejects non-string email or code with 400", async () => {
      const req1 = { body: { email: 12345, code: "123456" } };
      const res1 = createMockRes();
      await verifyCode(req1, res1);
      assert.equal(res1.statusCode, 400);

      const req2 = { body: { email: TEST_EMAIL, code: ["123456"] } };
      const res2 = createMockRes();
      await verifyCode(req2, res2);
      assert.equal(res2.statusCode, 400);
    });

    it("successfully verifies code, clears code, and sets vendor_session cookie", async () => {
      const req = { body: { email: TEST_EMAIL }, ip: "127.0.0.1" };
      await requestCode(req, createMockRes());

      const code = sentMails[0].text.match(/\b\d{6}\b/)[0];
      const verifyReq = { body: { email: TEST_EMAIL, code } };
      const verifyRes = createMockRes();

      await verifyCode(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 200);
      assert.equal(verifyRes.body.success, true);
      assert.ok(verifyRes.cookies.vendor_session, "Must set vendor_session cookie");
      assert.equal(verifyRes.cookies.vendor_session.opts.httpOnly, true);

      // Re-using the same code must fail (single use)
      const reuseRes = createMockRes();
      await verifyCode(verifyReq, reuseRes);
      assert.equal(reuseRes.statusCode, 400);
    });

    it("rejects wrong code with 400", async () => {
      const req = { body: { email: TEST_EMAIL }, ip: "127.0.0.1" };
      await requestCode(req, createMockRes());

      const verifyRes = createMockRes();
      await verifyCode({ body: { email: TEST_EMAIL, code: "000000" } }, verifyRes);

      assert.equal(verifyRes.statusCode, 400);
      assert.ok(verifyRes.body.message.includes("Invalid verification code"));
    });

    it("rejects expired code", async () => {
      setInMemoryVendor({
        _id: "vendor_1",
        email: TEST_EMAIL,
        storeId: STORE_ID,
        status: "approved",
        codeHash: hashString("123456"),
        codeExpiresAt: Date.now() - 1000, // Expired
      });

      const verifyRes = createMockRes();
      await verifyCode({ body: { email: TEST_EMAIL, code: "123456" } }, verifyRes);

      assert.equal(verifyRes.statusCode, 400);
      assert.ok(verifyRes.body.message.includes("expired"));
    });
  });

  describe("Vendor Store Access & Ownership Enforcement (requireStoreOwner)", () => {
    it("allows approved vendor access to their own store and populates req.store", async () => {
      const token = signToken(
        { vendorId: "vendor_1", email: TEST_EMAIL, storeId: STORE_ID, status: "approved", role: "vendor" },
        TEST_SECRET,
        3600
      );

      const req = {
        cookies: { vendor_session: token },
        params: { storeId: STORE_ID },
      };
      const res = createMockRes();

      let calledNext = false;
      await requireStoreOwner(req, res, () => {
        calledNext = true;
      });

      assert.equal(calledNext, true);
      assert.ok(req.store, "Must populate req.store");
      assert.equal(req.store._id, STORE_ID);
    });

    it("returns 403 when a vendor was removed in DB after login token was issued", async () => {
      // Token says approved
      const token = signToken(
        { vendorId: "vendor_1", email: TEST_EMAIL, storeId: STORE_ID, status: "approved", role: "vendor" },
        TEST_SECRET,
        3600
      );

      // But vendor status in DB/store is now 'removed'
      setInMemoryVendor({
        _id: "vendor_1",
        email: TEST_EMAIL,
        storeId: STORE_ID,
        status: "removed",
      });

      const req = {
        cookies: { vendor_session: token },
        params: { storeId: STORE_ID },
      };
      const res = createMockRes();

      let calledNext = false;
      await requireStoreOwner(req, res, () => {
        calledNext = true;
      });

      assert.equal(calledNext, false);
      assert.equal(res.statusCode, 403);
      assert.ok(res.body.message.includes("not approved"));
    });

    it("rejects vendor requesting another vendor's store with 403", async () => {
      const token = signToken(
        { vendorId: "vendor_1", email: TEST_EMAIL, storeId: STORE_ID, status: "approved", role: "vendor" },
        TEST_SECRET,
        3600
      );

      const req = {
        cookies: { vendor_session: token },
        params: { storeId: "store_farmer_01" }, // different store
      };
      const res = createMockRes();

      let calledNext = false;
      await requireStoreOwner(req, res, () => {
        calledNext = true;
      });

      assert.equal(calledNext, false);
      assert.equal(res.statusCode, 403);
      assert.ok(res.body.message.includes("do not have ownership"));
    });

    it("safely handles '(' without throwing SyntaxError and '.*' without matching every store", async () => {
      // '(' would break unescaped new RegExp
      const storeWithParen = await resolveStoreByIdentifier("store_(");
      assert.equal(storeWithParen, null);

      // '.*' must not match everything
      const storeWithWildcard = await resolveStoreByIdentifier(".*");
      assert.equal(storeWithWildcard, null);
    });
    it("R2: wrong code without active code does not count against vendor lock limits", async () => {
      // Vendor has NO active code
      const req = { body: { email: TEST_EMAIL, code: "123456" }, ip: "127.0.0.1" };
      const res = createMockRes();
      await verifyCode(req, res);
      assert.equal(res.statusCode, 400);

      // Now request a valid code
      const req2 = { body: { email: TEST_EMAIL }, ip: "127.0.0.1" };
      const res2 = createMockRes();
      await requestCode(req2, res2);
      assert.equal(res2.statusCode, 200);

      // The vendor should still have full attempts available (not locked out)
      const req3 = { body: { email: TEST_EMAIL, code: "000000" }, ip: "127.0.0.1" };
      const res3 = createMockRes();
      await verifyCode(req3, res3);
      assert.equal(res3.statusCode, 400);
      assert.equal(res3.body.message, "Invalid verification code");
    });

    it("R2: parallel attempts to checkRateLimit cannot exceed the limit", async () => {
      const { checkRateLimit } = await import("../src/lib/rateLimitHelper.js");
      const key = "parallel_test_key";
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          checkRateLimit(key, { maxAttempts: 5, windowMs: 60000, cooldownMs: 60000 })
        )
      );
      const allowedCount = results.filter((r) => r.allowed).length;
      assert.ok(allowedCount <= 5, `Expected at most 5 allowed attempts, got ${allowedCount}`);
    });
  });

  describe("POST /api/vendor/auth/logout", () => {
    it("clears vendor_session cookie", async () => {
      const req = {};
      const res = createMockRes();

      await vendorLogout(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.clearedCookie);
      assert.equal(res.clearedCookie.name, "vendor_session");
    });
  });
});
