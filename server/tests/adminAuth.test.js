import test, { describe, it, beforeEach, afterEach } from "node:test";
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
  sendAdminLoginCode,
  sendVendorLoginCode,
  sendEmail,
  setTestTransport,
  resetTestTransport,
} from "../src/services/emailService.js";

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

describe("Admin Authentication & Email Service Unit Tests (A1 & R1)", () => {
  const TEST_SECRET = "test-admin-secret-for-signing-unit-tests-12345";
  const ADMIN_EMAIL = "admin@bharatshopy.com";
  const ADMIN_PASS = "SuperSecureAdminPassword123!";
  let passwordHash;
  let sentMails = [];

  beforeEach(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    resetInMemoryAdmins();
    resetTestTransport();
    sentMails = [];

    // Setup fake test transport for emailService
    setTestTransport({
      async sendMail(mailOptions) {
        sentMails.push(mailOptions);
        return { messageId: "fake-msg-id-123" };
      },
    });

    passwordHash = await bcrypt.hash(ADMIN_PASS, 10);
    setInMemoryAdmin({
      _id: "admin_test_1",
      email: ADMIN_EMAIL,
      passwordHash,
    });
  });

  afterEach(() => {
    resetTestTransport();
  });

  describe("Signing Secret Requirement", () => {
    it("refuses to proceed without AUTH_SECRET in environment", () => {
      delete process.env.AUTH_SECRET;
      assert.throws(
        () => assertSigningSecret(),
        /AUTH_SECRET/i,
        "Should throw error when AUTH_SECRET is not configured"
      );
      process.env.AUTH_SECRET = TEST_SECRET;
    });

    it("accepts AUTH_SECRET when configured", () => {
      process.env.AUTH_SECRET = "configured-valid-secret";
      assert.doesNotThrow(() => assertSigningSecret());
      process.env.AUTH_SECRET = TEST_SECRET;
    });
  });

  describe("Email Service & Fake Transport Behavior", () => {
    it("sends email successfully through injected fake transport", async () => {
      const res = await sendAdminLoginCode(ADMIN_EMAIL, "654321");
      assert.equal(res.success, true);
      assert.equal(sentMails.length, 1);
      assert.equal(sentMails[0].to, ADMIN_EMAIL);
      assert.ok(sentMails[0].text.includes("654321"));
    });

    it("throws when email sending fails on transport", async () => {
      setTestTransport({
        async sendMail() {
          throw new Error("SMTP connection timeout");
        },
      });

      await assert.rejects(
        async () => {
          await sendAdminLoginCode(ADMIN_EMAIL, "112233");
        },
        /SMTP connection timeout/i
      );
    });

    it("throws in production when unconfigured without test transport", async () => {
      resetTestTransport();
      const origEnv = process.env.NODE_ENV;
      const origUser = process.env.GMAIL_USER;
      const origPass = process.env.GMAIL_APP_PASSWORD;

      process.env.NODE_ENV = "production";
      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;

      try {
        await assert.rejects(
          async () => {
            await sendEmail({
              to: "test@bharatshopy.com",
              subject: "Test",
              text: "Hello",
            });
          },
          /Production email service is unconfigured/i
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origUser) process.env.GMAIL_USER = origUser;
        if (origPass) process.env.GMAIL_APP_PASSWORD = origPass;
      }
    });
  });

  describe("POST /api/admin/auth/login", () => {
    it("rejects non-string email or password with 400", async () => {
      const req1 = { body: { email: 12345, password: ADMIN_PASS } };
      const res1 = createMockRes();
      await adminLogin(req1, res1);
      assert.equal(res1.statusCode, 400);

      const req2 = { body: { email: ADMIN_EMAIL, password: { nested: true } } };
      const res2 = createMockRes();
      await adminLogin(req2, res2);
      assert.equal(res2.statusCode, 400);

      const req3 = { body: { email: null, password: ADMIN_PASS } };
      const res3 = createMockRes();
      await adminLogin(req3, res3);
      assert.equal(res3.statusCode, 400);
    });

    it("handles correct email and password: sends 6-digit code and returns tempToken", async () => {
      const req = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const res = createMockRes();

      await adminLogin(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.tempToken, "Must return pre-auth tempToken");
      assert.equal(sentMails.length, 1);
      assert.ok(sentMails[0].text.match(/\b\d{6}\b/));
    });

    it("rejects wrong password with 401", async () => {
      const req = { body: { email: ADMIN_EMAIL, password: "WrongPassword" } };
      const res = createMockRes();

      await adminLogin(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(sentMails.length, 0, "Should not send code on wrong password");
    });

    it("rejects unknown admin email with 401", async () => {
      const req = { body: { email: "unknown@bharatshopy.com", password: ADMIN_PASS } };
      const res = createMockRes();

      await adminLogin(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(sentMails.length, 0);
    });
  });

  describe("POST /api/admin/auth/verify", () => {
    it("rejects non-string tempToken or code with 400", async () => {
      const req1 = { body: { tempToken: 9999, code: "123456" } };
      const res1 = createMockRes();
      await adminVerify(req1, res1);
      assert.equal(res1.statusCode, 400);

      const req2 = { body: { tempToken: "some-token", code: 123456 } };
      const res2 = createMockRes();
      await adminVerify(req2, res2);
      assert.equal(res2.statusCode, 400);
    });

    it("rejects verify call without password step (missing tempToken)", async () => {
      const req = { body: { code: "123456" } };
      const res = createMockRes();

      await adminVerify(req, res);

      assert.equal(res.statusCode, 400);
    });

    it("rejects verify call with invalid or tampered tempToken", async () => {
      const req = { body: { tempToken: "invalid-token-string", code: "123456" } };
      const res = createMockRes();

      await adminVerify(req, res);

      assert.equal(res.statusCode, 401);
    });

    it("successfully verifies correct code, sets 1-hour session cookie, and clears code (single-use)", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);

      const tempToken = loginRes.body.tempToken;
      const codeMatch = sentMails[0].text.match(/\b\d{6}\b/);
      const code = codeMatch[0];

      const verifyReq = { body: { tempToken, code } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 200);
      assert.equal(verifyRes.body.success, true);
      assert.ok(verifyRes.cookies.admin_session, "Should set admin_session cookie");
      assert.equal(verifyRes.cookies.admin_session.opts.httpOnly, true);

      // Re-using the same tempToken must now fail (single use)
      const reuseRes = createMockRes();
      await adminVerify(verifyReq, reuseRes);
      assert.equal(reuseRes.statusCode, 400);
    });

    it("rejects older tempToken when a new login has occurred (tempToken bound to loginNonce without codeHash)", async () => {
      // First login
      const loginReq1 = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes1 = createMockRes();
      await adminLogin(loginReq1, loginRes1);
      const tempToken1 = loginRes1.body.tempToken;
      const code1 = sentMails[0].text.match(/\b\d{6}\b/)[0];

      // Verify tempToken payload contains no codeHash or code-derived value
      const decoded = verifyToken(tempToken1);
      assert.equal(decoded.codeHash, undefined, "tempToken payload must not contain codeHash");
      assert.ok(decoded.loginNonce, "tempToken payload must contain random loginNonce");

      // Second login creates new code and new nonce
      const loginReq2 = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes2 = createMockRes();
      await adminLogin(loginReq2, loginRes2);
      const tempToken2 = loginRes2.body.tempToken;
      const code2 = sentMails[1].text.match(/\b\d{6}\b/)[0];

      // Verifying with older tempToken1 must be rejected even with code1
      const verifyResOld = createMockRes();
      await adminVerify({ body: { tempToken: tempToken1, code: code1 } }, verifyResOld);
      assert.equal(verifyResOld.statusCode, 400);
      assert.ok(verifyResOld.body.message.includes("superseded"));

      // Verifying with new tempToken2 must succeed
      const verifyResNew = createMockRes();
      await adminVerify({ body: { tempToken: tempToken2, code: code2 } }, verifyResNew);
      assert.equal(verifyResNew.statusCode, 200);
    });

    it("rejects wrong verification code with 400", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);

      const verifyReq = { body: { tempToken: loginRes.body.tempToken, code: "000000" } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 400);
      assert.ok(verifyRes.body.message.includes("Invalid verification code"));
    });

    it("rejects expired verification code", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);

      const tempToken = loginRes.body.tempToken;
      const code = sentMails[0].text.match(/\b\d{6}\b/)[0];

      // Manually simulate expiration
      const decodedTemp = verifyToken(tempToken);
      setInMemoryAdmin({
        _id: "admin_test_1",
        email: ADMIN_EMAIL,
        passwordHash,
        loginNonce: decodedTemp.loginNonce,
        verificationCodeHash: hashString(code),
        codeExpiresAt: Date.now() - 1000,
      });

      const verifyReq = { body: { tempToken, code } };
      const verifyRes = createMockRes();
      await adminVerify(verifyReq, verifyRes);

      assert.equal(verifyRes.statusCode, 400);
      assert.ok(verifyRes.body.message.includes("expired"));
    });

    it("enforces attempt limit (locks out after too many failed attempts)", async () => {
      const loginReq = { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } };
      const loginRes = createMockRes();
      await adminLogin(loginReq, loginRes);

      const tempToken = loginRes.body.tempToken;

      for (let i = 0; i < 5; i++) {
        const verifyRes = createMockRes();
        await adminVerify({ body: { tempToken, code: "999999" } }, verifyRes);
        assert.equal(verifyRes.statusCode, 400);
      }

      // 6th attempt should lock out
      const lockedRes = createMockRes();
      await adminVerify({ body: { tempToken, code: "999999" } }, lockedRes);
      assert.equal(lockedRes.statusCode, 429);
    });
  });

  describe("POST /api/admin/auth/logout", () => {
    it("clears the session cookie", async () => {
      const req = {};
      const res = createMockRes();

      await adminLogout(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.clearedCookie, "Should invoke clearCookie");
      assert.equal(res.clearedCookie.name, "admin_session");
    });
  });

  describe("requireAdmin Middleware", () => {
    it("allows request with valid admin_session cookie and renews cookie", (t, done) => {
      const token = signToken(
        { adminId: "admin_test_1", email: ADMIN_EMAIL, role: "admin" },
        TEST_SECRET,
        1800
      );

      const req = { cookies: { admin_session: token } };
      const res = createMockRes();

      requireAdmin(req, res, () => {
        assert.equal(req.admin.role, "admin");
        assert.ok(res.cookies.admin_session, "Should renew cookie");
        done();
      });
    });

    it("rejects request missing session cookie with 401", () => {
      const req = { cookies: {} };
      const res = createMockRes();

      requireAdmin(req, res, () => {
        assert.fail("Should not call next()");
      });

      assert.equal(res.statusCode, 401);
    });

    it("rejects session with non-admin role with 403", () => {
      const token = signToken(
        { adminId: "user_1", email: "user@test.com", role: "vendor" },
        TEST_SECRET,
        1800
      );

      const req = { cookies: { admin_session: token } };
      const res = createMockRes();

      requireAdmin(req, res, () => {
        assert.fail("Should not call next()");
      });

      assert.equal(res.statusCode, 403);
    });
  });
});
