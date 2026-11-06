import { describe, it } from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/routes.index.js";

describe("Server Route Stack Tests", () => {
  it("registers all expected API route paths and GET handlers", () => {
    assert.ok(router, "Router should be defined");
    assert.ok(Array.isArray(router.stack), "Router should have a stack array");

    const registeredRoutes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const expectedPaths = [
      "/searchLocations",
      "/products",
      "/products/:productId",
      "/stores",
      "/store/:storeId",
      "/shop/:storeId",
      "/stores/:storeId/products/search",
      "/search",
      "/tenant/resolve",
      "/vendor/store/:storeId",
      "/subscription/plans",
      "/vendor/store/:storeId/subscription",
      "/admin/subscription-requests",
    ];

    expectedPaths.forEach((expectedPath) => {
      const match = registeredRoutes.find((r) => r.path === expectedPath);
      assert.ok(match, `Route ${expectedPath} should be registered on the router`);
      assert.ok(match.methods.includes("get"), `Route ${expectedPath} should handle GET method`);
    });

    // Check mutating routes
    const vendorProductRoute = registeredRoutes.find(
      (r) => r.path === "/vendor/store/:storeId/products"
    );
    assert.ok(vendorProductRoute, "Should register vendor product creation route");
    assert.ok(vendorProductRoute.methods.includes("post"), "Should handle POST method");

    const subRequestRoute = registeredRoutes.find(
      (r) => r.path === "/vendor/store/:storeId/subscription-request"
    );
    assert.ok(subRequestRoute, "Should register subscription request route");
    assert.ok(subRequestRoute.methods.includes("post"), "Should handle POST method");
  });
});
