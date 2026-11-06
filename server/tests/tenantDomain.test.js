import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractSubdomain } from "../src/lib/domainHelper.js";

describe("Subdomain Extraction & Domain Helper Tests", () => {
  it("extracts clean tenant subdomain from production wildcard domain", () => {
    assert.equal(
      extractSubdomain("vastra-heritage.bharatshopee.com"),
      "vastra-heritage"
    );
    assert.equal(
      extractSubdomain("earthly-harvest.bharatshopee.com:443"),
      "earthly-harvest"
    );
  });

  it("extracts tenant subdomain from localhost development domain", () => {
    assert.equal(extractSubdomain("my-farm.localhost:5173"), "my-farm");
    assert.equal(extractSubdomain("artisan-tailor.localhost"), "artisan-tailor");
  });

  it("extracts tenant subdomain from lvh.me wildcard domain", () => {
    assert.equal(extractSubdomain("farmer-ramesh.lvh.me:5173"), "farmer-ramesh");
  });

  it("returns null for reserved subdomains like www, api, app, admin", () => {
    assert.equal(extractSubdomain("www.bharatshopee.com"), null);
    assert.equal(extractSubdomain("api.bharatshopee.com"), null);
    assert.equal(extractSubdomain("admin.bharatshopee.com"), null);
  });

  it("returns null for bare domains, IP addresses, or localhost without subdomain", () => {
    assert.equal(extractSubdomain("bharatshopee.com"), null);
    assert.equal(extractSubdomain("localhost"), null);
    assert.equal(extractSubdomain("localhost:5173"), null);
    assert.equal(extractSubdomain("127.0.0.1:5173"), null);
    assert.equal(extractSubdomain(""), null);
    assert.equal(extractSubdomain(null), null);
  });
});
