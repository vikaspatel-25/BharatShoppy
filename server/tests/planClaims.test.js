import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultPlans } from "../src/data/mockData/subscriptionPlans.js";
import { dummyStores } from "../scripts/seedDummyProfiles.js";
import stores from "../src/data/mockData/stores.js";

describe("M6: Plan claims, badges, and dummy credentials verification", () => {
  it("ensures no subscription plan promises analytics, priority ranking, 24/7 support, or verified badges", () => {
    const prohibitedKeywords = [
      "analytics",
      "priority",
      "24/7",
      "verified",
      "ranking",
      "placement",
    ];

    for (const plan of defaultPlans) {
      assert.ok(plan.features && plan.features.length > 0, `Plan ${plan.planId} has features`);
      for (const feature of plan.features) {
        const lower = feature.toLowerCase();
        for (const word of prohibitedKeywords) {
          assert.strictEqual(
            lower.includes(word),
            false,
            `Plan ${plan.planId} contains prohibited claim "${word}" in feature: "${feature}"`
          );
        }
      }
    }
  });

  it("ensures default plans contain only deliverable limits and capabilities", () => {
    const starter = defaultPlans.find((p) => p.planId === "starter_free");
    const standard = defaultPlans.find((p) => p.planId === "yearly_standard");
    const pro = defaultPlans.find((p) => p.planId === "yearly_pro");

    assert.ok(starter, "starter_free plan exists");
    assert.ok(standard, "yearly_standard plan exists");
    assert.ok(pro, "yearly_pro plan exists");

    assert.deepStrictEqual(standard.features, [
      "50 catalog products / services",
      "High-resolution printable Counter QR Code",
      "Up to 8 photos per item",
      "Entity-specific metadata (Farm season / Specialist)",
      "Dedicated path & subdomain storefront",
    ]);

    assert.deepStrictEqual(pro.features, [
      "200 catalog products / services",
      "Up to 12 photos per item",
      "Custom Subdomain Branding (*.bharatshopy.com)",
      "Unlimited WhatsApp Enquiry Cart",
      "Bulk produce / B2B order enquiry mode",
    ]);
  });

  it("ensures dummyStores and mock stores do not contain made-up FSSAI, license, or GSTIN numbers", () => {
    for (const store of dummyStores) {
      if (store.metadata) {
        assert.strictEqual(store.metadata.fssaiLicense, undefined, `Store ${store._id} has fssaiLicense`);
        assert.strictEqual(store.metadata.licenseNumber, undefined, `Store ${store._id} has licenseNumber`);
        assert.strictEqual(store.metadata.gstin, undefined, `Store ${store._id} has gstin`);
      }
    }

    for (const store of stores) {
      if (store.metadata) {
        assert.strictEqual(store.metadata.fssaiLicense, undefined, `Store ${store._id} has fssaiLicense`);
        assert.strictEqual(store.metadata.licenseNumber, undefined, `Store ${store._id} has licenseNumber`);
        assert.strictEqual(store.metadata.gstin, undefined, `Store ${store._id} has gstin`);
      }
    }
  });
});
