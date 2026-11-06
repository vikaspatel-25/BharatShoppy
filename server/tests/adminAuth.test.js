import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  adminLogin,
  adminVerify,
  adminLogout,
  setInMemoryAdmin,
  resetInMemoryAdmins,
} from "../src/controllers/adminAuthController.js";
import { requireAdmin } from "../src/middleware/authMiddleware.js";
import {
  assertSigningSecret,
  signToken,
  verifyToken,
  hashString,
} from "../src/lib/tokenHelper.js";
import {
  setEmailProvider,
  resetEmailProvider,
  ProductionEmailProvider,
  DevelopmentEmailProvider,
  getEmailProvider,
} from "../src/services/emailProvider.js";

// Mock response creator
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

describe("Admin Authentication (A1) Unit Tests", () => {
  const TEST_SECRET = "test-admin-secret-for-signing-unit-tests-12345";
  const ADMIN_EMAIL = "admin@bharatshopy.com";
  const ADMIN_PASS = "SuperSecureAdminPassword123!";
  let passwordHash;
  let sentEmailCode = null;

  beforeEach(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    resetInMemoryAdmins();
    resetEmailProvider();

    // Mock email provider to capture 6-digit code
    sentEmailCode = null;
    setEmailProvider({
      async sendAdminVerificationCode(email, code) {
        sentEmailCode = code;
        return { success: true };
      },
    });

    passwordHash = await bcrypt.hash(ADMIN_PASS, 10);
    setInMemoryAdmin({
      _id: "admin_test_1",
      email: ADMIN_EMAIL,
      passwordHash,
    });
  });

  describe("Signing Secret Requirement", () => {
    it("refuses to proceed without AUTH_SECRET in environment", () => {
      assert.throws(
        () => assertSigningSecret({}),
        /Missing required signing secret: AUTH_SECRET/
      );
    });

    it("accepts AUTH_SECRET when configured", () => {
      const secret = assertSigningSecret({ AUTH_SECRET: "my-secret" });
      assert.equal(secret, "my-secret");
    });
  });

  describe("Email Provider Fail-Closed Behavior", () => {
    it("development email provider logs and succeeds", async () => {
      const devProvider = new DevelopmentEmailProvider();
      const res = await devProvider.sendAdminVerificationCode("test@test.com", "123456");
      assert.equal(res.success, true);
    });

    it("production email provider fails closed when API key is missing", async () => {
      const prodProvider = new ProductionEmailProvider({});
      await assert.rejects(
        async () => prodProvider.sendAdminVerificationCode("test@test.com", "123456"),
        /Production email provider is unconfigured/
      );
    });
  });

  describe("POST /api/admin/auth/login", () => {
    it("handles correct email and password: sends 6-digit code and returns tempToken", async () => {
      const req = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const res = createMockRes();

      await adminLogin(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.tempToken, "Must return short-lived tempToken");
      assert.ok(sentEmailCode, "Must have dispatched a 6-digit code to email");
      assert.equal(sentEmailCode.length, 6);

      // Verify tempToken structure
      const payload = verifyToken(res.body.tempToken, TEST_SECRET);
      assert.equal(payload.adminId, "admin_test_1");
      assert.equal(payload.step, "code_verification");
    });

    it("rejects wrong password with 401", async () => {
      const req = { body: { email: ADMIN_EMAIL, password: "wrong-password" } };
      const res = createMockRes();

      await adminLogin(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(sentEmailCode, null);
    });

    it("rejects unknown admin email with 401", async () => {
      const req = { body: { email: "unknown@bharatshopy.com", password: ADMIN_PASS } };
      const res = createMockRes();

      await adminLogin(req, res);

      assert.equal(res.statusCode, 401);
    });
  });

  describe("POST /api/admin/auth/verify", () => {
    it("rejects verify call without password step (missing tempToken)", async () => {
      const req = { body: { code: "123456" } };
      const res = createMockRes();

      await adminVerify(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /pre-auth token/i);
    });

    it("rejects verify call with invalid or tampered tempToken", async () => {
      const req = { body: { tempToken: "invalid.jwt.token", code: "123456" } };
      const res = createMockRes();

      await adminVerify(req, res);

      assert.equal(res.statusCode, 401);
    });

    it("successfully verifies correct code, sets 1-hour session cookie, and clears code (single-use)", async () => {
      // Step 1: Login to get tempToken & code
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);

      const { tempToken } = loginRes.body;
      const validCode = sentEmailCode;

      // Step 2: Verify with correct code
      const verifyReq = { body: { tempToken, code: validCode } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 200);
      assert.equal(verifyRes.body.success, true);
      assert.equal(verifyRes.body.admin.email, ADMIN_EMAIL);
      assert.equal(verifyRes.body.admin.role, "admin");

      // Verify cookie
      assert.ok(verifyRes.cookies["admin_session"], "Must set admin_session cookie");
      const cookieData = verifyRes.cookies["admin_session"];
      assert.equal(cookieData.opts.httpOnly, true);
      assert.equal(cookieData.opts.sameSite, "lax");
      assert.equal(cookieData.opts.maxAge, 3600000);

      // Verify token inside cookie
      const sessionPayload = verifyToken(cookieData.val, TEST_SECRET);
      assert.equal(sessionPayload.role, "admin");
      assert.equal(sessionPayload.email, ADMIN_EMAIL);

      // Verify code is single-use: reusing same code fails
      const reuseRes = createMockRes();
      await adminVerify(verifyReq, reuseRes);
      assert.equal(reuseRes.statusCode, 400);
      assert.match(reuseRes.body.message, /already used|No active verification code/i);
    });

    it("rejects wrong verification code with 400", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);
      const { tempToken } = loginRes.body;

      const verifyReq = { body: { tempToken, code: "999999" } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 400);
      assert.match(verifyRes.body.message, /Invalid verification code/i);
    });

    it("rejects expired verification code", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);
      const { tempToken } = loginRes.body;

      // Manually set code expiration in past
      setInMemoryAdmin({
        _id: "admin_test_1",
        email: ADMIN_EMAIL,
        passwordHash,
        verificationCodeHash: hashString(sentEmailCode),
        codeExpiresAt: Date.now() - 1000, // expired
        codeAttempts: 0,
      });

      const verifyReq = { body: { tempToken, code: sentEmailCode } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 400);
      assert.match(verifyRes.body.message, /expired/i);
    });

    it("enforces attempt limit (locks out after too many failed attempts)", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);
      const { tempToken } = loginRes.body;

      // Fail 5 times
      for (let i = 0; i < 5; i++) {
        const verifyReq = { body: { tempToken, code: "000000" } };
        const verifyRes = createMockRes();
        await adminVerify(verifyReq, verifyRes);
        assert.equal(verifyRes.statusCode, 400);
      }

      // 6th attempt should be rejected with 429
      const verifyReq = { body: { tempToken, code: sentEmailCode } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 429);
      assert.match(verifyRes.body.message, /Too many failed/i);
    });
  });

  describe("POST /api/admin/auth/logout", () => {
    it("clears the session cookie", async () => {
      const req = {};
      const res = createMockRes();

      await adminLogout(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.clearedCookie);
      assert.equal(res.clearedCookie.name, "admin_session");
    });
  });

  describe("requireAdmin Middleware", () => {
    it("allows request with valid admin_session cookie and renews cookie", async () => {
      const token = signToken(
        { adminId: "admin_test_1", email: ADMIN_EMAIL, role: "admin" },
        TEST_SECRET,
        3600
      );

      const req = { cookies: { admin_session: token } };
      const res = createMockRes();
      let nextCalled = false;

      requireAdmin(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.admin.email, ADMIN_EMAIL);
      assert.equal(req.admin.role, "admin");
      assert.ok(res.cookies["admin_session"], "Session should be renewed");
    });

    it("rejects request missing session cookie with 401", async () => {
      const req = { cookies: {} };
      const res = createMockRes();
      let nextCalled = false;

      requireAdmin(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
    });

    it("rejects session with non-admin role with 403", async () => {
      const token = signToken(
        { adminId: "user_1", email: "user@test.com", role: "vendor" },
        TEST_SECRET,
        3600
      );

      const req = { cookies: { admin_session: token } };
      const res = createMockRes();
      let nextCalled = false;

      requireAdmin(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
    });
  });
});
