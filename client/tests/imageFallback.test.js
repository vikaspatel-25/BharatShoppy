import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getProductFallbackImage,
  getStoreFallbackLogo,
  PLACEHOLDERS,
} from "../src/lib/imageFallback.js";

describe("Image Fallback Engine Tests", () => {
  it("returns farmer SVG placeholder for farmer entity or organic categories", () => {
    assert.equal(getProductFallbackImage("farmer"), PLACEHOLDERS.farmer);
    assert.equal(
      getProductFallbackImage("unknown", "Certified Organic Wheat"),
      PLACEHOLDERS.farmer
    );
    assert.equal(
      getProductFallbackImage(undefined, "Farm Fresh Vegetables"),
      PLACEHOLDERS.farmer
    );
  });

  it("returns service provider SVG placeholder for service entity or repair categories", () => {
    assert.equal(
      getProductFallbackImage("service_provider"),
      PLACEHOLDERS.service_provider
    );
    assert.equal(
      getProductFallbackImage("unknown", "AC Maintenance & Repair"),
      PLACEHOLDERS.service_provider
    );
    assert.equal(
      getProductFallbackImage(undefined, "Electrical Consultation"),
      PLACEHOLDERS.service_provider
    );
  });

  it("returns boutique retail SVG placeholder for shopkeeper or apparel categories", () => {
    assert.equal(getProductFallbackImage("shopkeeper"), PLACEHOLDERS.shopkeeper);
    assert.equal(
      getProductFallbackImage("unknown", "Apparel & Fashion"),
      PLACEHOLDERS.shopkeeper
    );
    assert.equal(
      getProductFallbackImage(undefined, "Ethnic Silk Boutique"),
      PLACEHOLDERS.shopkeeper
    );
  });

  it("returns default fallback for generic uncategorized items", () => {
    assert.equal(
      getProductFallbackImage("other", "General Items"),
      PLACEHOLDERS.productDefault
    );
  });

  it("returns clean SVG logo for store fallback", () => {
    assert.equal(getStoreFallbackLogo("farmer"), PLACEHOLDERS.storeLogo);
    assert.equal(getStoreFallbackLogo("shopkeeper"), PLACEHOLDERS.storeLogo);
  });
});
