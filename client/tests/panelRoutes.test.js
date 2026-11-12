import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_NAV,
  VENDOR_NAV,
  getPanelRoutes,
  getPanelTitle,
  isPanelPath,
  findPanelPage,
} from "../src/routes/panelRoutes.js";
import { getTenantSubdomain } from "../src/lib/domainUtils.js";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoutesSrc = fs.readFileSync(path.join(clientRoot, "src/routes/AppRoutes.jsx"), "utf8");

describe("P5: panel route table", () => {
  it("a tenant host serves the vendor portal and vendor sign-in, and no admin page", () => {
    assert.ok(getTenantSubdomain("asha.bharatshopy.com"));
    const routes = getPanelRoutes({ tenant: true });
    assert.ok(routes.vendor.includes("/vendor"));
    assert.ok(routes.vendor.includes("/vendor/items/:productId"));
    assert.deepEqual(routes.admin, []);
    assert.deepEqual(routes.auth, ["/vendor/login"]);
  });

  it("the marketplace host serves both panels and all sign-in pages", () => {
    assert.equal(getTenantSubdomain("www.bharatshopy.com"), null);
    const routes = getPanelRoutes({ tenant: false });
    assert.ok(routes.vendor.includes("/vendor/plan"));
    assert.ok(routes.admin.includes("/admin/vendors"));
    assert.ok(routes.admin.includes("/admin/audit-log"));
    assert.deepEqual(routes.auth.sort(), ["/admin/login", "/vendor/apply", "/vendor/login"]);
  });

  it("every sidebar link is a served route", () => {
    const { vendor, admin } = getPanelRoutes({ tenant: false });
    for (const item of VENDOR_NAV.flatMap((g) => g.items)) assert.ok(vendor.includes(item.to), item.to);
    for (const item of ADMIN_NAV.flatMap((g) => g.items)) assert.ok(admin.includes(item.to), item.to);
  });

  it("every served panel path is declared in AppRoutes.jsx", () => {
    const { vendor, admin, auth } = getPanelRoutes({ tenant: false });
    for (const p of [...vendor, ...admin, ...auth]) {
      assert.ok(appRoutesSrc.includes(`path="${p}"`), `AppRoutes.jsx has no route for ${p}`);
    }
  });

  it("the tenant branch of AppRoutes declares no admin route", () => {
    const tenantBranch = appRoutesSrc.slice(appRoutesSrc.indexOf("if (tenantSubdomain)"), appRoutesSrc.indexOf("// Marketplace host"));
    assert.ok(tenantBranch.length > 0);
    assert.ok(!/path="\/admin/.test(tenantBranch), "tenant routes must not include /admin");
    assert.ok(tenantBranch.includes("vendorRoutes()"), "tenant routes include the vendor portal");
  });

  it("the old /admin/:storeId route is gone", () => {
    assert.ok(!appRoutesSrc.includes('path="/admin/:storeId"'));
  });

  it("hides the marketplace header on panel and sign-in pages only", () => {
    for (const p of ["/vendor", "/vendor/items/abc", "/vendor/login", "/admin", "/admin/vendors", "/admin/login", "/manage"]) {
      assert.equal(isPanelPath(p), true, p);
    }
    for (const p of ["/", "/home", "/search", "/store/asha", "/shop/asha", "/product/p1", "/vendors", "/administrator"]) {
      assert.equal(isPanelPath(p), false, p);
    }
  });

  it("titles each page from the navigation", () => {
    assert.equal(getPanelTitle("/vendor/items"), "Items · Vendor portal | BharatShopy");
    assert.equal(getPanelTitle("/vendor/items/prod_123"), "Edit item · Vendor portal | BharatShopy");
    assert.equal(getPanelTitle("/admin/vendors/"), "Vendor directory · Admin | BharatShopy");
    assert.equal(getPanelTitle("/admin/login"), "Admin sign in | BharatShopy");
    assert.equal(findPanelPage("/vendor/items/new").label, "Add item");
  });
});
