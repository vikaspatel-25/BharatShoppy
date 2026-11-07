import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTenantSubdomain,
  getTenantStoreUrl,
} from "../src/lib/domainUtils.js";
import { getEntityConfig } from "../src/lib/entityTypes.js";

describe("Multi-Tenant Domain & Subdomain Routing Tests", () => {
  it("extracts subdomain from production wildcard hostnames", () => {
    assert.equal(
      getTenantSubdomain("vastra-heritage.bharatshopy.com"),
      "vastra-heritage"
    );
    assert.equal(
      getTenantSubdomain("greenvalley-organics.bharatshopy.com"),
      "greenvalley-organics"
    );
  });

  it("extracts subdomain from development localhost and lvh.me hostnames", () => {
    assert.equal(getTenantSubdomain("my-farm.localhost"), "my-farm");
    assert.equal(getTenantSubdomain("artisan-tailor.localhost:5173"), "artisan-tailor");
    assert.equal(getTenantSubdomain("produce.lvh.me:5173"), "produce");
  });

  it("ignores reserved subdomains like www, app, api, admin", () => {
    assert.equal(getTenantSubdomain("www.bharatshopy.com"), null);
    assert.equal(getTenantSubdomain("api.bharatshopy.com"), null);
    assert.equal(getTenantSubdomain("app.bharatshopy.com"), null);
    assert.equal(getTenantSubdomain("admin.bharatshopy.com"), null);
  });

  it("returns null for bare domains without subdomains", () => {
    assert.equal(getTenantSubdomain("bharatshopy.com"), null);
    assert.equal(getTenantSubdomain("localhost"), null);
    assert.equal(getTenantSubdomain("127.0.0.1"), null);
    assert.equal(getTenantSubdomain(""), null);
  });

  it("builds correct canonical tenant store URL", () => {
    const store = {
      _id: "store_0103",
      storeName: "Vastra Heritage",
      subdomain: "vastra-heritage",
    };
    const url = getTenantStoreUrl(store);
    assert.ok(url.includes("vastra-heritage"), "Store URL should contain tenant subdomain");
  });

  it("H3: correctly isolates known tenant base domains vs platform hosts", () => {
    // Tenant on base domain
    assert.equal(getTenantSubdomain("vastra.bharatshopy.com"), "vastra");
    // Reserved / bare domains (none)
    assert.equal(getTenantSubdomain("www.bharatshopy.com"), null);
    assert.equal(getTenantSubdomain("bharatshopy.com"), null);
    // Platform hosts such as Vercel (none - treated as marketplace)
    assert.equal(getTenantSubdomain("bharat-shoppy-client.vercel.app"), null);
    assert.equal(getTenantSubdomain("tenant.vercel.app"), null);
    assert.equal(getTenantSubdomain("otherplatform.com"), null);
  });
});

describe("Entity Types & Metadata Config Tests", () => {
  it("returns appropriate badge and attributes for farmer entity type", () => {
    const config = getEntityConfig("farmer");
    assert.equal(config.id, "farmer");
    assert.equal(config.badgeLabel, "Direct from Farm");
    assert.equal(config.defaultUnit, "kg");
  });

  it("returns appropriate badge and attributes for service provider entity type", () => {
    const config = getEntityConfig("service_provider");
    assert.equal(config.id, "service_provider");
    assert.equal(config.badgeLabel, "Verified Specialist");
    assert.equal(config.defaultUnit, "service");
  });

  it("returns appropriate badge and attributes for shopkeeper entity type", () => {
    const config = getEntityConfig("shopkeeper");
    assert.equal(config.id, "shopkeeper");
    assert.equal(config.badgeLabel, "Verified Store");
    assert.equal(config.defaultUnit, "piece");
  });

  it("infers farmer entity from organic or farm categories", () => {
    const config = getEntityConfig("Groceries & Organics");
    assert.equal(config.id, "farmer");
  });

  it("infers service provider from repair or services categories", () => {
    const config = getEntityConfig("Electronic Repair Services");
    assert.equal(config.id, "service_provider");
  });
});
