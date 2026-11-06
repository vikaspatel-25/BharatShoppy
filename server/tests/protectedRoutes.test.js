import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import router from "../src/routes/routes.index.js";
import { signToken } from "../src/lib/tokenHelper.js";
import { setInMemoryVendor, resetInMemoryVendors } from "../src/controllers/vendorAuthController.js";

describe("Protected Routes Table-Driven Access Control Tests (C1)", () => {
  const TEST_SECRET = "test-protected-routes-signing-secret-999";
  let server;
  let baseUrl;

  let adminCookie;
  let vendorStore0103Cookie;
  let vendorOtherStoreCookie;

  // Comprehensive table of all protected routes defined in routes.index.js
  const protectedRoutes = [
    // Admin subscription desk
    { method: "GET", path: "/admin/subscription-requests", role: "admin" },
    { method: "POST", path: "/admin/subscription-requests/req_test/verify", role: "admin" },
    { method: "POST", path: "/admin/store/store_0103/renew", role: "admin" },
    { method: "POST", path: "/admin/store/store_0103/discontinue", role: "admin" },

    // Vendor store routes
    { method: "GET", path: "/vendor/store/store_0103/subscription", role: "vendor", storeId: "store_0103" },
    { method: "POST", path: "/vendor/store/store_0103/subscription-request", role: "vendor", storeId: "store_0103" },
    { method: "GET", path: "/vendor/store/store_0103", role: "vendor", storeId: "store_0103" },
    { method: "PUT", path: "/vendor/store/store_0103", role: "vendor", storeId: "store_0103" },
    { method: "POST", path: "/vendor/store/store_0103/products", role: "vendor", storeId: "store_0103" },
    { method: "PUT", path: "/vendor/store/store_0103/products/prod_1", role: "vendor", storeId: "store_0103" },
    { method: "DELETE", path: "/vendor/store/store_0103/products/prod_1", role: "vendor", storeId: "store_0103" },
  ];

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;

    setInMemoryVendor({
      _id: "vendor_1",
      email: "vendor1@bharatshopy.com",
      storeId: "store_0103",
      status: "approved",
    });

    setInMemoryVendor({
      _id: "vendor_other",
      email: "other@bharatshopy.com",
      storeId: "store_farmer_01",
      status: "approved",
    });

    const adminToken = signToken(
      { adminId: "admin_1", email: "admin@bharatshopy.com", role: "admin" },
      TEST_SECRET,
      3600
    );
    adminCookie = `admin_session=${adminToken}`;

    const vendor0103Token = signToken(
      {
        vendorId: "vendor_1",
        email: "vendor1@bharatshopy.com",
        storeId: "store_0103",
        status: "approved",
        role: "vendor",
      },
      TEST_SECRET,
      3600
    );
    vendorStore0103Cookie = `vendor_session=${vendor0103Token}`;

    const vendorOtherToken = signToken(
      {
        vendorId: "vendor_other",
        email: "other@bharatshopy.com",
        storeId: "store_farmer_01",
        status: "approved",
        role: "vendor",
      },
      TEST_SECRET,
      3600
    );
    vendorOtherStoreCookie = `vendor_session=${vendorOtherToken}`;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", router);

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    resetInMemoryVendors();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("keeps /api/subscription/plans publicly accessible without authentication", async () => {
    const res = await fetch(`${baseUrl}/subscription/plans`);
    assert.equal(res.status, 200, "Public plans route must remain accessible");
  });

  for (const route of protectedRoutes) {
    describe(`${route.method} ${route.path}`, () => {
      it("rejects request with no cookie (401)", async () => {
        const res = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: { "Content-Type": "application/json" },
          body: ["POST", "PUT"].includes(route.method) ? JSON.stringify({}) : undefined,
        });

        assert.equal(
          res.status,
          401,
          `Expected 401 for unauthenticated request to ${route.path}`
        );
      });

      it("rejects request with wrong role cookie (401 or 403)", async () => {
        const wrongCookie =
          route.role === "admin" ? vendorStore0103Cookie : adminCookie;

        const res = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: {
            Cookie: wrongCookie,
            "Content-Type": "application/json",
          },
          body: ["POST", "PUT"].includes(route.method) ? JSON.stringify({}) : undefined,
        });

        assert.ok(
          [401, 403].includes(res.status),
          `Expected 401 or 403 for wrong role on ${route.path}, got ${res.status}`
        );
      });

      if (route.role === "vendor") {
        it("rejects vendor requesting another vendor's store with 403", async () => {
          const res = await fetch(`${baseUrl}${route.path}`, {
            method: route.method,
            headers: {
              Cookie: vendorOtherStoreCookie,
              "Content-Type": "application/json",
            },
            body: ["POST", "PUT"].includes(route.method) ? JSON.stringify({}) : undefined,
          });

          assert.equal(
            res.status,
            403,
            `Expected 403 when vendor requests another vendor's store on ${route.path}`
          );
        });
      }
    });
  }
});
