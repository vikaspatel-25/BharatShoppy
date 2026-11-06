import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

describe("Security, Headers, CORS & Operations Tests (H8)", () => {
  let server;
  let baseUrl;
  let app;
  let isOriginAllowed;

  before(async () => {
    process.env.AUTH_SECRET = "test-security-signing-secret-12345";
    const appModule = await import("../src/app.js");
    app = appModule.default;
    isOriginAllowed = appModule.isOriginAllowed;

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

  describe("GET /api/health", () => {
    it("returns 200 status with ok health details and uptime", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.status, "ok");
      assert.ok(data.timestamp);
      assert.ok(data.database === "connected" || data.database === "disconnected");
      assert.ok(typeof data.uptime === "number");
    });
  });

  describe("Helmet Security Headers", () => {
    it("includes standard security headers from helmet in responses", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.ok(res.headers.get("x-dns-prefetch-control"));
    });
  });

  describe("CORS Origin Validation (isOriginAllowed)", () => {
    it("allows direct requests without Origin header", () => {
      assert.equal(isOriginAllowed(undefined), true);
      assert.equal(isOriginAllowed(null), true);
      assert.equal(isOriginAllowed(""), true);
    });

    it("allows official domain and wildcard subdomains on https", () => {
      assert.equal(isOriginAllowed("https://bharatshopy.com"), true);
      assert.equal(isOriginAllowed("https://vastra.bharatshopy.com"), true);
      assert.equal(isOriginAllowed("https://farmer-ramesh.bharatshopy.com"), true);
      assert.equal(isOriginAllowed("https://store.subdomain.bharatshopy.com"), true);
    });

    it("allows development localhost and lvh.me outside production", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        assert.equal(isOriginAllowed("http://localhost:5173"), true);
        assert.equal(isOriginAllowed("http://store.localhost:5173"), true);
        assert.equal(isOriginAllowed("http://store.lvh.me:5173"), true);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("rejects unauthorized external origins", () => {
      assert.equal(isOriginAllowed("https://malicious-site.com"), false);
      assert.equal(isOriginAllowed("http://phishing-bharatshopy.evil.com"), false);
      assert.equal(isOriginAllowed("https://random-tenant.vercel.app"), false);
      assert.equal(isOriginAllowed("http://notbharatshopy.com"), false);
    });
  });

  describe("CORS HTTP Handling on API Endpoints", () => {
    it("sets Access-Control-Allow-Origin for an allowed origin", async () => {
      const res = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        headers: {
          Origin: "https://bharatshopy.com",
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), "https://bharatshopy.com");
      assert.equal(res.headers.get("access-control-allow-credentials"), "true");
    });

    it("does NOT set Access-Control-Allow-Origin for an unauthorized origin", async () => {
      const res = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        headers: {
          Origin: "https://unauthorized-attacker.com",
        },
      });

      // Response must not grant CORS access to the rejected origin
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    });
  });
});
