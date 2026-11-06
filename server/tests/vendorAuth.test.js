import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  requestOtp,
  verifyOtp,
  vendorLogout,
  setInMemoryVendor,
  resetInMemoryVendors,
} from "../src/controllers/vendorAuthController.js";
import {
  requireVendor,
  requireStoreOwner,
  resolveStoreByIdentifier,
} from "../src/middleware/authMiddleware.js";
import { normalizePhoneNumber } from "../src/lib/phoneHelper.js";
import {
  setSMSProvider,
  resetSMSProvider,
  ProductionSMSProvider,
  DevelopmentSMSProvider,
} from "../src/services/smsProvider.js";
import { signToken, verifyToken, hashString } from "../src/lib/tokenHelper.js";

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

describe("Vendor Phone OTP Authentication (A2) Unit Tests", () => {
  const TEST_SECRET = "test-vendor-signing-secret-unit-tests-12345";
  const TEST_PHONE = "+919876543210";
  const STORE_ID = "store_0103";
  let sentOtp = null;

  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    resetInMemoryVendors();
    resetSMSProvider();

    sentOtp = null;
    setSMSProvider({
      async sendOTP(phone, otp) {
        sentOtp = otp;
        return { success: true };
      },
    });

    setInMemoryVendor({
      _id: "vendor_1",
      phone: TEST_PHONE,
      storeId: STORE_ID,
      status: "approved",
    });
  });

  describe("Phone Normalization to E.164", () => {
    it("normalizes 10-digit Indian numbers to E.164 format with +91", () => {
      assert.equal(normalizePhoneNumber("9876543210"), "+919876543210");
      assert.equal(normalizePhoneNumber("09876543210"), "+919876543210");
      assert.equal(normalizePhoneNumber(" 98765-43210 "), "+919876543210");
    });

    it("preserves valid international E.164 numbers", () => {
      assert.equal(normalizePhoneNumber("+919876543210"), "+919876543210");
      assert.equal(normalizePhoneNumber("+14155552671"), "+14155552671");
    });

    it("rejects invalid phone formats", () => {
      assert.throws(() => normalizePhoneNumber("abc"), /Invalid phone/);
      assert.throws(() => normalizePhoneNumber("12345"), /Invalid phone/);
    });
  });

  describe("SMS Provider Fail-Closed Behavior", () => {
    it("development provider logs and succeeds", async () => {
      const dev = new DevelopmentSMSProvider();
      const res = await dev.sendOTP(TEST_PHONE, "123456");
      assert.equal(res.success, true);
    });

    it("production provider fails closed when unconfigured", async () => {
      const prod = new ProductionSMSProvider({});
      await assert.rejects(
        async () => prod.sendOTP(TEST_PHONE, "123456"),
        /Production SMS provider is unconfigured/
      );
    });
  });

  describe("POST /api/vendor/auth/request-otp", () => {
    it("successfully requests OTP for registered vendor and sends 6-digit code", async () => {
      const req = { body: { phone: "9876543210" }, ip: "192.168.1.1", headers: {} };
      const res = createMockRes();

      await requestOtp(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(sentOtp, "Should have sent OTP code");
      assert.equal(sentOtp.length, 6);
    });

    it("returns 404 for unknown phone number", async () => {
      const req = { body: { phone: "9999999999" }, ip: "192.168.1.1", headers: {} };
      const res = createMockRes();

      await requestOtp(req, res);

      assert.equal(res.statusCode, 404);
    });

    it("returns 403 for removed vendor", async () => {
      setInMemoryVendor({
        _id: "vendor_removed",
        phone: "+919111111111",
        storeId: "store_removed",
        status: "removed",
      });

      const req = { body: { phone: "+919111111111" }, ip: "192.168.1.1", headers: {} };
      const res = createMockRes();

      await requestOtp(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /removed/i);
    });

    it("enforces cooldown rate limiting per phone", async () => {
      const req = { body: { phone: "9876543210" }, ip: "192.168.1.2", headers: {} };
      const res1 = createMockRes();
      await requestOtp(req, res1);
      assert.equal(res1.statusCode, 200);

      // Immediate second request within 30 seconds
      const res2 = createMockRes();
      await requestOtp(req, res2);
      assert.equal(res2.statusCode, 429);
      assert.match(res2.body.message, /wait 30 seconds/i);
    });
  });

  describe("POST /api/vendor/auth/verify-otp", () => {
    it("successfully verifies OTP, clears code, and sets vendor_session cookie", async () => {
      // Step 1: Request OTP
      const req1 = { body: { phone: TEST_PHONE }, ip: "192.168.1.3", headers: {} };
      const res1 = createMockRes();
      await requestOtp(req1, res1);

      const code = sentOtp;

      // Step 2: Verify OTP
      const req2 = { body: { phone: TEST_PHONE, otp: code } };
      const res2 = createMockRes();
      await verifyOtp(req2, res2);

      assert.equal(res2.statusCode, 200);
      assert.equal(res2.body.success, true);
      assert.equal(res2.body.vendor.phone, TEST_PHONE);
      assert.equal(res2.body.vendor.storeId, STORE_ID);

      // Verify separate cookie
      assert.ok(res2.cookies["vendor_session"]);
      const cookie = res2.cookies["vendor_session"];
      assert.equal(cookie.opts.httpOnly, true);
      assert.equal(cookie.opts.sameSite, "lax");

      const sessionPayload = verifyToken(cookie.val, TEST_SECRET);
      assert.equal(sessionPayload.role, "vendor");
      assert.equal(sessionPayload.phone, TEST_PHONE);
      assert.equal(sessionPayload.storeId, STORE_ID);

      // Code must be single-use: Reusing the same code fails
      const resReuse = createMockRes();
      await verifyOtp(req2, resReuse);
      assert.equal(resReuse.statusCode, 400);
      assert.match(resReuse.body.message, /already used|No active verification code/i);
    });

    it("rejects wrong code with 400", async () => {
      const req1 = { body: { phone: TEST_PHONE }, ip: "192.168.1.4", headers: {} };
      const res1 = createMockRes();
      await requestOtp(req1, res1);

      const req2 = { body: { phone: TEST_PHONE, otp: "000000" } };
      const res2 = createMockRes();
      await verifyOtp(req2, res2);

      assert.equal(res2.statusCode, 400);
      assert.match(res2.body.message, /Invalid verification code/i);
    });

    it("rejects expired OTP", async () => {
      setInMemoryVendor({
        _id: "vendor_1",
        phone: TEST_PHONE,
        storeId: STORE_ID,
        status: "approved",
        otpHash: hashString("123456"),
        otpExpiresAt: Date.now() - 1000, // Expired
        otpAttempts: 0,
      });

      const req = { body: { phone: TEST_PHONE, otp: "123456" } };
      const res = createMockRes();
      await verifyOtp(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /expired/i);
    });

    it("locks out code after too many failed attempts (attempt limits)", async () => {
      const req1 = { body: { phone: TEST_PHONE }, ip: "192.168.1.5", headers: {} };
      const res1 = createMockRes();
      await requestOtp(req1, res1);

      for (let i = 0; i < 5; i++) {
        const verifyReq = { body: { phone: TEST_PHONE, otp: "000000" } };
        const verifyRes = createMockRes();
        await verifyOtp(verifyReq, verifyRes);
        assert.equal(verifyRes.statusCode, 400);
      }

      // 6th attempt should be rejected with 429
      const verifyReq = { body: { phone: TEST_PHONE, otp: sentOtp } };
      const verifyRes = createMockRes();
      await verifyOtp(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 429);
      assert.match(verifyRes.body.message, /Too many failed attempts/i);
    });
  });

  describe("Vendor Store Access & Ownership Enforcement", () => {
    it("allows approved vendor access to their own store (requireStoreOwner)", async () => {
      const token = signToken(
        {
          vendorId: "vendor_1",
          phone: TEST_PHONE,
          storeId: "store_0103",
          status: "approved",
          role: "vendor",
        },
        TEST_SECRET
      );

      const req = {
        cookies: { vendor_session: token },
        params: { storeId: "store_0103" },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireStoreOwner(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.ok(req.store);
      assert.equal(req.store._id, "store_0103");
    });

    it("resolves store by slug or subdomain in requireStoreOwner", async () => {
      const token = signToken(
        {
          vendorId: "vendor_farmer",
          phone: "+919876543211",
          storeId: "store_farmer_01",
          status: "approved",
          role: "vendor",
        },
        TEST_SECRET
      );

      // Resolving by slug
      const req = {
        cookies: { vendor_session: token },
        params: { storeId: "kisan-organics" },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireStoreOwner(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.store._id, "store_farmer_01");
    });

    it("rejects unapproved vendor with 403", async () => {
      const token = signToken(
        {
          vendorId: "vendor_pending",
          phone: "+919876543299",
          storeId: "store_0103",
          status: "pending", // Unapproved!
          role: "vendor",
        },
        TEST_SECRET
      );

      const req = {
        cookies: { vendor_session: token },
        params: { storeId: "store_0103" },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireStoreOwner(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /not approved/i);
    });

    it("rejects vendor requesting another vendor's store with 403", async () => {
      const token = signToken(
        {
          vendorId: "vendor_1",
          phone: TEST_PHONE,
          storeId: "store_0103", // Vendor owns store_0103
          status: "approved",
          role: "vendor",
        },
        TEST_SECRET
      );

      // Attempting to access store_farmer_01
      const req = {
        cookies: { vendor_session: token },
        params: { storeId: "store_farmer_01" },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireStoreOwner(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Forbidden.*ownership/i);
    });

    it("returns 404 for nonexistent store in requireStoreOwner", async () => {
      const token = signToken(
        {
          vendorId: "vendor_1",
          phone: TEST_PHONE,
          storeId: "store_nonexistent",
          status: "approved",
          role: "vendor",
        },
        TEST_SECRET
      );

      const req = {
        cookies: { vendor_session: token },
        params: { storeId: "store_nonexistent" },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireStoreOwner(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 404);
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
